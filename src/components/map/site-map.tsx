/**
 * The festival site plan: a riverside park with zones, people, incidents and
 * the routes responders are walking.
 *
 * Positions come straight from the store, which is fed by either the
 * simulation or live GPS — the map does not know or care which.
 *
 * Static scenery is drawn once in SVG. Anything that moves (pulsing incidents,
 * walking responders, the marching route line, "you are here") lives in light
 * overlay views so it can animate smoothly without redrawing 300 dots.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, G, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { EASE_OUT } from '@/constants/motion';
import { Colors, urgencyColor } from '@/constants/theme';
import { centroid, dist, pointInPolygon } from '@/domain/geo';
import type { Skill, Vec, Volunteer, Zone, ZoneKind } from '@/domain/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { moveDot, updateZone, useStore } from '@/state/store';

/** Visible area in site metres: the park, the road to the north, the river to the south. */
const VB = { x: -30, y: -60, w: 660, h: 545 };

/** How far in you can zoom on the interactive map. */
const MAX_ZOOM = 5;

const LABEL_FONT = Platform.select({ web: '-apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif', default: undefined });

const SKILL_PRIORITY: Skill[] = ['first_aid', 'security_licence', 'deescalation', 'crowd_control', 'wwcc', 'rsa'];

/** Leads read darker than volunteers; certified volunteers a touch stronger than the rest. */
export function dotColor(v: Volunteer): string {
  if (v.role !== 'volunteer') return '#1E293B';
  return SKILL_PRIORITY.some((k) => v.skills.includes(k)) ? '#2340D9' : '#5B76E8';
}

/* ------------------------------ map palette ------------------------------ */

const MAP = {
  light: {
    outside: '#E8EBE3',
    grass: '#D4E7C2',
    grassEdge: '#B5D19C',
    path: '#FFFFFF',
    pathEdge: '#E0DAC8',
    river: '#8DC4EE',
    shore: '#C4E0F6',
    riverLabel: '#2F6EA8',
    road: '#D3D6DB',
    roadLine: '#FFFFFF',
    tree: '#8DBB78',
    treeTop: '#A7CF93',
    fence: '#55624F',
    deck: '#2B2E33',
    deckTop: '#41454C',
    label: '#1A1C19',
    halo: 'rgba(255,255,255,0.92)',
    dot: '#2340D9',
    dotStroke: '#FFFFFF',
  },
  dark: {
    outside: '#0C0E0C',
    grass: '#132116',
    grassEdge: '#1D3321',
    path: '#2A2E2A',
    pathEdge: '#1E211E',
    river: '#143A5E',
    shore: '#1B4B75',
    riverLabel: '#7FB5E6',
    road: '#22252A',
    roadLine: '#3A3E44',
    tree: '#1D3A23',
    treeTop: '#26492D',
    fence: '#6B7A6D',
    deck: '#4A4F57',
    deckTop: '#5A6069',
    label: '#EEF0EB',
    halo: 'rgba(0,0,0,0.78)',
    dot: '#7B93FF',
    dotStroke: '#0C0E0C',
  },
} as const;

const ZONE_TINT: Record<ZoneKind, { light: [string, string]; dark: [string, string] }> = {
  stage: { light: ['#E6E0FF', '#7C6CF0'], dark: ['#29244A', '#8B7CF6'] },
  water: { light: ['#D4EBFF', '#2F86D6'], dark: ['#122F4A', '#4FA3F0'] },
  bar: { light: ['#FFF0CC', '#C99415'], dark: ['#382C10', '#E0B040'] },
  food: { light: ['#FFE2D1', '#DD7438'], dark: ['#3C2317', '#F08A50'] },
  washroom: { light: ['#ECEDEF', '#8E959F'], dark: ['#24262A', '#7A808A'] },
  games: { light: ['#D5F2E7', '#249C74'], dark: ['#11322A', '#3CC08F'] },
  kids: { light: ['#FFDFED', '#D94C91'], dark: ['#3A1929', '#F06AA8'] },
  medical: { light: ['#FFE0E5', '#E11D48'], dark: ['#3C1720', '#FF4D6A'] },
  gate: { light: ['#E2E6EC', '#4B5563'], dark: ['#21252B', '#9AA3B2'] },
};

/** A zone kind's colour on the map (for swatches elsewhere). */
export function zoneColor(kind: ZoneKind, dark: boolean): string {
  return ZONE_TINT[kind][dark ? 'dark' : 'light'][1];
}

