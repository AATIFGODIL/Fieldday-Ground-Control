import { centroid } from '@/domain/geo';
import type { Festival, Skill, Slot, Vec, Volunteer, Zone } from '@/domain/types';

import { at } from './festival';

/** Deterministic PRNG so the seeded roster is identical on every reset. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  'Alex', 'Bella', 'Chloe', 'Daniel', 'Ella', 'Finn', 'Georgia', 'Harry', 'Isla', 'Jack', 'Kai', 'Liam',
  'Maya', 'Noah', 'Olivia', 'Pete', 'Quinn', 'Ruby', 'Sophie', 'Theo', 'Uma', 'Vic', 'Will', 'Xavier',
  'Yasmin', 'Zara', 'Ana', 'Ben', 'Cara', 'Dev', 'Eli', 'Fatima', 'Gus', 'Hana', 'Ivan', 'Jade', 'Kofi',
  'Lucy', 'Max', 'Nina', 'Omar', 'Paige', 'Rhys', 'Sana', 'Tariq', 'Vera', 'Wen', 'Yusuf', 'Leo', 'Mia',
];
const LAST = 'ABCDEFGHJKLMNOPRSTVWY';
const LANGS = ['Mandarin', 'Arabic', 'Vietnamese', 'Hindi', 'Spanish', 'Greek', 'Italian', 'Korean', 'Cantonese', 'Auslan'];

const FULL_DAY: Slot = { start: at(9, 30), end: at(23, 30) };

export const TOTAL_ROSTER = 300;

export interface SeedRoster {
  volunteers: Volunteer[];
  positions: Record<string, Vec>;
}

type Named = Omit<Volunteer, 'availability' | 'status' | 'languages'> & {
  pos: Vec;
  languages?: string[];
  availability?: Slot[];
};

/**
 * Hand-placed people the two demo scenarios are built around.
 *
 * S1 heat collapse (Water Station, 2pm, 38°C): Jordan + Mei are the rostered
 * first-aiders who no-show; Priya reports; Sam (Food Court, ~70 m) is the
 * nearest first-aider; Lena (First Aid Tent, ~140 m) is next; Ahmed supports.
 *
 * S2 possible duplicate (Lawn Stage): Tom (west) and Aisha (east) report the
 * same fight ~130 m apart; Marcus and Zoe are nearby security.
 *
 * Bar A, for a hands-on run: Jess works the counter (RSA) and Leo is the
 * bar's first-aider, the only one there, so a collapse at the bar always
 * goes to him. Neither changes who's nearest in the two stories.
 */
export const NAMED: Named[] = [
  { id: 'v-kim', name: 'Mo Rahman', role: 'safety_lead', skills: ['first_aid', 'crowd_control', 'security_licence'], pos: { x: 262, y: 300 } },
  { id: 'v-raj', name: 'Raj Patel', role: 'location_lead', leadsZoneId: 'z-lawn', zoneId: 'z-lawn', skills: ['crowd_control', 'first_aid'], pos: { x: 140, y: 140 }, languages: ['English', 'Hindi'] },
  { id: 'v-grace', name: 'Grace Okafor', role: 'location_lead', leadsZoneId: 'z-water', zoneId: 'z-water', skills: ['first_aid'], pos: { x: 318, y: 240 } },
  { id: 'v-priya', name: 'Priya Shah', role: 'volunteer', zoneId: 'z-water', skills: ['wwcc'], pos: { x: 290, y: 232 }, languages: ['English', 'Gujarati'] },
  { id: 'v-ahmed', name: 'Ahmed Hassan', role: 'volunteer', zoneId: 'z-water', skills: ['crowd_control'], pos: { x: 315, y: 205 }, languages: ['English', 'Arabic'] },
  { id: 'v-jordan', name: 'Jordan Lee', role: 'volunteer', zoneId: 'z-water', skills: ['first_aid'], pos: { x: 268, y: 210 } },
  { id: 'v-mei', name: 'Mei Chen', role: 'volunteer', zoneId: 'z-water', skills: ['first_aid', 'wwcc'], pos: { x: 282, y: 240 }, languages: ['English', 'Mandarin'] },
  { id: 'v-sam', name: 'Sam Carter', role: 'volunteer', zoneId: 'z-food', skills: ['first_aid', 'rsa'], pos: { x: 360, y: 236 } },
  { id: 'v-lena', name: 'Lena Fischer', role: 'volunteer', zoneId: 'z-aid', skills: ['first_aid', 'wwcc'], pos: { x: 218, y: 335 }, languages: ['English', 'German'] },
  { id: 'v-tom', name: 'Tom Walsh', role: 'volunteer', zoneId: 'z-lawn', skills: ['crowd_control'], pos: { x: 72, y: 118 } },
  { id: 'v-aisha', name: 'Aisha Rahman', role: 'volunteer', zoneId: 'z-lawn', skills: ['rsa'], pos: { x: 206, y: 122 }, languages: ['English', 'Arabic'] },
  { id: 'v-marcus', name: 'Marcus Brown', role: 'volunteer', zoneId: 'z-lawn', skills: ['security_licence', 'crowd_control'], pos: { x: 150, y: 152 } },
  { id: 'v-zoe', name: 'Zoe Martin', role: 'volunteer', zoneId: 'z-lawn', skills: ['security_licence', 'first_aid'], pos: { x: 110, y: 75 } },
  { id: 'v-ben', name: 'Ben Taylor', role: 'volunteer', zoneId: 'z-gate-n', skills: ['crowd_control'], pos: { x: 252, y: 22 } },
  { id: 'v-jess', name: 'Jess Nguyen', role: 'volunteer', zoneId: 'z-bar-a', skills: ['rsa'], pos: { x: 506, y: 192 }, languages: ['English', 'Vietnamese'] },
  { id: 'v-leo', name: 'Leo Park', role: 'volunteer', zoneId: 'z-bar-a', skills: ['first_aid'], pos: { x: 528, y: 214 }, languages: ['English', 'Korean'] },
];

