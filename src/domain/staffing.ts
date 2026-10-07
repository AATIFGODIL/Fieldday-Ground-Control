/**
 * Staffing: how many people with each skill a zone should have, and who could
 * move to make that true.
 *
 * Code decides who *can* move: on shift, not on a call-out, not moved in the
 * last half hour, and never leaving their own zone short. Closest goes first.
 * Nothing moves until the safety lead approves.
 */
import { activeRequirements } from './coverage';
import { centroid, dist } from './geo';
import { SKILL_LABELS, type Festival, type Skill, type Vec, type Volunteer, type Zone } from './types';

/** A new minimum for one skill in one zone (null skill = headcount). */
export interface TargetChange {
  zoneId: string;
  skill: Skill | null;
  min: number;
}

export interface StaffMove {
  volunteerId: string;
  fromZoneId?: string;
  toZoneId: string;
  skill: Skill | null;
  distanceM: number;
  reason: string;
}

export interface Shortfall {
  zoneId: string;
  skill: Skill | null;
  missing: number;
}

/** Skills on the Staff screen, most asked-for first. */
export const STAFF_SKILLS: Skill[] = ['first_aid', 'deescalation', 'security_licence', 'rsa', 'crowd_control', 'wwcc'];

/** Don't move the same person again within this long. */
export const MOVE_COOLDOWN_MS = 30 * 60 * 1000;

/** Scarcest skills are placed first so they aren't used up as general headcount. */
const FILL_ORDER: (Skill | null)[] = ['security_licence', 'wwcc', 'first_aid', 'deescalation', 'rsa', 'crowd_control', null];

/** Checked-in volunteers whose post is this zone. */
export function onShiftIn(zoneId: string, volunteers: Volunteer[]): Volunteer[] {
  return volunteers.filter((v) => v.role === 'volunteer' && v.status === 'checked_in' && v.zoneId === zoneId);
}

export function countWith(people: Volunteer[], skill: Skill | null): number {
  return skill ? people.filter((v) => v.skills.includes(skill)).length : people.length;
}

/** The minimum that applies right now for a skill in a zone (heat rules included). */
export function targetFor(zone: Zone, skill: Skill | null, tempC: number): number {
  return Math.max(0, ...activeRequirements(zone, tempC).filter((r) => r.skill === skill).map((r) => r.min));
}

/**
 * Set new minimums (pure). A change replaces every rule for that skill in that
 * zone, heat-only ones included: the safety lead's number is the number.
 */
export function withTargets(festival: Festival, changes: TargetChange[]): Festival {
  return {
    ...festival,
    zones: festival.zones.map((z) => {
      const mine = changes.filter((c) => c.zoneId === z.id);
      if (!mine.length) return z;
      let reqs = z.requirements;
      for (const c of mine) {
        reqs = reqs.filter((r) => r.skill !== c.skill);
        if (c.min > 0) reqs = [...reqs, { skill: c.skill, min: Math.round(c.min) }];
      }
      return { ...z, requirements: reqs };
    }),
  };
}

/** Plain-language skill name; null means "people" (headcount). */
export function skillName(skill: Skill | null, plural = true): string {
  if (!skill) return plural ? 'people' : 'person';
  return SKILL_LABELS[skill];
}

/**
 * Who should move so the given zones meet their minimums.
 * Returns the moves plus anything it couldn't cover without leaving
 * another zone short.
 */
export function planFill(args: {
  festival: Festival;
  volunteers: Volunteer[];
  positionOf: (id: string) => Vec | undefined;
  busyIds: Set<string>;
  now: number;
  tempC: number;
  zoneIds?: string[];
}): { moves: StaffMove[]; shortfalls: Shortfall[] } {
  const { festival, volunteers, positionOf, busyIds, now, tempC } = args;
  const byId = Object.fromEntries(festival.zones.map((z) => [z.id, z]));
  const targets = festival.zones.filter((z) => !args.zoneIds || args.zoneIds.includes(z.id));

  const present = volunteers.filter((v) => v.role === 'volunteer' && v.status === 'checked_in');
  const where = new Map(present.map((v) => [v.id, v.zoneId]));
  const movedNow = new Set<string>();

  const have = (zoneId: string, skill: Skill | null) =>
    present.filter((v) => where.get(v.id) === zoneId && (!skill || v.skills.includes(skill))).length;

  // Leaving must not drop their current zone below any of its own minimums.
  const canLeave = (v: Volunteer) => {
    const from = where.get(v.id);
    const zone = from ? byId[from] : undefined;
    if (!zone) return true;
    return activeRequirements(zone, tempC).every((r) => (r.skill && !v.skills.includes(r.skill)) || have(zone.id, r.skill) - 1 >= r.min);
  };

  const moves: StaffMove[] = [];
  const shortfalls: Shortfall[] = [];

  for (const zone of targets) {
    const centre = centroid(zone.polygon);
    const reqs = [...activeRequirements(zone, tempC)].sort((a, b) => FILL_ORDER.indexOf(a.skill) - FILL_ORDER.indexOf(b.skill));
    for (const r of reqs) {
      let missing = r.min - have(zone.id, r.skill);
      while (missing > 0) {
        let best: Volunteer | undefined;
        let bestD = Infinity;
        for (const v of present) {
          if (movedNow.has(v.id) || where.get(v.id) === zone.id || busyIds.has(v.id)) continue;
          if (r.skill && !v.skills.includes(r.skill)) continue;
          if (v.movedAt !== undefined && now - v.movedAt < MOVE_COOLDOWN_MS) continue;
          if (!canLeave(v)) continue;
          const from = positionOf(v.id) ?? (v.zoneId && byId[v.zoneId] ? centroid(byId[v.zoneId].polygon) : centre);
          const d = dist(from, centre);
          if (d < bestD) {
            bestD = d;
            best = v;
          }
        }
        if (!best) {
          shortfalls.push({ zoneId: zone.id, skill: r.skill, missing });
          break;
        }
        const fromZoneId = where.get(best.id);
        where.set(best.id, zone.id);
        movedNow.add(best.id);
        moves.push({
          volunteerId: best.id,
          fromZoneId,
          toZoneId: zone.id,
          skill: r.skill,
          distanceM: Math.round(bestD),
          reason: `${r.skill ? SKILL_LABELS[r.skill] : 'Extra hands'} · ${fromZoneId ? byId[fromZoneId]?.name : 'unassigned'} has spare`,
        });
        missing -= 1;
      }
    }
  }
  return { moves, shortfalls };
}

