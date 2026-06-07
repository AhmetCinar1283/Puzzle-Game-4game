'use client';

import React, { useState, useEffect } from 'react';
import BadgeIcon from './BadgeIcon';
import { useT } from '../contexts/LanguageContext';
import { Badge } from '../lib/api/badgesClient';

export interface BadgePickerProps {
  isOpen: boolean;
  onClose: () => void;
  badges: Badge[];
  initialShowcaseIds: string[];
  onSave: (badgeIds: string[]) => Promise<void>;
  saving: boolean;
}

export default function BadgePicker({
  isOpen,
  onClose,
  badges,
  initialShowcaseIds,
  onSave,
  saving,
}: BadgePickerProps) {
  const t = useT();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Initialize selected badges on open
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialShowcaseIds);
    }
  }, [isOpen, initialShowcaseIds]);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBadgeClick = (badgeId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(badgeId)) {
        return prev.filter((id) => id !== badgeId);
      }
      if (prev.length >= 5) {
        // Limit reached: cannot select more than 5
        return prev;
      }
      return [...prev, badgeId];
    });
  };

  const handleSave = async () => {
    await onSave(selectedIds);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(3, 7, 18, 0.9)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#0a0f1a',
          border: '1px solid #00ff8825',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '480px',
          padding: '24px',
          boxShadow: '0 0 40px rgba(0, 255, 136, 0.08), 0 20px 50px rgba(0,0,0,0.8)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            background: 'none',
            border: 'none',
            color: '#4b5563',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ff2d55')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}
        >
          ✕
        </button>

        {/* Title */}
        <h3
          style={{
            color: '#00ff88',
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '0.05em',
            margin: '0 0 8px 0',
            textShadow: '0 0 15px rgba(0, 255, 136, 0.4)',
          }}
        >
          {t('leaderboard.standing') === 'SENİN YERİN' ? 'VİTRİNİ DÜZENLE' : 'EDIT SHOWCASE'}
        </h3>

        <p
          style={{
            color: '#6b7280',
            fontSize: '12px',
            margin: '0 0 20px 0',
            lineHeight: 1.5,
          }}
        >
          {t('leaderboard.standing') === 'SENİN YERİN'
            ? 'En fazla 5 rozet seçerek profilinde sergileyebilirsin. Seçim sıranız vitrindeki sıralamayı belirler.'
            : 'Select up to 5 badges to show off on your profile. The order of selection determines their display position.'}
        </p>

        {/* Badge List (Scrollable Area) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: '6px',
            marginBottom: '24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
            gap: '14px',
            justifyItems: 'center',
            alignContent: 'start',
            minHeight: '120px',
          }}
          className="no-scrollbar"
        >
          {badges.length > 0 ? (
            badges.map((badge) => {
              const selectIndex = selectedIds.indexOf(badge.id);
              const isSelected = selectIndex !== -1;

              return (
                <div
                  key={badge.id}
                  onClick={() => handleBadgeClick(badge.id)}
                  style={{
                    position: 'relative',
                    padding: '12px 8px',
                    borderRadius: '10px',
                    background: isSelected ? 'rgba(0, 255, 136, 0.03)' : 'rgba(255,255,255,0.01)',
                    border: isSelected ? '1px solid #00ff8850' : '1px solid #1f293780',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = isSelected ? '#00ff88' : '#374151';
                    e.currentTarget.style.background = isSelected ? 'rgba(0, 255, 136, 0.06)' : 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isSelected ? '#00ff8850' : '#1f293780';
                    e.currentTarget.style.background = isSelected ? 'rgba(0, 255, 136, 0.03)' : 'rgba(255,255,255,0.01)';
                  }}
                >
                  <BadgeIcon
                    badgeType={badge.badgeType}
                    periodId={badge.periodId}
                    rank={badge.rank}
                    size="md"
                    showTooltip={false} // Tooltip disabled inside selection grid to avoid overlap
                  />

                  {/* Badge Label (Compact) */}
                  <span
                    style={{
                      fontSize: '8px',
                      color: '#4b5563',
                      marginTop: '6px',
                      fontWeight: 700,
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}
                  >
                    {badge.periodId}
                  </span>

                  {/* Selection Indicator Badge */}
                  {isSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: '#00ff88',
                        color: '#030712',
                        fontSize: '10px',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 8px #00ff88',
                        border: '1.5px solid #0a0f1a',
                      }}
                    >
                      {selectIndex + 1}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '40px 0',
                color: '#4b5563',
                fontSize: '13px',
              }}
            >
              {t('leaderboard.standing') === 'SENİN YERİN'
                ? 'Henüz kazanılmış bir rozetiniz bulunmuyor.'
                : 'You do not have any awarded badges yet.'}
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            borderTop: '1px solid #111827',
            paddingTop: '16px',
          }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid #1f2937',
              borderRadius: '8px',
              color: '#9ca3af',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              if (!saving) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: '10px 0',
              background: '#00ff8815',
              border: '1px solid #00ff8850',
              borderRadius: '8px',
              color: '#00ff88',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(0, 255, 136, 0.1)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.background = '#00ff88';
                e.currentTarget.style.color = '#030712';
                e.currentTarget.style.boxShadow = '0 0 16px rgba(0, 255, 136, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!saving) {
                e.currentTarget.style.background = '#00ff8815';
                e.currentTarget.style.color = '#00ff88';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.1)';
              }
            }}
          >
            {saving ? '...' : (t('leaderboard.standing') === 'SENİN YERİN' ? 'KAYDET' : 'SAVE')}
          </button>
        </div>
      </div>
    </div>
  );
}
