import { zoneAt } from './geo';
import { findPath, routeDistance } from './pathfinding';
import type { Candidate, Festival, Incident, IncidentType, Skill, Vec, Volunteer } from './types';

/** Average walking pace through a festival crowd, metres per second. */
export const WALK_SPEED_MPS = 1.2;

/** Skills that make someone a primary responder vs useful support, per incident type. */
export const RESPONSE_SKILLS: Record<IncidentType, { primary: Skill[]; support: Skill[] }> = {
  heat_illness: { primary: ['first_aid'], support: ['crowd_control'] },
  medical: { primary: ['first_aid'], support: ['crowd_control'] },
  intoxication: { primary: ['first_aid'], support: ['rsa', 'deescalation', 'security_licence'] },
  fight: { primary: ['security_licence', 'deescalation', 'crowd_control'], support: ['first_aid'] },
  security_threat: { primary: ['security_licence'], support: ['deescalation', 'crowd_control'] },
  crowd_crush: { primary: ['crowd_control', 'security_licence'], support: ['deescalation', 'first_aid'] },
  lost_child: { primary: ['wwcc'], support: ['crowd_control'] },
  fire: { primary: ['crowd_control'], support: ['first_aid'] },
  property: { primary: ['security_licence', 'crowd_control'], support: [] },
  other: { primary: [], support: [] },
};

export const MAX_PRIMARY = 3;
export const MAX_CANDIDATES = 5;

export type PositionLookup = (volunteerId: string) => Vec | undefined;

export interface MatchContext {
  festival: Festival;
  volunteers: Volunteer[];
  positionOf: PositionLookup;
  /** Volunteers already committed to an active dispatch. */
  busyIds: Set<string>;
  now: number;
}

export function isAvailableNow(v: Volunteer, now: number): boolean {
  return v.availability.some((s) => s.start <= now && now < s.end);
}

/**
 * Deterministically pick the 3–5 best responders for an incident.
 * This is the *only* place that decides who is eligible; the AI only chooses
 * among (and writes messages for) the people returned here.
 */
export function pickCandidates(
  incident: Pick<Incident, 'type' | 'location' | 'reporterId'>,
  ctx: MatchContext,
): Candidate[] {
  const { primary, support } = RESPONSE_SKILLS[incident.type];

  const eligible = ctx.volunteers.filter(
    (v) =>
      v.role === 'volunteer' &&
      v.status === 'checked_in' &&
      v.id !== incident.reporterId &&
      !ctx.busyIds.has(v.id) &&
      isAvailableNow(v, ctx.now) &&
      ctx.positionOf(v.id) !== undefined,
  );

  const scored = eligible.map((v) => {
    const pos = ctx.positionOf(v.id)!;
    const path = findPath(pos, incident.location, ctx.festival);
    const distanceM = Math.round(routeDistance(path));
    const matchedPrimary = v.skills.filter((s) => primary.includes(s));
    const matchedSupport = v.skills.filter((s) => support.includes(s));
    return { v, pos, distanceM, matchedPrimary, matchedSupport };
  });

  const byDistance = (a: { distanceM: number }, b: { distanceM: number }) => a.distanceM - b.distanceM;

  const primaries =
    primary.length === 0
      ? [...scored].sort(byDistance).slice(0, MAX_PRIMARY)
      : scored.filter((s) => s.matchedPrimary.length > 0).sort(byDistance).slice(0, MAX_PRIMARY);
  const taken = new Set(primaries.map((s) => s.v.id));
  const supports = scored
    .filter((s) => !taken.has(s.v.id) && (support.length === 0 || s.matchedSupport.length > 0))
    .sort(byDistance)
    .slice(0, MAX_CANDIDATES - primaries.length);

  const toCandidate = (s: (typeof scored)[number], tier: Candidate['tier']): Candidate => ({
    volunteerId: s.v.id,
    name: s.v.name,
    skills: s.v.skills,
    matchedSkills: tier === 'primary' ? s.matchedPrimary : s.matchedSupport,
    languages: s.v.languages,
    distanceM: s.distanceM,
    etaMin: Math.max(1, Math.round(s.distanceM / WALK_SPEED_MPS / 60)),
    zoneName: zoneAt(s.pos, ctx.festival.zones)?.name ?? 'Unknown',
    tier,
  });

  return [
    ...primaries.map((s) => toCandidate(s, 'primary')),
    ...supports.map((s) => toCandidate(s, 'support')),
  ];
}
