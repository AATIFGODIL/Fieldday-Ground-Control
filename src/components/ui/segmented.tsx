import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Txt } from './primitives';

export function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: t.backgroundSelected }]}>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable key={v} onPress={() => onChange(v)} style={[styles.segItem, on && { backgroundColor: t.accent }]}>
            <Txt variant="label" style={{ fontWeight: on ? '700' : '500' }} color={on ? '#FFFFFF' : t.textSecondary}>
              {label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: Radius.pill, padding: 4 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: Radius.pill },
});
