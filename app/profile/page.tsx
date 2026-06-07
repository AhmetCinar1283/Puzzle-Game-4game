import { Metadata } from 'next';
import { Suspense } from 'react';
import ProfileClient from './ProfileClient';

export const metadata: Metadata = {
  title: 'Profil | Syncron',
  description: 'Syncron oyuncu profili, istatistikleri ve rozet vitrini.',
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#030712' }} />}>
      <ProfileClient />
    </Suspense>
  );
}
