'use client';

import React from 'react';
import BadgeIcon from './BadgeIcon';
import { useT } from '../contexts/LanguageContext';

export interface BadgeShowcaseProps {
  uid: string;
  isOwner: boolean;
  showcaseBadges?: Array<{
    id: string;
    badgeType: string;
    periodId: string;
    rank: number;
  }>;
  onEditClick?: () => void;
}

export default function BadgeShowcase({
  uid,
  isOwner,
  showcaseBadges = [],
  onEditClick,
}: BadgeShowcaseProps) {
  const t = useT();

  return (
    <div
      style={{
        width: '100%',
        background: '#090d1650',
        border: '1px solid #111827',
        borderRadius: '16px',
        padding: '20px 24px',
        boxSizing: 'border-box',
        position: 'relative',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.15em',
            color: '#4b5563',
            textTransform: 'uppercase',
          }}
        >
          {t('leaderboard.standing') === 'SENİN YERİN' ? 'ROZET VİTRİNİ' : 'BADGE SHOWCASE'}
        </span>

        {isOwner && (
          <button
            onClick={onEditClick}
            style={{
              background: 'transparent',
              border: '1px solid #00ff8840',
              borderRadius: '6px',
              color: '#00ff88',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 136, 0.1)';
              e.currentTarget.style.borderColor = '#00ff88';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = '#00ff8840';
            }}
          >
            {t('list.edit').toUpperCase()}
          </button>
        )}
      </div>

      {/* Grid of badges */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          justifyContent: showcaseBadges.length > 0 ? 'flex-start' : 'center',
          minHeight: '44px',
          flexWrap: 'wrap',
        }}
      >
        {showcaseBadges.length > 0 ? (
          showcaseBadges.map((badge, idx) => (
            <div
              key={badge.id || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                animation: 'fadeIn 0.3s ease-out',
              }}
            >
              <BadgeIcon
                badgeType={badge.badgeType || (badge as any).badge_type}
                periodId={badge.periodId || (badge as any).period_id}
                rank={badge.rank}
                size="md"
              />
            </div>
          ))
        ) : (
          <p
            style={{
              fontSize: '12px',
              color: '#4b5563',
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            {isOwner
              ? (t('leaderboard.standing') === 'SENİN YERİN' ? 'Sergilemek için rozet seçin' : 'Select badges to showcase')
              : (t('leaderboard.standing') === 'SENİN YERİN' ? 'Sergilenen rozet yok' : 'No badges showcased')}
          </p>
        )}
      </div>
    </div>
  );
}
