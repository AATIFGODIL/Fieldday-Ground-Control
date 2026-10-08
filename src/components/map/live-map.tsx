import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

import { Glyph } from '@/components/ui/glyph';
import { Txt } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/state/store';

const CLOSE = { latitudeDelta: 0.004, longitudeDelta: 0.004 };

/**
 * Live GPS mode: a real map (Apple Maps on iPhone) showing where you actually
 * are. Your location only shows while you're checked in, same as everywhere else.
 */
export function LiveMap({ height }: { height: number }) {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const anchor = useStore((s) => s.festival.geoAnchor);
  const onShift = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId]?.status === 'checked_in' : false));
  const map = useRef<MapView>(null);
  const last = useRef<{ latitude: number; longitude: number } | null>(null);

  const recentre = () => {
    if (last.current) map.current?.animateToRegion({ ...last.current, ...CLOSE }, 500);
  };

  return (
    <View style={[styles.box, { height, borderColor: t.border }]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: anchor.lat, longitude: anchor.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        showsUserLocation={onShift}
        showsCompass
        showsScale
        userInterfaceStyle={dark ? 'dark' : 'light'}
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (!c) return;
          const first = !last.current;
          last.current = { latitude: c.latitude, longitude: c.longitude };
          // Fly to you on the first fix; after that the map stays where you put it.
          if (first) map.current?.animateToRegion({ ...last.current, ...CLOSE }, 700);
        }}
      />
      {onShift ? (
        <Pressable
          onPress={recentre}
          accessibilityLabel="Show where I am"
          style={({ pressed }) => [styles.locate, { backgroundColor: t.background, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <Glyph name="navigation" size={20} color={t.accent} />
        </Pressable>
      ) : (
        <View style={[styles.note, { backgroundColor: t.background }]}>
          <Txt variant="label" color={t.text}>
            Check in to see yourself here. Your location is only used while you’re on shift.
          </Txt>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  locate: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  note: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: Spacing.three, borderRadius: 16, padding: Spacing.three },
});
