'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/src/hooks/useAuth';
import { useT, useLanguage } from '@/app/src/contexts/LanguageContext';
import AuthModal from '@/app/src/components/AuthModal';
import { auth } from '@/app/src/lib/firebase';
import {
  type TicketCategory,
  CATEGORY_LABELS,
  TICKET_SUBJECT_MIN,
  TICKET_SUBJECT_MAX,
  TICKET_BODY_MIN,
  TICKET_BODY_MAX
} from '@/app/src/lib/firebase/supportTypes';

export default function SupportPage() {
  const t = useT();
  const { lang } = useLanguage();
  const router = useRouter();
  const { user, isAnonymous, loading } = useAuth();
  
  // Form states
  const [category, setCategory] = useState<TicketCategory>('general');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Auth modal trigger
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isTr = lang === 'tr';

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isAnonymous) {
      setErrorMsg(t('support.err_anon'));
      return;
    }

    // Client-side validations
    if (subject.length < TICKET_SUBJECT_MIN || subject.length > TICKET_SUBJECT_MAX) {
      setErrorMsg(isTr 
        ? `Konu ${TICKET_SUBJECT_MIN}-${TICKET_SUBJECT_MAX} karakter arasında olmalıdır.` 
        : `Subject must be between ${TICKET_SUBJECT_MIN} and ${TICKET_SUBJECT_MAX} characters.`);
      return;
    }

    if (body.length < TICKET_BODY_MIN || body.length > TICKET_BODY_MAX) {
      setErrorMsg(isTr 
        ? `Mesaj ${TICKET_BODY_MIN}-${TICKET_BODY_MAX} karakter arasında olmalıdır.` 
        : `Body must be between ${TICKET_BODY_MIN} and ${TICKET_BODY_MAX} characters.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;
      if (!WORKER_URL) {
        throw new Error('Worker URL is not configured.');
      }

      // Fetch the ID token from Firebase auth
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Failed to retrieve authentication token.');
      }

      const response = await fetch(`${WORKER_URL}/create-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ category, subject, body })
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          setErrorMsg(isTr 
            ? 'Çok fazla destek talebi gönderdiniz. Lütfen daha sonra tekrar deneyin.' 
            : 'Too many requests. Please try again later.');
        } else {
          try {
            const errObj = JSON.parse(errorText);
            setErrorMsg(errObj.error || t('support.err_generic'));
          } catch {
            setErrorMsg(errorText || t('support.err_generic'));
          }
        }
        setSubmitting(false);
        return;
      }

      const data = await response.json();
      if (data.success && data.ticketId) {
        router.push(`/support/my-tickets/detail?id=${data.ticketId}`);
      } else {
        throw new Error('Response did not contain a ticketId.');
      }
    } catch (err) {
      console.error('[CreateTicket] Error submitting support ticket:', err);
      setErrorMsg(t('support.err_generic'));
      setSubmitting(false);
    }
  };

  const isTrCategory = lang === 'tr';

  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#00c4ff', fontSize: 12, letterSpacing: '0.1em' }}>{t('common.loading')}</span>
      </main>
    );
  }

  // Styles
  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: '#060d1a',
    border: '1px solid rgba(0, 196, 255, 0.3)',
    color: '#e2e8f0',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
    transition: 'all 0.15s',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#060d1a',
    border: '1px solid rgba(0, 196, 255, 0.3)',
    color: '#e2e8f0',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#00c4ff',
    display: 'block',
    marginBottom: 6,
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#030712',
        color: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px',
        position: 'relative',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Glows */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(0, 196, 255, 0.05) 0%, transparent 70%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Navigation & Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => router.push('/')}
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
            {t('common.back_menu')}
          </button>

          {!isAnonymous && user && (
            <button
              onClick={() => router.push('/support/my-tickets')}
              style={{
                background: 'rgba(0, 196, 255, 0.07)',
                border: '1px solid rgba(0, 196, 255, 0.35)',
                color: '#00c4ff',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 196, 255, 0.15)';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 196, 255, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 196, 255, 0.07)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {t('support.my_tickets')}
            </button>
          )}
        </div>

        <div>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 900,
              color: '#00c4ff',
              margin: '0 0 8px 0',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              textShadow: '0 0 24px rgba(0, 196, 255, 0.3)',
            }}
          >
            {t('support.title')}
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af', lineHeight: 1.6 }}>
            {t('support.subtitle')}
          </p>
        </div>

        {/* Dynamic Authentication Protection */}
        {(!user || isAnonymous) ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(10, 15, 26, 0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(236, 72, 153, 0.25)',
              borderRadius: '16px',
              padding: '36px',
              textAlign: 'center',
              boxShadow: '0 0 30px rgba(236, 72, 153, 0.05), 0 10px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            <span style={{ fontSize: '48px', textShadow: '0 0 16px rgba(236, 72, 153, 0.4)' }}>⚠</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ec4899', margin: 0 }}>
                {isTr ? 'Üye Girişi Gerekli' : 'Authentication Required'}
              </h2>
              <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0, lineHeight: 1.6, maxWidth: '400px' }}>
                {t('support.err_anon')}
              </p>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              style={{
                background: 'rgba(236, 72, 153, 0.1)',
                border: '1px solid #ec4899',
                color: '#ec4899',
                padding: '12px 32px',
                fontSize: '14px',
                fontWeight: 700,
                borderRadius: '8px',
                cursor: 'pointer',
                letterSpacing: '0.05em',
                transition: 'all 0.2s',
                boxShadow: '0 0 15px rgba(236, 72, 153, 0.1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(236, 72, 153, 0.2)';
                e.currentTarget.style.boxShadow = '0 0 25px rgba(236, 72, 153, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(236, 72, 153, 0.1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(236, 72, 153, 0.1)';
              }}
            >
              {t('auth.sign_in')}
            </button>
          </motion.div>
        ) : (
          /* Form for Logged In Users */
          <motion.form
            onSubmit={handleCreateTicket}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(10, 15, 26, 0.65)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(0, 196, 255, 0.15)',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 0 40px rgba(0, 196, 255, 0.02), 0 10px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#e5e7eb', margin: 0, borderBottom: '1px solid rgba(0, 196, 255, 0.15)', paddingBottom: '12px' }}>
              {t('support.create_ticket')}
            </h2>

            {errorMsg && (
              <div
                style={{
                  background: 'rgba(236, 72, 153, 0.1)',
                  border: '1px solid rgba(236, 72, 153, 0.4)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#ec4899',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span>✕</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Category selection */}
            <div>
              <label htmlFor="category-select" style={labelStyle}>{t('support.form_category')}</label>
              <select
                id="category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                style={selectStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#00c4ff';
                  e.target.style.boxShadow = '0 0 10px rgba(0, 196, 255, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 196, 255, 0.3)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                {(['general', 'bug', 'account', 'level', 'purchase', 'suggestion', 'data_deletion'] as TicketCategory[]).map((cat) => (
                  <option key={cat} value={cat} style={{ background: '#030712', color: '#e2e8f0' }}>
                    {CATEGORY_LABELS[cat][isTrCategory ? 'tr' : 'en']}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="subject-input" style={labelStyle}>{t('support.form_subject')}</label>
              <input
                id="subject-input"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('support.form_subject_placeholder')}
                maxLength={TICKET_SUBJECT_MAX}
                required
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#00c4ff';
                  e.target.style.boxShadow = '0 0 10px rgba(0, 196, 255, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 196, 255, 0.3)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <span style={{ fontSize: 10, color: '#4b5563', display: 'block', marginTop: 4, textAlign: 'right' }}>
                {subject.length} / {TICKET_SUBJECT_MAX}
              </span>
            </div>

            {/* Message Body */}
            <div>
              <label htmlFor="body-textarea" style={labelStyle}>{t('support.form_body')}</label>
              <textarea
                id="body-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('support.form_body_placeholder')}
                maxLength={TICKET_BODY_MAX}
                required
                rows={6}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: '120px',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#00c4ff';
                  e.target.style.boxShadow = '0 0 10px rgba(0, 196, 255, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 196, 255, 0.3)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <span style={{ fontSize: 10, color: '#4b5563', display: 'block', marginTop: 4, textAlign: 'right' }}>
                {body.length} / {TICKET_BODY_MAX}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                background: submitting ? 'rgba(0, 196, 255, 0.05)' : 'rgba(0, 196, 255, 0.08)',
                border: '1px solid rgba(0, 196, 255, 0.6)',
                color: '#00c4ff',
                padding: '12px 0',
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 8,
                cursor: submitting ? 'not-allowed' : 'pointer',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                transition: 'all 0.2s',
                boxShadow: '0 0 15px rgba(0, 196, 255, 0.1)',
                opacity: submitting ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (submitting) return;
                e.currentTarget.style.background = 'rgba(0, 196, 255, 0.18)';
                e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 196, 255, 0.25)';
              }}
              onMouseLeave={(e) => {
                if (submitting) return;
                e.currentTarget.style.background = 'rgba(0, 196, 255, 0.08)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 196, 255, 0.1)';
              }}
            >
              {submitting ? t('support.form_submitting') : t('support.form_submit')}
            </button>
          </motion.form>
        )}
      </div>

      {/* Global Auth Modal portal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}
