import { Metadata } from 'next';
import { Suspense } from 'react';
import FriendsClient from './FriendsClient';

export const metadata: Metadata = {
  title: 'Arkadaşlar | Syncron',
  description: 'Syncron arkadaş listesi, arama ve istek yönetimi.',
};

export default function FriendsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#030712' }} />}>
      <FriendsClient />
    </Suspense>
  );
}
