/**
 * Log Retention — Scheduled Cron Trigger
 *
 * Runs weekly (every Sunday at 03:00 UTC) via Cloudflare Cron Triggers.
 * Archives audit logs older than RETENTION_DAYS to Cloudflare R2 in NDJSON
 * format, then deletes the archived rows from D1.
 *
 * Why NDJSON?
 *   - One JSON object per line → trivially readable by any tool
 *   - Easily convertible to Parquet with DuckDB if analytics needed later
 *   - Streaming-friendly (no need to parse the whole file at once)
 *
 * R2 key structure:
 *   audit-logs/YYYY/MM/archive-<timestamp>-<batch>.ndjson
 *
 * D1 size management:
 *   Each batch deletes up to BATCH_SIZE rows. Loop runs until no more old rows.
 *   This prevents a single cron run from timing out on very large datasets.
 */

import { fetchOldLogBatch, deleteLogBatch } from '../services/auditLog';
import type { Env } from '../types';

const RETENTION_DAYS = 90;
const BATCH_SIZE = 500; // rows per R2 file + D1 delete batch

export async function runLogRetention(env: Env): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffIso = cutoff.toISOString();
  const runTimestamp = Date.now();

  console.log(`[LogRetention] Starting. Cutoff: ${cutoffIso}`);

  let batchNumber = 0;
  let totalArchived = 0;

  while (true) {
    // 1. Fetch a batch of old logs
    const batch = await fetchOldLogBatch(env.AUDIT_DB, cutoffIso, BATCH_SIZE);
    if (batch.length === 0) break;

    // 2. Serialize to NDJSON
    const ndjson = batch.map((row) => JSON.stringify(row)).join('\n');

    // 3. Write to R2 under a date-partitioned key
    const year  = cutoff.getUTCFullYear();
    const month = String(cutoff.getUTCMonth() + 1).padStart(2, '0');
    const r2Key = `audit-logs/${year}/${month}/archive-${runTimestamp}-${batchNumber}.ndjson`;

    try {
      await env.syncron_audit_archive.put(r2Key, ndjson, {
        httpMetadata: { contentType: 'application/x-ndjson' },
        customMetadata: {
          rowCount:   String(batch.length),
          cutoffDate: cutoffIso,
          batchNum:   String(batchNumber),
          oldestLog:  batch[0].created_at,
          newestLog:  batch[batch.length - 1].created_at,
        },
      });
    } catch (err) {
      // If R2 write fails, do NOT delete from D1 — data safety first
      console.error(`[LogRetention] R2 write failed for batch ${batchNumber}:`, err);
      break;
    }

    // 4. Delete archived rows from D1
    const ids = batch.map((row) => row.id);
    try {
      await deleteLogBatch(env.AUDIT_DB, ids);
    } catch (err) {
      console.error(
        `[LogRetention] D1 delete failed for batch ${batchNumber} ` +
        `(R2 write to ${r2Key} succeeded — rows are safely archived but still in D1). ` +
        'Breaking loop to avoid infinite re-processing.',
        err,
      );
      // IMPORTANT: Break here. If we continued, fetchOldLogBatch would return
      // the same rows again (since they weren't deleted), causing an infinite loop
      // and creating duplicate R2 files. The data is safe in R2; manual D1 cleanup
      // can be done later.
      break;
    }

    totalArchived += batch.length;
    batchNumber++;

    console.log(
      `[LogRetention] Batch ${batchNumber} complete: archived ${batch.length} rows → ${r2Key}`,
    );

    // Stop if we got fewer rows than the batch size (means no more old rows)
    if (batch.length < BATCH_SIZE) break;
  }

  console.log(`[LogRetention] Done. Total archived: ${totalArchived} rows.`);
}
