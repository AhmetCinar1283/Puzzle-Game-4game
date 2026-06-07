import { workerFetch } from './workerClient';

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  displayName: string | null;
  tag: string | null;
  value: number;
  showcaseBadges?: Array<{
    id: string;
    badgeType: string;
    periodId: string;
    rank: number;
  }>;
}

export interface LeaderboardResponse {
  success: boolean;
  category: string;
  period: string;
  periodId: string;
  entries: LeaderboardEntry[];
  myRank: number | null;
  myValue: number | null;
  totalPlayers: number;
}

export async function getLeaderboard(
  category: 'stars' | 'levels' | 'records' | 'creators',
  period: 'daily' | 'weekly' | 'monthly' | 'all_time',
  options: {
    limit?: number;
    aroundMe?: boolean;
    friendsOnly?: boolean;
  } = {}
): Promise<LeaderboardResponse> {
  const { limit = 50, aroundMe = false, friendsOnly = false } = options;

  const queryParams = new URLSearchParams();
  queryParams.set('limit', String(limit));
  
  if (aroundMe) {
    queryParams.set('around_me', 'true');
  }
  if (friendsOnly) {
    queryParams.set('friends_only', 'true');
  }

  const path = `/leaderboard/${category}/${period}?${queryParams.toString()}`;
  
  return workerFetch<LeaderboardResponse>(path, {
    method: 'GET',
    requireAuth: false, // Optional: will use auth token if present
  });
}
