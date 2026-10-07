import type { Festival, Vec, Zone } from './types';

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pathLength(path: Vec[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += dist(path[i - 1], path[i]);
  return total;
}

/** Ray-casting point-in-polygon. */
export function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function centroid(poly: Vec[]): Vec {
  const sum = poly.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / poly.length, y: sum.y / poly.length };
}

export function rect(x: number, y: number, w: number, h: number): Vec[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function cross(o: Vec, a: Vec, b: Vec) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsIntersect(p1: Vec, p2: Vec, q1: Vec, q2: Vec): boolean {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True if the straight segment a→b crosses or enters the polygon. */
export function segmentHitsPolygon(a: Vec, b: Vec, poly: Vec[]): boolean {
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segmentsIntersect(a, b, poly[j], poly[i])) return true;
  }
  return false;
}

/** Distance from a point to the nearest edge of a polygon (0 if inside). */
export function distanceToPolygon(p: Vec, poly: Vec[]): number {
  if (pointInPolygon(p, poly)) return 0;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    best = Math.min(best, distanceToSegment(p, poly[j], poly[i]));
  }
  return best;
}

function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** The zone containing the point, else the zone whose edge is closest. */
export function zoneAt(p: Vec, zones: Zone[]): Zone | undefined {
  let best: Zone | undefined;
  let bestD = Infinity;
  for (const z of zones) {
    const d = distanceToPolygon(p, z.polygon);
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best;
}

/** Zones are adjacent if their polygons come within `gapM` metres of each other. */
export function zonesAdjacent(a: Zone, b: Zone, gapM = 40): boolean {
  if (a.id === b.id) return true;
  return (
    a.polygon.some((p) => distanceToPolygon(p, b.polygon) <= gapM) ||
    b.polygon.some((p) => distanceToPolygon(p, a.polygon) <= gapM)
  );
}

export function isOnSite(p: Vec, festival: Pick<Festival, 'boundary'>): boolean {
  return pointInPolygon(p, festival.boundary);
}

const EARTH_R = 6371000;

/**
 * Project a GPS fix into local site metres using an equirectangular approximation
 * around the anchor (accurate to centimetres over a festival-sized site).
 */
export function projectLatLng(
  lat: number,
  lng: number,
  anchor: Festival['geoAnchor'],
): Vec {
  const toRad = Math.PI / 180;
  const east = (lng - anchor.lng) * toRad * EARTH_R * Math.cos(anchor.lat * toRad);
  const north = (lat - anchor.lat) * toRad * EARTH_R;
  // Rotate so site x/y align with the plan, then flip north → +y south.
  const b = anchor.bearingDeg * toRad;
  const x = east * Math.cos(b) - north * Math.sin(b);
  const yNorth = east * Math.sin(b) + north * Math.cos(b);
  return { x, y: -yNorth };
}

/** Inverse of projectLatLng — used to show coordinates and for tests. */
export function unprojectToLatLng(p: Vec, anchor: Festival['geoAnchor']): { lat: number; lng: number } {
  const toRad = Math.PI / 180;
  const b = anchor.bearingDeg * toRad;
  const yNorth = -p.y;
  const east = p.x * Math.cos(b) + yNorth * Math.sin(b);
  const north = -p.x * Math.sin(b) + yNorth * Math.cos(b);
  return {
    lat: anchor.lat + north / EARTH_R / toRad,
    lng: anchor.lng + east / (EARTH_R * Math.cos(anchor.lat * toRad)) / toRad,
  };
}

/** Compass-ish direction from a to b, for briefs ("head north-east"). */
export function compassDirection(a: Vec, b: Vec): string {
  const angle = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
  const dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return dirs[(Math.round(((angle + 360) % 360) / 45) % 8 + 8) % 8];
}
