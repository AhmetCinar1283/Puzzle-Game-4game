'use client';

import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthContext } from '../src/contexts/AuthContext';
import { useT } from '../src/contexts/LanguageContext';
import { useGamepad } from '../src/hooks/useGamepad';
import { useFriends } from '../src/hooks/useFriends';
import BadgeIcon from '../src/components/BadgeIcon';
import AuthModal from '../src/components/AuthModal';

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

export default function FriendsClient() {
  const t = useT();
  const router = useRouter();
  const { user, isAnonymous } = useAuthContext();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [particles, setParticles] = useState<Particle[]>([]);

  // Friends Hook
  const {
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
    search,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
  } = useFriends();

  // Floating background particles
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

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // Gamepad controls
  useGamepad({
    onMenu: () => {
      router.push('/');
    },
  });

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    search(searchInput.trim());
  };

  // Safe tag input handler (only letters A-Z, numbers 2-9, max 10 chars)
  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    const tagRegex = /^[A-Z2-9]*$/;
    if (tagRegex.test(value) && value.length <= 10) {
      setSearchInput(value);
    }
  };

  const handleFriendClick = (friend: { uid: string; displayName: string; tag: string | null; showcaseBadges?: any[] }) => {
    const nameParam = friend.displayName || 'Player';
    const tagParam = friend.tag ? `&tag=${friend.tag}` : '';
    const showcaseIds = (friend.showcaseBadges || [])
      .map((b) => b.id || b.badgeId)
      .filter(Boolean)
      .join(',');
    const showcaseParam = showcaseIds ? `&showcase=${showcaseIds}` : '';
    router.push(`/profile?uid=${friend.uid}&name=${encodeURIComponent(nameParam)}${tagParam}${showcaseParam}`);
  };

  const isAuth = !!user && !isAnonymous;

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
      {/* Floating particles background */}
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

      {/* Main Container */}
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
            {t('friends.back_menu')}
          </button>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 900,
            letterSpacing: '0.12em',
            textAlign: 'center',
            color: '#ec4899',
            textShadow: '0 0 16px rgba(236, 72, 153, 0.4), 0 0 32px rgba(236, 72, 153, 0.2)',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
          }}
        >
          {t('friends.title')}
        </h1>

        {/* Status Messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255, 45, 85, 0.08)',
                border: '1px solid rgba(255, 45, 85, 0.3)',
                color: '#ff2d55',
                borderRadius: '8px',
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              ⚠️ {error.startsWith('friends.') ? t(error) : error}
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(0, 255, 136, 0.08)',
                border: '1px solid rgba(0, 255, 136, 0.3)',
                color: '#00ff88',
                borderRadius: '8px',
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              ✓ {t(successMsg)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Card logic */}
        {!isAuth ? (
          /* Unauthenticated Panel */
          <div
            style={{
              background: 'linear-gradient(to bottom, #0a0f1a, #070a12)',
              border: '1px solid rgba(236, 72, 153, 0.2)',
              borderRadius: '16px',
              padding: '40px 24px',
              textAlign: 'center',
              boxShadow: '0 0 30px rgba(236, 72, 153, 0.03)',
            }}
          >
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>👥</span>
            <p style={{ fontSize: '15px', color: '#9ca3af', marginBottom: '24px' }}>
              {t('friends.login_required')}
            </p>
            <button
              onClick={() => setAuthModalOpen(true)}
              style={{
                padding: '12px 28px',
                fontSize: '14px',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid #ec4899',
                background: 'rgba(236, 72, 153, 0.15)',
                color: '#ec4899',
                cursor: 'pointer',
                boxShadow: '0 0 14px rgba(236, 72, 153, 0.2)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ec4899';
                e.currentTarget.style.color = '#030712';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(236, 72, 153, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(236, 72, 153, 0.15)';
                e.currentTarget.style.color = '#ec4899';
                e.currentTarget.style.boxShadow = '0 0 14px rgba(236, 72, 153, 0.2)';
              }}
            >
              {t('auth.sign_in')}
            </button>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <>
            {/* Search Panel */}
            <div
              style={{
                background: 'linear-gradient(to bottom, #0a0f1a, #070a12)',
                border: '1px solid rgba(0, 196, 255, 0.15)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 0 24px rgba(0, 196, 255, 0.02)',
              }}
            >
              <h3
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.15em',
                  color: '#4b5563',
                  textTransform: 'uppercase',
                  margin: '0 0 14px 0',
                }}
              >
                {t('friends.search_title')}
              </h3>

              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder={t('friends.search_placeholder')}
                  value={searchInput}
                  onChange={handleTagInputChange}
                  maxLength={10}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    background: '#060c16',
                    border: '1px solid #1f2937',
                    borderRadius: '8px',
                    color: '#e5e7eb',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    textTransform: 'uppercase',
                    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.6)',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#00c4ff';
                    e.target.style.boxShadow = '0 0 8px rgba(0, 196, 255, 0.3), inset 0 2px 4px rgba(0, 0, 0, 0.6)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#1f2937';
                    e.target.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.6)';
                  }}
                />
                <button
                  type="submit"
                  disabled={searching || !searchInput.trim()}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(0, 196, 255, 0.1)',
                    border: '1px solid rgba(0, 196, 255, 0.3)',
                    borderRadius: '8px',
                    color: '#00c4ff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 0 12px rgba(0, 196, 255, 0.08)',
                  }}
                  onMouseEnter={(e) => {
                    if (!searching && searchInput.trim()) {
                      e.currentTarget.style.background = '#00c4ff';
                      e.currentTarget.style.color = '#030712';
                      e.currentTarget.style.boxShadow = '0 0 18px rgba(0, 196, 255, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 196, 255, 0.1)';
                    e.currentTarget.style.color = '#00c4ff';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 196, 255, 0.08)';
                  }}
                >
                  {searching ? '...' : t('friends.search_btn')}
                </button>
              </form>

              {/* Search Results Display */}
              {searchResults.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #111827', paddingTop: '16px' }}>
                  {searchResults.map((result) => {
                    const isBusy = actionBusy[result.uid];
                    return (
                      <div
                        key={result.uid}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid #111827',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span
                            onClick={() => handleFriendClick(result)}
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: '#e2e8f0',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                          >
                            {result.displayName}
                            {result.tag && (
                              <span style={{ fontSize: '9.5px', color: '#00c4ff', marginLeft: '4px', fontWeight: 800 }}>
                                [{result.tag}]
                              </span>
                            )}
                          </span>

                          {/* Showcase Badges */}
                          <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                            {result.showcaseBadges && result.showcaseBadges.length > 0 ? (
                              result.showcaseBadges.map((badge, bIdx) => (
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

                        {/* Action buttons based on state */}
                        <div>
                          {result.friendshipStatus === 'accepted' && (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#ec4899', opacity: 0.8 }}>
                              {t('friends.already_friends')}
                            </span>
                          )}

                          {result.friendshipStatus === 'pending' && result.friendshipRequestedBy === user.uid && (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', opacity: 0.6 }}>
                              {t('friends.pending_outgoing')}
                            </span>
                          )}

                          {result.friendshipStatus === 'pending' && result.friendshipRequestedBy !== user.uid && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => acceptRequest(result.uid)}
                                disabled={isBusy}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: 'rgba(0, 255, 136, 0.1)',
                                  border: '1px solid rgba(0, 255, 136, 0.3)',
                                  color: '#00ff88',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                }}
                              >
                                {t('friends.accept')}
                              </button>
                              <button
                                onClick={() => rejectRequest(result.uid)}
                                disabled={isBusy}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: 'rgba(255, 45, 85, 0.1)',
                                  border: '1px solid rgba(255, 45, 85, 0.3)',
                                  color: '#ff2d55',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                }}
                              >
                                {t('friends.reject')}
                              </button>
                            </div>
                          )}

                          {result.friendshipStatus === 'none' && (
                            <button
                              onClick={() => sendRequest(result.uid)}
                              disabled={isBusy}
                              style={{
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: 'rgba(0, 255, 136, 0.08)',
                                border: '1px solid rgba(0, 255, 136, 0.3)',
                                color: '#00ff88',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
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
                              {isBusy ? '...' : t('friends.add_friend')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Incoming Requests Panel */}
            <div
              style={{
                background: '#0a0f1a50',
                border: '1px solid #111827',
                borderRadius: '16px',
                padding: '20px 24px',
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
                {t('friends.pending_requests')}
              </h3>

              {loadingRequests ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.1)',
                      borderTopColor: '#ec4899',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                </div>
              ) : requests.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {requests.map((req) => {
                    const isBusy = actionBusy[req.uid];
                    return (
                      <div
                        key={req.uid}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid #111827',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span
                            onClick={() => handleFriendClick(req)}
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#e2e8f0',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                          >
                            {req.displayName}
                            {req.tag && (
                              <span style={{ fontSize: '9px', color: '#6b7280', marginLeft: '4px' }}>
                                [{req.tag}]
                              </span>
                            )}
                          </span>

                          <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                            {req.showcaseBadges && req.showcaseBadges.length > 0 ? (
                              req.showcaseBadges.map((badge, bIdx) => (
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

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => acceptRequest(req.uid)}
                            disabled={isBusy}
                            style={{
                              padding: '5px 12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: 'rgba(0, 255, 136, 0.08)',
                              border: '1px solid rgba(0, 255, 136, 0.3)',
                              color: '#00ff88',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
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
                            {isBusy ? '...' : t('friends.accept')}
                          </button>
                          <button
                            onClick={() => rejectRequest(req.uid)}
                            disabled={isBusy}
                            style={{
                              padding: '5px 12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: 'rgba(255, 45, 85, 0.08)',
                              border: '1px solid rgba(255, 45, 85, 0.3)',
                              color: '#ff2d55',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
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
                            {isBusy ? '...' : t('friends.reject')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: '#4b5563', fontSize: '12.5px', fontStyle: 'italic', margin: 0 }}>
                  {t('friends.no_requests')}
                </p>
              )}
            </div>

            {/* Friends List Panel */}
            <div
              style={{
                background: '#0a0f1a50',
                border: '1px solid #111827',
                borderRadius: '16px',
                padding: '20px 24px',
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
                {t('friends.my_friends', { n: friends.length })}
              </h3>

              {loadingFriends ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid rgba(255,255,255,0.1)',
                      borderTopColor: '#ec4899',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                </div>
              ) : friends.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {friends.map((friend) => {
                    const isBusy = actionBusy[friend.uid];
                    return (
                      <div
                        key={friend.uid}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid #111827',
                          borderRadius: '8px',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(236,72,153,0.25)')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#111827')}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span
                            onClick={() => handleFriendClick(friend)}
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#e2e8f0',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                          >
                            {friend.displayName}
                            {friend.tag && (
                              <span style={{ fontSize: '9.5px', color: '#6b7280', marginLeft: '4px' }}>
                                [{friend.tag}]
                              </span>
                            )}
                          </span>

                          {/* Showcase Badges */}
                          <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                            {friend.showcaseBadges && friend.showcaseBadges.length > 0 ? (
                              friend.showcaseBadges.map((badge, bIdx) => (
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

                        <button
                          onClick={() => {
                            if (window.confirm(t('levels.delete_title') === 'Emin misiniz?' ? 'Bu arkadaşı silmek istediğinize emin misiniz?' : 'Are you sure you want to remove this friend?')) {
                              removeFriend(friend.uid);
                            }
                          }}
                          disabled={isBusy}
                          style={{
                            padding: '6px 12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: 'rgba(255, 45, 85, 0.06)',
                            border: '1px solid rgba(255, 45, 85, 0.3)',
                            color: '#ff2d55',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ff2d55';
                            e.currentTarget.style.color = '#030712';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 45, 85, 0.06)';
                            e.currentTarget.style.color = '#ff2d55';
                          }}
                        >
                          {isBusy ? '...' : t('friends.remove_friend')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: '#4b5563', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>
                  {t('friends.no_friends_desc')}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Auth Modal for Sign In */}
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}

      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
