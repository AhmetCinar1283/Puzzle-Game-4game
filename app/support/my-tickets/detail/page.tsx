'use client';

import { Suspense } from 'react';
import TicketDetailClient from './TicketDetailClient';

export default function TicketDetailWrapper() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#00c4ff', fontSize: 12, letterSpacing: '0.1em' }}>LOADING TICKET...</span>
      </main>
    }>
      <TicketDetailClient />
    </Suspense>
  );
}
