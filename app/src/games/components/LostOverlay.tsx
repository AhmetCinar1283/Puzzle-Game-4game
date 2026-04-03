'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { LostReason } from '../types';
import { useT } from '@/app/src/contexts/LanguageContext';

interface LostOverlayProps {
  onRestart: () => void;
  reason?: LostReason;
}

const REASON_KEYS: Record<LostReason, { icon: string; titleKey: string; msgKey: string }> = {
  forbidden: { icon: '⚠', titleKey: 'lost.forbidden_title', msgKey: 'lost.forbidden_msg' },
  lava_edge: { icon: '☠', titleKey: 'lost.lava_title', msgKey: 'lost.lava_msg' },
  trail: { icon: '✗', titleKey: 'lost.trail_title', msgKey: 'lost.trail_msg' },
};

export default function LostOverlay({ onRestart, reason }: LostOverlayProps) {
  const t = useT();
  const cfg = REASON_KEYS[reason ?? 'forbidden'];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(2, 5, 14, 0.78)',
          backdropFilter: 'blur(4px)',
          zIndex: 20,
          borderRadius: 4,
        }}
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          style={{
            background: 'rgba(3, 7, 18, 0.97)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 0 40px rgba(239, 68, 68, 0.15), 0 0 80px rgba(239, 68, 68, 0.05)',
            borderRadius: 16,
            padding: '36px 48px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              fontSize: 36,
              color: '#ef4444',
              textShadow: '0 0 16px rgba(239,68,68,0.7)',
            }}
          >
            {cfg.icon}
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#ef4444',
              textShadow: '0 0 16px rgba(239,68,68,0.5)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            {t(cfg.titleKey)}
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{t(cfg.msgKey)}</p>
          <button
            onClick={onRestart}
            style={{
              fontSize: 12,
              padding: '8px 24px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              color: '#ef4444',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              letterSpacing: '0.04em',
              marginTop: 6,
              boxShadow: '0 0 12px rgba(239,68,68,0.12)',
            }}
          >
            {t('lost.try_again')}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
