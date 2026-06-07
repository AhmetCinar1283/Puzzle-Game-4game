import { Metadata } from 'next';
import LeaderboardClient from './LeaderboardClient';

export const metadata: Metadata = {
  title: 'Lider Tablosu | Syncron',
  description: 'Syncron bulmaca oyununda en iyi oyuncuları, bölüm fatihlerini, rekortmenleri ve mimarları görün.',
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
