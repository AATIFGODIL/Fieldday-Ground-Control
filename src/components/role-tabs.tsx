import { NativeTabs } from 'expo-router/unstable-native-tabs';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';

import type { GlyphName } from './ui/glyph';

export interface TabSpec {
  name: string;
  label: string;
  sf: SFSymbol;
  md: AndroidSymbol;
  /** Line icon used by the floating dock on web and Android. */
  glyph: GlyphName;
  badge?: string;
}

/**
 * iPhone: Apple's own tab bar. On iOS 26 that's Liquid Glass, with
 * press-and-drag between tabs, and it shrinks out of the way on scroll.
 */
export function RoleTabs({ tabs }: { tabs: TabSpec[]; base: string }) {
  const t = useTheme();
  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      iconColor={{ default: t.textSecondary, selected: t.accent }}
      labelStyle={{ default: { color: t.textSecondary }, selected: { color: t.accent } }}
      badgeBackgroundColor={t.critical}>
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
