'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/app/src/hooks/useAuth';
import { useT, useLanguage } from '@/app/src/contexts/LanguageContext';
import { db } from '@/app/src/lib/firebase/config';
import {
  subscribeToMessages,
  sendTicketMessage,
  markTicketAsRead,
  type SupportTicket,
  type TicketMessage,
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  TICKET_REPLY_MIN,
  TICKET_REPLY_MAX
} from '@/app/src/lib/firebase';

export default function TicketDetailClient() {
  const t = useT();
  const { lang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('id') || '';
  const { user, isAnonymous, loading } = useAuth();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [ticketLoading, setTicketLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isTr = lang === 'tr';

  // Redirect if unauthorized
  useEffect(() => {
    if (!loading && (!user || isAnonymous)) {
      router.replace('/support');
    }
  }, [user, isAnonymous, loading, router]);

  // Subscribe to ticket details
  useEffect(() => {
    if (loading || !user || isAnonymous || !ticketId) return;

    setTicketLoading(true);
    const docRef = doc(db, 'supportTickets', ticketId);

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          
          // Securely check if the user owns this ticket
          if (data.uid !== user.uid) {
            router.replace('/support/my-tickets');
            return;
          }

          // Robust mapping of Firestore Timestamps
          const mapToMs = (v: any) => {
            if (v && typeof v === 'object' && 'seconds' in v) {
              return v.seconds * 1000;
            }
            return v || Date.now();
          };

          const mappedTicket: SupportTicket = {
            id: snap.id,
            uid: data.uid || '',
            email: data.email || '',
            displayName: data.displayName || 'User',
            tag: data.tag || null,
            category: data.category || 'general',
            subject: data.subject || '',
            status: data.status || 'open',
            priority: data.priority || 'normal',
            hasUnreadAdmin: !!data.hasUnreadAdmin,
            hasUnreadUser: !!data.hasUnreadUser,
            createdAt: mapToMs(data.createdAt),
            updatedAt: mapToMs(data.updatedAt),
            closedAt: data.closedAt ? mapToMs(data.closedAt) : null,
            adminNote: null // users never see admin internal notes
          };
          setTicket(mappedTicket);
        } else {
          router.replace('/support/my-tickets');
        }
        setTicketLoading(false);
      },
      (error) => {
        console.error('[TicketDetail] Error fetching ticket:', error);
        router.replace('/support/my-tickets');
      }
    );

    return () => unsubscribe();
  }, [ticketId, user, isAnonymous, loading, router]);

  // Subscribe to ticket messages and mark as read
  useEffect(() => {
    if (loading || !user || isAnonymous || !ticketId) return;

    // Subscribing to live message updates
    const unsubscribe = subscribeToMessages(ticketId, (fetchedMessages) => {
      setMessages(fetchedMessages);
    });

    // Mark ticket as read by the user
    markTicketAsRead(ticketId).catch((err) => {
      console.warn('[TicketDetail] Failed to mark ticket as read:', err);
    });

    return () => unsubscribe();
  }, [ticketId, user, isAnonymous, loading]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId || !user) return;
    if (ticket?.status === 'resolved' || ticket?.status === 'closed') return;

    if (replyBody.trim().length < TICKET_REPLY_MIN || replyBody.trim().length > TICKET_REPLY_MAX) {
      setErrorMsg(isTr 
        ? `Cevabınız en az ${TICKET_REPLY_MIN} ve en fazla ${TICKET_REPLY_MAX} karakter olmalıdır.`
        : `Your reply must be between ${TICKET_REPLY_MIN} and ${TICKET_REPLY_MAX} characters.`);
      return;
    }

    setSending(true);
    setErrorMsg('');

    try {
      await sendTicketMessage(
        ticketId,
        user.uid,
        user.displayName || user.email?.split('@')[0] || 'User',
        replyBody.trim()
      );
      setReplyBody('');
    } catch (err) {
      console.error('[SendReply] Error sending message:', err);
      setErrorMsg(t('support.err_generic'));
    } finally {
      setSending(false);
    }
  };

  if (loading || ticketLoading || !ticket) {
    return (
      <main style={{ minHeight: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#00c4ff', fontSize: 12, letterSpacing: '0.1em' }}>{t('common.loading')}</span>
      </main>
    );
  }

  const isClosed = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#030712',
        color: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '30px 16px',
        position: 'relative',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(0, 196, 255, 0.04) 0%, transparent 70%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '700px',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100dvh - 60px)',
          gap: '16px',
        }}
      >
        {/* Navigation row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => router.push('/support/my-tickets')}
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#9ca3af',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#00c4ff';
              e.currentTarget.style.border = '1px solid rgba(0, 196, 255, 0.4)';
              e.currentTarget.style.background = 'rgba(0, 196, 255, 0.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9ca3af';
              e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
            }}
          >
            ← {t('support.my_tickets')}
          </button>
          
          <span style={{ fontSize: '11px', color: '#4b5563', letterSpacing: '0.05em' }}>
            {t('support.ticket_id')}: #{ticket.id.slice(0, 8)}
          </span>
        </div>

        {/* Ticket Header Metadata Card */}
        <div
          style={{
            background: 'rgba(10, 15, 26, 0.65)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 196, 255, 0.15)',
            borderRadius: '12px',
            padding: '16px 20px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#f3f4f6', margin: 0 }}>
              {ticket.subject}
            </h2>
            <span
              style={{
                fontSize: '11px',
                color: STATUS_COLORS[ticket.status],
                background: `${STATUS_COLORS[ticket.status]}0d`,
                border: `1px solid ${STATUS_COLORS[ticket.status]}35`,
                borderRadius: '6px',
                padding: '3px 8px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {STATUS_LABELS[ticket.status][isTr ? 'tr' : 'en']}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#6b7280' }}>
            <span>
              {isTr ? 'Kategori' : 'Category'}:{' '}
              <strong style={{ color: '#94a3b8' }}>
                {CATEGORY_LABELS[ticket.category][isTr ? 'tr' : 'en']}
              </strong>
            </span>
            <span>•</span>
            <span>
              {isTr ? 'Açılış' : 'Opened'}:{' '}
              <strong style={{ color: '#94a3b8' }}>
                {new Date(ticket.createdAt).toLocaleDateString(isTr ? 'tr-TR' : 'en-US')}
              </strong>
            </span>
          </div>
        </div>

        {/* Live Conversation Chat Feed */}
        <div
          style={{
            flex: 1,
            background: 'rgba(10, 15, 26, 0.4)',
            border: '1px solid rgba(0, 196, 255, 0.08)',
            borderRadius: '12px',
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {messages.map((msg, index) => {
            const isAdminSender = msg.senderType === 'admin';
            const msgDate = new Date(msg.createdAt).toLocaleTimeString(isTr ? 'tr-TR' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: isAdminSender ? -15 : 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  alignSelf: isAdminSender ? 'flex-start' : 'flex-end',
                  maxWidth: '75%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isAdminSender ? 'flex-start' : 'flex-end',
                  gap: '4px',
                }}
              >
                {/* Bubble */}
                <div
                  style={{
                    background: isAdminSender 
                      ? 'rgba(0, 255, 136, 0.05)' 
                      : 'rgba(0, 196, 255, 0.05)',
                    border: isAdminSender 
                      ? '1px solid rgba(0, 255, 136, 0.3)' 
                      : '1px solid rgba(0, 196, 255, 0.3)',
                    boxShadow: isAdminSender 
                      ? '0 0 10px rgba(0, 255, 136, 0.05)' 
                      : '0 0 10px rgba(0, 196, 255, 0.05)',
                    color: '#e2e8f0',
                    borderRadius: isAdminSender 
                      ? '12px 12px 12px 2px' 
                      : '12px 12px 2px 12px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    userSelect: 'text',
                  }}
                >
                  {isAdminSender && (
                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#00ff88', letterSpacing: '0.08em', marginBottom: '4px', textTransform: 'uppercase' }}>
                      ✦ Admin ({msg.senderName})
                    </div>
                  )}
                  {msg.body}
                </div>

                {/* Time badge */}
                <span style={{ fontSize: '9px', color: '#4b5563' }}>
                  {msgDate}
                </span>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Resolved/Closed Lock Banners */}
        {isClosed ? (
          <div
            style={{
              background: ticket.status === 'resolved' ? 'rgba(0, 255, 136, 0.06)' : 'rgba(236, 72, 153, 0.06)',
              border: ticket.status === 'resolved' ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid rgba(236, 72, 153, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              fontSize: '13px',
              color: ticket.status === 'resolved' ? '#00ff88' : '#ec4899',
              lineHeight: 1.5,
              flexShrink: 0
            }}
          >
            {ticket.status === 'resolved' ? t('support.resolved_banner') : t('support.closed_banner')}
          </div>
        ) : (
          /* Live Chat Reply Form */
          <form onSubmit={handleSendReply} style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
            {errorMsg && (
              <div style={{ fontSize: '11px', color: '#ec4899', padding: '0 4px' }}>
                ✕ {errorMsg}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder={t('support.reply_placeholder')}
                maxLength={TICKET_REPLY_MAX}
                disabled={sending}
                rows={1}
                style={{
                  flex: 1,
                  background: '#060d1a',
                  border: '1px solid rgba(0, 196, 255, 0.3)',
                  color: '#e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'none',
                  minHeight: '44px',
                  maxHeight: '120px',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#00c4ff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 196, 255, 0.3)';
                }}
                onKeyDown={(e) => {
                  // Send on Enter (unless shift is held)
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply(e);
                  }
                }}
              />

              <button
                type="submit"
                disabled={sending || !replyBody.trim()}
                style={{
                  background: 'rgba(0, 196, 255, 0.08)',
                  border: '1px solid rgba(0, 196, 255, 0.6)',
                  color: '#00c4ff',
                  height: '44px',
                  padding: '0 24px',
                  fontSize: '13px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  cursor: (sending || !replyBody.trim()) ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s',
                  opacity: (sending || !replyBody.trim()) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(0, 196, 255, 0.05)',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  if (sending || !replyBody.trim()) return;
                  e.currentTarget.style.background = 'rgba(0, 196, 255, 0.18)';
                  e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 196, 255, 0.25)';
                }}
                onMouseLeave={(e) => {
                  if (sending || !replyBody.trim()) return;
                  e.currentTarget.style.background = 'rgba(0, 196, 255, 0.08)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 196, 255, 0.05)';
                }}
              >
                {sending ? '...' : t('support.reply_send')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
