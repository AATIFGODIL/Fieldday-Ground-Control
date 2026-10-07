/**
 * The festival site plan: zones, volunteer dots, incidents and dispatch routes.
 *
 * Positions come straight from the store, which is fed by either the
 * simulation or live GPS — the map does not know or care which.
 */
import { useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { Colors, RoleColors, SkillColors, UrgencyColors, ZoneColors } from '@/constants/theme';
import { centroid, dist, pointInPolygon } from '@/domain/geo';
import type { Skill, Vec, Volunteer, Zone } from '@/domain/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { moveDot, updateZone, useStore } from '@/state/store';

/** Visible area in site metres, with margin outside the boundary for off-site dots. */
const VB = { x: -30, y: -70, w: 660, h: 500 };

const LABEL_FONT = Platform.select({ web: 'system-ui, -apple-system, Roboto, sans-serif', default: undefined });

const SKILL_PRIORITY: Skill[] = ['first_aid', 'security_licence', 'crowd_control', 'wwcc', 'rsa'];

export function dotColor(v: Volunteer): string {
  if (v.role !== 'volunteer') return RoleColors[v.role];
  const s = SKILL_PRIORITY.find((k) => v.skills.includes(k));
  return SkillColors[s ?? 'none'];
}

export type MapMode = 'view' | 'operator' | 'zones';

type DragState =
  | { kind: 'map' }
  | { kind: 'dot'; id: string }
  | { kind: 'vertex'; zoneId: string; index: number }
  | { kind: 'zone'; zoneId: string; start: Vec; polygon: Vec[] };

export interface SiteMapProps {
  mode?: MapMode;
  /** Fixed height; width fills the container. */
  height?: number;
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
}

export function SiteMap({
  mode = 'view',
  height,
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
}: SiteMapProps) {
  const scheme = useColorScheme();
  const t = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const festival = useStore((s) => s.festival);
  const positions = useStore((s) => s.positions);
  const volunteers = useStore((s) => s.volunteers);
  const incidents = useStore((s) => s.incidents);
  const dispatches = useStore((s) => s.dispatches);
  const currentUserId = useStore((s) => s.currentUserId);

  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);

  const vb = focus
    ? {
        x: focus.center.x - focus.radius * 1.3,
        y: focus.center.y - focus.radius,
        w: focus.radius * 2.6,
        h: focus.radius * 2,
      }
    : VB;
  const mapHeight = height ?? (width * vb.h) / vb.w;
  const pxPerM = width / vb.w;

  // Pan/zoom transform (origin top-left): screen = t + s * local.
  // Gesture state lives in shared values (read with get/set) so it is safe
  // under React Compiler and visible to the UI thread for the transform.
  const view = useSharedValue({ s: 1, tx: 0, ty: 0 });
  const gestureStart = useSharedValue({ s: 1, tx: 0, ty: 0 });
  const drag = useSharedValue<DragState | null>(null);

  const animatedStyle = useAnimatedStyle(() => {
    const v = view.get();
    return { transform: [{ translateX: v.tx }, { translateY: v.ty }, { scale: v.s }] };
  });

  const apply = (next: { s: number; tx: number; ty: number }) => {
    const sc = Math.min(6, Math.max(1, next.s));
    const minTx = width - width * sc;
    const minTy = mapHeight - mapHeight * sc;
    view.set({
      s: sc,
      tx: Math.min(0, Math.max(minTx, next.tx)),
      ty: Math.min(0, Math.max(minTy, next.ty)),
    });
  };

  /** Screen (container) point → site metres. */
  const toSite = (x: number, y: number): Vec => {
    const { s: sc, tx: ox, ty: oy } = view.get();
    return { x: vb.x + (x - ox) / sc / pxPerM, y: vb.y + (y - oy) / sc / pxPerM };
  };
  const hitRadiusM = (px: number) => px / (view.get().s * pxPerM);

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

  const nearestIncident = (p: Vec, radiusM: number) =>
    activeIncidents.find((i) => dist(i.location, p) < radiusM)?.id ?? null;

  const selectedZone = festival.zones.find((z) => z.id === selectedZoneId);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(4)
    .onStart((e) => {
      gestureStart.set(view.get());
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
    })
    .onUpdate((e) => {
      const d = drag.get();
      if (!d) return;
      if (d.kind === 'map') {
        const g = gestureStart.get();
        apply({ s: g.s, tx: g.tx + e.translationX, ty: g.ty + e.translationY });
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
    .onEnd(() => {
      const d = drag.get();
      if (d?.kind === 'dot') onDotDropped?.(d.id);
      drag.set(null);
    });

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      gestureStart.set(view.get());
    })
    .onUpdate((e) => {
      const g = gestureStart.get();
      const ns = Math.min(6, Math.max(1, g.s * e.scale));
      const k = ns / g.s;
      apply({ s: ns, tx: e.focalX - (e.focalX - g.tx) * k, ty: e.focalY - (e.focalY - g.ty) * k });
    })
    .onEnd(() => setZoom(view.get().s));

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      const p = toSite(e.x, e.y);
      const inc = onIncidentPress && nearestIncident(p, hitRadiusM(22));
      if (inc) return onIncidentPress(inc);
      const id = onDotPress && nearestDot(p, hitRadiusM(20));
      if (id) return onDotPress(id);
      if (onSelectZone) {
        const z = [...festival.zones].reverse().find((zz) => pointInPolygon(p, zz.polygon));
        onSelectZone(z?.id ?? null);
      }
    });

  const doubleTap = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .onEnd((e) => {
      const v = view.get();
      const target = v.s > 1.5 ? 1 : 2.5;
      const k = target / v.s;
      apply({ s: target, tx: e.x - (e.x - v.tx) * k, ty: e.y - (e.y - v.ty) * k });
      setZoom(target);
    });

  const gesture = Gesture.Simultaneous(pan, pinch, Gesture.Exclusive(doubleTap, tap));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Sizes in metres that stay roughly constant on screen as you zoom.
  const k = 1 / Math.sqrt(zoom);
  const dotR = (focus ? focus.radius / 40 : 4.2) * k;
  const fontSize = (focus ? focus.radius / 8 : 11) * k;

  const pathDispatches = dispatches.filter((d) => pathDispatchIds?.includes(d.id) && d.status !== 'declined');
  const highlight = new Set(highlightIds ?? []);

  const svg = (
    <Svg width={width} height={mapHeight} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
      <Rect x={vb.x - 200} y={vb.y - 200} width={vb.w + 400} height={vb.h + 400} fill={scheme === 'dark' ? '#0B0F0C' : '#D4D9CF'} />
      <Polygon points={pts(festival.boundary)} fill={t.mapGround} stroke={t.mapBoundary} strokeWidth={2} strokeDasharray="8 5" />
      {festival.walkways.edges.map(([a, b]) => {
        const A = festival.walkways.nodes[a];
        const B = festival.walkways.nodes[b];
        return <Line key={`${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={t.textSecondary} strokeOpacity={0.12} strokeWidth={6} strokeLinecap="round" />;
      })}
      {festival.zones.map((z) => (
        <ZoneShape key={z.id} zone={z} selected={z.id === selectedZoneId} />
      ))}
      {festival.obstacles.map((o, i) => (
        <Polygon key={i} points={pts(o)} fill={scheme === 'dark' ? '#3a3f3b' : '#4A5049'} />
      ))}
      {pathDispatches.map((d) => (
        <Polyline key={d.id} points={pts(d.path)} fill="none" stroke={t.mapPath} strokeWidth={2.5 * k} strokeDasharray={`${6 * k} ${4 * k}`} strokeLinecap="round" />
      ))}
      {visible.map((v) => {
        const p = positions[v.id];
        const isMe = v.id === currentUserId;
        const isLead = v.role !== 'volunteer';
        const lit = highlight.has(v.id);
        return (
          <G key={v.id}>
            {(isMe || lit) && <Circle cx={p.x} cy={p.y} r={dotR * 2.4} fill={isMe ? t.tint : t.mapPath} fillOpacity={0.25} />}
            <Circle
              cx={p.x}
              cy={p.y}
              r={isLead ? dotR * 1.35 : dotR}
              fill={dotColor(v)}
              stroke={isLead || isMe ? '#fff' : scheme === 'dark' ? '#0B0F0C' : '#fff'}
              strokeWidth={(isLead || isMe ? 1.6 : 0.8) * k}
            />
          </G>
        );
      })}
      {showLabels &&
        festival.zones.map((z) => <ZoneLabel key={z.id} zone={z} fontSize={fontSize} color={t.text} halo={t.mapGround} />)}
      {activeIncidents.map((i) => {
        const c = UrgencyColors[i.urgency];
        const r = dotR * 2.2;
        const focused = focusIncidentIds?.includes(i.id);
        const pending = i.status === 'suggested' || i.status === 'no_suggestion' || i.status === 'logged';
        return (
          <G key={i.id}>
            {(pending || focused) && <Circle cx={i.location.x} cy={i.location.y} r={r * 2.2} fill={c} fillOpacity={0.18} stroke={c} strokeOpacity={0.6} strokeWidth={1 * k} />}
            <Polygon
              points={pts([
                { x: i.location.x, y: i.location.y - r },
                { x: i.location.x + r, y: i.location.y },
                { x: i.location.x, y: i.location.y + r },
                { x: i.location.x - r, y: i.location.y },
              ])}
              fill={c}
              stroke="#fff"
              strokeWidth={1.4 * k}
            />
            {showLabels && (
              <SvgText x={i.location.x + r * 1.3} y={i.location.y - r * 0.8} fontSize={fontSize} fontWeight="800" fill={c} fontFamily={LABEL_FONT}>
                {i.ref}
              </SvgText>
            )}
          </G>
        );
      })}
      {mode === 'zones' && selectedZone &&
        selectedZone.polygon.map((v, i) => (
          <Rect key={i} x={v.x - 4 * k} y={v.y - 4 * k} width={8 * k} height={8 * k} fill="#fff" stroke={t.tint} strokeWidth={2 * k} />
        ))}
    </Svg>
  );

  return (
    <View onLayout={onLayout} style={[styles.container, { height: mapHeight || 200, borderColor: t.border }]}>
      {width > 0 &&
        (interactive && !focus ? (
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.inner, animatedStyle]}>{svg}</Animated.View>
          </GestureDetector>
        ) : (
          svg
        ))}
    </View>
  );
}

function ZoneShape({ zone, selected }: { zone: Zone; selected: boolean }) {
  const c = ZoneColors[zone.kind];
  return (
    <Polygon
      points={pts(zone.polygon)}
      fill={c}
      fillOpacity={selected ? 0.35 : 0.16}
      stroke={c}
      strokeOpacity={selected ? 1 : 0.55}
      strokeWidth={selected ? 2.5 : 1.2}
    />
  );
}

/** Zone name along the top edge, drawn above the dots with a halo for legibility. */
function ZoneLabel({ zone, fontSize, color, halo }: { zone: Zone; fontSize: number; color: string; halo: string }) {
  const ctr = centroid(zone.polygon);
  const top = Math.min(...zone.polygon.map((p) => p.y));
  const y = top + fontSize * 1.05;
  const common = { x: ctr.x, y, fontSize, fontWeight: '700' as const, textAnchor: 'middle' as const, fontFamily: LABEL_FONT };
  return (
    <G>
      <SvgText {...common} stroke={halo} strokeWidth={fontSize / 3} strokeLinejoin="round" fill={halo}>
        {zone.name}
      </SvgText>
      <SvgText {...common} fill={ZoneColors[zone.kind]}>
        {zone.name}
      </SvgText>
    </G>
  );
}

function pts(poly: Vec[]): string {
  return poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  inner: { transformOrigin: 'left top' },
});
