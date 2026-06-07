import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import {
  getFriends,
  getFriendRequests,
  searchUserByTag,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  Friend,
  FriendRequest,
  UserSearchResult,
} from '../lib/api/friendsClient';

// Cache structure: cache by user UID to avoid double fetching on mount/page changes
const cache: Record<string, { friends: Friend[]; requests: FriendRequest[]; timestamp: number }> = {};
const CACHE_DURATION = 60 * 1000; // 1 minute in-memory cache

export function useFriends() {
  const { user, isAnonymous } = useAuthContext();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);

  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [searching, setSearching] = useState(false);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const cacheKey = user?.uid || 'anonymous';

  const fetchFriendsList = useCallback(
    async (force = false) => {
      if (!user || isAnonymous) return;

      const now = Date.now();
      if (!force && cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_DURATION) {
        setFriends(cache[cacheKey].friends);
        return;
      }

      setLoadingFriends(true);
      setError(null);
      try {
        const res = await getFriends();
        if (res.success) {
          setFriends(res.friends);
          if (!cache[cacheKey]) {
            cache[cacheKey] = { friends: res.friends, requests: [], timestamp: now };
          } else {
            cache[cacheKey].friends = res.friends;
            cache[cacheKey].timestamp = now;
          }
        }
      } catch (err: any) {
        console.error('[useFriends] Failed to fetch friends:', err);
        setError(err.message || 'Error loading friends list.');
      } finally {
        setLoadingFriends(false);
      }
    },
    [user, isAnonymous, cacheKey]
  );

  const fetchIncomingRequests = useCallback(
    async (force = false) => {
      if (!user || isAnonymous) return;

      const now = Date.now();
      if (!force && cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_DURATION) {
        setRequests(cache[cacheKey].requests);
        return;
      }

      setLoadingRequests(true);
      setError(null);
      try {
        const res = await getFriendRequests();
        if (res.success) {
          setRequests(res.requests);
          if (!cache[cacheKey]) {
            cache[cacheKey] = { friends: [], requests: res.requests, timestamp: now };
          } else {
            cache[cacheKey].requests = res.requests;
            cache[cacheKey].timestamp = now;
          }
        }
      } catch (err: any) {
        console.error('[useFriends] Failed to fetch requests:', err);
        setError(err.message || 'Error loading friend requests.');
      } finally {
        setLoadingRequests(false);
      }
    },
    [user, isAnonymous, cacheKey]
  );

  const loadAll = useCallback(
    async (force = false) => {
      if (!user || isAnonymous) return;
      await Promise.all([fetchFriendsList(force), fetchIncomingRequests(force)]);
    },
    [user, isAnonymous, fetchFriendsList, fetchIncomingRequests]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const search = useCallback(
    async (tag: string) => {
      if (!user || isAnonymous) return;
      setSearching(true);
      setError(null);
      setSearchResults([]);
      try {
        const res = await searchUserByTag(tag);
        if (res.success) {
          setSearchResults(res.users);
          if (res.users.length === 0) {
            setError('friends.err_not_found');
          }
        }
      } catch (err: any) {
        console.error('[useFriends] Search error:', err);
        setError(err.message || 'Search failed.');
      } finally {
        setSearching(false);
      }
    },
    [user, isAnonymous]
  );

  const setBusy = (uid: string, busy: boolean) => {
    setActionBusy((prev) => ({ ...prev, [uid]: busy }));
  };

  const sendRequest = useCallback(
    async (targetUid: string) => {
      if (!user || isAnonymous) return;
      setBusy(targetUid, true);
      setError(null);
      setSuccessMsg(null);
      try {
        const res = await sendFriendRequest({ targetUid });
        if (res.success) {
          setSuccessMsg('friends.success_sent');
          // Update search result locally to pending outgoing
          setSearchResults((prev) =>
            prev.map((u) =>
              u.uid === targetUid
                ? { ...u, friendshipStatus: 'pending', friendshipRequestedBy: user.uid }
                : u
            )
          );
        }
      } catch (err: any) {
        setError(err.message || 'Failed to send request.');
      } finally {
        setBusy(targetUid, false);
      }
    },
    [user, isAnonymous]
  );

  const acceptRequest = useCallback(
    async (requesterUid: string) => {
      if (!user || isAnonymous) return;
      setBusy(requesterUid, true);
      setError(null);
      setSuccessMsg(null);
      try {
        const res = await acceptFriendRequest(requesterUid);
        if (res.success) {
          setSuccessMsg('friends.success_accepted');
          await loadAll(true);
          setSearchResults((prev) =>
            prev.map((u) => (u.uid === requesterUid ? { ...u, friendshipStatus: 'accepted' } : u))
          );
        }
      } catch (err: any) {
        setError(err.message || 'Failed to accept request.');
      } finally {
        setBusy(requesterUid, false);
      }
    },
    [user, isAnonymous, loadAll]
  );

  const rejectRequest = useCallback(
    async (requesterUid: string) => {
      if (!user || isAnonymous) return;
      setBusy(requesterUid, true);
      setError(null);
      setSuccessMsg(null);
      try {
        const res = await rejectFriendRequest(requesterUid);
        if (res.success) {
          setSuccessMsg('friends.success_rejected');
          await loadAll(true);
          setSearchResults((prev) =>
            prev.map((u) => (u.uid === requesterUid ? { ...u, friendshipStatus: 'none' } : u))
          );
        }
      } catch (err: any) {
        setError(err.message || 'Failed to reject request.');
      } finally {
        setBusy(requesterUid, false);
      }
    },
    [user, isAnonymous, loadAll]
  );

  const remove = useCallback(
    async (friendUid: string) => {
      if (!user || isAnonymous) return;
      setBusy(friendUid, true);
      setError(null);
      setSuccessMsg(null);
      try {
        const res = await removeFriend(friendUid);
        if (res.success) {
          setSuccessMsg('friends.success_removed');
          await loadAll(true);
          setSearchResults((prev) =>
            prev.map((u) => (u.uid === friendUid ? { ...u, friendshipStatus: 'none' } : u))
          );
        }
      } catch (err: any) {
        setError(err.message || 'Failed to remove friend.');
      } finally {
        setBusy(friendUid, false);
      }
    },
    [user, isAnonymous, loadAll]
  );

  return {
    friends,
    requests,
    searchResults,
    loadingFriends,
    loadingRequests,
    searching,
    actionBusy,
    error,
    successMsg,
    setError,
    setSuccessMsg,
    fetchFriends: () => fetchFriendsList(true),
    fetchRequests: () => fetchIncomingRequests(true),
    search,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend: remove,
  };
}

export default useFriends;
