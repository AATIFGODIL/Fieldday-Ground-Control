import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useStore } from '@/state/store';

import { GpsPositionSource, SimulatedPositionSource } from './sources';

/** Mount once at the root: runs the simulation tick, plus GPS for the signed-in user in live mode. */
export function usePositionSources() {
  const mode = useStore((s) => s.mode);
  const userId = useStore((s) => s.currentUserId);
  const onShift = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId]?.status === 'checked_in' : false));

  // The tick also runs the off-site and escalation watchdogs, so it always runs.
  useEffect(() => {
    const sim = new SimulatedPositionSource();
    sim.start();
    return () => sim.stop();
  }, []);

  useEffect(() => {
    if (mode !== 'live' || !userId || !onShift) return;
    const gps = new GpsPositionSource(userId, (msg) => Alert.alert('Location', msg));
    gps.start();
    return () => gps.stop();
  }, [mode, userId, onShift]);
}
