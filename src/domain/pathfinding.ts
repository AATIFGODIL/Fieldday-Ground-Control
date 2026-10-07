import { dist, pathLength, segmentHitsPolygon } from './geo';
import type { Festival, Vec, WalkGraph } from './types';

function clear(a: Vec, b: Vec, obstacles: Vec[][]): boolean {
  return !obstacles.some((o) => segmentHitsPolygon(a, b, o));
}

/**
 * Walking route between two points. The site is mostly open ground, so we walk
 * straight unless a solid structure (stage deck etc.) is in the way, in which
 * case we route over the walkway graph with A*.
 */
export function findPath(
  from: Vec,
  to: Vec,
  festival: Pick<Festival, 'obstacles' | 'walkways'>,
): Vec[] {
  const { obstacles, walkways } = festival;
  if (clear(from, to, obstacles)) return [from, to];

  const nodes = walkways.nodes;
  const ids = Object.keys(nodes);
  const adj = buildAdjacency(walkways);

  // Virtual start/end nodes connect to every walkway node with a clear line of sight.
  const START = '__start';
  const END = '__end';
  const pos: Record<string, Vec> = { ...nodes, [START]: from, [END]: to };
  adj[START] = ids.filter((id) => clear(from, nodes[id], obstacles));
  for (const id of ids) {
    if (clear(nodes[id], to, obstacles)) adj[id] = [...(adj[id] ?? []), END];
  }

  const route = aStar(START, END, adj, pos);
  if (!route) return [from, to];
  return smooth(
    route.map((id) => pos[id]),
    obstacles,
  );
}

export function routeDistance(path: Vec[]): number {
  return pathLength(path);
}

function buildAdjacency(g: WalkGraph): Record<string, string[]> {
  const adj: Record<string, string[]> = {};
  for (const [a, b] of g.edges) {
    (adj[a] ??= []).push(b);
    (adj[b] ??= []).push(a);
  }
  return adj;
}

function aStar(
  start: string,
  goal: string,
  adj: Record<string, string[]>,
  pos: Record<string, Vec>,
): string[] | null {
  const g: Record<string, number> = { [start]: 0 };
  const f: Record<string, number> = { [start]: dist(pos[start], pos[goal]) };
  const came: Record<string, string> = {};
  const open = new Set([start]);

  while (open.size) {
    let current = '';
    let best = Infinity;
    for (const id of open) {
      if (f[id] < best) {
        best = f[id];
        current = id;
      }
    }
    if (current === goal) {
      const out = [current];
      while (came[out[0]]) out.unshift(came[out[0]]);
      return out;
    }
    open.delete(current);
    for (const next of adj[current] ?? []) {
      const tentative = g[current] + dist(pos[current], pos[next]);
      if (tentative < (g[next] ?? Infinity)) {
        came[next] = current;
        g[next] = tentative;
        f[next] = tentative + dist(pos[next], pos[goal]);
        open.add(next);
      }
    }
  }
  return null;
}

/** Drop intermediate waypoints we can skip without hitting an obstacle. */
function smooth(path: Vec[], obstacles: Vec[][]): Vec[] {
  if (path.length <= 2) return path;
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && !clear(path[i], path[j], obstacles)) j--;
    out.push(path[j]);
    i = j;
  }
  return out;
}

/** Point a fraction `t` (0..1) along a polyline, by distance. */
export function pointAlong(path: Vec[], travelled: number): Vec {
  if (path.length === 0) return { x: 0, y: 0 };
  let remaining = travelled;
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * t,
        y: path[i - 1].y + (path[i].y - path[i - 1].y) * t,
      };
    }
    remaining -= seg;
  }
  return path[path.length - 1];
}
