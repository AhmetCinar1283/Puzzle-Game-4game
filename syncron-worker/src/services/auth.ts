/**
 * Verify a Firebase ID token using RS256 cryptographic validation.
 *
 * Uses the `jose` library to:
 * 1. Fetch Google's JWKS public keys (auto-cached per Cache-Control header)
 * 2. Verify the JWT signature with crypto.subtle (RS256 / RSASSA-PKCS1-v1_5)
 * 3. Validate iss, aud, exp, sub claims
 *
 * This replaces the previous REST API lookup (identitytoolkit) which added
 * ~150ms latency per request and did not verify the cryptographic signature.
 */

import { jwtVerify, createRemoteJWKSet } from 'jose';

// Google's public JWKS for Firebase Auth tokens.
// jose caches the JWKS response according to its Cache-Control header
// (typically max-age=3600), so we don't hit Google on every request.
const GOOGLE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
);

// Module-level JWKS instance — shared across all requests within a Worker isolate.
const JWKS = createRemoteJWKSet(GOOGLE_JWKS_URL);

export interface VerifiedToken {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

/**
 * Verifies a Firebase ID token and returns the decoded claims.
 * Throws an error if the token is expired, tampered, or otherwise invalid.
 *
 * @param idToken - Raw JWT string from the Authorization: Bearer header
 * @param projectId - Firebase project ID (used for iss + aud claim validation)
 */
export async function verifyIdToken(
  idToken: string,
  projectId: string,
): Promise<VerifiedToken> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const uid = payload.sub;
  if (!uid) throw new Error('Firebase token missing sub claim');

  return {
    uid,
    email: typeof payload['email'] === 'string' ? payload['email'] : undefined,
    emailVerified: typeof payload['email_verified'] === 'boolean'
      ? payload['email_verified']
      : undefined,
  };
}
