import { dist, zonesAdjacent } from './geo';
import type { Incident, IncidentType, Zone } from './types';

export const RELATED_WINDOW_MS = 10 * 60 * 1000;
export const RELATED_RADIUS_M = 200;

/** Incident types that could plausibly be two descriptions of the same event. */
const SIMILAR_GROUPS: IncidentType[][] = [
  ['fight', 'security_threat', 'crowd_crush'],
  ['heat_illness', 'medical', 'intoxication'],
  ['fire', 'security_threat', 'crowd_crush'],
  ['lost_child'],
  ['property', 'security_threat'],
];

export function similarTypes(a: IncidentType, b: IncidentType): boolean {
  if (a === b) return true;
  if (a === 'other' || b === 'other') return true;
  return SIMILAR_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

/**
 * Code-side pre-filter for duplicate detection. A pair is only plausible (and
 * only then sent to the AI) when it is close in place AND time AND type.
 */
export function plausiblyRelated(
  a: Pick<Incident, 'id' | 'type' | 'createdAt' | 'location' | 'zoneId'>,
  b: Pick<Incident, 'id' | 'type' | 'createdAt' | 'location' | 'zoneId'>,
  zones: Zone[],
): boolean {
  if (a.id === b.id) return false;
  if (Math.abs(a.createdAt - b.createdAt) > RELATED_WINDOW_MS) return false;
  if (!similarTypes(a.type, b.type)) return false;
  if (dist(a.location, b.location) <= RELATED_RADIUS_M) return true;
  const za = zones.find((z) => z.id === a.zoneId);
  const zb = zones.find((z) => z.id === b.zoneId);
  return !!za && !!zb && zonesAdjacent(za, zb);
}

export function relatedCandidates(incident: Incident, others: Incident[], zones: Zone[]): Incident[] {
  return others.filter(
    (o) =>
      o.id !== incident.id &&
      o.status !== 'resolved' &&
      o.status !== 'merged' &&
      plausiblyRelated(incident, o, zones),
  );
}
