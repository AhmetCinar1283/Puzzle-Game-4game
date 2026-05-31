'use client';

import { Suspense } from 'react';
import AdminUserProfileClient from './AdminUserProfileClient';

export default function AdminUserProfileWrapper() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100dvh',
            background: '#030712',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: '#9333ea',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              textShadow: '0 0 10px rgba(147, 51, 234, 0.4)',
            }}
          >
            CONNECTING WORKSPACE SECURELY...
          </span>
        </main>
      }
    >
      <AdminUserProfileClient />
    </Suspense>
  );
}
