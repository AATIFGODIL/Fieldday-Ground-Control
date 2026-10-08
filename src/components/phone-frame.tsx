import type { ReactNode } from 'react';

/** On a phone the app is the screen. (The web version frames it on desktop.) */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return children;
}
