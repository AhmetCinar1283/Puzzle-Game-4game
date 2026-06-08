import { workerFetch } from './workerClient';

export interface Friend {
  uid: string;
  displayName: string;
  tag: string | null;
  showcaseBadges?: any[];
  friendsSince?: string;
}

export interface FriendRequest {
  uid: string;
  displayName: string;
  tag: string | null;
  showcaseBadges?: any[];
  requestedAt?: string;
}

export interface UserSearchResult {
  uid: string;
  displayName: string;
  tag: string | null;
  showcaseBadges?: any[];
  friendshipStatus: 'none' | 'pending' | 'accepted';
  friendshipRequestedBy: string | null;
}

/**
 * Fetch the list of accepted friends for the current user.
 */
export async function getFriends(): Promise<{ success: boolean; friends: Friend[] }> {
  return workerFetch<{ success: boolean; friends: Friend[] }>('/friends', {
    method: 'GET',
    requireAuth: true,
  });
}

/**
 * Fetch the list of incoming pending friend requests.
 */
export async function getFriendRequests(): Promise<{ success: boolean; requests: FriendRequest[] }> {
  return workerFetch<{ success: boolean; requests: FriendRequest[] }>('/friends/requests', {
    method: 'GET',
    requireAuth: true,
  });
}

/**
 * Search for user profiles by their unique tag.
 */
export async function searchUserByTag(tag: string): Promise<{ success: boolean; users: UserSearchResult[] }> {
  return workerFetch<{ success: boolean; users: UserSearchResult[] }>(
    `/users/search?tag=${encodeURIComponent(tag)}`,
    {
      method: 'GET',
      requireAuth: true,
    }
  );
}

/**
 * Send a friend request using target UID or target tag.
 */
export async function sendFriendRequest(params: {
  targetUid?: string;
  targetTag?: string;
}): Promise<{ success: boolean }> {
  return workerFetch<{ success: boolean }>('/friends/request', {
    method: 'POST',
    body: params,
    requireAuth: true,
  });
}

/**
 * Accept an incoming friend request from a user.
 */
export async function acceptFriendRequest(uid: string): Promise<{ success: boolean }> {
  return workerFetch<{ success: boolean }>('/friends/accept', {
    method: 'POST',
    body: { uid },
    requireAuth: true,
  });
}

/**
 * Reject/cancel an incoming friend request.
 */
export async function rejectFriendRequest(uid: string): Promise<{ success: boolean }> {
  return workerFetch<{ success: boolean }>('/friends/reject', {
    method: 'POST',
    body: { uid },
    requireAuth: true,
  });
}

/**
 * Remove/delete an existing friendship.
 */
export async function removeFriend(uid: string): Promise<{ success: boolean }> {
  return workerFetch<{ success: boolean }>(`/friends/${uid}`, {
    method: 'DELETE',
    requireAuth: true,
  });
}

/**
 * Block another user.
 */
export async function blockUser(uid: string): Promise<{ success: boolean }> {
  return workerFetch<{ success: boolean }>(`/friends/block/${uid}`, {
    method: 'POST',
    requireAuth: true,
  });
}

/**
 * Unblock a blocked user.
 */
export async function unblockUser(uid: string): Promise<{ success: boolean }> {
  return workerFetch<{ success: boolean }>(`/friends/block/${uid}`, {
    method: 'DELETE',
    requireAuth: true,
  });
}

/**
 * Fetch list of blocked users.
 */
export async function getBlockedUsers(): Promise<{ success: boolean; blocked: Friend[] }> {
  return workerFetch<{ success: boolean; blocked: Friend[] }>('/friends/blocked', {
    method: 'GET',
    requireAuth: true,
  });
}