/** Short names so labels stay big without colliding. */
export function mapName(z: Zone) {
  return z.name
    .replace('Washrooms ', 'WC ')
    .replace(' Tent', '')
    .replace(' Station', '')
    .replace('Food Court', 'Food')
    .replace('Kids Zone', 'Kids');
}

/* --------------------------- scenery (static) ---------------------------- */

/** Deterministic tree scatter around the park edges. */
const TREES: { x: number; y: number; r: number }[] = (() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out: { x: number; y: number; r: number }[] = [];
  const area = (x0: number, x1: number, y0: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) out.push({ x: x0 + rnd() * (x1 - x0), y: y0 + rnd() * (y1 - y0), r: 4 + rnd() * 4 });
  };
  area(-26, 2, -20, 400, 22);
  area(598, 628, -20, 400, 22);
  area(10, 590, -24, 2, 18);
  area(10, 590, 396, 404, 14);
  return out;
})();

const RIVER_TOP = Array.from({ length: 19 }, (_, i) => {
  const x = -40 + i * 40;
  return { x, y: 414 + 5 * Math.sin(x / 55) };
});

function pts(poly: Vec[]): string {
  return poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

const Scenery = memo(function Scenery({ dark, ppm, showLabels }: { dark: boolean; ppm: number; showLabels: boolean }) {
  const m = dark ? MAP.dark : MAP.light;
  const festival = useStore((s) => s.festival);
  const label = 15 / ppm;
  const river = [...RIVER_TOP, { x: 700, y: 520 }, { x: -40, y: 520 }];
  const shore = RIVER_TOP.map((p) => ({ x: p.x, y: p.y - 6 }));
  return (
    <G>
      <Rect x={-200} y={-200} width={1100} height={900} fill={m.outside} />
      {/* Road along the north side */}
      <Rect x={-60} y={-48} width={760} height={18} fill={m.road} />
      <Line x1={-60} y1={-39} x2={700} y2={-39} stroke={m.roadLine} strokeWidth={1.2} strokeDasharray="8 8" />
      {/* River along the south side */}
      <Polygon points={pts([...shore, { x: 700, y: 520 }, { x: -40, y: 520 }])} fill={m.shore} />
      <Polygon points={pts(river)} fill={m.river} />
      {showLabels && (
        <>
          <SvgText x={300} y={458} fontSize={label * 1.05} fontStyle="italic" fontWeight="600" textAnchor="middle" fill={m.riverLabel} fontFamily={LABEL_FONT}>
            Yarra River
          </SvgText>
          <SvgText x={300} y={-50} fontSize={label * 0.9} fontWeight="600" textAnchor="middle" fill={m.fence} fontFamily={LABEL_FONT}>
            Riverside Drive
          </SvgText>
        </>
      )}
      {TREES.map((t, i) => (
        <G key={i}>
          <Circle cx={t.x} cy={t.y} r={t.r} fill={m.tree} />
          <Circle cx={t.x - t.r * 0.25} cy={t.y - t.r * 0.25} r={t.r * 0.55} fill={m.treeTop} />
        </G>
      ))}
      {/* The park */}
      <Polygon points={pts(festival.boundary)} fill={m.grass} stroke={m.grassEdge} strokeWidth={3} />
      {festival.walkways.edges.map(([a, b]) => {
        const A = festival.walkways.nodes[a];
        const B = festival.walkways.nodes[b];
        return <Line key={`e${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={m.pathEdge} strokeWidth={11} strokeLinecap="round" />;
      })}
      {festival.walkways.edges.map(([a, b]) => {
        const A = festival.walkways.nodes[a];
        const B = festival.walkways.nodes[b];
        return <Line key={`p${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={m.path} strokeWidth={8} strokeLinecap="round" />;
      })}
      <Polygon points={pts(festival.boundary)} fill="none" stroke={m.fence} strokeWidth={1.4} strokeDasharray="5 4" />
    </G>
  );
});

/* ------------------------------- the map -------------------------------- */

export type MapMode = 'view' | 'operator' | 'zones';

type DragState =
  | { kind: 'map' }
  | { kind: 'dot'; id: string }
  | { kind: 'vertex'; zoneId: string; index: number }
  | { kind: 'zone'; zoneId: string; start: Vec; polygon: Vec[] };

export interface SiteMapProps {
  mode?: MapMode;
  /** Height of the map window. */
  height?: number;
  /** Fill the window's height (wider than the screen; pan sideways). Used on the Map tab. */
  tall?: boolean;
  /** Zoom the static view onto a region (used for mini maps). */
  focus?: { center: Vec; radius: number };
  interactive?: boolean;
  highlightIds?: string[];
  pathDispatchIds?: string[];
  focusIncidentIds?: string[];
  selectedZoneId?: string | null;
  onSelectZone?: (id: string | null) => void;
  onDotPress?: (volunteerId: string) => void;
  onDotDropped?: (volunteerId: string) => void;
  onIncidentPress?: (incidentId: string) => void;
  showLabels?: boolean;
  /** Zoom onto one zone and fade everything outside it (the Map tab's zone filter). */
  filterZoneId?: string | null;
}

export function SiteMap({
  mode = 'view',
  height,
  tall = false,
  focus,
  interactive = true,
  highlightIds,
  pathDispatchIds,
  focusIncidentIds,
  selectedZoneId,
  onSelectZone,
  onDotPress,
  onDotDropped,
  onIncidentPress,
  showLabels = true,
  filterZoneId = null,
}: SiteMapProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const t = Colors[dark ? 'dark' : 'light'];
  const m = dark ? MAP.dark : MAP.light;
  const festival = useStore((s) => s.festival);
  const positions = useStore((s) => s.positions);
  const volunteers = useStore((s) => s.volunteers);
  const incidents = useStore((s) => s.incidents);
  const dispatches = useStore((s) => s.dispatches);
  const movements = useStore((s) => s.movements);
  const currentUserId = useStore((s) => s.currentUserId);

  const [W, setW] = useState(0);
  const [zoom, setZoom] = useState(1);

  const vb = focus
    ? { x: focus.center.x - focus.radius * 1.3, y: focus.center.y - focus.radius, w: focus.radius * 2.6, h: focus.radius * 2 }
    : VB;
  const staticMap = !!focus || !interactive;

  // Window (W×H) and content (cw×ch at `ppm` pixels per metre).
  const H = staticMap ? (height ?? 220) : tall ? (height ?? 520) : (W * vb.h) / vb.w;
  const ppm = W === 0 ? 1 : staticMap ? Math.max(W / vb.w, H / vb.h) : tall ? H / vb.h : W / vb.w;
  const cw = vb.w * ppm;
  const ch = vb.h * ppm;
  const ox = staticMap ? (W - cw) / 2 : 0;
  const oy = staticMap ? (H - ch) / 2 : 0;

  // Pan/zoom transform on the content (origin top-left): screen = t + s × local.
  // Pan, pinch and double-tap run on the UI thread, so the map stays with your
  // fingers even while the simulation is re-rendering the dots.
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const pinching = useSharedValue(false);
  /** Where a one-finger pan took hold. `fresh` means take hold again (after a pinch). */
  const grab = useSharedValue({ s: 1, x: 0, y: 0, ax: 0, ay: 0, fresh: true });
  /** The view and focal point a pinch started from, its latest focal point, and the zoom last sent to React. */
  const pinchFrom = useSharedValue({ s: 1, x: 0, y: 0, fx: 0, fy: 0, lx: 0, ly: 0, sent: 1 });
  const drag = useSharedValue<DragState | null>(null);
  const surface = useRef<View>(null);
  const minS = Math.min(1, W / Math.max(cw, 1));

  const clamp = (v: number, lo: number, hi: number) => {
    'worklet';
    return Math.min(hi, Math.max(lo, v));
  };
  /** Allowed translation at a scale: centred when the content is smaller than the window. */
  const bounds = (sc: number) => {
    'worklet';
    const lo = (win: number, size: number) => (size * sc <= win ? (win - size * sc) / 2 : win - size * sc);
    const hi = (win: number, size: number) => (size * sc <= win ? (win - size * sc) / 2 : 0);
    return { xlo: lo(W, cw), xhi: hi(W, cw), ylo: lo(H, ch), yhi: hi(H, ch) };
  };
  /** Past an edge the map follows less and less (like iOS), then settles back when you let go. */
  const rubber = (v: number, lo: number, hi: number, dim: number) => {
    'worklet';
    const band = (o: number) => (o * dim * 0.55) / (dim + 0.55 * o);
    return v > hi ? hi + band(v - hi) : v < lo ? lo - band(lo - v) : v;
  };
  const softScale = (sc: number) => {
    'worklet';
    if (sc > MAX_ZOOM) return MAX_ZOOM * Math.pow(sc / MAX_ZOOM, 0.3);
    if (sc < minS) return minS * Math.pow(sc / minS, 0.3);
    return sc;
  };
  const stopMotion = () => {
    'worklet';
    cancelAnimation(scale);
    cancelAnimation(tx);
    cancelAnimation(ty);
  };
  /** Follow a gesture: edges stretch rather than stop dead. */
  const follow = (sc: number, x: number, y: number) => {
    'worklet';
    const b = bounds(sc);
    scale.set(sc);
    tx.set(rubber(x, b.xlo, b.xhi, W));
    ty.set(rubber(y, b.ylo, b.yhi, H));
  };
  /** Glide to a view, kept inside the edges. */
  const settleTo = (sc: number, x: number, y: number, duration = 380) => {
    'worklet';
    const s2 = clamp(sc, minS, MAX_ZOOM);
    const b = bounds(s2);
    const cfg = { duration, easing: EASE_OUT };
    scale.set(withTiming(s2, cfg));
    tx.set(withTiming(clamp(x, b.xlo, b.xhi), cfg));
    ty.set(withTiming(clamp(y, b.ylo, b.yhi), cfg));
  };
  /** Zoom to `sc`, keeping the window point (fx, fy) where it is. */
  const zoomAbout = (sc: number, fx: number, fy: number, duration?: number) => {
    'worklet';
    const s2 = clamp(sc, minS, MAX_ZOOM);
    const r = s2 / scale.get();
    settleTo(s2, fx - (fx - tx.get()) * r, fy - (fy - ty.get()) * r, duration);
  };

  const panBegin = () => {
    'worklet';
    stopMotion();
    grab.set({ s: scale.get(), x: tx.get(), y: ty.get(), ax: 0, ay: 0, fresh: false });
  };
  const panMove = (dx: number, dy: number) => {
    'worklet';
    // Two fingers down: the pinch is in charge. Take hold again wherever it leaves the map.
    if (pinching.get()) {
      grab.set({ ...grab.get(), fresh: true });
      return;
    }
    let g = grab.get();
    if (g.fresh) {
      g = { s: scale.get(), x: tx.get(), y: ty.get(), ax: dx, ay: dy, fresh: false };
      grab.set(g);
    }
    follow(g.s, g.x + dx - g.ax, g.y + dy - g.ay);
  };
  const panEnd = (vx: number, vy: number) => {
    'worklet';
    if (pinching.get()) return;
    const b = bounds(scale.get());
    // A flick carries on at the finger's speed and slows to a stop; past an edge it settles back.
    const glide = (v: SharedValue<number>, speed: number, lo: number, hi: number) => {
      const now = v.get();
      if (hi > lo && now >= lo && now <= hi) v.set(withDecay({ velocity: speed, clamp: [lo, hi], rubberBandEffect: true, rubberBandFactor: 0.6 }));
      else v.set(withTiming(clamp(now, lo, hi), { duration: 380, easing: EASE_OUT }));
    };
    glide(tx, vx, b.xlo, b.xhi);
    glide(ty, vy, b.ylo, b.yhi);
  };

  /** Where the map sits with nothing filtered, or zoomed onto a zone. Content pixels, like the transform. */
  const placement = (zoneId: string | null) => {
    const zone = zoneId ? festival.zones.find((z) => z.id === zoneId) : undefined;
    if (!zone || !W) return { s: 1, x: (W - cw) / 2, y: (H - ch) / 2 };
    const xs = zone.polygon.map((p) => (p.x - vb.x) * ppm);
    const ys = zone.polygon.map((p) => (p.y - vb.y) * ppm);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // The zone fills a bit under half the window, so you still see what's around it.
    const sc = clamp(Math.min(W / ((x1 - x0) * 2.4), H / ((y1 - y0) * 2.4)), minS, 4);
    return { s: sc, x: W / 2 - ((x0 + x1) / 2) * sc, y: H / 2 - ((y0 + y1) / 2) * sc };
  };

  // Dots and labels are sized for the zoom, so React hears about zoom changes (now and then).
  const [shownFilter, setShownFilter] = useState(filterZoneId);
  if (filterZoneId !== shownFilter) {
    setShownFilter(filterZoneId);
    setZoom(placement(filterZoneId).s);
  }

  // Start centred on the park; glide to a zone when one is picked.
  const placed = useRef(false);
  useEffect(() => {
    if (!W || staticMap) return;
    const to = placement(filterZoneId);
    if (placed.current) {
      settleTo(to.s, to.x, to.y, 560);
      return;
    }
    placed.current = true;
    const b = bounds(to.s);
    scale.set(to.s);
    tx.set(clamp(to.x, b.xlo, b.xhi));
    ty.set(clamp(to.y, b.ylo, b.yhi));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, cw, ch, staticMap, filterZoneId]);

  // In a browser: pinch on a trackpad (or ctrl/⌘ + scroll) zooms the map, not the page.
  useEffect(() => {
    const el = surface.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || staticMap || !el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const zoomBy = (k: number, clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      const css = r.width / (el.offsetWidth || r.width) || 1;
      const fx = (clientX - r.left) / css;
      const fy = (clientY - r.top) / css;
      stopMotion();
      const s0 = scale.get();
      const s1 = clamp(s0 * k, minS, MAX_ZOOM);
      const b = bounds(s1);
      scale.set(s1);
      tx.set(clamp(fx - (fx - tx.get()) * (s1 / s0), b.xlo, b.xhi));
      ty.set(clamp(fy - (fy - ty.get()) * (s1 / s0), b.ylo, b.yhi));
      clearTimeout(timer);
      timer = setTimeout(() => setZoom(scale.get()), 140);
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain scrolling still scrolls the page
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.01)), e.clientX, e.clientY);
    };
    // Safari reports trackpad pinches as gesture events instead.
    let last = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      last = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      zoomBy(g.scale / last, g.clientX, g.clientY);
      last = g.scale;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, cw, ch, staticMap]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  /** Window point → site metres. */
  const toSite = (x: number, y: number): Vec => {
    const sc = scale.get();
    return { x: vb.x + (x - tx.get()) / sc / ppm, y: vb.y + (y - ty.get()) / sc / ppm };
  };
  const hitRadiusM = (px: number) => px / (scale.get() * ppm);

  const visible = Object.values(volunteers).filter((v) => v.status === 'checked_in' && positions[v.id]);

  const nearestDot = (p: Vec, radiusM: number) => {
    let best: string | null = null;
    let bestD = radiusM;
    for (const v of visible) {
      const d = dist(positions[v.id], p);
      if (d < bestD) {
        bestD = d;
        best = v.id;
      }
    }
    return best;
  };

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'merged');
  const nearestIncident = (p: Vec, radiusM: number) => activeIncidents.find((i) => dist(i.location, p) < radiusM)?.id ?? null;
  const selectedZone = festival.zones.find((z) => z.id === selectedZoneId);
  const filterZone = festival.zones.find((z) => z.id === filterZoneId);
  /** With a zone filter on, anything outside the zone fades back. */
  const inFilter = (p: Vec) => !filterZone || pointInPolygon(p, filterZone.polygon);

  // Plain viewing: one finger pans, entirely on the UI thread.
  const viewPan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => panBegin())
    .onUpdate((e) => panMove(e.translationX, e.translationY))
    .onEnd((e) => panEnd(e.velocityX, e.velocityY));

  // Editing (dragging people or zones) needs the store, so it runs in React.
  const editPan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(4)
    .onStart((e) => {
      const p = toSite(e.x - e.translationX, e.y - e.translationY);
      if (mode === 'operator') {
        const id = nearestDot(p, hitRadiusM(24));
        if (id) {
          drag.set({ kind: 'dot', id });
          return;
        }
      }
      if (mode === 'zones' && selectedZone) {
        const idx = selectedZone.polygon.findIndex((v) => dist(v, p) < hitRadiusM(26));
        if (idx >= 0) {
          drag.set({ kind: 'vertex', zoneId: selectedZone.id, index: idx });
          return;
        }
        if (pointInPolygon(p, selectedZone.polygon)) {
          drag.set({ kind: 'zone', zoneId: selectedZone.id, start: p, polygon: selectedZone.polygon });
          return;
        }
      }
      drag.set({ kind: 'map' });
      panBegin();
    })
    .onUpdate((e) => {
      const d = drag.get();
      if (!d) return;
      if (d.kind === 'map') {
        panMove(e.translationX, e.translationY);
        return;
      }
      const p = toSite(e.x, e.y);
      const snapped = { x: Math.round(p.x), y: Math.round(p.y) };
      if (d.kind === 'dot') moveDot(d.id, snapped);
      if (d.kind === 'vertex') {
        const zone = useStore.getState().festival.zones.find((z) => z.id === d.zoneId);
        if (zone) updateZone(zone.id, { polygon: zone.polygon.map((v, i) => (i === d.index ? snapped : v)) });
      }
      if (d.kind === 'zone') {
        const dx = Math.round(p.x - d.start.x);
        const dy = Math.round(p.y - d.start.y);
        updateZone(d.zoneId, { polygon: d.polygon.map((v) => ({ x: v.x + dx, y: v.y + dy })) });
      }
    })
    .onEnd((e) => {
      const d = drag.get();
      if (d?.kind === 'dot') onDotDropped?.(d.id);
      if (d?.kind === 'map') panEnd(e.velocityX, e.velocityY);
      drag.set(null);
    });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      stopMotion();
      pinching.set(true);
      const sc = scale.get();
      pinchFrom.set({ s: sc, x: tx.get(), y: ty.get(), fx: e.focalX, fy: e.focalY, lx: e.focalX, ly: e.focalY, sent: sc });
    })
    .onUpdate((e) => {
      const p = pinchFrom.get();
      const sc = softScale(p.s * e.scale);
      const r = sc / p.s;
      // The spot that was under your fingers stays under them, so a pinch can also move the map.
      follow(sc, e.focalX - (p.fx - p.x) * r, e.focalY - (p.fy - p.y) * r);
      const resize = Math.abs(sc - p.sent) / p.sent > 0.18;
      pinchFrom.set({ ...p, lx: e.focalX, ly: e.focalY, sent: resize ? sc : p.sent });
      if (resize) scheduleOnRN(setZoom, sc);
    })
    .onEnd(() => {
      pinching.set(false);
      const p = pinchFrom.get();
      const sc = clamp(scale.get(), minS, MAX_ZOOM);
      zoomAbout(sc, p.lx, p.ly);
      scheduleOnRN(setZoom, sc);
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      const p = toSite(e.x, e.y);
      const inc = onIncidentPress && nearestIncident(p, hitRadiusM(26));
      if (inc) return onIncidentPress(inc);
      const id = onDotPress && nearestDot(p, hitRadiusM(20));
      if (id) return onDotPress(id);
      if (onSelectZone) {
        const z = [...festival.zones].reverse().find((zz) => pointInPolygon(p, zz.polygon));
        onSelectZone(z?.id ?? null);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd((e) => {
      const sc = clamp(scale.get() > 1.6 ? 1 : 2.4, minS, MAX_ZOOM);
      zoomAbout(sc, e.x, e.y, 420);
      scheduleOnRN(setZoom, sc);
    });

  // Taps don't wait to see if a second tap is coming: tapping a dot or incident opens it at once,
  // and a double-tap still zooms (its first tap just selects whatever is under it, like Apple Maps).
  const gesture = Gesture.Simultaneous(mode === 'view' ? viewPan : editPan, pinch, doubleTap, tap);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  // Sizes in pixels, converted to metres, easing off a little as you zoom in.
  const k = 1 / Math.sqrt(zoom);
  const dotR = (4.2 / ppm) * k;
  const fontSize = (15 / ppm) * k;

  const pathDispatches = dispatches.filter((d) => pathDispatchIds?.includes(d.id) && d.status !== 'declined');
  const highlight = new Set(highlightIds ?? []);
  const walking = new Set(Object.entries(movements).filter(([, mv]) => mv.dispatchId).map(([id]) => id));

  // Content-space pixel position of a site point.
  const px = (p: Vec) => ({ left: (p.x - vb.x) * ppm, top: (p.y - vb.y) * ppm });

  const svg = (
    <Svg width={cw} height={ch} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
      <Scenery dark={dark} ppm={ppm} showLabels={showLabels && !focus} />
      {festival.zones.map((z) => (
        <ZoneShape key={z.id} zone={z} selected={z.id === (selectedZoneId ?? filterZoneId)} faded={!!filterZone && z.id !== filterZone.id} dark={dark} />
      ))}
      {festival.obstacles.map((o, i) => (
        <G key={i}>
          <Polygon points={pts(o)} fill={m.deck} />
          <Polygon points={pts(inset(o, 3))} fill={m.deckTop} />
        </G>
      ))}
      {visible.map((v) => {
        if (walking.has(v.id)) return null; // drawn as a gliding overlay instead
        const p = positions[v.id];
        const isMe = v.id === currentUserId;
        const isLead = v.role !== 'volunteer';
        const lit = highlight.has(v.id);
        return (
          <Circle
            key={v.id}
            cx={p.x}
            cy={p.y}
            r={isLead || lit || isMe ? dotR * 1.45 : dotR}
            fill={lit || isMe ? t.accent : isLead ? (dark ? '#E5E7EB' : '#1E293B') : m.dot}
            fillOpacity={(lit || isMe || isLead ? 1 : 0.82) * (inFilter(p) ? 1 : 0.18)}
            strokeOpacity={inFilter(p) ? 1 : 0.18}
            stroke={m.dotStroke}
            strokeWidth={((isLead || isMe || lit ? 2 : 1) / ppm) * k}
          />
        );
      })}
      {showLabels && staticMap && festival.zones.map((z) => <ZoneLabel key={z.id} zone={z} fontSize={fontSize} dark={dark} />)}
      {activeIncidents.map((i) => {
        const c = urgencyColor(i.urgency, t) === t.textSecondary ? t.accent : urgencyColor(i.urgency, t);
        const r = dotR * 2.3;
        return (
          <G key={i.id} opacity={inFilter(i.location) ? 1 : 0.25}>
            <Circle cx={i.location.x} cy={i.location.y} r={r} fill={c} stroke={m.dotStroke} strokeWidth={(2 / ppm) * k} />
            <SvgText
              x={i.location.x}
              y={i.location.y + r * 0.42}
              fontSize={r * 1.25}
              fontWeight="900"
              textAnchor="middle"
              fill="#FFFFFF"
              fontFamily={LABEL_FONT}>
              !
            </SvgText>
          </G>
        );
      })}
      {mode === 'zones' &&
        selectedZone &&
        selectedZone.polygon.map((v, i) => (
          <Rect key={i} x={v.x - 4 * k} y={v.y - 4 * k} width={8 * k} height={8 * k} fill="#fff" stroke={t.accent} strokeWidth={2 * k} />
        ))}
    </Svg>
  );

  const me = currentUserId && visible.some((v) => v.id === currentUserId) ? positions[currentUserId] : undefined;

  const overlays = (
    <>
      {pathDispatches.length > 0 && <MarchingPaths paths={pathDispatches.map((d) => d.path)} vb={vb} w={cw} h={ch} color={t.accent} width={(3.5 / ppm) * k} />}
      {activeIncidents.map((i) => {
        const pending = i.status === 'suggested' || i.status === 'no_suggestion' || i.status === 'logged';
        const focused = focusIncidentIds?.includes(i.id);
        if (!pending && !focused) return null;
        const c = urgencyColor(i.urgency, t) === t.textSecondary ? t.accent : urgencyColor(i.urgency, t);
        const p = px(i.location);
        const size = Math.max(54, dotR * ppm * 14);
        return (
          <View key={i.id} pointerEvents="none" style={[styles.anchor, p, !inFilter(i.location) && styles.faded]}>
            <Pulse size={size} color={c} />
            <Pulse size={size} color={c} delay={900} />
          </View>
        );
      })}
      {[...walking].map((id) => {
        const p = positions[id];
        if (!p || volunteers[id]?.status !== 'checked_in' || !inFilter(p)) return null;
        return <Walker key={id} x={px(p).left} y={px(p).top} size={Math.max(14, dotR * ppm * 3.2)} color={t.accent} ring={m.dotStroke} />;
      })}
      {me && !walking.has(currentUserId!) && (
        <View pointerEvents="none" style={[styles.anchor, px(me)]}>
          <Pulse size={40} color={t.accent} duration={2200} />
        </View>
      )}
    </>
  );

  const content = (
    <View style={{ width: cw, height: ch }}>
      {svg}
      {overlays}
    </View>
  );

  return (
    <Animated.View entering={FadeIn.duration(450)} onLayout={onLayout} style={[styles.container, { height: H || 200, borderColor: t.border, backgroundColor: m.outside }]}>
      {W > 0 &&
        (staticMap ? (
          <View style={{ position: 'absolute', left: ox, top: oy }}>{content}</View>
        ) : (
          <GestureDetector gesture={gesture}>
            <View ref={surface} style={StyleSheet.absoluteFill}>
              <Animated.View style={[styles.inner, animatedStyle]}>{content}</Animated.View>
              {showLabels &&
                festival.zones.map((z) => (
                  <ZoneTag key={z.id} zone={z} vb={vb} ppm={ppm} scale={scale} tx={tx} ty={ty} dark={dark} faded={!!filterZone && z.id !== filterZone.id} />
                ))}
            </View>
          </GestureDetector>
        ))}
    </Animated.View>
  );
}

/* ------------------------------- moving bits ------------------------------ */

/** A ring that grows and fades, forever. Two offset ones read as a heartbeat. */
function Pulse({ size, color, delay = 0, duration = 1800 }: { size: number; color: string; delay?: number; duration?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.cubic) }), -1, false)));
  }, [p, delay, duration]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - p.get()),
    transform: [{ scale: 0.25 + p.get() * 1.1 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, backgroundColor: `${color}33` },
        style,
      ]}
    />
  );
}

