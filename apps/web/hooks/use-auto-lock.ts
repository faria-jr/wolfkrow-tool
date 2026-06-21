'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

const IDLE_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'] as const;

async function callLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

export function useAutoLock(): void {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await callLogout();
    router.push('/unlock');
  }, [router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void lock(); }, IDLE_MS);
  }, [lock]);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((e) => document.addEventListener(e, resetTimer, { passive: true }));

    function onVisibilityChange() {
      if (document.hidden) { void lock(); }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [lock, resetTimer]);
}
