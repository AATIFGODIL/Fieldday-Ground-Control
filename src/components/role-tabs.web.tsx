import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import type { TabSpec } from './role-tabs';

/** Web fallback for the native tab bar (used when previewing in a browser). */
export function RoleTabs({ tabs, base }: { tabs: TabSpec[]; base: string }) {
  const t = useTheme();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <View style={StyleSheet.flatten([styles.bar, { backgroundColor: t.backgroundElement, borderTopColor: t.border }])}>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={(tab.name === 'index' ? base : `${base}/${tab.name}`) as never} asChild>
              <TabButton tab={tab} />
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ tab, isFocused, ...props }: TabTriggerSlotProps & { tab: TabSpec }) {
  const t = useTheme();
  const color = isFocused ? t.tint : t.textSecondary;
  return (
    <Pressable {...props} style={styles.item}>
      <SymbolView name={{ ios: tab.sf, android: tab.md, web: tab.md }} size={22} tintColor={color} />
      <Text style={{ color, fontSize: 11, fontWeight: isFocused ? '800' : '500' }}>{tab.label}</Text>
      {tab.badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{tab.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 8, paddingTop: 6 },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  badge: { position: 'absolute', top: -2, right: '30%', backgroundColor: '#E5484D', borderRadius: 8, minWidth: 16, paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', textAlign: 'center' },
});
