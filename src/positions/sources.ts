/**
 * Where volunteer positions come from.
 *
 * Both sources write into the same `positions` map in the store, and all
 * consumers (map, matching, off-site watch, AI requests) read only from there.
 * Switching from simulation to live GPS therefore changes nothing downstream.
 */
import * as Location from 'expo-location';

import { projectLatLng } from '@/domain/geo';
import { setPosition, tick, useStore } from '@/state/store';

export interface PositionSource {
  readonly kind: 'simulated' | 'gps';
  start(): void;
  stop(): void;
}

/** Drives simulated dots (scripted walks, dragged dots) and the shared watchdogs. */
export class SimulatedPositionSource implements PositionSource {
  readonly kind = 'simulated';
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = Date.now();

  start() {
    this.last = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      tick(now - this.last);
      this.last = now;
    }, 100);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/**
 * Live GPS for the signed-in volunteer. Only runs while they are checked in —
 * location is never collected or shared off shift.
 */
export class GpsPositionSource implements PositionSource {
  readonly kind = 'gps';
  private sub: Location.LocationSubscription | null = null;
  private stopped = false;

  constructor(
    private readonly volunteerId: string,
    private readonly onError: (message: string) => void,
  ) {}

  start() {
    this.stopped = false;
    void (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        this.onError('Location permission denied — your position will not be shared.');
        return;
      }
      if (this.stopped) return;
      this.sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 5000 },
        (loc) => {
          const anchor = useStore.getState().festival.geoAnchor;
          setPosition(this.volunteerId, projectLatLng(loc.coords.latitude, loc.coords.longitude, anchor));
        },
      );
      if (this.stopped) this.sub.remove();
    })();
  }

  stop() {
    this.stopped = true;
    this.sub?.remove();
    this.sub = null;
  }
}
