import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** The palette for the current light/dark setting. Light unless the device says dark. */
export function useTheme() {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
