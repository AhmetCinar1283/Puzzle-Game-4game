'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { localClear, type StoredLevel, type StoredPlayedLevel } from '@/app/src/lib/db';
import { useAuth } from '@/app/src/hooks/useAuth';
import { SectionHeader, LevelTable } from './components/LevelTable';
import { LevelRow } from './components/LevelRow';
import { useT } from '@/app/src/contexts/LanguageContext';
import { useAppSelector } from '@/app/src/store/hooks';
import { selectUser } from '@/app/src/store/userSlice';
import type { LevelPart } from '@/app/src/lib/firebase/adminTypes';

type LevelEntry = StoredLevel & { id: number };

export default function LevelsPage() {
  const t = useT();
  const router = useRouter();
  const { isModerator } = useAuth();
  const { totalScore } = useAppSelector(selectUser);
  const [presets, setPresets] = useState<LevelEntry[]>([]);
  const [userLevels, setUserLevels] = useState<LevelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<LevelEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [parts, setParts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [playedMap, setPlayedMap] = useState<Map<string, StoredPlayedLevel>>(new Map());
  const [partsMap, setPartsMap] = useState<Map<string, LevelPart>>(new Map());
  const { user } = useAuth()

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 600); }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const reload = useCallback(async () => {
    const { getOrderedLevels, getPresetLevels, getDB } = await import('@/app/src/lib/db');
    const [presetData, userData] = await Promise.all([getPresetLevels(), getOrderedLevels()]);
    setPresets(presetData.sort((a, b) => a.position - b.position) as LevelEntry[]);
    setUserLevels(userData as LevelEntry[]);

    const db = getDB();
    const playedData = await db.playedLevels.toArray();
    setPlayedMap(new Map(playedData.map((p) => [p.levelId, p])));

    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Load part names and full part data from Firestore (for lock computation)
  useEffect(() => {
    import('@/app/src/lib/firebase/adminParts').then(({ getAllParts }) => {
      getAllParts()
        .then((fetchedParts) => {
          const mapped = fetchedParts.map((p) => ({ id: p.partId, name: p.name }));
          setParts(mapped);
          setSelectedPartId((prev) => prev || (mapped[0]?.id ?? ''));
          const m = new Map<string, LevelPart>();
          fetchedParts.forEach((p) => m.set(p.partId, p));
          setPartsMap(m);
        })
        .catch((err) => console.warn('[Parts]', err));
    });
  }, []);

  useEffect(() => {
    import('@/app/src/lib/firebase/sync').then(({ syncLevelsMeta }) => {
      syncLevelsMeta().then(() => reload()).catch((err) =>
        console.warn('[Sync] Meta sync failed:', err),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!user?.uid) return null;
    setSyncing(true);
    try {
      const { syncLevelsMeta, syncPlayedLevels } = await import('@/app/src/lib/firebase/sync');
      await syncLevelsMeta(true);
      await syncPlayedLevels(user.uid, true)
    } catch (err) {
      console.warn('[Sync] Refresh failed:', err);
    }
    await reload();
    setSyncing(false);
  }, [reload]);

  const move = useCallback(async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= userLevels.length) return;
    const next = [...userLevels];
    [next[index], next[target]] = [next[target], next[index]];
    setUserLevels(next);
    const { reorderLevels } = await import('@/app/src/lib/db');
    await reorderLevels(next.map((l) => l.id));
  }, [userLevels]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Delete this level? This cannot be undone.')) return;
    const { deleteStoredLevel } = await import('@/app/src/lib/db');
    await deleteStoredLevel(id);
    await reload();
  }, [reload]);

  const handleDeletePreset = useCallback((lv: LevelEntry) => {
    setDeleteConfirm(lv);
  }, []);

  const confirmDeletePreset = useCallback(async () => {
    if (!deleteConfirm?.firestoreId) return;
    setDeleting(true);
    try {
      const { deleteFirestoreLevel, getAllParts } = await import('@/app/src/lib/firebase/admin');
      const allParts = await getAllParts();
      const part = allParts.find((p) =>
        Object.values(p.order).some((e) => (typeof e === 'string' ? e : e.id) === deleteConfirm.firestoreId),
      );
      if (!part) {
        await deleteFirestoreLevel(deleteConfirm.firestoreId, '');
      } else {
        await deleteFirestoreLevel(deleteConfirm.firestoreId, part.partId);
      }
      const { getDB } = await import('@/app/src/lib/db');
      const db = getDB();
      await db.presetLevels.delete(deleteConfirm.id);
      await reload();
    } catch (err) {
      console.error('[DeletePreset]', err);
    }
    setDeleting(false);
    setDeleteConfirm(null);
  }, [deleteConfirm, reload]);

  // Filter presets to selected part
  const filteredPresets = selectedPartId
    ? presets.filter((lv) => String(lv.part) === selectedPartId)
    : presets;

  // Compute which levels are locked based on progression + totalScore
  const lockedSet = useMemo((): Set<string> => {
    if (isModerator) return new Set(); // admins/mods see everything unlocked
    const locked = new Set<string>();
    if (!selectedPartId) return locked;

    const part = partsMap.get(selectedPartId);
    if (!part) return locked;

    const sorted = Object.values(part.order)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    for (let i = 0; i < sorted.length; i++) {
      const fid = typeof sorted[i] === 'string' ? (sorted[i] as unknown as string) : sorted[i].id;
      if (i === 0) {
        if (totalScore < (part.unlockRequirement ?? 0)) locked.add(fid);
      } else {
        const prevEntry = sorted[i - 1];
        const prevFid = typeof prevEntry === 'string' ? (prevEntry as unknown as string) : prevEntry.id;
        if (!playedMap.has(prevFid)) locked.add(fid);
      }
    }
    return locked;
  }, [selectedPartId, partsMap, playedMap, totalScore, isModerator]);

  return (
    <div style={{ minHeight: '100dvh', background: '#030712', color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 12px' : '12px 24px', background: 'rgba(3,7,18,0.97)', borderBottom: '1px solid rgba(0,255,136,0.12)' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', letterSpacing: '0.06em' }}>{t('common.back_menu')}</button>
        <h1 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00ff88', textShadow: '0 0 12px rgba(0,255,136,0.5)' }}>
          {t('levels.title')}
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { localClear().then(() => { reload() }) }} disabled={syncing} title="Firestore'dan güncelle"
            style={{ fontSize: 14, padding: '5px 10px', background: 'rgba(255,50,50,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: syncing ? '#1e3a5f' : '#475569', borderRadius: 7, cursor: syncing ? 'not-allowed' : 'pointer', transition: 'color 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>Del</span>
          </button>
          <button
            onClick={handleRefresh} disabled={syncing} title="Firestore'dan güncelle"
            style={{ fontSize: 14, padding: '5px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: syncing ? '#1e3a5f' : '#475569', borderRadius: 7, cursor: syncing ? 'not-allowed' : 'pointer', transition: 'color 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          </button>
          <button
            onClick={() => router.push('/editor')}
            style={{ fontSize: 12, padding: '6px 12px', fontWeight: 700, letterSpacing: '0.06em', background: 'rgba(0,196,255,0.06)', border: '1px solid rgba(0,196,255,0.35)', color: '#00c4ff', borderRadius: 7, cursor: 'pointer' }}
          >
            {isMobile ? t('levels.new_mobile') : t('levels.new')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 720, width: '100%', margin: '0 auto', padding: isMobile ? '16px 8px' : '24px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em', paddingTop: 60 }}>{t('common.loading')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            {presets.length > 0 && (
              <section>
                <SectionHeader label={t('levels.campaign')} color="#ffd700" />

                {/* Part tabs */}
                {parts.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    {parts.map((p) => {
                      const isActive = selectedPartId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPartId(p.id)}
                          style={{
                            fontSize: 11, padding: '4px 12px', borderRadius: 6,
                            background: isActive ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isActive ? 'rgba(255,215,0,0.45)' : 'rgba(30,58,95,0.4)'}`,
                            color: isActive ? '#ffd700' : '#475569',
                            cursor: 'pointer', fontWeight: isActive ? 700 : 400,
                            letterSpacing: '0.06em', transition: 'all 0.12s',
                          }}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                <LevelTable>
                  {filteredPresets.map((lv, idx) => {
                    const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
                    return (
                      <LevelRow
                        key={lv.id} level={lv} index={idx} total={filteredPresets.length}
                        isPreset isAdmin={isModerator} isMobile={isMobile} cols=""
                        playedLevel={lv.firestoreId ? playedMap.get(lv.firestoreId) : undefined}
                        isLocked={isLocked}
                        onPlay={() => {
                          if (isLocked) return;
                          router.push(`/game?id=${lv.id}&source=preset`);
                        }}
                        onEdit={() => lv.firestoreId ? router.push(`/editor?firestoreId=${lv.firestoreId}`) : undefined}
                        onDelete={() => handleDeletePreset(lv)}
                        onMoveUp={() => { }} onMoveDown={() => { }}
                      />
                    );
                  })}
                </LevelTable>
              </section>
            )}

            <section>
              <SectionHeader label={t('levels.custom')} color="#00c4ff" />
              {userLevels.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 24 }}>
                  <p style={{ color: '#1e3a5f', fontSize: 13, letterSpacing: '0.06em' }}>{t('levels.no_custom')}</p>
                  <button
                    onClick={() => router.push('/editor')}
                    style={{ padding: '10px 28px', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(0,196,255,0.06)', border: '1px solid rgba(0,196,255,0.4)', color: '#00c4ff', borderRadius: 10, cursor: 'pointer' }}
                  >
                    {t('levels.create_first')}
                  </button>
                </div>
              ) : (
                <LevelTable>
                  {userLevels.map((lv, idx) => (
                    <LevelRow
                      key={lv.id} level={lv} index={idx} total={userLevels.length}
                      isPreset={false} isMobile={isMobile} cols=""
                      onPlay={() => router.push(`/game?id=${lv.id}`)}
                      onEdit={() => router.push(`/editor?id=${lv.id}`)}
                      onDelete={() => handleDelete(lv.id)}
                      onMoveUp={() => move(idx, -1)} onMoveDown={() => move(idx, 1)}
                    />
                  ))}
                </LevelTable>
              )}
            </section>

          </div>
        )}
      </div>

      {/* Delete preset confirmation dialog */}
      {deleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.88)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div
            style={{ background: '#0a0f1a', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 14, padding: '24px 28px', maxWidth: 360, width: '100%', boxShadow: '0 0 40px rgba(239,68,68,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#ef4444', letterSpacing: '0.05em' }}>{t('levels.delete_title')}</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 6px' }}>
              {t('levels.delete_body', { name: deleteConfirm.name })}
            </p>
            <p style={{ fontSize: 11, color: '#334155', margin: '0 0 20px' }}>{t('levels.delete_warning')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmDeletePreset} disabled={deleting}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', borderRadius: 8, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? '...' : t('levels.delete_yes')}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)} disabled={deleting}
                style={{ padding: '8px 16px', fontSize: 13, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#475569', borderRadius: 8, cursor: 'pointer' }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