/** A responder walking to the scene: glides between position updates, with a pulse. */
function Walker({ x, y, size, color, ring }: { x: number; y: number; size: number; color: string; ring: string }) {
  const sx = useSharedValue(x);
  const sy = useSharedValue(y);
  useEffect(() => {
    sx.set(withTiming(x, { duration: 130, easing: Easing.linear }));
    sy.set(withTiming(y, { duration: 130, easing: Easing.linear }));
  }, [x, y, sx, sy]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: sx.get() }, { translateY: sy.get() }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.anchor, { left: 0, top: 0 }, style]}>
      <Pulse size={size * 3} color={color} duration={1400} />
      <View
        style={{
          position: 'absolute',
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 2.5,
          borderColor: ring,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      />
    </Animated.View>
  );
}

/** Route lines with dashes that march toward the incident. */
function MarchingPaths({ paths, vb, w, h, color, width }: { paths: Vec[][]; vb: { x: number; y: number; w: number; h: number }; w: number; h: number; color: string; width: number }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      setOffset((o) => (o - (now - last) * 0.02) % 1000);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={w} height={h} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
      {paths.map((p, i) => (
        <G key={i}>
          <Polyline points={pts(p)} fill="none" stroke={color} strokeOpacity={0.22} strokeWidth={width * 2.6} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline
            points={pts(p)}
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeDasharray={`${width * 2.2} ${width * 1.6}`}
            strokeDashoffset={offset * width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      ))}
    </Svg>
  );
}