/* --------------------------------- surges --------------------------------- */

export interface SurgePreset {
  id: string;
  title: string;
  subtitle: string;
  glyph: 'music' | 'glass' | 'sun' | 'cloud';
  /** What the people who move are told. */
  note: string;
  /** How many more than are there right now. */
  add: { zoneId: string; skill: Skill | null; by: number }[];
}

export const SURGES: SurgePreset[] = [
  {
    id: 'concert-lawn',
    title: 'Concert at the Lawn Stage',
    subtitle: 'Calm heads and security up front',
    glyph: 'music',
    note: 'Big crowd at the Lawn Stage. Help keep things calm.',
    add: [
      { zoneId: 'z-lawn', skill: 'deescalation', by: 4 },
      { zoneId: 'z-lawn', skill: 'security_licence', by: 1 },
      { zoneId: 'z-lawn', skill: null, by: 4 },
    ],
  },
  {
    id: 'concert-main',
    title: 'Concert at the Main Stage',
    subtitle: 'Calm heads and security up front',
    glyph: 'music',
    note: 'Big crowd at the Main Stage. Help keep things calm.',
    add: [
      { zoneId: 'z-main', skill: 'deescalation', by: 4 },
      { zoneId: 'z-main', skill: 'security_licence', by: 1 },
      { zoneId: 'z-main', skill: null, by: 4 },
    ],
  },
  {
    id: 'bar-rush',
    title: 'Bar rush',
    subtitle: 'More RSA at both bars',
    glyph: 'glass',
    note: 'The bars are busy. Check IDs and keep service responsible.',
    add: [
      { zoneId: 'z-bar-a', skill: 'rsa', by: 2 },
      { zoneId: 'z-bar-b', skill: 'rsa', by: 2 },
    ],
  },
  {
    id: 'heat',
    title: 'Heat spike',
    subtitle: 'More first aid where people queue in the sun',
    glyph: 'sun',
    note: 'It’s very hot. Look out for anyone struggling in the heat.',
    add: [
      { zoneId: 'z-water', skill: 'first_aid', by: 1 },
      { zoneId: 'z-food', skill: 'first_aid', by: 1 },
      { zoneId: 'z-water', skill: null, by: 2 },
    ],
  },
  {
    id: 'storm',
    title: 'Storm warning',
    subtitle: 'Crowd help at the stages and gates',
    glyph: 'cloud',
    note: 'Storm on the way. Help people move calmly to shelter.',
    add: [
      { zoneId: 'z-lawn', skill: 'crowd_control', by: 2 },
      { zoneId: 'z-main', skill: 'crowd_control', by: 2 },
      { zoneId: 'z-gate-n', skill: null, by: 2 },
      { zoneId: 'z-gate-s', skill: null, by: 2 },
    ],
  },
];

/**
 * Turn a preset's "+N" into absolute minimums: N more than are there now
 * (or than the current minimum, if the zone is already short).
 */
export function resolveSurge(festival: Festival, preset: SurgePreset, tempC: number, volunteers: Volunteer[]): TargetChange[] {
  return preset.add.flatMap((a) => {
    const zone = festival.zones.find((z) => z.id === a.zoneId);
    if (!zone) return [];
    const here = countWith(onShiftIn(zone.id, volunteers), a.skill);
    return [{ zoneId: zone.id, skill: a.skill, min: Math.min(80, Math.max(targetFor(zone, a.skill, tempC), here) + a.by) }];
  });
}
