/**
 * logClient.ts — Audit Log HTTP Client for Firebase Functions
 *
 * Sends audit log entries to the Cloudflare Worker (/internal/log) using
 * HMAC-SHA256 signed requests. This ensures:
 *   - The Worker can verify the request came from trusted Firebase Functions
 *   - The shared secret never travels over the network
 *   - The body cannot be tampered with after signing
 *
 * Protocol (must match Worker's hmacAuth middleware exactly):
 *   message  = METHOD + PATH + TIMESTAMP_MS + SHA256(body)
 *   signature = HMAC-SHA256(message, LOG_SECRET) → base64
 *   headers  = { X-Timestamp, X-Signature }
 *
 * Usage:
 *   import { sendLogToWorker } from './logClient';
 *   await sendLogToWorker('account.create', 'account', uid, { ... }, workerUrl, logSecret);
 *
 * Always fire-and-forget (non-fatal): log failures are warned but never
 * propagate to the caller, so they cannot break the primary trigger logic.
 */

import * as crypto from 'crypto';
import * as functions from 'firebase-functions/v2';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditCategory = 'game' | 'support' | 'account' | 'payment' | 'admin';

export type AuditAction =
  | 'level.complete'
  | 'ticket.create'
  | 'ticket.message'
  | 'account.create'
  | 'account.upgrade'
  | 'account.tag_change'
  | 'payment.success'
  | 'payment.failed'
  | 'payment.refund'
  | 'admin.role_change'
  | 'admin.ticket_status_change';

interface LogPayload {
  uid: string;
  action: AuditAction | string;
  category: AuditCategory;
  metadata: Record<string, unknown>;
}

// ─── HMAC Signing ─────────────────────────────────────────────────────────────

/**
 * Computes HMAC-SHA256 of `message` using `secret` and returns it as base64.
 * Uses Node.js `crypto` module (available in Firebase Functions runtime).
 */
function hmacBase64(secret: string, message: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('base64');
}

/**
 * Computes SHA-256 hex digest of a string.
 * Used to hash the request body before including it in the signed message,
 * preventing body substitution after the signature is generated.
 */
function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ─── HTTP Client ──────────────────────────────────────────────────────────────

const METHOD = 'POST';
const PATH   = '/internal/log';
const TIMEOUT_MS = 8_000; // 8 second timeout — Functions have 60s limit

/**
 * Sends a signed audit log entry to the Cloudflare Worker.
 *
 * @param action     - The action being logged (e.g. 'account.create')
 * @param category   - The action category ('game' | 'support' | 'account' | ...)
 * @param uid        - The Firebase UID of the user performing the action
 * @param metadata   - Action-specific details (level ID, tag name, ticket ID, etc.)
 * @param workerUrl  - Full base URL of the worker (e.g. 'https://syncron-worker.xxx.workers.dev')
 * @param logSecret  - HMAC shared secret (from SECRET: LOG_SECRET)
 *
 * @returns Promise<void> — always resolves (failures are warned, not thrown)
 */
export async function sendLogToWorker(
  action:    AuditAction | string,
  category:  AuditCategory,
  uid:       string,
  metadata:  Record<string, unknown>,
  workerUrl: string,
  logSecret: string,
): Promise<void> {
  // 1. Build and serialize payload
  const payload: LogPayload = { uid, action, category, metadata };
  const body = JSON.stringify(payload);

  // 2. Compute body hash (integrity — prevents body swap after signing)
  const bodyHash = sha256Hex(body);

  // 3. Timestamp — milliseconds since epoch (as string, matching Worker expectation)
  const timestamp = Date.now().toString();

  // 4. Signed message: METHOD + PATH + TIMESTAMP + BODY_HASH
  //    Order must exactly match Worker's hmacAuth middleware reconstruction
  const message   = `${METHOD}${PATH}${timestamp}${bodyHash}`;
  const signature = hmacBase64(logSecret, message);

  // 5. Send with AbortController timeout
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${workerUrl}${PATH}`, {
      method: METHOD,
      headers: {
        'Content-Type':  'application/json',
        'X-Timestamp':   timestamp,
        'X-Signature':   signature,
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      // Worker rejected the request — log status but don't throw
      const text = await res.text().catch(() => '(no body)');
      functions.logger.warn(
        `[logClient] Worker responded ${res.status} for action "${action}" (uid: ${uid}): ${text}`,
      );
    }
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    functions.logger.warn(
      `[logClient] Failed to send log to Worker (action: "${action}", uid: ${uid}): ${
        isAbort ? 'Request timed out' : String(err)
      }`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
