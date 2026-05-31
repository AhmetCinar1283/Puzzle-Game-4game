'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/app/src/contexts/LanguageContext';
import { AdminGuard } from '@/app/src/components/AdminGuard';
import { fetchAdminApi } from '@/app/src/lib/api/adminClient';
import { useAuth } from '@/app/src/hooks/useAuth';

// Types derived from Worker API endpoints
type UserProfileData = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  tag?: string | null;
  role: string;
  authProvider: string;
  totalScore: number;
  completedCount: number;
  createdAt?: string | null;
  acceptedTermsAt?: string | null;
};

type AuditLogStat = {
  category: 'game' | 'support' | 'account' | 'payment' | 'admin';
  count: number;
};

type AuditLogEntry = {
  id: string;
  uid: string;
  action: string;
  category: 'game' | 'support' | 'account' | 'payment' | 'admin';
  metadata: any;
  created_at: string;
};

type PlayedLevelEntry = {
  levelId: string;
  stars: number;
  moveCount: number | null;
  timeSpent: number | null;
  completedAt: string | null;
  updatedAt: string | null;
};

const CATEGORY_DETAILS = {
  game: { label: { tr: 'Oyun', en: 'Game' }, color: '#00ff88', glow: '0 0 10px #00ff88' },
  support: { label: { tr: 'Destek', en: 'Support' }, color: '#ffd700', glow: '0 0 10px #ffd700' },
  account: { label: { tr: 'Hesap', en: 'Account' }, color: '#00c4ff', glow: '0 0 10px #00c4ff' },
  payment: { label: { tr: 'Ödeme', en: 'Payment' }, color: '#fb923c', glow: '0 0 10px #fb923c' },
  admin: { label: { tr: 'Admin', en: 'Admin' }, color: '#ec4899', glow: '0 0 10px #ec4899' },
};

