/**
 * Verify a Firebase ID token and return the uid.
 * Uses the Firebase Auth REST API (no Admin SDK required).
 */
export async function verifyIdToken(idToken: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );

  if (!res.ok) {
    throw new Error(`Token verification failed: ${res.status}`);
  }

  const data = await res.json() as { users?: Array<{ localId: string }> };
  const uid = data.users?.[0]?.localId;
  if (!uid) throw new Error('Invalid token: no user found');
  return uid;
}
