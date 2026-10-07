/**
 * Line icons drawn with react-native-svg, so they look identical on iOS,
 * Android and web. 24×24 grid, 2px round strokes.
 */
import type { ReactNode } from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

export type GlyphName =
  | 'home'
  | 'map'
  | 'shield'
  | 'alert'
  | 'mic'
  | 'stop'
  | 'users'
  | 'clock'
  | 'volume'
  | 'x'
  | 'check'
  | 'chevron'
  | 'back'
  | 'play'
  | 'radio'
  | 'navigation'
  | 'bell'
  | 'sparkle'
  | 'link'
  | 'person'
  | 'camera'
  | 'keyboard'
  | 'phone'
  | 'cross'
  | 'pin'
  | 'edit'
  | 'music'
  | 'glass'
  | 'sun'
  | 'cloud';

const PATHS: Record<GlyphName, (c: string) => ReactNode> = {
  home: () => (
    <>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  map: () => (
    <>
      <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <Line x1="8" y1="2" x2="8" y2="18" />
      <Line x1="16" y1="6" x2="16" y2="22" />
    </>
  ),
  shield: () => <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  alert: () => (
    <>
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  mic: () => (
    <>
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Line x1="12" y1="19" x2="12" y2="23" />
      <Line x1="8" y1="23" x2="16" y2="23" />
    </>
  ),
  stop: (c) => <Rect x="6" y="6" width="12" height="12" rx="2" fill={c} />,
  users: () => (
    <>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  clock: () => (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </>
  ),
  volume: () => (
    <>
      <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <Path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </>
  ),
  x: () => (
    <>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  check: () => <Polyline points="20 6 9 17 4 12" />,
  chevron: () => <Polyline points="9 18 15 12 9 6" />,
  back: () => <Polyline points="15 18 9 12 15 6" />,
  play: (c) => <Polygon points="6 3 20 12 6 21 6 3" fill={c} />,
  radio: () => (
    <>
      <Circle cx="12" cy="12" r="2" />
      <Path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </>
  ),
  navigation: (c) => <Polygon points="3 11 22 2 13 21 11 13 3 11" fill={c} />,
  bell: () => (
    <>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  sparkle: (c) => <Path d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2z" fill={c} />,
  link: () => (
    <>
      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  person: () => (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  camera: () => (
    <>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </>
  ),
  phone: () => (
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  cross: (c) => <Path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" fill={c} strokeWidth={0} />,
  pin: () => (
    <>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" />
    </>
  ),
  music: () => (
    <>
      <Path d="M9 18V5l12-2v13" />
      <Circle cx="6" cy="18" r="3" />
      <Circle cx="18" cy="16" r="3" />
    </>
  ),
  glass: () => (
    <>
      <Path d="M6 2h12l-1.5 7a4.5 4.5 0 0 1-9 0z" />
      <Line x1="12" y1="13.5" x2="12" y2="21" />
      <Line x1="8" y1="21" x2="16" y2="21" />
    </>
  ),
  sun: () => (
    <>
      <Circle cx="12" cy="12" r="5" />
      <Line x1="12" y1="1" x2="12" y2="3" />
      <Line x1="12" y1="21" x2="12" y2="23" />
      <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <Line x1="1" y1="12" x2="3" y2="12" />
      <Line x1="21" y1="12" x2="23" y2="12" />
      <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </>
  ),
  cloud: () => (
    <>
      <Line x1="16" y1="13" x2="16" y2="21" />
      <Line x1="8" y1="13" x2="8" y2="21" />
      <Line x1="12" y1="15" x2="12" y2="23" />
      <Path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
    </>
  ),
  edit: () => (
    <>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),
  keyboard: () => (
    <>
      <Rect x="2" y="5" width="20" height="14" rx="2" />
      <Line x1="6" y1="9" x2="6.01" y2="9" />
      <Line x1="10" y1="9" x2="10.01" y2="9" />
      <Line x1="14" y1="9" x2="14.01" y2="9" />
      <Line x1="18" y1="9" x2="18.01" y2="9" />
      <Line x1="7" y1="15" x2="17" y2="15" />
    </>
  ),
};

export function Glyph({ name, size = 24, color = '#000', strokeWidth = 2 }: { name: GlyphName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name](color)}
    </Svg>
  );
}
