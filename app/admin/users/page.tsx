'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/app/src/hooks/useAuth';
import { useLanguage } from '@/app/src/contexts/LanguageContext';
import { AdminGuard } from '@/app/src/components/AdminGuard';
import { db } from '@/app/src/lib/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  where,
  doc,
  getDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

type UserProfile = {
  uid: string;
  email?: string;
  displayName?: string;
  tag?: string;
  role: 'user' | 'moderator' | 'admin';
  authProvider: 'anonymous' | 'google' | 'email';
  totalScore: number;
  completedCount: number;
  createdAt: number; // ms
};

const PAGE_SIZE = 15;

export default function AdminUsersDashboard() {
  const router = useRouter();
  const { lang } = useLanguage();
  const isTr = lang === 'tr';

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Debouncing Search Input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400); // 400ms debouncing as requested

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Initial Fetch & Search Query Change
  useEffect(() => {
    let active = true;

    async function fetchUsers() {
      setLoading(true);
      try {
        if (debouncedQuery !== '') {
          // Reset pagination
          setLastDoc(null);
          setHasMore(false);

          let fetched: UserProfile[] = [];

          // 1. UID Exact Match Check (28 chars or standard Firestore UID)
          if (debouncedQuery.length >= 20 && !debouncedQuery.includes('@') && !debouncedQuery.startsWith('#')) {
            const userRef = doc(db, 'users', debouncedQuery);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && active) {
              fetched.push(mapUserDoc(userSnap.data()));
            }
          }

          // 2. Email exact match
          if (fetched.length === 0 && debouncedQuery.includes('@')) {
            const q = query(
              collection(db, 'users'),
              where('email', '==', debouncedQuery),
              limit(1)
            );
            const snaps = await getDocs(q);
            if (!snaps.empty && active) {
              fetched.push(mapUserDoc(snaps.docs[0].data()));
            }
          }

          // 3. Gamer Tag exact match
          if (fetched.length === 0) {
            const tagQuery = debouncedQuery.startsWith('#')
              ? debouncedQuery.slice(1)
              : debouncedQuery;
            const q = query(
              collection(db, 'users'),
              where('tag', '==', tagQuery),
              limit(5)
            );
            const snaps = await getDocs(q);
            if (!snaps.empty && active) {
              snaps.forEach((d) => fetched.push(mapUserDoc(d.data())));
            }
          }

          // 4. Display Name prefix match (fallback if other search types yield nothing)
          if (fetched.length === 0) {
            const q = query(
              collection(db, 'users'),
              where('displayName', '>=', debouncedQuery),
              where('displayName', '<=', debouncedQuery + '\uf8ff'),
              orderBy('displayName'),
              limit(PAGE_SIZE)
            );
            const snaps = await getDocs(q);
            if (!snaps.empty && active) {
              snaps.forEach((d) => fetched.push(mapUserDoc(d.data())));
            }
          }

          if (active) {
            setUsers(fetched);
          }
        } else {
          // Fetch Default List (paginated, sorted by createdAt desc)
          const q = query(
            collection(db, 'users'),
            orderBy('createdAt', 'desc'),
            limit(PAGE_SIZE)
          );
          const snaps = await getDocs(q);
          if (active) {
            const list = snaps.docs.map((d) => mapUserDoc(d.data()));
            setUsers(list);
            setLastDoc(snaps.docs.length > 0 ? snaps.docs[snaps.docs.length - 1] : null);
            setHasMore(snaps.docs.length === PAGE_SIZE);
          }
        }
      } catch (err) {
        console.error('[AdminUsers] Error querying users:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchUsers();

    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  // Paginated Fetch More (only applicable for default list)
  const fetchMoreUsers = async () => {
    if (loadingMore || !lastDoc || !hasMore || debouncedQuery !== '') return;

    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snaps = await getDocs(q);
      const list = snaps.docs.map((d) => mapUserDoc(d.data()));

      setUsers((prev) => [...prev, ...list]);
      setLastDoc(snaps.docs.length > 0 ? snaps.docs[snaps.docs.length - 1] : null);
      setHasMore(snaps.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('[AdminUsers] Error fetching more users:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Helper map Firestore document fields to UserProfile
  function mapUserDoc(data: DocumentData): UserProfile {
    const toMs = (v: any): number => {
      if (v && typeof v.toMillis === 'function') return v.toMillis();
      if (typeof v === 'number') return v;
      if (v instanceof Date) return v.getTime();
      return Date.now();
    };

    return {
      uid: data.uid || '',
      email: data.email || undefined,
      displayName: data.displayName || undefined,
      tag: data.tag || undefined,
      role: data.role || 'user',
      authProvider: data.authProvider || 'anonymous',
      totalScore: data.totalScore ?? 0,
      completedCount: data.completedCount ?? 0,
      createdAt: toMs(data.createdAt),
    };
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
        {/* Top Header Navigation */}
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
            onClick={() => router.push('/admin')}
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
            {isTr ? '◄ ADMİN PANELİ' : '◄ ADMIN PANEL'}
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
            {isTr ? 'KULLANICI YÖNETİMİ' : 'USER MANAGEMENT'}
          </h1>

          <span style={{ fontSize: '11px', color: '#475569' }}>
            {isTr ? `${users.length} Kayıt Listeleniyor` : `${users.length} Records Loaded`}
          </span>
        </div>

        {/* Content Box */}
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
            gap: '24px',
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(147, 51, 234, 0.1)',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Purple Search Magnifier unicode */}
              <span style={{ fontSize: '18px', color: '#9333ea', textShadow: '0 0 8px rgba(147, 51, 234, 0.5)' }}>⚲</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isTr
                    ? 'İsim, email, #tag veya UID aratın... (Prefix debounced)'
                    : 'Search name, email, #tag, or UID... (Prefix debounced)'
                }
                style={{
                  flex: 1,
                  background: '#060d1a',
                  border: '1px solid rgba(147, 51, 234, 0.25)',
                  color: '#e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border 0.2s',
                }}
                onFocus={(e) => (e.currentTarget.style.border = '1px solid #9333ea')}
                onBlur={(e) => (e.currentTarget.style.border = '1px solid rgba(147, 51, 234, 0.25)')}
              />
            </div>
            <div style={{ fontSize: '10px', color: '#475569', letterSpacing: '0.04em' }}>
              💡 {isTr 
                ? 'İpuçları: Tam email adresi, GamerTag (# ile) veya tam UID yazarak anında nokta atışı yapabilirsiniz.' 
                : 'Tips: Type exact email, GamerTag (with # prefix), or full UID to perform a high-performance direct match.'}
            </div>
          </div>

          {/* Results Board Grid */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#9333ea',
                textShadow: '0 0 10px rgba(147, 51, 234, 0.4)',
              }}
            >
              {isTr ? 'KULLANICI BAZI' : 'USERS DIRECTORY'}
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(147, 51, 234, 0.12)' }} />
          </div>

          {/* Users Table / Directory */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <span
                style={{
                  color: '#9333ea',
                  fontSize: '12px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  textShadow: '0 0 10px rgba(147, 51, 234, 0.3)',
                }}
              >
                {isTr ? 'Veri Tabanından Çekiliyor...' : 'LOADING DIRECTORY...'}
              </span>
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', border: '1px dashed rgba(147, 51, 234, 0.15)', borderRadius: '12px' }}>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                {isTr ? 'Eşleşen herhangi bir kullanıcı bulunamadı.' : 'No users found matching the query.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Responsive Layout Grid instead of basic table */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: '16px',
                }}
              >
                <AnimatePresence>
                  {users.map((u, idx) => {
                    const dateStr = new Date(u.createdAt).toLocaleDateString(
                      isTr ? 'tr-TR' : 'en-US',
                      { year: 'numeric', month: 'short', day: 'numeric' }
                    );

                    return (
                      <motion.div
                        key={u.uid}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.02 }}
                        onClick={() => router.push(`/admin/users/detail?uid=${u.uid}`)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(147, 51, 234, 0.15)',
                          borderRadius: '12px',
                          padding: '20px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget;
                          el.style.border = '1px solid rgba(147, 51, 234, 0.5)';
                          el.style.boxShadow = '0 0 20px rgba(147, 51, 234, 0.12), 0 8px 24px rgba(0,0,0,0.3)';
                          el.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget;
                          el.style.border = '1px solid rgba(147, 51, 234, 0.15)';
                          el.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                          el.style.transform = 'translateY(0)';
                        }}
                      >
                        {/* Identity Line */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: '#f1f5f9' }}>
                              {u.displayName || (isTr ? 'İsimsiz Oyuncu' : 'Anonymous Player')}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                              UID: {u.uid.slice(0, 10)}...{u.uid.slice(-6)}
                            </span>
                          </div>

                          {/* Gamer Tag Badge */}
                          {u.tag && (
                            <span
                              style={{
                                background: 'rgba(147, 51, 234, 0.1)',
                                border: '1px solid rgba(147, 51, 234, 0.3)',
                                color: '#9333ea',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                textShadow: '0 0 5px rgba(147, 51, 234, 0.3)',
                              }}
                            >
                              #{u.tag}
                            </span>
                          )}
                        </div>

                        {/* Email or Anonymous Notice */}
                        <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>✉</span>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {u.email || (isTr ? 'Anonim Giriş (E-posta yok)' : 'Anonymous Session (No Email)')}
                          </span>
                        </div>

                        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '4px 0' }} />

                        {/* Badges and Metrics */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                          {/* Role Badge */}
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '5px',
                              border:
                                u.role === 'admin'
                                  ? '1px solid rgba(236, 72, 153, 0.4)'
                                  : u.role === 'moderator'
                                  ? '1px solid rgba(6, 182, 212, 0.4)'
                                  : '1px solid rgba(100, 116, 139, 0.25)',
                              color:
                                u.role === 'admin'
                                  ? '#ec4899'
                                  : u.role === 'moderator'
                                  ? '#06b6d4'
                                  : '#94a3b8',
                              background:
                                u.role === 'admin'
                                  ? 'rgba(236, 72, 153, 0.06)'
                                  : u.role === 'moderator'
                                  ? 'rgba(6, 182, 212, 0.06)'
                                  : 'rgba(255, 255, 255, 0.01)',
                            }}
                          >
                            {u.role}
                          </span>

                          {/* Auth Provider Badge */}
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '5px',
                              background:
                                u.authProvider === 'google'
                                  ? 'rgba(59, 130, 246, 0.1)'
                                  : u.authProvider === 'email'
                                  ? 'rgba(16, 185, 129, 0.1)'
                                  : 'rgba(245, 158, 11, 0.1)',
                              border:
                                u.authProvider === 'google'
                                  ? '1px solid rgba(59, 130, 246, 0.3)'
                                  : u.authProvider === 'email'
                                  ? '1px solid rgba(16, 185, 129, 0.3)'
                                  : '1px solid rgba(245, 158, 11, 0.3)',
                              color:
                                u.authProvider === 'google'
                                  ? '#60a5fa'
                                  : u.authProvider === 'email'
                                  ? '#34d399'
                                  : '#fbbf24',
                            }}
                          >
                            {u.authProvider}
                          </span>

                          {/* Score and Completion Metrics */}
                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                            <span>🏆 <b>{u.totalScore}</b></span>
                            <span>🏁 <b>{u.completedCount}</b></span>
                          </span>
                        </div>

                        {/* Joined Date Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#475569' }}>
                          <span>{isTr ? `Kayıt: ${dateStr}` : `Registered: ${dateStr}`}</span>
                          <span style={{ color: '#9333ea', fontWeight: 800 }}>{isTr ? 'GÖRÜNTÜLE ➔' : 'VIEW WORKSPACE ➔'}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Pagination controls for default list */}
              {debouncedQuery === '' && hasMore && (
                <button
                  onClick={fetchMoreUsers}
                  disabled={loadingMore}
                  style={{
                    alignSelf: 'center',
                    background: 'transparent',
                    border: '1px solid rgba(147, 51, 234, 0.4)',
                    color: '#9333ea',
                    borderRadius: '8px',
                    padding: '10px 24px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.1em',
                    boxShadow: '0 0 12px rgba(147, 51, 234, 0.1)',
                    marginTop: '12px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(147, 51, 234, 0.1)';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(147, 51, 234, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(147, 51, 234, 0.1)';
                  }}
                >
                  {loadingMore ? (isTr ? 'YÜKLENİYOR...' : 'FETCHING SECTORS...') : (isTr ? 'DAHA FAZLA GÖSTER' : 'LOAD MORE DIRECTORIES')}
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </AdminGuard>
  );
}