export const DEMO_IDENTITIES = ['v-kim', 'v-raj', 'v-grace', 'v-priya', 'v-sam', 'v-lena', 'v-tom', 'v-aisha', 'v-ben', 'v-jess', 'v-leo'];

/** Zones with no named lead get a generated one. */
const LEADS_NEEDED = (zones: Zone[]) =>
  zones.filter((z) => !NAMED.some((n) => n.leadsZoneId === z.id)).map((z) => z.id);

/** Zones whose generated volunteers must NOT carry a skill (keeps the S1 gap and nearest-first-aider honest). */
const NO_EXTRA_SKILL: Record<string, Skill[]> = {
  'z-water': ['first_aid'],
  'z-food': ['first_aid'],
  // Leo is Bar A's first-aider; nobody generated there should be nearer.
  'z-bar-a': ['first_aid'],
};

/** Extra share of generic volunteers each zone gets beyond its requirements. */
const ZONE_WEIGHT: Record<string, number> = {
  'z-main': 9, 'z-lawn': 5, 'z-water': 1, 'z-food': 3, 'z-bar-a': 3, 'z-bar-b': 2, 'z-wash-n': 1,
  'z-wash-w': 1, 'z-wash-e': 1, 'z-games': 2, 'z-kids': 2, 'z-aid': 1, 'z-gate-n': 2, 'z-gate-s': 2,
};

