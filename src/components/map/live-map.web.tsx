import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '@/components/ui/glyph';
import { Txt } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/state/store';

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const ME = L.divIcon({
  className: '',
  iconSize: [22, 22],
  html: '<div style="width:22px;height:22px;box-sizing:border-box;border-radius:50%;background:#0A84FF;border:3.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35)"></div>',
});

/**
 * Live GPS mode in a browser: a real street map showing where you actually
 * are. Your location only shows while you're checked in, same as everywhere else.
 */
export function LiveMap({ height }: { height: number }) {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const anchor = useStore((s) => s.festival.geoAnchor);
  const onShift = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId]?.status === 'checked_in' : false));
  const box = useRef<View>(null);
  const map = useRef<L.Map | null>(null);
  const me = useRef<{ dot: L.Marker; ring: L.Circle } | null>(null);
  const [here, setHere] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // The map itself (rebuilt when the theme flips, for the matching tiles).
  useEffect(() => {
    const el = box.current as unknown as HTMLElement | null;
    if (!el) return;
    const m = L.map(el, { zoomControl: false, attributionControl: true }).setView([anchor.lat, anchor.lng], 15);
    L.tileLayer(TILES[dark ? 'dark' : 'light'], { attribution: ATTRIBUTION, subdomains: 'abcd', maxZoom: 20 }).addTo(m);
    map.current = m;
    const fit = new ResizeObserver(() => m.invalidateSize());
    fit.observe(el);
    return () => {
      fit.disconnect();
      m.remove();
      map.current = null;
      me.current = null;
    };
  }, [dark, anchor.lat, anchor.lng]);

  // Where you are, straight from the browser, only while you're on shift.
  useEffect(() => {
    if (!onShift || !('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setProblem(null);
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
      },
      (e) => setProblem(e.code === e.PERMISSION_DENIED ? 'Location is blocked for this site. Allow it in your browser to see where you are.' : 'Couldn’t find your location yet.'),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [onShift]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!here || !onShift) {
      me.current?.dot.remove();
      me.current?.ring.remove();
      me.current = null;
      return;
    }
    const at: L.LatLngExpression = [here.lat, here.lng];
    if (me.current) {
      me.current.dot.setLatLng(at);
      me.current.ring.setLatLng(at).setRadius(here.accuracy);
      return;
    }
    // First fix: drop the dot and fly to it. After that the map stays where you put it.
    me.current = {
      ring: L.circle(at, { radius: here.accuracy, color: '#0A84FF', weight: 0, fillOpacity: 0.14, interactive: false }).addTo(m),
      dot: L.marker(at, { icon: ME, interactive: false, keyboard: false }).addTo(m),
    };
    m.flyTo(at, 17, { duration: 0.8 });
  }, [here, onShift, dark]);

  const message = !onShift ? 'Check in to see yourself here. Your location is only used while you’re on shift.' : problem;

  return (
    <View style={[styles.box, { height, borderColor: t.border }]}>
      {/* Its own stacking context, so Leaflet's layers stay under our buttons. */}
      <View ref={box} style={[StyleSheet.absoluteFill, { zIndex: 0 }]} />
      {onShift && here && (
        <Pressable
          onPress={() => map.current?.flyTo([here.lat, here.lng], 17, { duration: 0.6 })}
          accessibilityLabel="Show where I am"
          style={({ pressed }) => [styles.locate, { backgroundColor: t.background, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <Glyph name="navigation" size={20} color={t.accent} />
        </Pressable>
      )}
      {message && (
        <View style={[styles.note, { backgroundColor: t.background }]}>
          <Txt variant="label" color={t.text}>
            {message}
          </Txt>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, zIndex: 0 },
  locate: {
    position: 'absolute',
    right: Spacing.three,
    bottom: 34,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  note: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: 34, borderRadius: 16, padding: Spacing.three, zIndex: 1 },
});
