/**
 * Ground Control design tokens.
 *
 * Black and white first, with a little royal colour: royal blue for actions,
 * violet for anything the AI wrote, red/amber for urgency. Change `accent`
 * in both schemes and every highlight follows.
 */

import '@/global.css';

import { Platform } from 'react-native';

import type { Role, Skill, Urgency, ZoneKind } from '@/domain/types';

export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#5C5C61',
    background: '#FFFFFF',
    backgroundElement: '#F2F2F4',
    backgroundSelected: '#E4E4E8',
    border: '#D9D9DE',
    /** Royal blue: the one colour for "do this". */
    accent: '#2340D9',
    accentText: '#FFFFFF',
    accentSoft: 'rgba(35,64,217,0.10)',
    /** Violet marks anything the AI produced. */
    ai: '#6D28D9',
    aiSoft: 'rgba(109,40,217,0.08)',
    critical: '#E11D48',
    criticalSoft: 'rgba(225,29,72,0.10)',
    high: '#D97706',
    success: '#059669',
    /** Kept for older screens. */
    tint: '#2340D9',
    tintText: '#FFFFFF',
    glass: 'rgba(255,255,255,0.72)',
    glassEdge: 'rgba(255,255,255,0.9)',
    glider: 'rgba(35,64,217,0.14)',
    scrim: 'rgba(0,0,0,0.35)',
    mapGround: '#FFFFFF',
    mapBoundary: '#000000',
    mapZone: '#F2F2F4',
    mapZoneStroke: '#B8B8BE',
    mapPath: '#000000',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#A1A1A8',
    background: '#000000',
    backgroundElement: '#161618',
    backgroundSelected: '#26262A',
    border: '#2E2E33',
    accent: '#5B78FF',
    accentText: '#FFFFFF',
    accentSoft: 'rgba(91,120,255,0.16)',
    ai: '#A78BFA',
    aiSoft: 'rgba(167,139,250,0.12)',
    critical: '#FF4D6A',
    criticalSoft: 'rgba(255,77,106,0.16)',
    high: '#FBBF24',
    success: '#34D399',
    tint: '#5B78FF',
    tintText: '#FFFFFF',
    glass: 'rgba(28,28,30,0.72)',
    glassEdge: 'rgba(255,255,255,0.14)',
    glider: 'rgba(91,120,255,0.24)',
    scrim: 'rgba(0,0,0,0.6)',
    mapGround: '#0B0B0C',
    mapBoundary: '#FFFFFF',
    mapZone: '#1C1C1F',
    mapZoneStroke: '#4A4A50',
    mapPath: '#FFFFFF',
  },
} as const;

export type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Urgency: colour plus weight, and the word is always shown too.
 * critical = solid red, high = solid amber, medium/low = quiet grey.
 */
export function urgencyStyle(u: Urgency, t: Palette) {
  switch (u) {
    case 'critical':
      return { bg: t.critical, fg: '#FFFFFF', border: t.critical };
    case 'high':
      return { bg: t.high, fg: '#1A1200', border: t.high };
    case 'medium':
      return { bg: t.backgroundSelected, fg: t.text, border: t.backgroundSelected };
    default:
      return { bg: t.backgroundElement, fg: t.textSecondary, border: t.border };
  }
}

/** Colour that stands for an urgency (map markers, card edges). */
export function urgencyColor(u: Urgency, t: Palette) {
  return u === 'critical' ? t.critical : u === 'high' ? t.high : t.textSecondary;
}

/* Legacy static palettes for older screens. */
const GREY = '#8E8E93';
export const UrgencyColors: Record<Urgency, string> = { critical: '#E11D48', high: '#D97706', medium: GREY, low: GREY };
export const SkillColors: Record<Skill | 'none', string> = {
  first_aid: GREY,
  security_licence: GREY,
  crowd_control: GREY,
  rsa: GREY,
  wwcc: GREY,
  none: GREY,
};
export const RoleColors: Record<Role, string> = { volunteer: GREY, location_lead: GREY, safety_lead: GREY };
export const ZoneColors: Record<ZoneKind, string> = {
  stage: GREY,
  water: GREY,
  bar: GREY,
  food: GREY,
  washroom: GREY,
  games: GREY,
  kids: GREY,
  medical: GREY,
  gate: GREY,
};

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', serif: 'var(--font-serif)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
});

/**
 * Type scale. Nothing in the app goes below 17 — people read this on foot,
 * in the sun, mid-incident.
 */
export const Type = {
  hero: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -0.8 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.6 },
  heading: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontSize: 19, lineHeight: 27, fontWeight: '400', letterSpacing: 0 },
  strong: { fontSize: 19, lineHeight: 27, fontWeight: '700', letterSpacing: 0 },
  label: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: 0.1 },
  caption: { fontSize: 17, lineHeight: 24, fontWeight: '500', letterSpacing: 0.1 },
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

/** Space to leave at the bottom of scrolling screens for the floating tab bar. */
export const BottomTabInset = Platform.select({ ios: 110, android: 120, default: 128 }) ?? 120;
export const MaxContentWidth = 640;
