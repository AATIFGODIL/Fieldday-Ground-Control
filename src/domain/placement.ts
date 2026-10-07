import { centroid, dist } from './geo';
import { activeRequirements } from './coverage';
import type { Festival, Skill, Vec, Volunteer } from './types';

export interface PlacementMove {
  volunteerId: string;
  toZoneId: string;
  reason: string;
}

/** Scarcest skills first, so they're not used up filling generic headcount. */
const SKILL_PRIORITY: Skill[] = ['security_licence', 'wwcc', 'first_aid', 'deescalation', 'rsa', 'crowd_control'];

/**
 * Deterministic greedy placement. Used as the fallback when the AI placement
 * call fails, and as a sanity baseline. Returns only the moves that differ
 * from the current assignment.
 */
export function greedyPlacement(
  festival: Festival,
  volunteers: Volunteer[],
  tempC: number,
  positionOf: (id: string) => Vec | undefined,
): PlacementMove[] {
  const pool = volunteers.filter((v) => v.role === 'volunteer' && v.status !== 'no_show' && v.status !== 'checked_out');
  const assigned = new Map<string, string>();
  const centres = Object.fromEntries(festival.zones.map((z) => [z.id, centroid(z.polygon)]));
  const reasons = new Map<string, string>();

  const nearestFree = (zoneId: string, skill: Skill | null) => {
    const c = centres[zoneId];
    let best: Volunteer | undefined;
    let bestD = Infinity;
    for (const v of pool) {
      if (assigned.has(v.id)) continue;
      if (skill && !v.skills.includes(skill)) continue;
      // Prefer keeping people where they are: distance from their current zone.
      const from = (v.zoneId && centres[v.zoneId]) || positionOf(v.id) || c;
      const d = dist(from, c) + (v.zoneId === zoneId ? -1000 : 0);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  };

  const reqs = festival.zones.flatMap((z) =>
    activeRequirements(z, tempC).map((r) => ({ zone: z, ...r })),
  );
  reqs.sort((a, b) => {
    const pa = a.skill ? SKILL_PRIORITY.indexOf(a.skill) : 99;
    const pb = b.skill ? SKILL_PRIORITY.indexOf(b.skill) : 99;
    return pa - pb;
  });

  for (const r of reqs) {
    const already = [...assigned.entries()].filter(
      ([id, zid]) => zid === r.zone.id && (!r.skill || pool.find((p) => p.id === id)?.skills.includes(r.skill)),
    ).length;
    for (let i = already; i < r.min; i++) {
      const v = nearestFree(r.zone.id, r.skill);
      if (!v) break;
      assigned.set(v.id, r.zone.id);
      reasons.set(v.id, r.skill ? `Covers ${r.zone.name} ${r.skill.replace('_', ' ')} requirement` : `Headcount for ${r.zone.name}`);
    }
  }

  // Everyone else stays where they are.
  const moves: PlacementMove[] = [];
  for (const [id, zoneId] of assigned) {
    const v = pool.find((p) => p.id === id)!;
    if (v.zoneId !== zoneId) moves.push({ volunteerId: id, toZoneId: zoneId, reason: reasons.get(id) ?? '' });
  }
  return moves;
}

/** Validate AI-proposed moves: known people and zones, each person at most once. */
export function validateMoves(
  moves: PlacementMove[],
  volunteers: Volunteer[],
  zoneIds: string[],
): { ok: true } | { ok: false; reason: string } {
  const ids = new Set(volunteers.map((v) => v.id));
  const zones = new Set(zoneIds);
  const seen = new Set<string>();
  for (const m of moves) {
    if (!ids.has(m.volunteerId)) return { ok: false, reason: `Unknown volunteer ${m.volunteerId}` };
    if (!zones.has(m.toZoneId)) return { ok: false, reason: `Unknown zone ${m.toZoneId}` };
    if (seen.has(m.volunteerId)) return { ok: false, reason: `${m.volunteerId} moved twice` };
    seen.add(m.volunteerId);
  }
  return { ok: true };
}
