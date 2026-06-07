import { workerFetch } from './workerClient';

export interface Badge {
  id: string;
  uid: string;
  badgeType: string;
  periodId: string;
  rank: number;
  awardedAt: string;
}

export interface BadgesResponse {
  success: boolean;
  badges: Badge[];
}

/**
 * Fetch all badges awarded to a specific user.
 * Public endpoint.
 */
export async function getUserBadges(uid: string): Promise<BadgesResponse> {
  return workerFetch<BadgesResponse>(`/badges/${uid}`, {
    method: 'GET',
    requireAuth: false,
  });
}

/**
 * Update the user's showcased badges (maximum 5).
 * Authenticated endpoint.
 */
export async function updateShowcase(badgeIds: string[]): Promise<{ success: boolean }> {
  return workerFetch<{ success: boolean }>('/badges/showcase', {
    method: 'POST',
    body: { badgeIds },
    requireAuth: true,
  });
}
