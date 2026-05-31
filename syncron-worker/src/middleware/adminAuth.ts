/**
 * Admin authentication middleware.
 *
 * Verifies the Firebase ID token and checks that the caller has
 * 'admin' or 'moderator' role in Firestore. Sets c.var.uid and
 * c.var.role for downstream route handlers to use.
 *
 * Moderators can only reach GET (read-only) endpoints. Write endpoints
 * must additionally check that role === 'admin' if needed.
 */

import { createMiddleware } from 'hono/factory';
import { verifyIdToken } from '../services/auth';
import { fsGet, fromDoc } from '../services/firestore';
import { getAdminAccessToken } from '../services/serviceAccount';
import type { AppContext } from '../types';

export const adminAuth = createMiddleware<AppContext>(async (c, next) => {
  // 1. Extract Bearer token
  const authHeader = c.req.header('Authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) {
    return c.json({ success: false, error: 'Missing Authorization header' }, 401);
  }

  // 2. Cryptographic JWT verification (jose + JWKS)
  let uid: string;
  try {
    const verified = await verifyIdToken(idToken, c.env.FIREBASE_PROJECT_ID);
    uid = verified.uid;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[adminAuth] Token verification failed:', msg);
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }

  // 3. Fetch user document to check role
  let role: string;
  try {
    const adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
    const userDoc = await fsGet(c.env.FIREBASE_PROJECT_ID, `users/${uid}`, adminToken);
    if (!userDoc) {
      return c.json({ success: false, error: 'User not found' }, 403);
    }
    const userData = fromDoc(userDoc);
    role = typeof userData.role === 'string' ? userData.role : 'user';
  } catch (err: unknown) {
    console.error('[adminAuth] Failed to fetch user role:', err);
    return c.json({ success: false, error: 'Internal error during authorization' }, 500);
  }

  // 4. Enforce admin/moderator access
  if (role !== 'admin' && role !== 'moderator') {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }

  c.set('uid', uid);
  c.set('role', role);
  await next();
});
