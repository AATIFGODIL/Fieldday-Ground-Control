import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { mapName, zoneColor } from '@/components/map/site-map';
import { Glyph } from '@/components/ui/glyph';
import { Txt } from '@/components/ui/primitives';
import { settle } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { pointInPolygon } from '@/domain/geo';
import type { Zone } from '@/domain/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/state/store';

const glass = Platform.OS === 'web' ? ({ backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' } as object) : null;

/**
 * The map's zone filter, pinned to its top-right corner: pick a zone to zoom
 * onto it and fade everything else back. "All zones" goes back to the park.
 */
export function ZoneFilter({ value, onChange, maxHeight }: { value: string | null; onChange: (id: string | null) => void; maxHeight: number }) {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const zones = useStore((s) => s.festival.zones);
  const volunteers = useStore((s) => s.volunteers);
  const [open, setOpen] = useState(false);
  // Head counts only matter while the list is open, so don't re-render for every step people take otherwise.
  const positions = useStore((s) => (open ? s.positions : null));
  const zone = zones.find((z) => z.id === value);
  // Without a blur behind it (native), the surface needs to be nearly solid to read over the map.
  const surface = Platform.OS === 'web' ? t.glass : dark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)';

  const here = (z: Zone) =>
    positions ? Object.values(volunteers).filter((v) => v.status === 'checked_in' && positions[v.id] && pointInPolygon(positions[v.id], z.polygon)).length : 0;

  const pick = (id: string | null) => {
    setOpen(false);
    onChange(id);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {open && <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close zone filter" />}
      <View style={styles.corner} pointerEvents="box-none">
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={zone ? `Showing ${zone.name}. Change zone` : 'Filter by zone'}
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [
            styles.button,
            glass,
            { backgroundColor: zone ? t.accent : surface, borderColor: zone ? t.accent : t.glassEdge, transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}>
          <Glyph name="filter" size={15} color={zone ? '#FFFFFF' : t.text} strokeWidth={2.4} />
          <Txt variant="label" color={zone ? '#FFFFFF' : t.text} numberOfLines={1} style={styles.buttonText}>
            {zone ? mapName(zone) : 'Zones'}
          </Txt>
        </Pressable>

        {open && (
          <Animated.View entering={settle(0, 260)} style={[styles.menu, glass, { maxHeight, backgroundColor: surface, borderColor: t.glassEdge }]}>
            <ScrollView contentContainerStyle={{ padding: 6 }} showsVerticalScrollIndicator={false}>
              <Item label="All zones" on={!value} onPress={() => pick(null)} />
              {zones.map((z) => (
                <Item key={z.id} label={z.name} swatch={zoneColor(z.kind, dark)} count={here(z)} on={value === z.id} onPress={() => pick(z.id)} />
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function Item({ label, swatch, count, on, onPress }: { label: string; swatch?: string; count?: number; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.item, { backgroundColor: pressed ? t.backgroundSelected : on ? t.accentSoft : 'transparent' }]}>
      {swatch ? <View style={[styles.swatch, { backgroundColor: swatch }]} /> : <Glyph name="map" size={14} color={t.textSecondary} />}
      <Txt variant="label" numberOfLines={1} style={styles.itemText} color={on ? t.accent : t.text}>
        {label}
      </Txt>
      {count !== undefined && <Txt variant="caption">{count}</Txt>}
      <View style={{ width: 18, alignItems: 'center' }}>{on && <Glyph name="check" size={16} color={t.accent} strokeWidth={3} />}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', top: Spacing.three, right: Spacing.three, alignItems: 'flex-end', gap: Spacing.two },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonText: { maxWidth: 150, fontWeight: '700' },
  menu: {
    width: 250,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    transformOrigin: 'top right',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42, paddingHorizontal: 10, borderRadius: 12 },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  itemText: { flex: 1 },
});