export default function AdminUserProfileClient() {
  const router = useRouter();
  const { lang } = useLanguage();
  const isTr = lang === 'tr';
  
  // Resolve uid dynamic query parameter from searchParams at runtime
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') || '';

  const { user, loading: authLoading } = useAuth();

  // Core profile data states
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [stats, setStats] = useState<AuditLogStat[]>([]);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [playedLevels, setPlayedLevels] = useState<PlayedLevelEntry[]>([]);
  const [playedSort, setPlayedSort] = useState<'date' | 'stars' | 'time'>('date');

  // Logs states
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [logsOffset, setLogsOffset] = useState(0);
  const [logsHasMore, setLogsHasMore] = useState(true);
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);

  // Logs filters
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [actionQuery, setActionQuery] = useState('');
  const [debouncedActionQuery, setDebouncedActionQuery] = useState('');
  const [dateAfter, setDateAfter] = useState('');
  const [dateBefore, setDateBefore] = useState('');

  // Skeletons and Loadings
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Debouncing Action search filter
  useEffect(() => {
    const t = setTimeout(() => setDebouncedActionQuery(actionQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [actionQuery]);

  // Load profile & statistics
  useEffect(() => {
    async function loadWorkspaceData() {
      setLoadingProfile(true);
      try {
        const [profileRes, statsRes, levelsRes] = await Promise.all([
          fetchAdminApi(`/admin/users/${uid}`),
          fetchAdminApi(`/admin/users/${uid}/stats`),
          fetchAdminApi(`/admin/users/${uid}/played-levels?limit=100`),
        ]);

        if (profileRes.success) {
          setProfile(profileRes.user);
        }
        if (statsRes.success) {
          const s = statsRes.stats || { totalCount: 0, levelsCompleted: 0, ticketsCreated: 0 };
          const gameCount = s.levelsCompleted || 0;
          const supportCount = s.ticketsCreated || 0;
          const accountCount = Math.max(0, (s.totalCount || 0) - gameCount - supportCount);

          const mappedStats: AuditLogStat[] = [
            { category: 'game' as const, count: gameCount },
            { category: 'support' as const, count: supportCount },
            { category: 'account' as const, count: accountCount },
          ].filter(item => item.count > 0);

          setStats(mappedStats);
          setLastActivity(statsRes.lastActivity || null);
        }
        if (levelsRes.success) {
          setPlayedLevels(levelsRes.playedLevels || []);
        }
      } catch (err) {
        console.error('[AdminWorkspace] Error loading workspace data:', err);
      } finally {
        setLoadingProfile(false);
      }
    }

    if (uid && !authLoading && user) {
      loadWorkspaceData();
    }
  }, [uid, authLoading, user]);

  // Load audit logs with dynamic filters
  useEffect(() => {
    let active = true;

    async function loadLogs() {
      setLoadingLogs(true);
      try {
        // Construct query parameters
        const params = new URLSearchParams();
        params.append('limit', '15');
        params.append('offset', '0'); // Reset offset on filter change

        if (activeCategory !== 'all') {
          params.append('category', activeCategory);
        }
        if (debouncedActionQuery !== '') {
          params.append('action', debouncedActionQuery);
        }
        if (dateAfter !== '') {
          params.append('after', new Date(dateAfter).toISOString());
        }
        if (dateBefore !== '') {
          params.append('before', new Date(dateBefore).toISOString());
        }

        const res = await fetchAdminApi(`/admin/users/${uid}/logs?${params.toString()}`);
        if (res.success && active) {
          setLogs(res.logs || []);
          setLogsOffset(0);
          setLogsHasMore((res.logs || []).length === 15);
        }
      } catch (err) {
        console.error('[AdminWorkspace] Error querying logs:', err);
      } finally {
        if (active) setLoadingLogs(false);
      }
    }

    if (uid && !authLoading && user) {
      loadLogs();
    }

    return () => {
      active = false;
    };
  }, [uid, activeCategory, debouncedActionQuery, dateAfter, dateBefore, authLoading, user]);

  // Fetch more logs (Pagination)
  const fetchMoreLogs = async () => {
    if (logsLoadingMore || !logsHasMore || !uid) return;

    setLogsLoadingMore(true);
    try {
      const nextOffset = logsOffset + 15;
      const params = new URLSearchParams();
      params.append('limit', '15');
      params.append('offset', String(nextOffset));

      if (activeCategory !== 'all') {
        params.append('category', activeCategory);
      }
      if (debouncedActionQuery !== '') {
        params.append('action', debouncedActionQuery);
      }
      if (dateAfter !== '') {
        params.append('after', new Date(dateAfter).toISOString());
      }
      if (dateBefore !== '') {
        params.append('before', new Date(dateBefore).toISOString());
      }

      const res = await fetchAdminApi(`/admin/users/${uid}/logs?${params.toString()}`);
      if (res.success) {
        const nextLogs = res.logs || [];
        setLogs((prev) => [...prev, ...nextLogs]);
        setLogsOffset(nextOffset);
        setLogsHasMore(nextLogs.length === 15);
      }
    } catch (err) {
      console.error('[AdminWorkspace] Error paginating logs:', err);
    } finally {
      setLogsLoadingMore(false);
    }
  };

  // Human-readable parser for JSON metadata payloads
  const formatLogMetadata = (log: AuditLogEntry) => {
    const meta = log.metadata || {};
    const act = log.action;

    switch (act) {
      case 'account.create':
        return isTr
          ? `👤 Yeni profil oluşturuldu. Kayıt sağlayıcı: **${meta.provider || log.metadata.authProvider || 'anonymous'}**`
          : `👤 New profile created. Auth provider: **${meta.provider || log.metadata.authProvider || 'anonymous'}**`;

      case 'account.tag_change':
        return isTr
          ? `🏷️ GamerTag değiştirildi. Yeni etiket: **#${meta.tag || meta.newTag}**`
          : `🏷️ GamerTag changed. New label: **#${meta.tag || meta.newTag}**`;

      case 'level.complete':
        return isTr
          ? `🏆 **${meta.levelId}** seviyesini **${meta.stars} Yıldız** ile **${meta.timeSpent} saniyede** tamamladı (${meta.moveCount} hamle).`
          : `🏆 Completed **${meta.levelId}** with **${meta.stars} Stars** in **${meta.timeSpent} seconds** (${meta.moveCount} moves).`;

      case 'level.start':
        return isTr
          ? `🎮 **${meta.levelId}** seviyesini oynamaya başladı.`
          : `🎮 Started playing level **${meta.levelId}**.`;

      case 'ticket.create':
        return isTr
          ? `✉️ **#${meta.ticketId || meta.id}** nolu destek talebini oluşturdu. Başlık: **"${meta.subject}"**`
          : `✉️ Opened support ticket **#${meta.ticketId || meta.id}**. Subject: **"${meta.subject}"**`;

      case 'ticket.reply':
        return isTr
          ? `💬 **#${meta.ticketId}** nolu destek talebine yanıt gönderdi.`
          : `💬 Sent a reply to support ticket **#${meta.ticketId}**.`;

      case 'payment.success':
        return isTr
          ? `💳 Abonelik ödemesi başarıyla tahsil edildi. Tutar: **$${meta.amount || '9.99'}**. Ref: **${meta.ref || meta.transactionId}**`
          : `💳 Subscription payment successful. Amount: **$${meta.amount || '9.99'}**. Ref: **${meta.ref || meta.transactionId}**`;

      case 'payment.failed':
        return isTr
          ? `❌ Ödeme Hatası! Başarısız ödeme denemesi. Neden: **${meta.reason || 'insufficient_funds'}**. Ref: **${meta.ref || meta.transactionId || 'N/A'}**`
          : `❌ Payment Failed! Unsuccessful billing attempt. Reason: **${meta.reason || 'insufficient_funds'}**. Ref: **${meta.ref || meta.transactionId || 'N/A'}**`;

      case 'admin.ban':
        return isTr
          ? `🚫 Sistem erişimi askıya alındı (Banned). Gerekçe: **${meta.reason || 'Bilinmiyor'}**`
          : `🚫 Access suspended (Banned). Reason: **${meta.reason || 'Unknown'}**`;

      case 'admin.unban':
        return isTr
          ? `🔓 Kullanıcı engeli kaldırıldı.`
          : `🔓 Access suspension lifted (Unbanned).`;

      default:
        // Generic metadata formatter to avoid displaying raw JSON
        if (Object.keys(meta).length > 0) {
          const formattedPairs = Object.entries(meta)
            .map(([k, v]) => `**${k}**: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
            .join(', ');
          return `${act} — [ ${formattedPairs} ]`;
        }
        return `${act}`;
    }
  };

  // Played Levels Sorting logic
  const getSortedLevels = () => {
    const list = [...playedLevels];
    if (playedSort === 'stars') {
      return list.sort((a, b) => b.stars - a.stars);
    }
    if (playedSort === 'time') {
      return list.sort((a, b) => (a.timeSpent ?? 9999) - (b.timeSpent ?? 9999));
    }
    // date (default)
    return list.sort(
      (a, b) =>
        new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
    );
  };

  // Calculate dynamic circular SVG donut chart paths and percentages
  const totalLogs = stats.reduce((acc, curr) => acc + curr.count, 0);
  let accumulatedAngle = 0;

  // Render loading placeholder if no uid present in the query parameter yet
  if (!uid) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#030712',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#9333ea', fontSize: '12px', letterSpacing: '0.15em' }}>
          NO UID SPECIFIED IN PARAMETERS.
        </span>
      </div>
    );
  }

  return (
    <AdminGuard>
      <div
        style={{
          minHeight: '100dvh',
          background: '#030712',
          color: '#e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            background: 'rgba(3, 7, 18, 0.97)',
            borderBottom: '1px solid rgba(147, 51, 234, 0.15)',
            zIndex: 10,
          }}
        >
          <button
            onClick={() => router.push('/admin/users')}
            style={{
              background: 'none',
              border: 'none',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.06em',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#9333ea')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
          >
            {isTr ? '◄ KULLANICILAR' : '◄ USERS DIRECTORY'}
          </button>

          <h1
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#9333ea',
              textShadow: '0 0 12px rgba(147, 51, 234, 0.4)',
            }}
          >
            {isTr ? 'KULLANICI ÇALIŞMA ALANI' : 'USER WORKSPACE'}
          </h1>

          <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
            ID: {uid ? `${uid.slice(0, 8)}...` : ''}
          </span>
        </div>

        {/* Content Container */}
        <main
          style={{
            flex: 1,
            maxWidth: '1200px',
            width: '100%',
            margin: '0 auto',
            padding: '32px 24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
          }}
        >
          {/* Skeleton Loaders or Main Workspace Board */}
          {loadingProfile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Profile Skeleton */}
              <div
                style={{
                  height: '180px',
                  background: 'rgba(255,255,255,0.01)',
                  borderRadius: '16px',
                  border: '1px solid rgba(147, 51, 234, 0.08)',
                  animation: 'pulse 1.5s infinite ease-in-out',
                }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div
                  style={{
                    height: '240px',
                    background: 'rgba(255,255,255,0.01)',
                    borderRadius: '16px',
                    border: '1px solid rgba(147, 51, 234, 0.08)',
                    animation: 'pulse 1.5s infinite ease-in-out',
                  }}
                />
                <div
                  style={{
                    height: '240px',
                    background: 'rgba(255,255,255,0.01)',
                    borderRadius: '16px',
                    border: '1px solid rgba(147, 51, 234, 0.08)',
                    animation: 'pulse 1.5s infinite ease-in-out',
                  }}
                />
              </div>
            </div>
          ) : !profile ? (
            <div style={{ textAlign: 'center', padding: '80px 0', border: '1px dashed #ef4444', borderRadius: '16px' }}>
              <p style={{ color: '#ef4444', fontSize: '15px' }}>
                ❌ {isTr ? 'Kullanıcı profili yüklenemedi veya bulunamadı.' : 'Failed to retrieve user profile.'}
              </p>
            </div>
          ) : (
            <>
              {/* Grid 1: Profile Summary Panel */}
              <section
                style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(147, 51, 234, 0.18)',
                  borderRadius: '16px',
                  padding: '24px 32px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2), inset 0 0 15px rgba(147, 51, 234, 0.02)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '24px',
                  position: 'relative',
                }}
              >
                {/* Decorative glowing gradient backdrop */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '120px',
                    height: '100%',
                    background: 'linear-gradient(to left, rgba(147, 51, 234, 0.04), transparent)',
                    pointerEvents: 'none',
                  }}
                />

                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#00ff88',
                        boxShadow: '0 0 8px #00ff88',
                      }}
                    />
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f1f5f9' }}>
                      {profile.displayName || (isTr ? 'İsimsiz Oyuncu' : 'Anonymous Player')}
                    </h2>
                    {profile.tag && (
                      <span style={{ fontSize: '13px', color: '#9333ea', fontWeight: 800, background: 'rgba(147,51,234,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                        #{profile.tag}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                    UID: {profile.uid}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {isTr ? 'E-POSTA ADRESİ' : 'EMAIL ADDRESS'}
                  </span>
                  <span style={{ fontSize: '13px', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {profile.email || (isTr ? 'Anonim Giriş (E-posta yok)' : 'Anonymous Session (No Email)')}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {isTr ? 'BAĞLANTI TÜRÜ' : 'AUTH PROVIDER'}
                  </span>
                  <span style={{ fontSize: '13px', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700 }}>
                    ⚡ {profile.authProvider}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {isTr ? 'SİSTEM YETKİSİ' : 'SYSTEM ROLE'}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      color: profile.role === 'admin' ? '#ec4899' : profile.role === 'moderator' ? '#00c4ff' : '#94a3b8',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}
                  >
                    ✦ {profile.role}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {isTr ? 'TOPLAM PUAN' : 'TOTAL SCORE'}
                  </span>
                  <span style={{ fontSize: '16px', color: '#00ff88', fontWeight: 900, textShadow: '0 0 8px rgba(0,255,136,0.3)' }}>
                    🏆 {profile.totalScore}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {isTr ? 'BİTEN SEVİYE' : 'COMPLETED LEVELS'}
                  </span>
                  <span style={{ fontSize: '16px', color: '#00c4ff', fontWeight: 900, textShadow: '0 0 8px rgba(0,196,255,0.3)' }}>
                    🏁 {profile.completedCount}
                  </span>
                </div>
              </section>

              {/* Grid 2: Statistics and Levels Played */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                  gap: '24px',
                }}
              >
                {/* Visual Stats Widget */}
                <section
                  style={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid rgba(147, 51, 234, 0.12)',
                    borderRadius: '16px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, letterSpacing: '0.1em', color: '#9333ea', textTransform: 'uppercase' }}>
                    📊 {isTr ? 'KATEGORİSEL ETKİNLİK' : 'ACTIVITY STATISTICS'}
                  </h3>

                  {totalLogs === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: '#475569', fontSize: '12px' }}>
                      {isTr ? 'Etkinlik istatistiği mevcut değil.' : 'No activity logged yet.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
                      {/* Premium Glowing SVG Donut Chart */}
                      <div style={{ width: '130px', height: '130px', position: 'relative' }}>
                        <svg width="100%" height="100%" viewBox="0 0 42 42">
                          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.02)" strokeWidth="3" />
                          {stats.map((st) => {
                            const percent = (st.count / totalLogs) * 100;
                            const strokeDasharray = `${percent} ${100 - percent}`;
                            const strokeDashoffset = 100 - accumulatedAngle + 25; // 25 is offset to start from top
                            accumulatedAngle += percent;
                            const catColor = CATEGORY_DETAILS[st.category]?.color || '#ffffff';

                            return (
                              <circle
                                key={st.category}
                                cx="21"
                                cy="21"
                                r="15.915"
                                fill="transparent"
                                stroke={catColor}
                                strokeWidth="3.2"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                style={{
                                  transition: 'stroke-width 0.2s',
                                  filter: `drop-shadow(0 0 2px ${catColor})`,
                                }}
                              />
                            );
                          })}
                        </svg>
                        {/* Summary counter inside ring */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span style={{ fontSize: '18px', fontWeight: 900, color: '#f1f5f9' }}>{totalLogs}</span>
                          <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {isTr ? 'ETKİNLİK' : 'EVENTS'}
                          </span>
                        </div>
                      </div>

                      {/* Legend / Custom Horizontal Bar list */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '160px' }}>
                        {stats.map((st) => {
                          const percent = Math.round((st.count / totalLogs) * 100);
                          const details = CATEGORY_DETAILS[st.category];
                          if (!details) return null;

                          return (
                            <div key={st.category} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: details.color }} />
                                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>{details.label[isTr ? 'tr' : 'en']}</span>
                                </div>
                                <span style={{ color: '#64748b' }}>
                                  {st.count} ({percent}%)
                                </span>
                              </div>
                              <div style={{ height: '3px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${percent}%`, background: details.color, boxShadow: details.glow }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Last Active Timestamp highlighted */}
                  {lastActivity && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(147, 51, 234, 0.05)', border: '1px solid rgba(147, 51, 234, 0.12)', borderRadius: '8px', fontSize: '11px', color: '#94a3b8' }}>
                      <span style={{ color: '#9333ea', textShadow: '0 0 6px #9333ea' }}>●</span>
                      <span>
                        {isTr ? 'Son Aktiflik Zamanı:' : 'Last System Activity at:'} <b>{new Date(lastActivity).toLocaleString(isTr ? 'tr-TR' : 'en-US')}</b>
                      </span>
                    </div>
                  )}
                </section>

                {/* Completed Played Levels list grid */}
                <section
                  style={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid rgba(147, 51, 234, 0.12)',
                    borderRadius: '16px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, letterSpacing: '0.1em', color: '#9333ea', textTransform: 'uppercase' }}>
                      🏁 {isTr ? 'OYNANAN SEVİYELER' : 'PLAYED LEVELS SUBGRID'}
                    </h3>

                    {/* Sort buttons */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {(['date', 'stars', 'time'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setPlayedSort(s)}
                          style={{
                            background: playedSort === s ? 'rgba(147,51,234,0.15)' : 'transparent',
                            border: '1px solid ' + (playedSort === s ? '#9333ea' : 'rgba(255,255,255,0.06)'),
                            color: playedSort === s ? '#9333ea' : '#475569',
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                          }}
                        >
                          {s === 'date' ? (isTr ? 'Tarih' : 'Date') : s === 'stars' ? (isTr ? 'Yıldız' : 'Stars') : (isTr ? 'Süre' : 'Time')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {playedLevels.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', color: '#475569', fontSize: '12px' }}>
                      {isTr ? 'Henüz hiçbir oyun seviyesi tamamlanmadı.' : 'No completed levels found.'}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        paddingRight: '4px',
                      }}
                    >
                      {getSortedLevels().map((lvl) => {
                        const starsString = Array.from({ length: 3 }, (_, i) => (
                          <span key={i} style={{ color: i < lvl.stars ? '#ffd700' : 'rgba(255,255,255,0.08)' }}>★</span>
                        ));

                        return (
                          <div
                            key={lvl.levelId}
                            style={{
                              background: 'rgba(255,255,255,0.01)',
                              border: '1px solid rgba(255,255,255,0.04)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{lvl.levelId}</span>
                              <span style={{ fontSize: '10px', color: '#475569' }}>
                                {lvl.completedAt ? new Date(lvl.completedAt).toLocaleDateString(isTr ? 'tr-TR' : 'en-US') : ''}
                              </span>
                            </div>

                            {/* Center stars */}
                            <div style={{ fontSize: '13px', display: 'flex', gap: '2px' }}>
                              {starsString}
                            </div>

                            {/* Right hand score / time metrics */}
                            <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#94a3b8' }}>
                              {lvl.timeSpent !== null && (
                                <span>⏱️ <b>{lvl.timeSpent}s</b></span>
                              )}
                              {lvl.moveCount !== null && (
                                <span>👟 <b>{lvl.moveCount}</b></span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* Grid 3: Operational Filterable Audit Log Timeline */}
              <section
                style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(147, 51, 234, 0.12)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, letterSpacing: '0.1em', color: '#9333ea', textTransform: 'uppercase' }}>
                    🕦 {isTr ? 'İŞLEMSEL DENETİM GÜNLÜĞÜ (TIMELINE)' : 'FILTERABLE AUDIT LOG TIMELINE'}
                  </h3>
                </div>

                {/* Interactive Toolbars */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid rgba(147, 51, 234, 0.08)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* Category clickable pill selectors */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {isTr ? 'Kategori Filtresi:' : 'Category Filter:'}
                    </span>

                    {/* All button */}
                    <button
                      onClick={() => setActiveCategory('all')}
                      style={{
                        background: activeCategory === 'all' ? 'rgba(147,51,234,0.15)' : 'transparent',
                        border: '1px solid ' + (activeCategory === 'all' ? '#9333ea' : 'rgba(255,255,255,0.06)'),
                        color: activeCategory === 'all' ? '#9333ea' : '#94a3b8',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isTr ? 'TÜMÜ' : 'ALL'}
                    </button>

                    {/* HSL segment colored buttons */}
                    {Object.entries(CATEGORY_DETAILS).map(([cat, details]) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        style={{
                          background: activeCategory === cat ? `${details.color}1c` : 'transparent',
                          border: '1px solid ' + (activeCategory === cat ? details.color : 'rgba(255,255,255,0.06)'),
                          color: activeCategory === cat ? details.color : '#94a3b8',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          boxShadow: activeCategory === cat ? details.glow + '2a' : 'none',
                          textTransform: 'uppercase',
                        }}
                      >
                        {details.label[isTr ? 'tr' : 'en']}
                      </button>
                    ))}
                  </div>

                  {/* Actions, After, Before inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'center' }}>
                    {/* Action match input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '9px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                        {isTr ? 'Eylem Türü (Action)' : 'Action Match'}
                      </label>
                      <input
                        type="text"
                        value={actionQuery}
                        onChange={(e) => setActionQuery(e.target.value)}
                        placeholder="e.g. level.complete"
                        style={{
                          background: '#060d1a',
                          border: '1px solid rgba(147, 51, 234, 0.15)',
                          color: '#e2e8f0',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          outline: 'none',
                        }}
                      />
                    </div>

                    {/* Date After Filter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '9px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                        {isTr ? 'Şu Tarihten Sonra (After)' : 'Logged After'}
                      </label>
                      <input
                        type="date"
                        value={dateAfter}
                        onChange={(e) => setDateAfter(e.target.value)}
                        style={{
                          background: '#060d1a',
                          border: '1px solid rgba(147, 51, 234, 0.15)',
                          color: '#e2e8f0',
                          borderRadius: '6px',
                          padding: '5px 12px',
                          fontSize: '12px',
                          outline: 'none',
                        }}
                      />
                    </div>

                    {/* Date Before Filter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '9px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                        {isTr ? 'Şu Tarihten Önce (Before)' : 'Logged Before'}
                      </label>
                      <input
                        type="date"
                        value={dateBefore}
                        onChange={(e) => setDateBefore(e.target.value)}
                        style={{
                          background: '#060d1a',
                          border: '1px solid rgba(147, 51, 234, 0.15)',
                          color: '#e2e8f0',
                          borderRadius: '6px',
                          padding: '5px 12px',
                          fontSize: '12px',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Timeline display */}
                {loadingLogs ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                    <span style={{ color: '#9333ea', fontSize: '12px', letterSpacing: '0.1em' }}>
                      {isTr ? 'GÜNLÜKLER OKUNUYOR...' : 'FETCHING AUDIT LOGS...'}
                    </span>
                  </div>
                ) : logs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                    <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
                      {isTr ? 'Filtrelere uyan işlem günlüğü kaydı bulunamadı.' : 'No audit logs found matching filters.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', position: 'relative', paddingLeft: '24px' }}>
                    {/* Vertical line indicator */}
                    <div style={{ position: 'absolute', top: 12, bottom: 12, left: 7, width: '1px', background: 'rgba(147, 51, 234, 0.12)' }} />

                    {logs.map((log) => {
                      const details = CATEGORY_DETAILS[log.category];
                      const dotColor = details?.color || '#ffffff';
                      const dotGlow = details?.glow || 'none';
                      const parsedText = formatLogMetadata(log);
                      const timeStr = new Date(log.created_at).toLocaleString(isTr ? 'tr-TR' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });

                      return (
                        <div
                          key={log.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            position: 'relative',
                            paddingBottom: '20px',
                          }}
                        >
                          {/* Glowing left dot */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '-21px',
                              top: '7px',
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              background: dotColor,
                              boxShadow: `0 0 8px ${dotColor}`,
                              border: '1.5px solid #030712',
                            }}
                          />

                          {/* Content Row */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '240px' }}>
                              {/* Human readable payload text (supports markdown **Bold**) */}
                              <span
                                style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.4' }}
                                dangerouslySetInnerHTML={{
                                  __html: parsedText
                                    .replace(/\*\*(.*?)\*\*/g, '<b style="color:#ffffff">$1</b>')
                                    .replace(/❌/g, '❌')
                                    .replace(/🏆/g, '🏆')
                                    .replace(/🎮/g, '🎮')
                                    .replace(/💳/g, '💳')
                                    .replace(/👤/g, '👤')
                                    .replace(/🏷️/g, '🏷️')
                                    .replace(/💬/g, '💬')
                                    .replace(/✉️/g, '✉️')
                                    .replace(/🚫/g, '🚫')
                                    .replace(/🔓/g, '🔓')
                                }}
                              />
                              <span style={{ fontSize: '10px', color: '#475569', letterSpacing: '0.04em', fontFamily: 'monospace' }}>
                                action: <b>{log.action}</b> | id: <b>{log.id}</b>
                              </span>
                            </div>

                            {/* Timestamp / Category label right-hand alignment */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                              <span
                                style={{
                                  fontSize: '9px',
                                  fontWeight: 800,
                                  color: dotColor,
                                  background: dotColor + '08',
                                  border: `1px solid ${dotColor}25`,
                                  borderRadius: '4px',
                                  padding: '1px 5px',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {details?.label[isTr ? 'tr' : 'en']}
                              </span>
                              <span style={{ color: '#475569', whiteSpace: 'nowrap' }}>
                                {timeStr}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Timeline Paginate button */}
                    {logsHasMore && (
                      <button
                        onClick={fetchMoreLogs}
                        disabled={logsLoadingMore}
                        style={{
                          alignSelf: 'flex-start',
                          background: 'transparent',
                          border: '1px solid rgba(147, 51, 234, 0.3)',
                          color: '#9333ea',
                          borderRadius: '6px',
                          padding: '6px 16px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          letterSpacing: '0.05em',
                          boxShadow: '0 0 10px rgba(147, 51, 234, 0.05)',
                          marginTop: '8px',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(147, 51, 234, 0.06)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {logsLoadingMore ? (isTr ? 'GÜNLÜKLER ÇEKİLİYOR...' : 'LOADING SECTORS...') : (isTr ? 'DAHA FAZLA GÜNLÜK YÜKLE' : 'LOAD OLDER ENTRIES')}
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </AdminGuard>
  );
}
