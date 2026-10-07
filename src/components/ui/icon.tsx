import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

/** Cross-platform icon: SF Symbols on iOS, Material Symbols on Android. */
export function Icon({ ios, android, size = 20, color }: { ios: SFSymbol; android: AndroidSymbol; size?: number; color?: ColorValue }) {
  return <SymbolView name={{ ios, android, web: android }} size={size} tintColor={color} />;
}
