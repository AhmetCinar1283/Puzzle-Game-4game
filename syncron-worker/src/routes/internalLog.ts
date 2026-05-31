/**
 * POST /internal/log
 *
 * Internal endpoint called exclusively by Firebase Functions to write audit
 * log entries into D1. Not exposed to end-users.
 *
 * Security layers:
 *   1. hmacAuth middleware — HMAC-SHA256 signature + timestamp replay protection
 *   2. rateLimiter        — 100/min global + 20/min per-UID (loop detection)
 *   3. Zod validation     — strict schema for every incoming payload
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../types';
import { hmacAuth } from '../middleware/hmacAuth';
import { checkInternalLogRateLimit } from '../middleware/rateLimiter';
import { writeAuditLog } from '../services/auditLog';
import type { AuditCategory, AuditAction } from '../services/auditLog';

// ─── Validation schema ────────────────────────────────────────────────────────

const AUDIT_CATEGORIES = ['game', 'support', 'account', 'payment', 'admin'] as const;

const internalLogSchema = z.object({
  uid:      z.string().min(1).max(128),
  action:   z.string().min(1).max(64),
  category: z.enum(AUDIT_CATEGORIES),
  metadata: z.record(z.unknown()).default({}),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const internalLogRouter = new Hono<AppContext>();

internalLogRouter.post('/internal/log', hmacAuth, async (c) => {
  // Body was already parsed and stored by hmacAuth middleware
  const rawBody = c.get('parsedBody');

  // 1. Validate payload
  const validation = internalLogSchema.safeParse(rawBody);
  if (!validation.success) {
    const error = validation.error.errors[0]?.message ?? 'Invalid payload';
    console.warn('[InternalLog] Validation failed:', error);
    return c.json({ success: false, error }, 400);
  }

  const { uid, action, category, metadata } = validation.data;

  // 2. Rate limiting (loop detection)
  const rateLimitError = checkInternalLogRateLimit(uid);
  if (rateLimitError) {
    console.error('[InternalLog] Rate limit exceeded:', rateLimitError);
    return c.json({ success: false, error: 'Rate limit exceeded' }, 429);
  }

  // 3. Write to D1 (fire-and-forget pattern via waitUntil not needed here
  //    because this endpoint IS the async side — the caller already used
  //    fire-and-forget from Firebase Functions)
  try {
    await writeAuditLog(
      c.env.AUDIT_DB,
      uid,
      action as AuditAction,
      category as AuditCategory,
      metadata as Record<string, unknown>,
    );
  } catch (err) {
    console.error('[InternalLog] D1 write failed:', err);
    return c.json({ success: false, error: 'Failed to write log' }, 500);
  }

  return c.json({ success: true });
});
