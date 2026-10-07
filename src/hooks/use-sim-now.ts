import { useEffect, useState } from 'react';

import { simNow, useStore } from '@/state/store';

/** Current simulated time, re-rendering every `intervalMs`. */
export function useSimNow(intervalMs = 1000): number {
  const clock = useStore((s) => s.clock);
  const [now, setNow] = useState(() => simNow(clock));
  useEffect(() => {
    // Refresh immediately when the clock changes (e.g. speed change), then on the interval.
    const first = setTimeout(() => setNow(simNow(clock)), 0);
    const id = setInterval(() => setNow(simNow(clock)), intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [clock, intervalMs]);
  return now;
}
