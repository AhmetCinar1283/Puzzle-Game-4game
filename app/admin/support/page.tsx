'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/src/hooks/useAuth';
import { useT, useLanguage } from '@/app/src/contexts/LanguageContext';
import {
  subscribeToAllTickets,
  type SupportTicket,
  type TicketStatus,
  type TicketCategory,
  type TicketPriority,
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS
} from '@/app/src/lib/firebase';

export default function AdminSupportDashboard() {
  const t = useT();
  const { lang } = useLanguage();
  const router = useRouter();
  const { role, loading } = useAuth();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filters state
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isTr = lang === 'tr';

  // Secure access control
  useEffect(() => {
    if (!loading && role !== 'admin' && role !== 'moderator') {
      router.replace('/');
    }
  }, [role, loading, router]);

  // Subscribe to all support tickets
  // In order to perform category filtering client-side as designed, we retrieve
  // tickets with status filtering if enabled, then filter categories locally in the callback/render.
  useEffect(() => {
    if (loading || (role !== 'admin' && role !== 'moderator')) return;

    setDataLoading(true);
    
    // We pass statusFilter to subscribeToAllTickets if it's not 'all' to leverage Firestore status indexes.
    const activeStatus = statusFilter === 'all' ? undefined : { status: statusFilter, category: 'all' as any };
    
    const unsubscribe = subscribeToAllTickets(
      (fetchedTickets) => {
        setTickets(fetchedTickets);
        setDataLoading(false);
      },
      activeStatus
    );

    return () => unsubscribe();
  }, [role, loading, statusFilter]);

  // Perform remaining client-side filtering (category filter & search query)
  const filteredTickets = tickets.filter((ticket) => {
    // 1. Category Filter (performed client-side)
    if (categoryFilter !== 'all' && ticket.category !== categoryFilter) {
      return false;
    }

    // 2. Search Query (matches user display name, tag, subject, or email)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      const matchName = ticket.displayName.toLowerCase().includes(query);
      const matchTag = ticket.tag ? ticket.tag.toLowerCase().includes(query) : false;
      const matchEmail = ticket.email.toLowerCase().includes(query);
      const matchSubject = ticket.subject.toLowerCase().includes(query);
      const matchId = ticket.id.toLowerCase().includes(query);

      return matchName || matchTag || matchEmail || matchSubject || matchId;
    }

    return true;
  });

  if (loading || (role !== 'admin' && role !== 'moderator')) {
    return (
      <main style={{ minHeight: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fbbf24', fontSize: 12, letterSpacing: '0.1em' }}>LOADING PANEL...</span>
      </main>
    );
  }

  // Styles
  const filterSelectStyle: React.CSSProperties = {
    background: '#060d1a',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    color: '#fbbf24',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#030712',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: 'rgba(3, 7, 18, 0.97)',
          borderBottom: '1px solid rgba(251, 191, 36, 0.15)',
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
            cursor: 'pointer',
            letterSpacing: '0.06em',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fbbf24')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
        >
          {t('common.back_menu')}
        </button>

        <h1
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 800,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#fbbf24',
            textShadow: '0 0 12px rgba(251, 191, 36, 0.4)',
          }}
        >
          {isTr ? 'DESTEK TALEPLERİ' : 'SUPPORT TICKETS'}
        </h1>

        <span style={{ fontSize: '11px', color: '#475569' }}>
          {filteredTickets.length} / {tickets.length}
        </span>
      </div>

      {/* Main Panel Content Workspace */}
      <div
        style={{
          flex: 1,
          maxWidth: '1000px',
          width: '100%',
          margin: '0 auto',
          padding: '24px 16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Filters Toolbar */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(251, 191, 36, 0.12)',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isTr ? 'Kullanıcı, konu veya ID ara...' : 'Search user, subject, or ID...'}
              style={{
                flex: 1,
                minWidth: '220px',
                background: '#060d1a',
                border: '1px solid rgba(30, 58, 95, 0.6)',
                color: '#94a3b8',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isTr ? 'DURUM:' : 'STATUS:'}
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={filterSelectStyle}
              >
                <option value="all" style={{ background: '#030712' }}>{isTr ? 'Tümü' : 'All'}</option>
                {(['open', 'in_progress', 'waiting_user', 'resolved', 'closed'] as TicketStatus[]).map((st) => (
                  <option key={st} value={st} style={{ background: '#030712' }}>
                    {STATUS_LABELS[st][isTr ? 'tr' : 'en']}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isTr ? 'KATEGORİ:' : 'CATEGORY:'}
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                style={filterSelectStyle}
              >
                <option value="all" style={{ background: '#030712' }}>{isTr ? 'Tümü' : 'All'}</option>
                {(['general', 'bug', 'account', 'level', 'purchase', 'suggestion', 'data_deletion'] as TicketCategory[]).map((cat) => (
                  <option key={cat} value={cat} style={{ background: '#030712' }}>
                    {CATEGORY_LABELS[cat][isTr ? 'tr' : 'en']}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fbbf24', textShadow: '0 0 10px rgba(251,191,36,0.5)' }}>
            {isTr ? 'TÜM DESTEK TALEPLERİ' : 'ALL SUPPORT TICKETS'}
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(251, 191, 36, 0.15)' }} />
        </div>

        {/* Ticket List Grid */}
        {dataLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#fbbf24', fontSize: '12px', letterSpacing: '0.1em' }}>
            LOADING...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: '#475569', fontSize: '13px', letterSpacing: '0.06em' }}>
              {tickets.length === 0 
                ? (isTr ? 'Sistemde henüz destek talebi bulunmamaktadır.' : 'No support tickets found in the system.')
                : (isTr ? 'Filtrelere uygun destek talebi bulunamadı.' : 'No support tickets matching current filters.')
              }
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredTickets.map((ticket, idx) => {
              const lastUpdateStr = new Date(ticket.updatedAt).toLocaleString(isTr ? 'tr-TR' : 'en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => router.push(`/admin/support/detail/?id=${ticket.id}`)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: ticket.hasUnreadAdmin 
                      ? '1px solid rgba(251, 191, 36, 0.45)' 
                      : '1px solid rgba(30, 58, 95, 0.35)',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    position: 'relative',
                    transition: 'all 0.15s ease-in-out',
                    boxShadow: ticket.hasUnreadAdmin 
                      ? '0 0 15px rgba(251, 191, 36, 0.06)' 
                      : 'none',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.border = ticket.hasUnreadAdmin
                      ? '1px solid rgba(251, 191, 36, 0.8)'
                      : '1px solid rgba(251, 191, 36, 0.4)';
                    el.style.boxShadow = ticket.hasUnreadAdmin
                      ? '0 0 20px rgba(251, 191, 36, 0.18), 0 4px 20px rgba(0,0,0,0.4)'
                      : '0 0 20px rgba(251, 191, 36, 0.08), 0 4px 20px rgba(0,0,0,0.4)';
                    el.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.border = ticket.hasUnreadAdmin 
                      ? '1px solid rgba(251, 191, 36, 0.45)' 
                      : '1px solid rgba(30, 58, 95, 0.35)';
                    el.style.boxShadow = ticket.hasUnreadAdmin 
                      ? '0 0 15px rgba(251, 191, 36, 0.06)' 
                      : 'none';
                    el.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Top line: subject, user tag */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {ticket.hasUnreadAdmin && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            background: '#fbbf24',
                            borderRadius: '50%',
                            display: 'inline-block',
                            boxShadow: '0 0 8px #fbbf24, 0 0 16px #fbbf24',
                            flexShrink: 0
                          }}
                        />
                      )}
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                        {ticket.subject}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>{ticket.displayName}</span>
                      {ticket.tag && <span style={{ color: '#475569' }}> #{ticket.tag}</span>}
                    </div>
                  </div>

                  {/* Badges line: Category, Status, Priority, last update */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {/* Category */}
                    <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '5px', padding: '2px 6px' }}>
                      {CATEGORY_LABELS[ticket.category][isTr ? 'tr' : 'en']}
                    </span>

                    {/* Status */}
                    <span
                      style={{
                        fontSize: '10px',
                        color: STATUS_COLORS[ticket.status],
                        background: `${STATUS_COLORS[ticket.status]}0d`,
                        border: `1px solid ${STATUS_COLORS[ticket.status]}35`,
                        borderRadius: '5px',
                        padding: '2px 6px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {STATUS_LABELS[ticket.status][isTr ? 'tr' : 'en']}
                    </span>

                    {/* Priority */}
                    <span
                      style={{
                        fontSize: '10px',
                        color: PRIORITY_COLORS[ticket.priority],
                        background: `${PRIORITY_COLORS[ticket.priority]}0d`,
                        border: `1px solid ${PRIORITY_COLORS[ticket.priority]}35`,
                        borderRadius: '5px',
                        padding: '2px 6px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {PRIORITY_LABELS[ticket.priority][isTr ? 'tr' : 'en']}
                    </span>

                    {/* Unread admin text */}
                    {ticket.hasUnreadAdmin && (
                      <span style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', textShadow: '0 0 6px rgba(251,191,36,0.3)' }}>
                        {isTr ? '● CÜMLE BEKLENİYOR' : '● RESPOND NOW'}
                      </span>
                    )}

                    {/* Last update */}
                    <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto' }}>
                      {lastUpdateStr}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
