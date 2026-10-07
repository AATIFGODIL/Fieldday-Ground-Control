import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

/** Set by the desktop phone frame to the frame's size. */
export const ScreenSizeContext = createContext<{ width: number; height: number } | null>(null);

/** The app's screen: the phone frame on desktop web, otherwise the window. */
export function useScreenSize() {
  const win = useWindowDimensions();
  return useContext(ScreenSizeContext) ?? win;
}
