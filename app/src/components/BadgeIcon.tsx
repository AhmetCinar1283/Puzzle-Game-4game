'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useT } from '../contexts/LanguageContext';

export interface BadgeIconProps {
  badgeType: string;
  periodId: string;
  rank: number;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export default function BadgeIcon({
  badgeType,
  periodId,
  rank,
  size = 'md',
  showTooltip = true,
}: BadgeIconProps) {
  const t = useT();
  const [active, setActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close tooltip on click outside (useful for mobile touch)
  useEffect(() => {
    if (!active) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActive(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [active]);

  // Dimension mapping
  const sizes = {
    sm: { box: 22, icon: 16, crownWidth: 10, crownY: -2 },
    md: { box: 36, icon: 26, crownWidth: 16, crownY: -4 },
    lg: { box: 64, icon: 46, crownWidth: 28, crownY: -8 },
  };

  const dim = sizes[size];
  const isFirst = rank === 1;

  // Colors & Glows
  const colors = {
    gold: '#ffd700',
    goldGlow: 'rgba(255, 215, 0, 0.6)',
    silver: '#a8a29e',
    silverGlow: 'rgba(168, 162, 158, 0.4)',
    bronze: '#b45309',
    bronzeGlow: 'rgba(180, 83, 9, 0.3)',
  };

  const themeColor = isFirst ? colors.gold : colors.silver;
  const themeGlow = isFirst ? colors.goldGlow : colors.silverGlow;

  // Tooltip Text Resolution
  const getTooltipText = () => {
    let key = '';
    if (badgeType.includes('stars')) {
      key = isFirst ? 'badge.weekly_stars_1st' : 'badge.weekly_stars_top3';
    } else if (badgeType.includes('levels')) {
      key = isFirst ? 'badge.weekly_levels_1st' : 'badge.weekly_levels_top3';
    } else if (badgeType.includes('records')) {
      key = isFirst ? 'badge.weekly_records_1st' : 'badge.weekly_records_top3';
    } else if (badgeType.includes('creator') || badgeType.includes('architect')) {
      key = isFirst ? 'badge.monthly_creator_1st' : 'badge.monthly_creator_top3';
    }

    const localizedLabel = key ? t(key) : badgeType;
    return `${localizedLabel} (${periodId})`;
  };

  // SVGs for each category
  const renderSVGIcon = () => {
    const iconColor = themeColor;
    if (badgeType.includes('stars')) {
      // STAR
      return (
        <svg
          width={dim.icon}
          height={dim.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${themeGlow})` }}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={`${iconColor}20`} />
        </svg>
      );
    } else if (badgeType.includes('levels')) {
      // MOUNTAIN
      return (
        <svg
          width={dim.icon}
          height={dim.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${themeGlow})` }}
        >
          <path d="m8 3-6 16h12Z" fill={`${iconColor}15`} />
          <path d="m18 8-6 11h10Z" fill={`${iconColor}25`} />
        </svg>
      );
    } else if (badgeType.includes('records')) {
      // MEDAL
      return (
        <svg
          width={dim.icon}
          height={dim.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${themeGlow})` }}
        >
          <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
          <circle cx="12" cy="15" r="5" fill={`${iconColor}20`} />
          <path d="M12 12v6M10 15h4" />
        </svg>
      );
    } else {
      // CREATOR / ARCHITECT (Construction ruler/cube)
      return (
        <svg
          width={dim.icon}
          height={dim.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${themeGlow})` }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" fill={`${iconColor}10`} />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" opacity="0.3" />
          <path d="M3 3h18M21 3v18M21 21H3M3 21V3" />
          <path d="m15 9-6 6M15 15 9 9" />
        </svg>
      );
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim.box,
        height: dim.box,
        cursor: showTooltip ? 'pointer' : 'default',
      }}
      onMouseEnter={() => {
        if (showTooltip) setActive(true);
      }}
      onMouseLeave={() => {
        if (showTooltip) setActive(false);
      }}
      onClick={(e) => {
        if (showTooltip) {
          e.stopPropagation();
          setActive((prev) => !prev);
        }
      }}
    >
      {/* Crown Icon (overlay for rank 1 champions) */}
      {isFirst && (
        <svg
          width={dim.crownWidth}
          viewBox="0 0 24 24"
          fill={colors.gold}
          style={{
            position: 'absolute',
            top: dim.crownY,
            zIndex: 10,
            filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.8)) drop-shadow(0 0 4px ${colors.goldGlow})`,
          }}
        >
          <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
          <rect x="5" y="18" width="14" height="2" rx="0.5" />
        </svg>
      )}

      {/* Main Badge Hexagon/Circular frame */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: `1.5px solid ${themeColor}40`,
          background: `radial-gradient(circle, ${themeColor}12 0%, #030712 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `inset 0 0 8px ${themeColor}20, 0 0 10px ${themeColor}15`,
          transition: 'transform 0.2s, border-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = themeColor;
          e.currentTarget.style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = `${themeColor}40`;
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {renderSVGIcon()}
      </div>

      {/* Glow effect on hover */}
      {active && (
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${themeGlow}15 0%, transparent 70%)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Tooltip Overlay */}
      {showTooltip && active && (
        <div
          style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(9, 15, 28, 0.95)',
            border: `1px solid ${themeColor}60`,
            borderRadius: '6px',
            padding: '6px 10px',
            color: '#f3f4f6',
            fontSize: '10px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: `0 4px 20px rgba(0, 0, 0, 0.8), 0 0 12px ${themeColor}20`,
            zIndex: 1000,
            pointerEvents: 'none',
            fontFamily: 'var(--font-sans)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {getTooltipText()}
          {/* Tooltip arrow */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: `5px solid ${themeColor}60`,
            }}
          />
        </div>
      )}
    </div>
  );
}
