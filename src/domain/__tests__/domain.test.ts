import { seedFestival, at } from '@/sim/seed/festival';
import { seedRoster, TOTAL_ROSTER } from '@/sim/seed/roster';

import { briefLevelForDistance, templateBrief } from '../brief';
import { coverageGaps, gapsAt } from '../coverage';
import { canApprove, canResolveLinks } from '../escalation';
import { dist, isOnSite, pointInPolygon, projectLatLng, rect, unprojectToLatLng, zoneAt } from '../geo';
import { pickCandidates } from '../matching';
import { findPath, routeDistance } from '../pathfinding';
import { greedyPlacement, validateMoves } from '../placement';
import { plausiblyRelated } from '../related';
import type { Incident, RelatedLink, Volunteer } from '../types';

const festival = seedFestival();

function freshRoster() {
  return seedRoster(festival);
}

const baseIncident: Incident = {
  id: 'i1',
  ref: 'INC-001',
  createdAt: at(14),
  reporterId: 'v-priya',
  source: 'voice',
  transcript: '',
  type: 'heat_illness',
  description: 'Collapse',
  zoneId: 'z-water',
  location: { x: 290, y: 232 },
  urgency: 'critical',
  structuredBy: 'ai',
  status: 'suggested',
  candidates: [],
};

