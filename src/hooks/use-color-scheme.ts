import { useEffect } from 'react';
import { Appearance, Platform, useColorScheme as useSystemScheme } from 'react-native';

import { useStore } from '@/state/store';

/**
 * Light or dark for this screen: the phone's own setting, unless the demo
 * menu forces one.
 */
export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemScheme();
  const appearance = useStore((s) => s.appearance);
  if (appearance !== 'system') return appearance;
  return system === 'dark' ? 'dark' : 'light';
}

/**
 * Mount once at the root. Tells the native side too, so Apple's tab bar,
 * the keyboard and system sheets switch along with the app.
 */
export function useApplyAppearance() {
  const appearance = useStore((s) => s.appearance);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(appearance === 'system' ? 'unspecified' : appearance);
  }, [appearance]);
}