/* --------------------------------- zones --------------------------------- */

function ZoneShape({ zone, selected, faded, dark }: { zone: Zone; selected: boolean; faded: boolean; dark: boolean }) {
  const [fill, stroke] = ZONE_TINT[zone.kind][dark ? 'dark' : 'light'];
  return (
    <Polygon
      points={pts(zone.polygon)}
      fill={fill}
      fillOpacity={faded ? 0.4 : 0.92}
      stroke={stroke}
      strokeWidth={selected ? 3 : 1.4}
      strokeOpacity={selected ? 1 : faded ? 0.35 : 0.8}
    />
  );
}

/**
 * A zone's name over the interactive map. It rides along with the pan and zoom
 * but stays the same size, so it's sharp at any zoom and never jumps.
 */
function ZoneTag({
  zone,
  vb,
  ppm,
  scale,
  tx,
  ty,
  dark,
  faded,
}: {
  zone: Zone;
  vb: { x: number; y: number };
  ppm: number;
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  dark: boolean;
  faded: boolean;
}) {
  const m = dark ? MAP.dark : MAP.light;
  const [, stroke] = ZONE_TINT[zone.kind][dark ? 'dark' : 'light'];
  const left = (centroid(zone.polygon).x - vb.x) * ppm;
  const top = (Math.min(...zone.polygon.map((p) => p.y)) - vb.y) * ppm;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() + left * scale.get() }, { translateY: ty.get() + top * scale.get() + 3 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.tagAnchor, { opacity: faded ? 0.35 : 1 }, style]}>
      <Text numberOfLines={1} style={[styles.tag, { color: dark ? m.label : stroke, textShadowColor: m.halo }]}>
        {mapName(zone)}
      </Text>
    </Animated.View>
  );
}

