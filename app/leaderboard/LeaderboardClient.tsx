'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useT, useLanguage } from '@/app/src/contexts/LanguageContext';
import { useAuthContext } from '@/app/src/contexts/AuthContext';
import { useGamepad } from '@/app/src/hooks/useGamepad';
import { useLeaderboard } from '@/app/src/hooks/useLeaderboard';
import AuthModal from '@/app/src/components/AuthModal';
import BadgeIcon from '@/app/src/components/BadgeIcon';

const CATEGORIES = [
  { id: 'stars', labelKey: 'leaderboard.cat_stars', periods: ['daily', 'weekly', 'all_time'], color: '#00ff88', glow: 'rgba(0, 255, 136, 0.4)' },
  { id: 'levels', labelKey: 'leaderboard.cat_levels', periods: ['daily', 'weekly', 'all_time'], color: '#00c4ff', glow: 'rgba(0, 196, 255, 0.4)' },
  { id: 'records', labelKey: 'leaderboard.cat_records', periods: ['daily', 'weekly', 'all_time'], color: '#ffd700', glow: 'rgba(255, 215, 0, 0.4)' },
  { id: 'creators', labelKey: 'leaderboard.cat_creators', periods: ['monthly', 'all_time'], color: '#bf5fff', glow: 'rgba(191, 95, 255, 0.4)' },
  { id: 'friends', labelKey: 'leaderboard.cat_friends', periods: ['weekly'], color: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];
type PeriodId = 'daily' | 'weekly' | 'monthly' | 'all_time';

export default function LeaderboardClient() {
  const t = useT();
  const router = useRouter();
  const { user, isAnonymous } = useAuthContext();

  const [catIndex, setCatIndex] = useState(0);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const activeCategory = CATEGORIES[catIndex];
  const activePeriod = activeCategory.periods[Math.min(periodIndex, activeCategory.periods.length - 1)] as PeriodId;

  // Clamping periodIndex when switching categories with different periods
  useEffect(() => {
    const maxPeriodIdx = activeCategory.periods.length - 1;
    if (periodIndex > maxPeriodIdx) {
      setPeriodIndex(0);
    }
  }, [catIndex, activeCategory.periods.length, periodIndex]);

  // Main leaderboard query (Top 50)
  const isFriendsCategory = activeCategory.id === 'friends';
  
  // Call hook only for valid API categories
  const apiCategory = isFriendsCategory ? 'stars' : activeCategory.id;
  const apiPeriod = isFriendsCategory ? 'weekly' : activePeriod;

  const { data, loading, error, refresh } = useLeaderboard(
    apiCategory as any,
    apiPeriod as any,
    { friendsOnly: isFriendsCategory }
  );

  // Fetch around me data for standing section if logged in
  const shouldFetchAroundMe = !!user && !isAnonymous && !isFriendsCategory;
  const { data: aroundMeData, loading: aroundMeLoading } = useLeaderboard(
    apiCategory as any,
    apiPeriod as any,
    { aroundMe: shouldFetchAroundMe }
  );

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/');
      } else if (e.key === 'ArrowLeft') {
        setCatIndex((prev) => (prev - 1 + CATEGORIES.length) % CATEGORIES.length);
      } else if (e.key === 'ArrowRight') {
        setCatIndex((prev) => (prev + 1) % CATEGORIES.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentPeriods = CATEGORIES[catIndex].periods;
        setPeriodIndex((prev) => (prev - 1 + currentPeriods.length) % currentPeriods.length);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentPeriods = CATEGORIES[catIndex].periods;
        setPeriodIndex((prev) => (prev + 1) % currentPeriods.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [catIndex, router]);

  // Gamepad controls
  useGamepad({
    onMove: (dir) => {
      if (dir === 'left') {
        setCatIndex((prev) => (prev - 1 + CATEGORIES.length) % CATEGORIES.length);
      } else if (dir === 'right') {
        setCatIndex((prev) => (prev + 1) % CATEGORIES.length);
      } else if (dir === 'up') {
        const currentPeriods = CATEGORIES[catIndex].periods;
        setPeriodIndex((prev) => (prev - 1 + currentPeriods.length) % currentPeriods.length);
      } else if (dir === 'down') {
        const currentPeriods = CATEGORIES[catIndex].periods;
        setPeriodIndex((prev) => (prev + 1) % currentPeriods.length);
      }
    },
    onMenu: () => {
      router.push('/');
    },
    onConfirm: () => {
      refresh();
    }
  });

  // Split entries into Podium (1, 2, 3) and List (4+)
  const entries = data?.entries ?? [];
  const podiumEntries = useMemo(() => {
    const top3 = entries.slice(0, 3);
    const sorted = [
      top3[1] || null, // 2nd place on left
      top3[0] || null, // 1st place in middle
      top3[2] || null  // 3rd place on right
    ];
    return sorted;
  }, [entries]);

  const listEntries = useMemo(() => {
    return entries.slice(3);
  }, [entries]);

  // Format score based on category
  const formatScore = useCallback((val: number, cat: CategoryId) => {
    switch (cat) {
      case 'stars':
        return t('leaderboard.value_stars', { n: val });
      case 'levels':
        return t('leaderboard.value_levels', { n: val });
      case 'records':
        return t('leaderboard.value_records', { n: val });
      case 'creators':
        return t('leaderboard.value_creators', { n: val });
      default:
        return String(val);
    }
  }, [t]);

  // Standing calculation (+/- 2 around user)
  const standingSection = useMemo(() => {
    if (!user || isAnonymous) {
      return { status: 'unauthenticated' as const };
    }

    if (loading || (shouldFetchAroundMe && aroundMeLoading)) {
      return { status: 'loading' as const };
    }

    const myRank = data?.myRank ?? null;
    const myValue = data?.myValue ?? null;

    if (myRank === null || myValue === 0) {
      return { status: 'no_score' as const };
    }

    // Get from aroundMeData
    const aroundEntries = aroundMeData?.entries ?? [];
    const myIndex = aroundEntries.findIndex(e => e.uid === user.uid);
    if (myIndex === -1) {
      // Fallback: search in normal entries
      const normalIndex = entries.findIndex(e => e.uid === user.uid);
      if (normalIndex !== -1) {
        const slice = entries.slice(Math.max(0, normalIndex - 2), normalIndex + 3);
        return { status: 'ranked' as const, entries: slice };
      }
      return { status: 'no_score' as const };
    }

    // Slice +/- 2 around the user
    const slice = aroundEntries.slice(Math.max(0, myIndex - 2), myIndex + 3);
    return { status: 'ranked' as const, entries: slice };
  }, [user, isAnonymous, loading, aroundMeLoading, data, aroundMeData, entries]);

  const handlePlayClick = () => {
    router.push('/levels');
  };

  const handleUserClick = (
    uid: string,
    name: string | null,
    tag: string | null,
    showcase: any[] = [],
    value: number
  ) => {
    const nameParam = name || 'Player';
    const tagParam = tag ? `&tag=${tag}` : '';
    const scoreParam = `&score=${value}&scoreCat=${activeCategory.id}`;
    const showcaseIds = showcase.map((b) => b.id || b.badgeId).filter(Boolean).join(',');
    const showcaseParam = showcaseIds ? `&showcase=${showcaseIds}` : '';
    router.push(`/profile?uid=${uid}&name=${encodeURIComponent(nameParam)}${tagParam}${showcaseParam}${scoreParam}`);
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
      }}
    >
      {/* Header Panel */}
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
        }}
      >
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
          {t('leaderboard.back')}
        </button>

        {/* Refresh button */}
        {!isFriendsCategory && (
          <button
            onClick={() => refresh()}
            style={{
              background: 'transparent',
              border: `1px solid ${activeCategory.color}30`,
              color: activeCategory.color,
              fontSize: '12px',
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${activeCategory.color}15`;
              e.currentTarget.style.borderColor = activeCategory.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = `${activeCategory.color}30`;
            }}
          >
            ⟳ {t('hud.restart')}
          </button>
        )}
      </div>

      {/* Main Glowing Title */}
      <h1
        style={{
          fontSize: '32px',
          fontWeight: 900,
          letterSpacing: '0.12em',
          textAlign: 'center',
          color: activeCategory.color,
          textShadow: `0 0 16px ${activeCategory.glow}, 0 0 32px ${activeCategory.color}20`,
          margin: '0 0 24px 0',
          textTransform: 'uppercase',
          transition: 'color 0.3s, text-shadow 0.3s',
        }}
      >
        {t('leaderboard.title')}
      </h1>

      {/* Category Tabs Wrapper */}
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          display: 'flex',
          gap: '8px',
          paddingBottom: '8px',
          marginBottom: '20px',
        }}
        className="no-scrollbar"
      >
        {CATEGORIES.map((cat, idx) => {
          const isSelected = catIndex === idx;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setCatIndex(idx);
                setPeriodIndex(0);
              }}
              style={{
                flexShrink: 0,
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '8px',
                border: isSelected ? `1px solid ${cat.color}` : '1px solid #1f2937',
                background: isSelected ? `${cat.color}15` : '#11182780',
                color: isSelected ? cat.color : '#9ca3af',
                cursor: 'pointer',
                boxShadow: isSelected ? `0 0 12px ${cat.color}20` : 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = `${cat.color}60`;
                  e.currentTarget.style.color = '#e2e8f0';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#1f2937';
                  e.currentTarget.style.color = '#9ca3af';
                }
              }}
            >
              {t(cat.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Period Tabs Wrapper */}
      {!isFriendsCategory && (
        <div
          style={{
            display: 'flex',
            gap: '6px',
            background: '#090d16',
            padding: '4px',
            borderRadius: '8px',
            border: '1px solid #111827',
            marginBottom: '32px',
          }}
        >
          {activeCategory.periods.map((p, idx) => {
            const isSelected = periodIndex === idx;
            return (
              <button
                key={p}
                onClick={() => setPeriodIndex(idx)}
                style={{
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  background: isSelected ? activeCategory.color : 'transparent',
                  color: isSelected ? '#030712' : '#6b7280',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.color = '#e2e8f0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.color = '#6b7280';
                  }
                }}
              >
                {t(`leaderboard.period_${p}`)}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        {isFriendsCategory && isAnonymous ? (
          /* Unauthenticated Placeholder for Friends Tab */
          <div
            style={{
              width: '100%',
              padding: '40px 24px',
              textAlign: 'center',
              border: `1px solid ${activeCategory.color}25`,
              background: '#11182740',
              borderRadius: '16px',
              boxShadow: `0 0 24px ${activeCategory.color}05`,
            }}
          >
            <span style={{ fontSize: '36px', display: 'block', marginBottom: '16px' }}>👥</span>
            <p style={{ fontSize: '15px', color: '#9ca3af', marginBottom: '20px' }}>
              {t('leaderboard.login_required')}
            </p>
            <button
              onClick={() => setAuthModalOpen(true)}
              style={{
                padding: '10px 24px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '8px',
                border: `1px solid ${activeCategory.color}`,
                background: `${activeCategory.color}15`,
                color: activeCategory.color,
                cursor: 'pointer',
                boxShadow: `0 0 14px ${activeCategory.color}20`,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = activeCategory.color;
                e.currentTarget.style.color = '#030712';
                e.currentTarget.style.boxShadow = `0 0 20px ${activeCategory.color}50`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${activeCategory.color}15`;
                e.currentTarget.style.color = activeCategory.color;
                e.currentTarget.style.boxShadow = `0 0 14px ${activeCategory.color}20`;
              }}
            >
              {t('auth.sign_in')}
            </button>
          </div>
        ) : isFriendsCategory && entries.length === 0 && !loading ? (
          /* Empty State Placeholder for Friends Tab */
          <div
            style={{
              width: '100%',
              padding: '40px 24px',
              textAlign: 'center',
              border: `1px solid ${activeCategory.color}25`,
              background: '#11182740',
              borderRadius: '16px',
              boxShadow: `0 0 24px ${activeCategory.color}05`,
            }}
          >
            <span style={{ fontSize: '36px', display: 'block', marginBottom: '16px' }}>👥</span>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '20px' }}>
              {t('leaderboard.no_friends')}
            </p>
            <button
              onClick={() => router.push('/friends')}
              style={{
                padding: '10px 20px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid #1f2937',
                background: '#111827',
                color: '#e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1f2937';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#111827';
              }}
            >
              {t('leaderboard.go_to_friends')}
            </button>
          </div>
        ) : loading ? (
          /* Loading Indicator */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: `3px solid ${activeCategory.color}20`,
                borderTopColor: activeCategory.color,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '16px',
              }}
            />
            <span style={{ fontSize: '12px', letterSpacing: '0.1em', color: '#6b7280' }}>
              {t('leaderboard.loading').toUpperCase()}
            </span>
          </div>
        ) : error ? (
          /* Error State */
          <div
            style={{
              width: '100%',
              padding: '20px',
              textAlign: 'center',
              border: '1px solid #ff2d5530',
              background: '#ff2d5508',
              color: '#ff2d55',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            ⚠️ {t('leaderboard.error')}
          </div>
        ) : (
          /* Normal List Render */
          <>
            {/* Podium (Ranks 1-3) */}
            {entries.length > 0 && (
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: '12px',
                  marginBottom: '24px',
                  minHeight: '220px',
                  padding: '0 8px',
                  boxSizing: 'border-box',
                }}
              >
                {podiumEntries.map((entry, idx) => {
                  if (!entry) {
                    // Empty spacer pedestal if we don't have enough entries
                    return <div key={`empty-${idx}`} style={{ flex: 1 }} />;
                  }

                  const isFirst = entry.rank === 1;
                  const isSecond = entry.rank === 2;
                  const isThird = entry.rank === 3;

                  let medalColor = '#ffd700'; // gold
                  let pedestalHeight = '150px';
                  let glowColor = 'rgba(255, 215, 0, 0.35)';

                  if (isSecond) {
                    medalColor = '#a8a29e'; // silver
                    pedestalHeight = '115px';
                    glowColor = 'rgba(168, 162, 158, 0.25)';
                  } else if (isThird) {
                    medalColor = '#b45309'; // bronze
                    pedestalHeight = '85px';
                    glowColor = 'rgba(180, 83, 9, 0.2)';
                  }

                  const nameText = entry.displayName || 'Player';
                  const isSelf = user?.uid === entry.uid;

                  return (
                    <motion.div
                      key={entry.uid}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      {/* Avatar/Name Header Above Pedestal */}
                      <div
                        style={{
                          textAlign: 'center',
                          marginBottom: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          width: '100%',
                        }}
                      >
                        {isFirst && (
                          <span style={{ fontSize: '20px', marginBottom: '-2px', filter: 'drop-shadow(0 0 6px #ffd700)' }}>
                            👑
                          </span>
                        )}
                        <span
                          onClick={() => handleUserClick(entry.uid, entry.displayName, entry.tag, entry.showcaseBadges, entry.value)}
                          style={{
                            fontSize: isFirst ? '14px' : '12px',
                            fontWeight: isFirst ? 800 : 700,
                            color: isSelf ? '#00ff88' : '#e2e8f0',
                            maxWidth: '90px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                          }}
                          title={nameText}
                          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                        >
                          {nameText}
                          {entry.tag && (
                            <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '2px' }}>
                              [{entry.tag}]
                            </span>
                          )}
                        </span>

                        {/* Showcase badges */}
                        <div style={{ display: 'flex', gap: '3px', marginTop: '2px', minHeight: '12px' }}>
                          {entry.showcaseBadges && entry.showcaseBadges.length > 0 ? (
                            entry.showcaseBadges.map((badge: any, bIdx: number) => (
                              <BadgeIcon
                                key={badge.id || bIdx}
                                badgeType={badge.badgeType}
                                periodId={badge.periodId}
                                rank={badge.rank}
                                size="sm"
                              />
                            ))
                          ) : (
                            <span style={{ opacity: 0.15, fontSize: '9px' }}>-</span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: activeCategory.color,
                            marginTop: '2px',
                          }}
                        >
                          {formatScore(entry.value, activeCategory.id)}
                        </span>
                      </div>

                      {/* Pedestal Structure */}
                      <div
                        style={{
                          width: '100%',
                          height: pedestalHeight,
                          background: `linear-gradient(to top, #090d16, ${medalColor}12)`,
                          border: `1px solid ${medalColor}40`,
                          borderBottom: 'none',
                          borderTopLeftRadius: '10px',
                          borderTopRightRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: `0 0 16px ${glowColor}`,
                          position: 'relative',
                        }}
                      >
                        <span
                          style={{
                            fontSize: isFirst ? '32px' : '24px',
                            fontWeight: 900,
                            color: medalColor,
                            textShadow: `0 0 10px ${medalColor}70`,
                          }}
                        >
                          {entry.rank}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* List Rows (Ranks 4-50) */}
            {listEntries.length > 0 && (
              <div
                style={{
                  width: '100%',
                  background: '#090d1640',
                  border: '1px solid #111827',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  marginBottom: '20px',
                }}
              >
                {listEntries.map((entry, idx) => {
                  const isSelf = user?.uid === entry.uid;
                  const nameText = entry.displayName || 'Player';

                  return (
                    <div
                      key={entry.uid}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderBottom: idx === listEntries.length - 1 ? 'none' : '1px solid #111827',
                        borderLeft: isSelf ? '3px solid #00ff88' : '3px solid transparent',
                        background: isSelf ? 'rgba(0, 255, 136, 0.03)' : 'transparent',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isSelf
                          ? 'rgba(0, 255, 136, 0.06)'
                          : 'rgba(255, 255, 255, 0.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelf
                          ? 'rgba(0, 255, 136, 0.03)'
                          : 'transparent';
                      }}
                    >
                      {/* Left side: Rank + Username */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#6b7280',
                            width: '20px',
                          }}
                        >
                          {entry.rank}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span
                            onClick={() => handleUserClick(entry.uid, entry.displayName, entry.tag, entry.showcaseBadges, entry.value)}
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: isSelf ? '#00ff88' : '#e2e8f0',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                          >
                            {nameText}
                            {entry.tag && (
                              <span style={{ fontSize: '9.5px', color: '#6b7280', marginLeft: '4px' }}>
                                [{entry.tag}]
                              </span>
                            )}
                          </span>

                          {/* Showcase badges */}
                          <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                            {entry.showcaseBadges && entry.showcaseBadges.length > 0 ? (
                              entry.showcaseBadges.map((badge: any, bIdx: number) => (
                                <BadgeIcon
                                  key={badge.id || bIdx}
                                  badgeType={badge.badgeType}
                                  periodId={badge.periodId}
                                  rank={badge.rank}
                                  size="sm"
                                />
                              ))
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Score */}
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: isSelf ? '#00ff88' : '#9ca3af',
                        }}
                      >
                        {formatScore(entry.value, activeCategory.id)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* "Senin Yerin" (My Standing) Sticky Section */}
      {!isFriendsCategory && (
        <div
          style={{
            width: '100%',
            maxWidth: '600px',
            marginTop: '28px',
            borderTop: '1px solid #111827',
            paddingTop: '24px',
            boxSizing: 'border-box',
          }}
        >
          <h3
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.15em',
              color: '#4b5563',
              marginBottom: '12px',
              textTransform: 'uppercase',
            }}
          >
            {t('leaderboard.standing')}
          </h3>

          {standingSection.status === 'unauthenticated' && (
            /* User not logged in */
            <div
              style={{
                width: '100%',
                padding: '16px 20px',
                borderRadius: '8px',
                background: '#11182740',
                border: '1px dashed #374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>
                {t('leaderboard.login_required')}
              </span>
              <button
                onClick={() => setAuthModalOpen(true)}
                style={{
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid #00ff88',
                  background: 'rgba(0, 255, 136, 0.05)',
                  color: '#00ff88',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#00ff88';
                  e.currentTarget.style.color = '#030712';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 255, 136, 0.05)';
                  e.currentTarget.style.color = '#00ff88';
                }}
              >
                {t('auth.sign_in')}
              </button>
            </div>
          )}

          {standingSection.status === 'loading' && (
            /* Loading */
            <div
              style={{
                width: '100%',
                height: '52px',
                background: '#11182730',
                border: '1px solid #111827',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderTopColor: '#9ca3af',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          )}

          {standingSection.status === 'no_score' && (
            /* Score is null / 0 */
            <div
              style={{
                width: '100%',
                padding: '16px 20px',
                borderRadius: '8px',
                background: '#11182740',
                border: '1px dashed #374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>
                {t('leaderboard.no_score')}
              </span>
              <button
                onClick={handlePlayClick}
                style={{
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid #ffd700',
                  background: 'rgba(255, 215, 0, 0.05)',
                  color: '#ffd700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ffd700';
                  e.currentTarget.style.color = '#030712';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 215, 0, 0.05)';
                  e.currentTarget.style.color = '#ffd700';
                }}
              >
                {t('home.play').toUpperCase()}
              </button>
            </div>
          )}

          {standingSection.status === 'ranked' && standingSection.entries && (
            /* Surrounding List */
            <div
              style={{
                width: '100%',
                background: '#090d1650',
                border: '1px solid #111827',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              {standingSection.entries.map((entry, idx) => {
                const isSelf = user?.uid === entry.uid;
                const nameText = entry.displayName || 'Player';

                return (
                  <div
                    key={`standing-${entry.uid}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderBottom: idx === standingSection.entries!.length - 1 ? 'none' : '1px solid #111827',
                      borderLeft: isSelf ? '3px solid #00ff88' : '3px solid transparent',
                      background: isSelf ? 'rgba(0, 255, 136, 0.04)' : 'transparent',
                      opacity: isSelf ? 1 : 0.55,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#6b7280', width: '20px' }}>
                        {entry.rank}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span
                          onClick={() => handleUserClick(entry.uid, entry.displayName, entry.tag, entry.showcaseBadges, entry.value)}
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 700,
                            color: isSelf ? '#00ff88' : '#e2e8f0',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                        >
                          {nameText}
                          {entry.tag && (
                            <span style={{ fontSize: '9px', color: '#6b7280', marginLeft: '4px' }}>
                              [{entry.tag}]
                            </span>
                          )}
                        </span>

                        {/* Showcase badges */}
                        <div style={{ display: 'flex', gap: '2px', marginTop: '1px' }}>
                          {entry.showcaseBadges && entry.showcaseBadges.length > 0 ? (
                            entry.showcaseBadges.map((badge: any, bIdx: number) => (
                              <BadgeIcon
                                key={badge.id || bIdx}
                                badgeType={badge.badgeType}
                                periodId={badge.periodId}
                                rank={badge.rank}
                                size="sm"
                              />
                            ))
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: isSelf ? '#00ff88' : '#9ca3af' }}>
                      {formatScore(entry.value, activeCategory.id)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Authentication Modal */}
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}

      <style jsx global>{`
        /* Hide scrollbar for Chrome, Safari and Opera */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for IE, Edge and Firefox */
        .no-scrollbar {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
