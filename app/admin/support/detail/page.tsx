'use client';

import { Suspense } from 'react';
import AdminTicketDetailClient from './AdminTicketDetailClient';

export default function AdminTicketDetailWrapper() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fbbf24', fontSize: 12, letterSpacing: '0.1em' }}>LOADING PANEL...</span>
      </main>
    }>
      <AdminTicketDetailClient />
    </Suspense>
  );
}