/** Zone name inside the top of the zone, with a halo so it reads over anything. */
function ZoneLabel({ zone, fontSize, dark }: { zone: Zone; fontSize: number; dark: boolean }) {
  const m = dark ? MAP.dark : MAP.light;
  const [, stroke] = ZONE_TINT[zone.kind][dark ? 'dark' : 'light'];
  const ctr = centroid(zone.polygon);
  const top = Math.min(...zone.polygon.map((p) => p.y));
  const y = top + fontSize * 1.1;
  const common = { x: ctr.x, y, fontSize, fontWeight: '700' as const, textAnchor: 'middle' as const, fontFamily: LABEL_FONT };
  return (
    <G>
      <SvgText {...common} stroke={m.halo} strokeWidth={fontSize / 3.2} strokeLinejoin="round" fill={m.halo}>
        {mapName(zone)}
      </SvgText>
      <SvgText {...common} fill={dark ? m.label : stroke}>
        {mapName(zone)}
      </SvgText>
    </G>
  );
}

/** Shrink a rectangle-ish polygon toward its centre (roof highlight on stage decks). */
function inset(poly: Vec[], by: number): Vec[] {
  const c = centroid(poly);
  return poly.map((p) => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: p.x - (dx / d) * by, y: p.y - (dy / d) * by };
  });
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  inner: { transformOrigin: 'left top' },
  anchor: { position: 'absolute', width: 0, height: 0 },
  faded: { opacity: 0.25 },
  // A 140-wide box centred on the anchor point (a zero-width parent would squash the text on web).
  tagAnchor: { position: 'absolute', left: -70, top: 0, width: 140, alignItems: 'center' },
  tag: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: LABEL_FONT,
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 0 },
  },
});
