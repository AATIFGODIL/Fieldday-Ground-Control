import { NativeTabs } from 'expo-router/unstable-native-tabs';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';

export interface TabSpec {
  name: string;
  label: string;
  sf: SFSymbol;
  md: AndroidSymbol;
  badge?: string;
}

/** Native tab bar shared by the three role areas. `base` is used by the web fallback. */
export function RoleTabs({ tabs }: { tabs: TabSpec[]; base: string }) {
  const t = useTheme();
  return (
    <NativeTabs
      backgroundColor={t.backgroundElement}
      indicatorColor={t.backgroundSelected}
      iconColor={{ selected: t.tint }}
      labelStyle={{ selected: { color: t.tint } }}>
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
          {tab.badge ? <NativeTabs.Trigger.Badge>{tab.badge}</NativeTabs.Trigger.Badge> : null}
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
