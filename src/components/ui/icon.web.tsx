import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { Glyph, type GlyphName } from './glyph';

const FROM_MATERIAL: Record<string, GlyphName> = {
  mic: 'mic',
  stop: 'stop',
  volume_up: 'volume',
  campaign: 'radio',
  home: 'home',
  map: 'map',
  shield: 'shield',
  groups: 'users',
  group_add: 'users',
  schedule: 'clock',
  event_busy: 'clock',
  warning: 'alert',
  select_all: 'map',
};

/** Web: SF/Material symbols aren't available, so draw the matching line icon. */
export function Icon({ android, size = 20, color }: { ios: SFSymbol; android: AndroidSymbol; size?: number; color?: ColorValue }) {
  return <Glyph name={FROM_MATERIAL[android as string] ?? 'alert'} size={size} color={typeof color === 'string' ? color : '#000'} />;
}
