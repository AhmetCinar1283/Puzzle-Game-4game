'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, onSnapshot } from 'firebase/firestore';
import { useT, useLanguage } from '@/app/src/contexts/LanguageContext';
import { useAuth } from '@/app/src/hooks/useAuth';
import { db } from '@/app/src/lib/firebase/config';
import {
  subscribeToMessages,
  sendAdminReply,
  updateTicketStatus,
  updateTicketPriority,
  setAdminNote,
  markTicketAsReadByAdmin,
  type SupportTicket,
  type TicketMessage,
  type TicketStatus,
  type TicketPriority,
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  TICKET_REPLY_MIN,
  TICKET_REPLY_MAX
} from '@/app/src/lib/firebase';

export default function AdminTicketDetailClient() {
  const t = useT();
  const { lang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('id') || '';
  const { user: currentUser, role, loading } = useAuth();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [ticketLoading, setTicketLoading] = useState(true);
  
  // Action states
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);
  const [internalNoteLocal, setInternalNoteLocal] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSavedToast, setNoteSavedToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isTr = lang === 'tr';

  // Secure access control
  useEffect(() => {
    if (!loading && role !== 'admin' && role !== 'moderator') {
      router.replace('/');
    }
  }, [role, loading, router]);

  // Subscribe to ticket details document
  useEffect(() => {
    if (loading || (role !== 'admin' && role !== 'moderator') || !ticketId) return;

    setTicketLoading(true);
    const docRef = doc(db, 'supportTickets', ticketId);

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          
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
            adminNote: data.adminNote || ''
          };
          
          setTicket(mappedTicket);
          setInternalNoteLocal(data.adminNote || '');
        } else {
          router.replace('/admin/support');
        }
        setTicketLoading(false);
      },
      (error) => {
        console.error('[AdminTicketDetail] Error subscribing to ticket details:', error);
        router.replace('/admin/support');
      }
    );

    return () => unsubscribe();
  }, [ticketId, role, loading, router]);

  // Subscribe to messages list and mark as read by admin
  useEffect(() => {
    if (loading || (role !== 'admin' && role !== 'moderator') || !ticketId) return;

    const unsubscribe = subscribeToMessages(ticketId, (fetchedMessages) => {
      setMessages(fetchedMessages);
    });

    // Mark as read by admin
    markTicketAsReadByAdmin(ticketId).catch((err) => {
      console.warn('[AdminTicketDetail] Failed to mark ticket as read by admin:', err);
    });

    return () => unsubscribe();
  }, [ticketId, role, loading]);

  // Scroll to bottom of conversation feed
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send admin reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId || !currentUser) return;

    if (replyBody.trim().length < TICKET_REPLY_MIN || replyBody.trim().length > TICKET_REPLY_MAX) {
      setErrorMsg(isTr 
        ? `Cevabınız en az ${TICKET_REPLY_MIN} ve en fazla ${TICKET_REPLY_MAX} karakter olmalıdır.`
        : `Your reply must be between ${TICKET_REPLY_MIN} and ${TICKET_REPLY_MAX} characters.`);
      return;
    }

    setReplying(true);
    setErrorMsg('');

    try {
      await sendAdminReply(ticketId, currentUser.uid, replyBody.trim());
      
      // Automatically advance status to in_progress or waiting_user when admin replies
      if (ticket && (ticket.status === 'open' || ticket.status === 'waiting_user')) {
        await updateTicketStatus(ticketId, 'in_progress');
      }
      
      setReplyBody('');
    } catch (err) {
      console.error('[AdminSendReply] Error sending message:', err);
      setErrorMsg(t('support.err_generic'));
    } finally {
      setReplying(false);
    }
  };

  // Update status dropdown
  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticketId) return;
    try {
      await updateTicketStatus(ticketId, newStatus);
    } catch (err) {
      console.error('[AdminUpdateStatus] Error updating status:', err);
    }
  };

  // Update priority dropdown
  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (!ticketId) return;
    try {
      await updateTicketPriority(ticketId, newPriority);
    } catch (err) {
      console.error('[AdminUpdatePriority] Error updating priority:', err);
    }
  };

  // Save private internal note
  const handleSaveInternalNote = async () => {
    if (!ticketId) return;
    setSavingNote(true);
    try {
      await setAdminNote(ticketId, internalNoteLocal.trim());
      setNoteSavedToast(true);
      setTimeout(() => setNoteSavedToast(false), 2500);
    } catch (err) {
      console.error('[AdminSaveNote] Error saving note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  if (loading || ticketLoading || !ticket) {
    return (
      <main style={{ minHeight: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fbbf24', fontSize: 12, letterSpacing: '0.1em' }}>LOADING PANEL...</span>
      </main>
    );
  }

  const inputSelectStyle: React.CSSProperties = {
    background: '#060d1a',
    border: '1px solid rgba(251, 191, 36, 0.25)',
    color: '#fbbf24',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#475569',
    display: 'block',
    marginBottom: '6px',
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
          onClick={() => router.push('/admin/support')}
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
          ← {isTr ? 'Taleplere Dön' : 'Back to Tickets'}
        </button>

        <h1
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#fbbf24',
          }}
        >
          {isTr ? 'BİLET ÇALIŞMA ALANI' : 'TICKET WORKSPACE'}
        </h1>

        <span style={{ fontSize: '11px', color: '#475569' }}>
          ID: #{ticket.id.slice(0, 10)}
        </span>
      </div>

      {/* Main Workspace Grid (Two-Column Layout) */}
      <div
        style={{
          flex: 1,
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '20px 16px',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px',
          gap: '20px',
          height: 'calc(100dvh - 60px)',
          alignItems: 'stretch',
        }}
      >
        {/* Left Column: Live Chat Conversation & Reply */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
          {/* Ticket Header Brief */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(251, 191, 36, 0.12)',
              borderRadius: '10px',
              padding: '16px 20px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                {ticket.subject}
              </h2>
              <span
                style={{
                  fontSize: '10px',
                  color: STATUS_COLORS[ticket.status],
                  background: `${STATUS_COLORS[ticket.status]}0d`,
                  border: `1px solid ${STATUS_COLORS[ticket.status]}35`,
                  borderRadius: '5px',
                  padding: '2px 8px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {STATUS_LABELS[ticket.status][isTr ? 'tr' : 'en']}
              </span>
            </div>
          </div>

          {/* Conversation Feed Scroll Area */}
          <div
            style={{
              flex: 1,
              background: 'rgba(10, 15, 26, 0.4)',
              border: '1px solid rgba(251, 191, 36, 0.08)',
              borderRadius: '10px',
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {messages.map((msg) => {
              const isAdminSender = msg.senderType === 'admin';
              const msgTime = new Date(msg.createdAt).toLocaleTimeString(isTr ? 'tr-TR' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit'
              });
              const msgDate = new Date(msg.createdAt).toLocaleDateString(isTr ? 'tr-TR' : 'en-US');

              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isAdminSender ? 'flex-start' : 'flex-end',
                    maxWidth: '75%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isAdminSender ? 'flex-start' : 'flex-end',
                    gap: '4px',
                  }}
                >
                  <div
                    style={{
                      background: isAdminSender 
                        ? 'rgba(0, 255, 136, 0.05)' 
                        : 'rgba(0, 196, 255, 0.05)',
                      border: isAdminSender 
                        ? '1px solid rgba(0, 255, 136, 0.3)' 
                        : '1px solid rgba(0, 196, 255, 0.3)',
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
                    {!isAdminSender && (
                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#00c4ff', letterSpacing: '0.08em', marginBottom: '4px', textTransform: 'uppercase' }}>
                        👤 {ticket.displayName} ({isTr ? 'Kullanıcı' : 'User'})
                      </div>
                    )}
                    {msg.body}
                  </div>
                  <span style={{ fontSize: '9px', color: '#475569' }}>
                    {msgDate} {msgTime}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Admin Reply Form */}
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
                disabled={replying}
                rows={2}
                style={{
                  flex: 1,
                  background: '#060d1a',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  color: '#e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'none',
                  minHeight: '52px',
                  maxHeight: '120px',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#fbbf24';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(251, 191, 36, 0.3)';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply(e);
                  }
                }}
              />

              <button
                type="submit"
                disabled={replying || !replyBody.trim()}
                style={{
                  background: 'rgba(251, 191, 36, 0.08)',
                  border: '1px solid rgba(251, 191, 36, 0.6)',
                  color: '#fbbf24',
                  height: '52px',
                  padding: '0 24px',
                  fontSize: '13px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  cursor: (replying || !replyBody.trim()) ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s',
                  opacity: (replying || !replyBody.trim()) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(251, 191, 36, 0.05)',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  if (replying || !replyBody.trim()) return;
                  e.currentTarget.style.background = 'rgba(251, 191, 36, 0.18)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(251, 191, 36, 0.2)';
                }}
                onMouseLeave={(e) => {
                  if (replying || !replyBody.trim()) return;
                  e.currentTarget.style.background = 'rgba(251, 191, 36, 0.08)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(251, 191, 36, 0.05)';
                }}
              >
                {replying ? '...' : t('support.reply_send')}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Admin Operations & User Details Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
          {/* Operations: Status & Priority Card */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(251, 191, 36, 0.12)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.08em', margin: 0, borderBottom: '1px solid rgba(251, 191, 36, 0.12)', paddingBottom: '10px' }}>
              {isTr ? 'BİLET YÖNETİMİ' : 'TICKET OPERATIONS'}
            </h3>

            {/* Status Selector */}
            <div>
              <label htmlFor="status-select" style={labelStyle}>{t('support.status')}</label>
              <select
                id="status-select"
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                style={inputSelectStyle}
              >
                {(['open', 'in_progress', 'waiting_user', 'resolved', 'closed'] as TicketStatus[]).map((st) => (
                  <option key={st} value={st} style={{ background: '#030712', color: '#e2e8f0' }}>
                    {STATUS_LABELS[st][isTr ? 'tr' : 'en']}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Selector */}
            <div>
              <label htmlFor="priority-select" style={labelStyle}>{t('support.priority')}</label>
              <select
                id="priority-select"
                value={ticket.priority}
                onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                style={inputSelectStyle}
              >
                {(['low', 'normal', 'high', 'urgent'] as TicketPriority[]).map((pr) => (
                  <option key={pr} value={pr} style={{ background: '#030712', color: '#e2e8f0' }}>
                    {PRIORITY_LABELS[pr][isTr ? 'tr' : 'en']}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Private Internal Notes Card */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(251, 191, 36, 0.12)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.08em', margin: 0, borderBottom: '1px solid rgba(251, 191, 36, 0.12)', paddingBottom: '10px' }}>
              {t('support.admin_note')}
            </h3>

            <textarea
              value={internalNoteLocal}
              onChange={(e) => setInternalNoteLocal(e.target.value)}
              placeholder={t('support.admin_note_placeholder')}
              rows={4}
              style={{
                background: '#060d1a',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                color: '#e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
                width: '100%',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                minHeight: '80px',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#fbbf24';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(251, 191, 36, 0.2)';
              }}
            />

            <button
              onClick={handleSaveInternalNote}
              disabled={savingNote}
              style={{
                background: 'rgba(251, 191, 36, 0.05)',
                border: '1px solid rgba(251, 191, 36, 0.4)',
                color: '#fbbf24',
                padding: '8px 0',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                cursor: savingNote ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.2s',
                opacity: savingNote ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (savingNote) return;
                e.currentTarget.style.background = 'rgba(251, 191, 36, 0.12)';
              }}
              onMouseLeave={(e) => {
                if (savingNote) return;
                e.currentTarget.style.background = 'rgba(251, 191, 36, 0.05)';
              }}
            >
              {savingNote ? '...' : t('support.admin_note_save')}
            </button>

            {noteSavedToast && (
              <span style={{ fontSize: '11px', color: '#00ff88', textAlign: 'center', display: 'block', marginTop: '4px' }}>
                ✓ {t('support.note_updated')}
              </span>
            )}
          </div>

          {/* User Information Details Card */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(251, 191, 36, 0.12)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.08em', margin: 0, borderBottom: '1px solid rgba(251, 191, 36, 0.12)', paddingBottom: '10px' }}>
              {t('support.user_info')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div>
                <span style={labelStyle}>{isTr ? 'Adı Soyadı / Mail' : 'Name / Email'}</span>
                <span style={{ color: '#f8fafc', fontWeight: 600, wordBreak: 'break-all' }}>{ticket.displayName}</span>
                <div style={{ color: '#64748b', fontSize: '11px', wordBreak: 'break-all', marginTop: '2px' }}>{ticket.email}</div>
              </div>

              <div>
                <span style={labelStyle}>TAG</span>
                <span style={{ color: '#fbbf24', fontWeight: 800 }}>
                  {ticket.tag ? `#${ticket.tag}` : (isTr ? 'Atanmamış' : 'None')}
                </span>
              </div>

              <div>
                <span style={labelStyle}>UID</span>
                <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '10px', wordBreak: 'break-all' }}>{ticket.uid}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