describe('geo', () => {
  it('detects points inside polygons', () => {
    const sq = rect(0, 0, 10, 10);
    expect(pointInPolygon({ x: 5, y: 5 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, sq)).toBe(false);
  });

  it('knows the site boundary', () => {
    expect(isOnSite({ x: 300, y: 200 }, festival)).toBe(true);
    expect(isOnSite({ x: 252, y: -30 }, festival)).toBe(false);
  });

  it('round-trips GPS projection to within a centimetre', () => {
    const p = { x: 123.4, y: 222.2 };
    const ll = unprojectToLatLng(p, festival.geoAnchor);
    const back = projectLatLng(ll.lat, ll.lng, festival.geoAnchor);
    expect(dist(p, back)).toBeLessThan(0.01);
  });

  it('finds the zone at a point', () => {
    expect(zoneAt({ x: 290, y: 232 }, festival.zones)?.id).toBe('z-water');
  });
});

describe('pathfinding', () => {
  it('walks straight when nothing is in the way', () => {
    expect(findPath({ x: 360, y: 236 }, { x: 290, y: 232 }, festival)).toHaveLength(2);
  });

  it('routes around a stage deck', () => {
    const from = { x: 480, y: 25 };
    const to = { x: 480, y: 80 };
    const path = findPath(from, to, festival);
    expect(path.length).toBeGreaterThan(2);
    expect(routeDistance(path)).toBeGreaterThan(dist(from, to));
  });
});

describe('matching (scenario 1)', () => {
  it('picks Sam as the nearest available first-aider, skipping no-shows', () => {
    const { volunteers, positions } = freshRoster();
    const roster = volunteers.map((v) =>
      v.id === 'v-jordan' || v.id === 'v-mei' ? { ...v, status: 'no_show' as const } : v,
    );
    const candidates = pickCandidates(baseIncident, {
      festival,
      volunteers: roster,
      positionOf: (id) => positions[id],
      busyIds: new Set(),
      now: at(14),
    });
    expect(candidates.length).toBeGreaterThanOrEqual(3);
    expect(candidates.length).toBeLessThanOrEqual(5);
    expect(candidates[0].volunteerId).toBe('v-sam');
    expect(candidates[0].distanceM).toBeLessThan(100);
    expect(candidates.map((c) => c.volunteerId)).not.toContain('v-jordan');
    expect(candidates.map((c) => c.volunteerId)).not.toContain('v-mei');
    expect(candidates.map((c) => c.volunteerId)).not.toContain('v-priya');
    expect(candidates.filter((c) => c.tier === 'primary').every((c) => c.skills.includes('first_aid'))).toBe(true);
  });

  it('excludes volunteers already on a dispatch', () => {
    const { volunteers, positions } = freshRoster();
    const candidates = pickCandidates(baseIncident, {
      festival,
      volunteers,
      positionOf: (id) => positions[id],
      busyIds: new Set(['v-sam']),
      now: at(14),
    });
    expect(candidates.map((c) => c.volunteerId)).not.toContain('v-sam');
  });

  it('never suggests someone who said they can’t go, and lines up the next first-aider', () => {
    const { volunteers, positions } = freshRoster();
    const roster = volunteers.map((v) =>
      v.id === 'v-jordan' || v.id === 'v-mei' ? { ...v, status: 'no_show' as const } : v,
    );
    const candidates = pickCandidates(baseIncident, {
      festival,
      volunteers: roster,
      positionOf: (id) => positions[id],
      busyIds: new Set(),
      excludeIds: new Set(['v-sam']),
      now: at(14),
    });
    expect(candidates.map((c) => c.volunteerId)).not.toContain('v-sam');
    expect(candidates[0].tier).toBe('primary');
    expect(candidates[0].skills).toContain('first_aid');
  });
});

describe('escalation', () => {
  const safety = { id: 'v-kim', role: 'safety_lead' as const };
  const raj = { id: 'v-raj', role: 'location_lead' as const, leadsZoneId: 'z-lawn' };
  const vol = { id: 'v-tom', role: 'volunteer' as const };
  const fight: Incident = { ...baseIncident, zoneId: 'z-lawn', urgency: 'high', type: 'fight' };

  it('lets the safety lead approve immediately', () => {
    expect(canApprove(safety, fight, [], fight.createdAt)).toEqual({ allowed: true, escalated: false });
  });

  it('never lets volunteers approve', () => {
    expect(canApprove(vol, fight, [], fight.createdAt + 1e7).allowed).toBe(false);
  });

  it('holds location leads for 2 minutes on non-critical incidents', () => {
    expect(canApprove(raj, fight, [], fight.createdAt + 119_000).allowed).toBe(false);
    expect(canApprove(raj, fight, [], fight.createdAt + 120_000)).toEqual({ allowed: true, escalated: true });
  });

  it('restarts the lead’s window when the incident starts waiting again (someone couldn’t go)', () => {
    const critical = { ...fight, urgency: 'critical' as const, status: 'suggested' as const, awaitingSince: fight.createdAt + 300_000 };
    expect(canApprove(raj, critical, [], critical.awaitingSince + 29_000).allowed).toBe(false);
    expect(canApprove(raj, critical, [], critical.awaitingSince + 30_000)).toEqual({ allowed: true, escalated: true });
  });

  it('holds location leads for 30 seconds on critical incidents', () => {
    const critical = { ...fight, urgency: 'critical' as const };
    expect(canApprove(raj, critical, [], critical.createdAt + 29_000).allowed).toBe(false);
    expect(canApprove(raj, critical, [], critical.createdAt + 30_000).allowed).toBe(true);
  });

  it('keeps location leads to their own zone', () => {
    const elsewhere = { ...fight, zoneId: 'z-main' };
    expect(canApprove(raj, elsewhere, [], elsewhere.createdAt + 1e7).allowed).toBe(false);
  });

  it('blocks approval while a related link is unresolved', () => {
    const link: RelatedLink = {
      id: 'l1', a: fight.id, b: 'i2', source: 'ai', likelySame: true, confidence: 0.8, reason: '', resolution: 'pending',
    };
    expect(canApprove(safety, fight, [link], fight.createdAt).allowed).toBe(false);
    expect(canApprove(safety, fight, [{ ...link, resolution: 'separate' }], fight.createdAt).allowed).toBe(true);
  });

  it('only lets a lead resolve links once their window opens', () => {
    expect(canResolveLinks(raj, fight, fight.createdAt)).toBe(false);
    expect(canResolveLinks(raj, fight, fight.createdAt + 120_000)).toBe(true);
    expect(canResolveLinks(safety, fight, fight.createdAt)).toBe(true);
  });

  it('refuses approval once already approved', () => {
    expect(canApprove(safety, { ...fight, status: 'approved' }, [], fight.createdAt).allowed).toBe(false);
  });
});

describe('related pre-filter (scenario 2)', () => {
  const tom = { id: 'a', type: 'fight' as const, createdAt: at(20, 30), location: { x: 72, y: 118 }, zoneId: 'z-lawn' };
  const aisha = { id: 'b', type: 'fight' as const, createdAt: at(20, 31), location: { x: 206, y: 122 }, zoneId: 'z-lawn' };

  it('flags two fights either side of the Lawn Stage', () => {
    expect(plausiblyRelated(tom, aisha, festival.zones)).toBe(true);
  });

  it('ignores reports far apart in time', () => {
    expect(plausiblyRelated(tom, { ...aisha, createdAt: at(21, 0) }, festival.zones)).toBe(false);
  });

  it('ignores dissimilar types', () => {
    expect(plausiblyRelated(tom, { ...aisha, type: 'lost_child' }, festival.zones)).toBe(false);
  });

  it('ignores distant zones', () => {
    expect(plausiblyRelated(tom, { ...aisha, location: { x: 520, y: 320 }, zoneId: 'z-games' }, festival.zones)).toBe(false);
  });
});

describe('brief tiers', () => {
  it('maps distance to detail', () => {
    expect(briefLevelForDistance(70)).toBe('oneSentence');
    expect(briefLevelForDistance(100)).toBe('locationAndExpect');
    expect(briefLevelForDistance(300)).toBe('locationAndExpect');
    expect(briefLevelForDistance(301)).toBe('full');
  });

  it('builds a template brief with all three levels', () => {
    const b = templateBrief({
      incident: baseIncident,
      zoneName: 'Water Station',
      plan: { whatToExpect: 'Patient on the ground.', whoToFind: 'Priya' },
      message: 'Start cooling.',
      role: 'First aid lead',
      from: { x: 360, y: 236 },
      to: { x: 290, y: 232 },
      distanceM: 70,
    });
    expect(b.oneSentence.length).toBeGreaterThan(0);
    expect(b.full.length).toBeGreaterThan(b.locationAndExpect.length);
    expect(b.source).toBe('template');
  });
});

describe('seed + coverage', () => {
  it('has a 300-person roster with one safety lead and a lead per zone', () => {
    const { volunteers } = freshRoster();
    expect(volunteers).toHaveLength(TOTAL_ROSTER);
    expect(volunteers.filter((v) => v.role === 'safety_lead')).toHaveLength(1);
    for (const z of festival.zones) {
      expect(volunteers.some((v) => v.leadsZoneId === z.id)).toBe(true);
    }
  });

  it('has the Water Station first-aid gap only once Jordan and Mei no-show', () => {
    const { volunteers } = freshRoster();
    const waterFa = (vs: Volunteer[]) =>
      gapsAt(festival, vs, at(14)).filter((g) => g.zoneId === 'z-water' && g.skill === 'first_aid');
    expect(waterFa(volunteers)).toHaveLength(0);
    const noShows = volunteers.map((v) =>
      v.id === 'v-jordan' || v.id === 'v-mei' ? { ...v, status: 'no_show' as const } : v,
    );
    expect(waterFa(noShows)).toHaveLength(1);
    expect(waterFa(noShows)[0].have).toBe(0);
  });

  it('computes gaps across the day without throwing', () => {
    const { volunteers } = freshRoster();
    expect(Array.isArray(coverageGaps(festival, volunteers))).toBe(true);
  });
});

describe('placement', () => {
  it('greedy placement closes the no-show gap with valid moves', () => {
    const { volunteers, positions } = freshRoster();
    const roster = volunteers.map((v) =>
      v.id === 'v-jordan' || v.id === 'v-mei' ? { ...v, status: 'no_show' as const } : v,
    );
    const moves = greedyPlacement(festival, roster, 38, (id) => positions[id]);
    expect(validateMoves(moves, roster, festival.zones.map((z) => z.id))).toEqual({ ok: true });
    const after = roster.map((v) => {
      const m = moves.find((x) => x.volunteerId === v.id);
      return m ? { ...v, zoneId: m.toZoneId } : v;
    });
    expect(gapsAt(festival, after, at(14)).filter((g) => g.zoneId === 'z-water')).toHaveLength(0);
  });

  it('rejects moves for unknown people or duplicates', () => {
    const { volunteers } = freshRoster();
    const zoneIds = festival.zones.map((z) => z.id);
    expect(validateMoves([{ volunteerId: 'nope', toZoneId: 'z-water', reason: '' }], volunteers, zoneIds).ok).toBe(false);
    expect(
      validateMoves(
        [
          { volunteerId: 'v-sam', toZoneId: 'z-water', reason: '' },
          { volunteerId: 'v-sam', toZoneId: 'z-food', reason: '' },
        ],
        volunteers,
        zoneIds,
      ).ok,
    ).toBe(false);
  });
});

describe('staffing', () => {
  const { planFill, resolveSurge, SURGES, targetFor, withTargets, onShiftIn, countWith } = jest.requireActual('../staffing') as typeof import('../staffing');
  const roster = freshRoster();
  const people = roster.volunteers;
  const positionOf = (id: string) => roster.positions[id];
  const lawn = () => festival.zones.find((z) => z.id === 'z-lawn')!;

  it('hands out de-escalation training without disturbing the rest of the roster', () => {
    expect(people.length).toBe(TOTAL_ROSTER);
    expect(people.filter((v) => v.skills.includes('deescalation')).length).toBeGreaterThan(10);
    expect(people.find((v) => v.id === 'v-sam')?.skills).toContain('first_aid');
  });

  it('a new target replaces the old rule for that skill', () => {
    const next = withTargets(festival, [{ zoneId: 'z-lawn', skill: 'deescalation', min: 4 }]);
    const z = next.zones.find((x) => x.id === 'z-lawn')!;
    expect(targetFor(z, 'deescalation', 30)).toBe(4);
    expect(targetFor(z, 'security_licence', 30)).toBe(targetFor(lawn(), 'security_licence', 30));
  });

  it('fills a raised target without leaving any other zone short', () => {
    const surge = SURGES.find((s) => s.id === 'concert-lawn')!;
    const next = withTargets(festival, resolveSurge(festival, surge, 30, people));
    const { moves } = planFill({ festival: next, volunteers: people, positionOf, busyIds: new Set(), now: at(20), tempC: 30, zoneIds: ['z-lawn'] });
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.toZoneId === 'z-lawn' && m.fromZoneId !== 'z-lawn')).toBe(true);
    // Apply the moves, then check every source zone still meets its own minimums.
    const after = people.map((v) => {
      const m = moves.find((x) => x.volunteerId === v.id);
      return m ? { ...v, zoneId: m.toZoneId } : v;
    });
    for (const zoneId of new Set(moves.map((m) => m.fromZoneId!))) {
      const zone = next.zones.find((z) => z.id === zoneId)!;
      const here = onShiftIn(zoneId, after);
      for (const r of zone.requirements.filter((x) => x.minTempC === undefined)) {
        const before = countWith(onShiftIn(zoneId, people), r.skill);
        // Never pushed below a minimum it was meeting before.
        if (before >= r.min) expect(countWith(here, r.skill)).toBeGreaterThanOrEqual(r.min);
      }
    }
  });

  it('never moves someone on a call-out or moved in the last half hour', () => {
    const next = withTargets(festival, [{ zoneId: 'z-lawn', skill: 'deescalation', min: 30 }]);
    const busy = new Set(people.filter((v) => v.skills.includes('deescalation')).slice(0, 3).map((v) => v.id));
    const recent = people.map((v, i) => (i % 2 === 0 ? { ...v, movedAt: at(20) - 5 * 60 * 1000 } : v));
    const { moves, shortfalls } = planFill({ festival: next, volunteers: recent, positionOf, busyIds: busy, now: at(20), tempC: 30, zoneIds: ['z-lawn'] });
    for (const m of moves) {
      expect(busy.has(m.volunteerId)).toBe(false);
      expect(recent.find((v) => v.id === m.volunteerId)?.movedAt).toBeUndefined();
    }
    expect(shortfalls.length).toBeGreaterThan(0);
  });
});
