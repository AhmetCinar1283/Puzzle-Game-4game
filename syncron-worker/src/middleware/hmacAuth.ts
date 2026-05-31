/**
 * HMAC-SHA256 service-to-service authentication middleware.
 *
 * Used exclusively for the POST /internal/log endpoint, which is called by
 * Firebase Functions (not by end-users). The shared secret (LOG_SECRET) is
 * stored as a Worker Secret and is never transmitted over the network.
 *
 * Protocol:
 *   Sender computes: HMAC-SHA256( METHOD + PATH + TIMESTAMP + SHA256(BODY) )
 *   Sends headers:   X-Timestamp: <unix-ms>  X-Signature: <base64>
 *   Receiver:        Verifies timestamp drift (±5 min) then re-derives and
 *                    compares the signature with crypto.subtle.verify()
 *
 * Security properties:
 *   - Secret never leaves either server
 *   - Timestamp replay window: ±5 minutes (standard for HMAC-signed APIs)
 *   - Body hash prevents content substitution after signing
 */

import { createMiddleware } from 'hono/factory';
import type { AppContext } from '../types';

const MAX_DRIFT_MS = 5 * 60 * 1000; // ±5 minutes

export const hmacAuth = createMiddleware<AppContext>(async (c, next) => {
  const timestamp = c.req.header('X-Timestamp');
  const signature = c.req.header('X-Signature');

  if (!timestamp || !signature) {
    return c.json({ success: false, error: 'Missing auth headers' }, 401);
  }

  // 1. Replay protection: reject if timestamp is too old or in the future
  const tsMs = parseInt(timestamp, 10);
  if (isNaN(tsMs) || Math.abs(Date.now() - tsMs) > MAX_DRIFT_MS) {
    return c.json({ success: false, error: 'Request timestamp out of range' }, 401);
  }

  // 2. Read body text (must be done before any other body consumption)
  const bodyText = await c.req.text();

  // 3. Hash the body (ensures body integrity — prevents body swapping attacks)
  const bodyHashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(bodyText),
  );
  const bodyHash = Array.from(new Uint8Array(bodyHashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // 4. Reconstruct the signed message: METHOD + PATH + TIMESTAMP + BODY_HASH
  const url = new URL(c.req.url);
  const message = `${c.req.method}${url.pathname}${timestamp}${bodyHash}`;

  // 5. Import shared secret as an HMAC-SHA256 key
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(c.env.LOG_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  // 6. Decode the base64 signature from the header
  let sigBytes: Uint8Array;
  try {
    sigBytes = Uint8Array.from(atob(signature), (ch) => ch.charCodeAt(0));
  } catch {
    return c.json({ success: false, error: 'Invalid signature encoding' }, 401);
  }

  // 7. Constant-time HMAC verification (crypto.subtle.verify is constant-time)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(message),
  );

  if (!valid) {
    return c.json({ success: false, error: 'Invalid signature' }, 401);
  }

  // 8. Store parsed body so the route handler doesn't need to re-parse
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(bodyText);
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }
  c.set('parsedBody', parsedBody);

  await next();
});
