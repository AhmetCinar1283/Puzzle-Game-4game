'use client';

import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { useAuthContext } from '../src/contexts/AuthContext';
import { useT, useLanguage } from '../src/contexts/LanguageContext';
import { db, functions } from '../src/lib/firebase/config';
import { useBadges } from '../src/hooks/useBadges';
import { useFriends } from '../src/hooks/useFriends';
import BadgeShowcase from '../src/components/BadgeShowcase';
import BadgePicker from '../src/components/BadgePicker';
import BadgeIcon from '../src/components/BadgeIcon';
import { LANGS, type Lang } from '../src/lib/i18n';
import { useGamepad } from '../src/hooks/useGamepad';

const NEON_TYPES = [
  { color: '#00ff88', glow: '0 0 6px #00ff88, 0 0 18px rgba(0,255,136,0.3)' },
  { color: '#00c4ff', glow: '0 0 6px #00c4ff, 0 0 18px rgba(0,196,255,0.3)' },
  { color: '#ffd700', glow: '0 0 6px #ffd700, 0 0 18px rgba(255,215,0,0.3)' },
  { color: '#fbbf24', glow: '0 0 6px #fbbf24, 0 0 18px rgba(251,191,36,0.3)' },
  { color: '#9333ea', glow: '0 0 6px #9333ea, 0 0 18px rgba(147,51,234,0.3)' },
  { color: '#ec4899', glow: '0 0 6px #ec4899, 0 0 18px rgba(236,72,153,0.3)' },
];

interface Particle {
  id: number;
  color: string;
  glow: string;
  size: number;
  startX: number;
  startY: number;
  driftX: number;
  duration: number;
  delay: number;
  opacity: number;
}