export function seedRoster(festival: Festival): SeedRoster {
  const rand = mulberry32(20270116);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const volunteers: Volunteer[] = [];
  const positions: Record<string, Vec> = {};
  let n = 0;
  const usedNames = new Set(NAMED.map((v) => v.name));

  const genName = () => {
    for (;;) {
      const name = `${pick(FIRST)} ${pick(LAST.split(''))}.`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
  };

  const pointIn = (zone: Zone): Vec => {
    const xs = zone.polygon.map((p) => p.x);
    const ys = zone.polygon.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs) + 4, Math.max(...xs) - 4, Math.min(...ys) + 4, Math.max(...ys) - 4];
    return { x: Math.round(x0 + rand() * (x1 - x0)), y: Math.round(y0 + rand() * (y1 - y0)) };
  };

  const randomSkills = (zoneId: string): Skill[] => {
    const s: Skill[] = [];
    if (rand() < 0.22) s.push('first_aid');
    if (rand() < 0.3) s.push('wwcc');
    if (rand() < 0.22) s.push('rsa');
    if (rand() < 0.15) s.push('crowd_control');
    if (rand() < 0.06) s.push('security_licence');
    const banned = NO_EXTRA_SKILL[zoneId] ?? [];
    return s.filter((k) => !banned.includes(k));
  };

  const randomLangs = () => (rand() < 0.3 ? ['English', pick(LANGS)] : ['English']);

  const randomShift = (): Slot[] => {
    const r = rand();
    if (r < 0.6) return [FULL_DAY];
    if (r < 0.8) return [{ start: at(9, 30), end: at(17) }];
    return [{ start: at(16), end: at(23, 30) }];
  };

  const add = (v: Volunteer, pos: Vec) => {
    volunteers.push(v);
    positions[v.id] = pos;
  };

  for (const nm of NAMED) {
    const { pos, ...rest } = nm;
    add(
      {
        ...rest,
        languages: nm.languages ?? ['English'],
        availability: nm.availability ?? [FULL_DAY],
        status: 'checked_in',
      },
      pos,
    );
  }

  const zoneById = Object.fromEntries(festival.zones.map((z) => [z.id, z]));

  for (const zoneId of LEADS_NEEDED(festival.zones)) {
    const zone = zoneById[zoneId];
    const c = centroid(zone.polygon);
    add(
      {
        id: `v-lead-${zoneId.slice(2)}`,
        name: genName(),
        role: 'location_lead',
        leadsZoneId: zoneId,
        zoneId,
        skills: ['crowd_control', ...(rand() < 0.5 ? (['first_aid'] as Skill[]) : [])],
        languages: randomLangs(),
        availability: [FULL_DAY],
        status: 'checked_in',
      },
      { x: Math.round(c.x), y: Math.round(c.y) },
    );
  }

  const nextId = () => `v-${String(++n).padStart(3, '0')}`;

  // 1. Satisfy each zone's skill requirements (all-day shifts), counting named staff.
  for (const zone of festival.zones) {
    for (const req of zone.requirements) {
      if (!req.skill) continue;
      // The Water Station's first-aiders are exactly Jordan + Mei, so their no-show leaves a real gap.
      if (zone.id === 'z-water' && req.skill === 'first_aid') continue;
      const have = volunteers.filter(
        (v) => v.zoneId === zone.id && v.role === 'volunteer' && v.skills.includes(req.skill!),
      ).length;
      for (let i = have; i < req.min; i++) {
        const skills = Array.from(new Set<Skill>([req.skill, ...randomSkills(zone.id)]));
        // Kids Zone: one WWCC volunteer leaves at 5pm → a pre-festival coverage gap to show.
        const availability = zone.id === 'z-kids' && req.skill === 'wwcc' && i === req.min - 1
          ? [{ start: at(9, 30), end: at(17) }]
          : [FULL_DAY];
        add(
          { id: nextId(), name: genName(), role: 'volunteer', zoneId: zone.id, skills, languages: randomLangs(), availability, status: 'checked_in' },
          pointIn(zone),
        );
      }
    }
  }

  // 2. Fill headcount minimums.
  for (const zone of festival.zones) {
    const min = zone.requirements.find((r) => r.skill === null)?.min ?? 0;
    const have = volunteers.filter((v) => v.zoneId === zone.id && v.role === 'volunteer').length;
    for (let i = have; i < min; i++) {
      add(
        { id: nextId(), name: genName(), role: 'volunteer', zoneId: zone.id, skills: randomSkills(zone.id), languages: randomLangs(), availability: [FULL_DAY], status: 'checked_in' },
        pointIn(zone),
      );
    }
  }

  // 3. Spread the rest of the 300 by zone weight, with mixed shifts.
  const weighted = festival.zones.flatMap((z) => Array(ZONE_WEIGHT[z.id] ?? 1).fill(z.id) as string[]);
  while (volunteers.length < TOTAL_ROSTER) {
    const zone = zoneById[pick(weighted)];
    add(
      { id: nextId(), name: genName(), role: 'volunteer', zoneId: zone.id, skills: randomSkills(zone.id), languages: randomLangs(), availability: randomShift(), status: 'checked_in' },
      pointIn(zone),
    );
  }

  // 4. De-escalation training, handed out in its own pass with its own random
  //    stream, so everything above (and the demo stories built on it) stays put.
  const rand2 = mulberry32(8086);
  for (const v of volunteers) {
    if (v.role === 'safety_lead') continue;
    const likely = v.role === 'location_lead' || v.skills.includes('crowd_control') || v.skills.includes('security_licence');
    if (rand2() < (likely ? 0.55 : 0.1)) v.skills = [...v.skills, 'deescalation'];
  }

  return { volunteers, positions };
}
