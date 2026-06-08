import { auth } from '@/app/src/lib/firebase';

/**
 * Proactively fetches a valid Firebase ID Token for the logged-in user.
 * If the current token is close to expiry (less than 5 minutes remaining),
 * it forces a token refresh via `getIdToken(true)` as required.
 */
export async function getAdminIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const tokenResult = await user.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime).getTime();
    const now = Date.now();

    // If token expires in less than 5 minutes (300,000 ms), force-refresh it
    const forceRefresh = expirationTime - now < 5 * 60 * 1000;
    return await user.getIdToken(forceRefresh);
  } catch (err) {
    console.error('[adminClient] Error resolving Firebase ID Token:', err);
    // Fallback: try standard refresh
    return await user.getIdToken(true);
  }
}

/**
 * Fetch helper for secure admin API endpoints under the Cloudflare Worker.
 * Automatically injects the Authorization: Bearer <token> header and handles baseUrl.
 */
export async function fetchAdminApi<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAdminIdToken();
  if (!token) {
    throw new Error('Unauthorized: No active admin/moderator session.');
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_WORKER_URL ||
    process.env.NEXT_PUBLIC_WORKER_API_URL ||
    '';

  // Ensure path starts with /
  const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${sanitizedPath}`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.error) {
        errorMessage = errorJson.error;
      }
    } catch {
      // Ignored: keep default message
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

export interface BanRecord {
  id: string;
  uid: string;
  ban_type: 'platform' | 'tag' | 'social' | 'coop';
  reason: string;
  issued_by: string;
  issued_at: string;
  expires_at: string | null;
  lifted_at: string | null;
  lifted_by: string | null;
}

export interface ActiveBan {
  id: string;
  uid: string;
  ban_type: 'platform' | 'tag' | 'social' | 'coop';
  reason: string;
  issued_by: string;
  issued_at: string;
  expires_at: string | null;
}

export interface UserBansResponse {
  success: boolean;
  bans: BanRecord[];
  activeBans: ActiveBan[];
}

export interface IssueBanParams {
  banType: 'platform' | 'tag' | 'social' | 'coop';
  reason: string;
  expiresAt?: string;
}

export async function getUserBans(uid: string): Promise<UserBansResponse> {
  return fetchAdminApi<UserBansResponse>(`/admin/users/${uid}/bans`, {
    method: 'GET',
  });
}

export async function issueUserBan(uid: string, params: IssueBanParams): Promise<{ success: boolean }> {
  return fetchAdminApi<{ success: boolean }>(`/admin/users/${uid}/bans`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function liftUserBan(uid: string, banId: string): Promise<{ success: boolean }> {
  return fetchAdminApi<{ success: boolean }>(`/admin/users/${uid}/bans/${banId}/lift`, {
    method: 'POST',
  });
}

