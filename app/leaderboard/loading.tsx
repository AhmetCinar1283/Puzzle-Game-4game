'use client';

import React from 'react';

export default function LeaderboardLoading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030712',
        color: '#e2e8f0',
        fontFamily: 'var(--font-sans)',
        padding: '32px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      {/* Back button skeleton */}
      <div
        style={{
          alignSelf: 'flex-start',
          width: '80px',
          height: '20px',
          background: '#1f2937',
          borderRadius: '4px',
          marginBottom: '24px',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      />

      {/* Title skeleton */}
      <div
        style={{
          width: '240px',
          height: '48px',
          background: '#1f2937',
          borderRadius: '8px',
          marginBottom: '32px',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      />

      {/* Category tabs skeleton */}
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          height: '44px',
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '12px',
          marginBottom: '24px',
          display: 'flex',
          padding: '4px',
          gap: '8px',
          boxSizing: 'border-box',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      >
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              height: '100%',
              background: '#1f2937',
              borderRadius: '8px',
            }}
          />
        ))}
      </div>

      {/* Period tabs skeleton */}
      <div
        style={{
          width: '240px',
          height: '32px',
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '8px',
          marginBottom: '40px',
          display: 'flex',
          padding: '3px',
          gap: '4px',
          boxSizing: 'border-box',
        }}
      >
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              height: '100%',
              background: '#1f2937',
              borderRadius: '6px',
            }}
          />
        ))}
      </div>

      {/* Podium skeleton */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '240px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '16px',
          marginBottom: '40px',
          padding: '0 16px',
          boxSizing: 'border-box',
        }}
      >
        {/* 2nd place (left) */}
        <div
          style={{
            flex: 1,
            height: '160px',
            background: '#111827',
            border: '1px solid #1f2937',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            animation: 'pulse 1.5s infinite ease-in-out',
            animationDelay: '0.2s',
          }}
        />

        {/* 1st place (middle) */}
        <div
          style={{
            flex: 1,
            height: '200px',
            background: '#111827',
            border: '1px solid #1f2937',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            animation: 'pulse 1.5s infinite ease-in-out',
          }}
        />

        {/* 3rd place (right) */}
        <div
          style={{
            flex: 1,
            height: '120px',
            background: '#111827',
            border: '1px solid #1f2937',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            animation: 'pulse 1.5s infinite ease-in-out',
            animationDelay: '0.4s',
          }}
        />
      </div>

      {/* Rows skeleton */}
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              width: '100%',
              height: '52px',
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: '8px',
              animation: 'pulse 1.5s infinite ease-in-out',
              animationDelay: `${idx * 0.1}s`,
            }}
          />
        ))}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}
export type { }; // Keep compiler happy
