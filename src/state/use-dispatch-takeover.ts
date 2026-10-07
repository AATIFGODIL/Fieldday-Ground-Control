import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useStore } from './store';

/**
 * When the signed-in volunteer has a fresh dispatch, take over the screen with
 * the "You're needed" view — once per dispatch.
 */
export function useDispatchTakeover() {
  const userId = useStore((s) => s.currentUserId);
  const pending = useStore((s) =>
    s.dispatches.find((d) => d.volunteerId === s.currentUserId && d.status === 'notified')?.id,
  );
  const shown = useRef(new Set<string>());

  useEffect(() => {
    if (!pending || shown.current.has(pending)) return;
    shown.current.add(pending);
    // Let any in-flight navigation (e.g. switching identity) settle first.
    const t = setTimeout(() => router.push({ pathname: '/dispatch/[id]', params: { id: pending } }), 400);
    return () => clearTimeout(t);
  }, [pending, userId]);
}
