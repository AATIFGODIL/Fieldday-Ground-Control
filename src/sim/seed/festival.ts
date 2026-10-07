import { rect } from '@/domain/geo';
import type { Festival, Vec, WalkGraph, Zone } from '@/domain/types';

/** Saturday 16 January 2027 (local time). */
export const FESTIVAL_DAY = { year: 2027, month: 0, day: 16 };

export function at(hour: number, minute = 0): number {
  return new Date(FESTIVAL_DAY.year, FESTIVAL_DAY.month, FESTIVAL_DAY.day, hour, minute).getTime();
}

export const FESTIVAL_ID = 'FD-2026';

const zones: Zone[] = [
  {
    id: 'z-main',
    name: 'Main Stage',
    kind: 'stage',
    polygon: rect(380, 30, 180, 110),
    requirements: [
      { skill: null, min: 8 },
      { skill: 'crowd_control', min: 3 },
      { skill: 'security_licence', min: 2 },
    ],
  },
  {
    id: 'z-lawn',
    name: 'Lawn Stage',
    kind: 'stage',
    polygon: rect(60, 40, 160, 120),
    requirements: [
      { skill: null, min: 6 },
      { skill: 'crowd_control', min: 2 },
      { skill: 'security_licence', min: 1 },
    ],
  },
  {
    id: 'z-water',
    name: 'Water Station',
    kind: 'water',
    polygon: rect(255, 195, 70, 50),
    requirements: [
      { skill: null, min: 3 },
      { skill: 'first_aid', min: 2, minTempC: 35 },
    ],
  },
  {
    id: 'z-food',
    name: 'Food Court',
    kind: 'food',
    polygon: rect(345, 195, 100, 85),
    requirements: [
      { skill: null, min: 4 },
      { skill: 'first_aid', min: 1 },
    ],
  },
  {
    id: 'z-bar-a',
    name: 'Bar A',
    kind: 'bar',
    polygon: rect(470, 165, 90, 70),
    requirements: [
      { skill: null, min: 4 },
      { skill: 'rsa', min: 3 },
      { skill: 'security_licence', min: 1 },
    ],
  },
  {
    id: 'z-bar-b',
    name: 'Bar B',
    kind: 'bar',
    polygon: rect(110, 195, 90, 55),
    requirements: [
      { skill: null, min: 3 },
      { skill: 'rsa', min: 2 },
    ],
  },
  {
    id: 'z-wash-n',
    name: 'Washrooms North',
    kind: 'washroom',
    polygon: rect(290, 40, 50, 30),
    requirements: [{ skill: null, min: 1 }],
  },
  {
    id: 'z-wash-w',
    name: 'Washrooms West',
    kind: 'washroom',
    polygon: rect(25, 250, 40, 45),
    requirements: [{ skill: null, min: 1 }],
  },
  {
    id: 'z-wash-e',
    name: 'Washrooms East',
    kind: 'washroom',
    polygon: rect(540, 280, 40, 40),
    requirements: [{ skill: null, min: 1 }],
  },
  {
    id: 'z-games',
    name: 'Games',
    kind: 'games',
    polygon: rect(455, 270, 70, 90),
    requirements: [{ skill: null, min: 3 }],
  },
  {
    id: 'z-kids',
    name: 'Kids Zone',
    kind: 'kids',
    polygon: rect(70, 290, 110, 75),
    requirements: [
      { skill: null, min: 4 },
      { skill: 'wwcc', min: 3 },
      { skill: 'first_aid', min: 1 },
    ],
  },
  {
    id: 'z-aid',
    name: 'First Aid Tent',
    kind: 'medical',
    polygon: rect(200, 320, 50, 45),
    requirements: [
      { skill: null, min: 3 },
      { skill: 'first_aid', min: 3 },
    ],
  },
  {
    id: 'z-gate-n',
    name: 'North Gate',
    kind: 'gate',
    polygon: rect(225, 10, 50, 22),
    requirements: [
      { skill: null, min: 3 },
      { skill: 'security_licence', min: 1 },
    ],
  },
  {
    id: 'z-gate-s',
    name: 'South Gate',
    kind: 'gate',
    polygon: rect(280, 368, 60, 22),
    requirements: [
      { skill: null, min: 3 },
      { skill: 'security_licence', min: 1 },
    ],
  },
];

/** Stage decks are solid — people walk around them. */
const obstacles: Vec[][] = [rect(430, 32, 100, 28), rect(105, 42, 70, 22)];

function gridWalkways(): WalkGraph {
  const xs = [40, 240, 340, 400, 560];
  const ys = [25, 175, 285, 378];
  const nodes: WalkGraph['nodes'] = {};
  const edges: WalkGraph['edges'] = [];
  for (const x of xs) for (const y of ys) nodes[`w${x}-${y}`] = { x, y };
  xs.forEach((x, i) =>
    ys.forEach((y, j) => {
      if (i + 1 < xs.length) edges.push([`w${x}-${y}`, `w${xs[i + 1]}-${y}`]);
      if (j + 1 < ys.length) edges.push([`w${x}-${y}`, `w${x}-${ys[j + 1]}`]);
    }),
  );
  return { nodes, edges };
}

export function seedFestival(): Festival {
  return {
    id: FESTIVAL_ID,
    name: 'Fieldday Summer',
    width: 600,
    height: 400,
    boundary: [
      { x: 20, y: 8 },
      { x: 580, y: 8 },
      { x: 592, y: 25 },
      { x: 592, y: 375 },
      { x: 575, y: 392 },
      { x: 25, y: 392 },
      { x: 8, y: 375 },
      { x: 8, y: 25 },
    ],
    zones: structuredClone(zones),
    obstacles,
    walkways: gridWalkways(),
    geoAnchor: { lat: -33.8975, lng: 151.2305, bearingDeg: 0 },
    opensAt: at(10),
    closesAt: at(23),
    forecastC: {
      9: 22, 10: 24, 11: 27, 12: 31, 13: 35, 14: 38, 15: 38, 16: 37,
      17: 35, 18: 32, 19: 29, 20: 27, 21: 25, 22: 23, 23: 22,
    },
  };
}
