'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

export type SoundName =
  | 'move'
  | 'portal'
  | 'teleport'
  | 'ice'
  | 'conveyor'
  | 'win'
  | 'lose'
  | 'toggle'
  | 'box_push';

const SOUND_FILES: Record<SoundName, string> = {
  move:      '/sounds/move.mp3',
  portal:    '/sounds/portal.mp3',
  teleport:  '/sounds/teleport.mp3',
  ice:       '/sounds/ice.mp3',
  conveyor:  '/sounds/conveyor.mp3',
  win:       '/sounds/win.mp3',
  lose:      '/sounds/lose.mp3',
  toggle:    '/sounds/toggle.mp3',
  box_push:  '/sounds/box_push.mp3',
};

const SOUND_VOLUME: Record<SoundName, number> = {
  move:      0.4,
  portal:    0.7,
  teleport:  0.7,
  ice:       0.5,
  conveyor:  0.4,
  win:       0.8,
  lose:      0.7,
  toggle:    0.5,
  box_push:  0.45,
};

export function useSoundManager() {
  const audioRefs = useRef<Partial<Record<SoundName, HTMLAudioElement>>>({});
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  // Sesleri ön yükle
  useEffect(() => {
    const names = Object.keys(SOUND_FILES) as SoundName[];
    names.forEach((name) => {
      const audio = new Audio(SOUND_FILES[name]);
      audio.volume = SOUND_VOLUME[name];
      audio.preload = 'auto';
      audioRefs.current[name] = audio;
    });
    return () => {
      Object.values(audioRefs.current).forEach((audio) => {
        if (audio) { audio.pause(); audio.src = ''; }
      });
      audioRefs.current = {};
    };
  }, []);

  const play = useCallback((name: SoundName) => {
    if (mutedRef.current) return;
    const audio = audioRefs.current[name];
    if (!audio) return;
    // Aynı ses tekrar tetiklenirse baştan başlat
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Dosya bulunamazsa ya da tarayıcı izin vermezse sessizce devam et
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      mutedRef.current = !prev;
      return !prev;
    });
  }, []);

  return { play, muted, toggleMute };
}