export default function ProfileClient() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, setLang } = useLanguage();
  const { user: currentUser, isAnonymous: isCurrentAnonymous, signOut } = useAuthContext();

  // Determine who we are viewing
  const paramUid = searchParams.get('uid');
  const viewUid = paramUid || currentUser?.uid || null;
  const isOwner = !paramUid || paramUid === currentUser?.uid;

  // Retrieve query params for non-owner fallback
  const queryName = searchParams.get('name') || 'Player';
  const queryTag = searchParams.get('tag');
  const queryShowcaseStr = searchParams.get('showcase');
  const queryScore = searchParams.get('score');
  const queryScoreCat = searchParams.get('scoreCat');

  // Firestore local state for owner profile
  const [profileDoc, setProfileDoc] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);

  // Tag edit states
  const [tagInput, setTagInput] = useState('');
  const [tagBusy, setTagBusy] = useState(false);
  const [tagError, setTagError] = useState('');
  const [tagSuccess, setTagSuccess] = useState(false);

  // Background particles
  const [particles, setParticles] = useState<Particle[]>([]);

  // Load badges API
  const { badges, loading: loadingBadges, error: badgesError, saveShowcase, saving: savingShowcase } = useBadges(viewUid);

  // Load friends hook
  const {
    friends,
    requests,
    searchResults,
    search,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
    actionBusy,
  } = useFriends();

  const currentTag = isOwner ? profileDoc?.tag : queryTag;

  // Search target tag on mount if public profile
  useEffect(() => {
    if (!isOwner && currentTag && currentUser && !isCurrentAnonymous) {
      search(currentTag);
    }
  }, [isOwner, currentTag, currentUser, isCurrentAnonymous, search]);

  const friendshipState = useMemo(() => {
    if (!currentUser || isCurrentAnonymous || isOwner || !viewUid) return 'none';

    // 1. Try search results
    const searchMatch = searchResults.find((u) => u.uid === viewUid);
    if (searchMatch) {
      if (searchMatch.friendshipStatus === 'accepted') return 'accepted';
      if (searchMatch.friendshipStatus === 'pending') {
        return searchMatch.friendshipRequestedBy === currentUser.uid
          ? 'pending_outgoing'
          : 'pending_incoming';
      }
      return 'none';
    }

    // 2. Scan friends list
    const isFriend = friends.some((f) => f.uid === viewUid);
    if (isFriend) return 'accepted';

    // 3. Scan incoming requests
    const isIncoming = requests.some((r) => r.uid === viewUid);
    if (isIncoming) return 'pending_incoming';

    return 'none';
  }, [currentUser, isCurrentAnonymous, isOwner, viewUid, searchResults, friends, requests]);

  // Generate floating neon background particles
  useEffect(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
    const list = Array.from({ length: 20 }, (_, i) => {
      const type = NEON_TYPES[i % NEON_TYPES.length];
      return {
        id: i,
        color: type.color,
        glow: type.glow,
        size: 8 + Math.random() * 14,
        startX: Math.random() * vw,
        startY: Math.random() * vh,
        driftX: (Math.random() - 0.5) * 80,
        duration: 15 + Math.random() * 15,
        delay: -(Math.random() * 20),
        opacity: 0.08 + Math.random() * 0.15,
      };
    });
    setParticles(list);
  }, []);

  // Fetch Firestore owner profile details
  useEffect(() => {
    if (!viewUid) return;
    if (isOwner) {
      setLoadingProfile(true);
      getDoc(doc(db, 'users', viewUid))
        .then((snap) => {
          if (snap.exists()) {
            setProfileDoc(snap.data());
          }
        })
        .catch((err) => console.error('[Profile] Failed to fetch firestore profile:', err))
        .finally(() => setLoadingProfile(false));
    }
  }, [viewUid, isOwner]);

  // Gamepad / Keyboard back support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pickerOpen) {
        router.push('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, pickerOpen]);

  useGamepad({
    onMenu: () => {
      if (!pickerOpen) router.push('/');
    },
  });

  // Handle display names & tags
  const displayName = isOwner
    ? (profileDoc?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Player')
    : queryName;

  // Resolve showcase badges
  const showcaseBadges = useMemo(() => {
    if (isOwner) {
      // Use array directly from Firestore user doc
      return profileDoc?.showcaseBadges || [];
    } else {
      // Filter the D1 public badge list using ID list from query param
      if (!queryShowcaseStr) return [];
      const ids = queryShowcaseStr.split(',');
      const badgeMap = new Map(badges.map((b) => [b.id, b]));
      return ids
        .map((id) => badgeMap.get(id))
        .filter((b): b is Badge => b !== undefined);
    }
  }, [isOwner, profileDoc?.showcaseBadges, queryShowcaseStr, badges]);

  // Resolve stats
  const stats = useMemo(() => {
    if (isOwner) {
      return {
        score: profileDoc?.totalScore ?? 0,
        completed: profileDoc?.completedCount ?? 0,
      };
    }
    return null;
  }, [isOwner, profileDoc]);

  // Tag request limits calculation
  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
  const tagChangedAtDate = profileDoc?.tagChangedAt?.toDate() ?? null;
  const now = Date.now();
  const lastChangeMs = tagChangedAtDate?.getTime() ?? 0;
  const msRemaining = lastChangeMs + TWO_WEEKS_MS - now;
  const daysRemaining = tagChangedAtDate ? Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000))) : 0;
  const changesLeft = Math.max(0, 5 - (profileDoc?.tagChangeCount ?? 0));
  const canChangeTag = changesLeft > 0 && daysRemaining === 0;

  const handleTagSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim() || !isOwner) return;

    setTagBusy(true);
    setTagError('');
    setTagSuccess(false);

    try {
      const requestNewTag = httpsCallable<{ tag: string }, { tag: string }>(functions, 'requestNewTag');
      const result = await requestNewTag({ tag: tagInput.trim() });
      const newTag = result.data.tag;

      setProfileDoc((prev: any) =>
        prev
          ? {
              ...prev,
              tag: newTag,
              tagChangeCount: (prev.tagChangeCount ?? 0) + 1,
              tagChangedAt: { toDate: () => new Date() },
            }
          : prev
      );
      setTagInput('');
      setTagSuccess(true);
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg === 'TAG_INVALID_CHARS') setTagError(t('auth.err_tag_chars'));
      else if (msg.startsWith('TAG_LENGTH')) setTagError(t('auth.err_tag_length'));
      else if (msg === 'TAG_TAKEN') setTagError(t('auth.err_tag_taken'));
      else if (msg.startsWith('TAG_COOLDOWN')) {
        const days = msg.split(':')[1] ?? '14';
        setTagError(t('auth.err_tag_cooldown', { n: days }));
      } else if (msg === 'TAG_MAX_CHANGES') setTagError(t('auth.err_tag_max'));
      else setTagError(t('auth.err_generic'));
    } finally {
      setTagBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (err) {
      console.error('[Profile] Sign out failed:', err);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#030712',
        color: '#e2e8f0',
        fontFamily: 'var(--font-sans)',
        padding: '24px 16px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* Background neon particles */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.color,
              boxShadow: p.glow,
            }}
            animate={{
              x: [p.startX, p.startX + p.driftX],
              y: [p.startY, -40],
              opacity: [0, p.opacity, p.opacity, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      {/* Main Content Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#e5e7eb';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9ca3af';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {t('common.back_menu')}
          </button>
        </div>

        {/* Profile Card Header */}
        <div
          style={{
            background: 'linear-gradient(to bottom, #0a0f1a, #070a12)',
            border: '1px solid #00ff8820',
            borderRadius: '16px',
            padding: '28px 24px',
            boxShadow: '0 0 30px rgba(0, 255, 136, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* Avatar Icon */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(0, 255, 136, 0.08)',
              border: '1.5px solid #00ff8840',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 900,
              color: '#00ff88',
              boxShadow: '0 0 20px rgba(0, 255, 136, 0.15)',
              marginBottom: '16px',
            }}
          >
            {displayName[0]?.toUpperCase()}
          </div>

          <h2
            style={{
              fontSize: '24px',
              fontWeight: 900,
              color: '#f3f4f6',
              margin: 0,
              letterSpacing: '0.04em',
            }}
          >
            {displayName}
          </h2>

          {/* User Tag */}
          {currentTag ? (
            <span
              style={{
                marginTop: '6px',
                fontSize: '15px',
                fontWeight: 800,
                color: '#00c4ff',
                textShadow: '0 0 10px rgba(0, 196, 255, 0.4)',
                background: 'rgba(0, 196, 255, 0.06)',
                border: '1px solid rgba(0, 196, 255, 0.25)',
                padding: '2px 10px',
                borderRadius: '6px',
                letterSpacing: '0.1em',
              }}
            >
              #{currentTag}
            </span>
          ) : (
            isOwner && (
              <span style={{ fontSize: '12px', color: '#4b5563', marginTop: '6px' }}>
                {t('auth.tag_no_tag')}
              </span>
            )
          )}

          {/* Friend Status Button for public profile views */}
          {!isOwner && currentUser && !isCurrentAnonymous && viewUid && (
            <div style={{ marginTop: '16px' }}>
              {friendshipState === 'accepted' && (
                <button
                  onClick={() => {
                    if (window.confirm(t('levels.delete_title') === 'Emin misiniz?' ? 'Bu arkadaşı silmek istediğinize emin misiniz?' : 'Are you sure you want to remove this friend?')) {
                      removeFriend(viewUid);
                    }
                  }}
                  disabled={actionBusy[viewUid]}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid #ff2d55',
                    background: 'rgba(255, 45, 85, 0.08)',
                    color: '#ff2d55',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#ff2d55';
                    e.currentTarget.style.color = '#030712';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 45, 85, 0.08)';
                    e.currentTarget.style.color = '#ff2d55';
                  }}
                >
                  {actionBusy[viewUid] ? '...' : t('friends.remove_friend')}
                </button>
              )}

              {friendshipState === 'pending_outgoing' && (
                <button
                  disabled
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid #4b5563',
                    background: '#1f293750',
                    color: '#9ca3af',
                    cursor: 'not-allowed',
                  }}
                >
                  {t('friends.pending_outgoing')}
                </button>
              )}

              {friendshipState === 'pending_incoming' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => acceptRequest(viewUid)}
                    disabled={actionBusy[viewUid]}
                    style={{
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: '1px solid #00ff88',
                      background: 'rgba(0, 255, 136, 0.08)',
                      color: '#00ff88',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#00ff88';
                      e.currentTarget.style.color = '#030712';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 255, 136, 0.08)';
                      e.currentTarget.style.color = '#00ff88';
                    }}
                  >
                    {actionBusy[viewUid] ? '...' : t('friends.accept')}
                  </button>
                  <button
                    onClick={() => rejectRequest(viewUid)}
                    disabled={actionBusy[viewUid]}
                    style={{
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: '1px solid #ff2d55',
                      background: 'rgba(255, 45, 85, 0.08)',
                      color: '#ff2d55',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#ff2d55';
                      e.currentTarget.style.color = '#030712';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 45, 85, 0.08)';
                      e.currentTarget.style.color = '#ff2d55';
                    }}
                  >
                    {actionBusy[viewUid] ? '...' : t('friends.reject')}
                  </button>
                </div>
              )}

              {friendshipState === 'none' && (
                <button
                  onClick={() => sendRequest(viewUid)}
                  disabled={actionBusy[viewUid]}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid #00ff88',
                    background: 'rgba(0, 255, 136, 0.08)',
                    color: '#00ff88',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#00ff88';
                    e.currentTarget.style.color = '#030712';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 255, 136, 0.08)';
                    e.currentTarget.style.color = '#00ff88';
                  }}
                >
                  {actionBusy[viewUid] ? '...' : t('friends.add_friend')}
                </button>
              )}
            </div>
          )}

          {/* Statistics Grid */}
          {stats && (
            <div
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginTop: '28px',
                borderTop: '1px solid #111827',
                paddingTop: '20px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: 900, color: '#ffd700' }}>
                  {stats.score}
                </span>
                <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                  {t('leaderboard.score')} (Stars)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: 900, color: '#00c4ff' }}>
                  {stats.completed}
                </span>
                <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                  {t('levels.title')}
                </span>
              </div>
            </div>
          )}

          {/* Non-owner Score display if navigated from leaderboard */}
          {!isOwner && queryScore && (
            <div
              style={{
                marginTop: '16px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#9ca3af',
              }}
            >
              {queryScoreCat === 'stars' && `⭐ ${queryScore} Stars`}
              {queryScoreCat === 'levels' && `🏔 ${queryScore} Levels`}
              {queryScoreCat === 'records' && `🏅 ${queryScore} Records`}
              {queryScoreCat === 'creators' && `🏗 ${queryScore} Points`}
            </div>
          )}
        </div>

        {/* Badge Showcase Component */}
        <BadgeShowcase
          uid={viewUid || ''}
          isOwner={isOwner}
          showcaseBadges={showcaseBadges}
          onEditClick={() => setPickerOpen(true)}
        />

        {/* Tag Management Panel (Owner only) */}
        {isOwner && !isCurrentAnonymous && (
          <div
            style={{
              background: '#0a0f1a50',
              border: '1px solid #111827',
              borderRadius: '16px',
              padding: '20px 24px',
              boxSizing: 'border-box',
            }}
          >
            <h3
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.15em',
                color: '#4b5563',
                textTransform: 'uppercase',
                margin: '0 0 12px 0',
              }}
            >
              {t('auth.tag_section')}
            </h3>

            {changesLeft > 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '12px', margin: '0 0 12px' }}>
                {t('auth.tag_changes_remaining', { n: changesLeft })}
              </p>
            ) : (
              <p style={{ color: '#ff2d55', fontSize: '12px', margin: '0 0 12px' }}>
                {t('auth.tag_max_reached')}
              </p>
            )}

            {daysRemaining > 0 && (
              <p style={{ color: '#4b5563', fontSize: '12px', margin: '0 0 12px' }}>
                {t('auth.tag_cooldown', { n: daysRemaining })}
              </p>
            )}

            {canChangeTag && (
              <form onSubmit={handleTagSubmit} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder={t('auth.tag_placeholder')}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value.toUpperCase())}
                  maxLength={10}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#060c16',
                    border: '1px solid #1f2937',
                    borderRadius: '8px',
                    color: '#e5e7eb',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  disabled={tagBusy || !tagInput.trim()}
                  style={{
                    padding: '8px 16px',
                    background: '#00ff8815',
                    border: '1px solid #00ff8840',
                    borderRadius: '8px',
                    color: '#00ff88',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tagBusy ? '...' : t('auth.tag_save')}
                </button>
              </form>
            )}

            {tagError && <p style={{ color: '#ff2d55', fontSize: '12px', margin: '8px 0 0' }}>{tagError}</p>}
            {tagSuccess && <p style={{ color: '#00ff88', fontSize: '12px', margin: '8px 0 0' }}>{t('auth.tag_updated')}</p>}
          </div>
        )}

        {/* All Earned Badges Grid */}
        <div
          style={{
            background: '#0a0f1a50',
            border: '1px solid #111827',
            borderRadius: '16px',
            padding: '20px 24px',
            boxSizing: 'border-box',
          }}
        >
          <h3
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.15em',
              color: '#4b5563',
              textTransform: 'uppercase',
              margin: '0 0 16px 0',
            }}
          >
            {t('leaderboard.standing') === 'SENİN YERİN' ? 'TÜM ROZETLER' : 'ALL BADGES'}
          </h3>

          {loadingBadges ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderTopColor: '#00ff88',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          ) : badgesError ? (
            <p style={{ color: '#ff2d55', fontSize: '12px', margin: 0 }}>⚠️ {badgesError}</p>
          ) : badges.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                gap: '12px',
                justifyItems: 'center',
              }}
            >
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <BadgeIcon
                    badgeType={badge.badgeType}
                    periodId={badge.periodId}
                    rank={badge.rank}
                    size="md"
                  />
                  <span style={{ fontSize: '8px', color: '#4b5563', marginTop: '4px', fontWeight: 700 }}>
                    {badge.periodId}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#4b5563', fontSize: '12px', fontStyle: 'italic', margin: 0 }}>
              {t('leaderboard.standing') === 'SENİN YERİN' ? 'Henüz kazanılmış rozet yok' : 'No badges earned yet'}
            </p>
          )}
        </div>

        {/* Profile Settings (Owner only) */}
        {isOwner && (
          <div
            style={{
              background: '#0a0f1a50',
              border: '1px solid #111827',
              borderRadius: '16px',
              padding: '20px 24px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Language Settings */}
            <div>
              <h3
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.15em',
                  color: '#4b5563',
                  textTransform: 'uppercase',
                  margin: '0 0 8px 0',
                }}
              >
                {t('auth.language')}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {LANGS.map(({ code, label: lbl }) => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    style={{
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      background: lang === code ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${lang === code ? 'rgba(0,255,136,0.4)' : '#1f2937'}`,
                      color: lang === code ? '#00ff88' : '#6b7280',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Logout button */}
            {!isCurrentAnonymous && (
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ef4444';
                  e.currentTarget.style.color = '#030712';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                  e.currentTarget.style.color = '#ef4444';
                }}
              >
                {t('auth.sign_out')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Badge Picker Modal */}
      {isOwner && (
        <BadgePicker
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          badges={badges}
          initialShowcaseIds={showcaseBadges.map((b) => b.id)}
          onSave={saveShowcase}
          saving={savingShowcase}
        />
      )}
    </div>
  );
}
