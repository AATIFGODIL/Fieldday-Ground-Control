/**
 * Colours and spacing for Fieldday Ground Control, in light and dark mode.
 */

import '@/global.css';

import { Platform } from 'react-native';

import type { Role, Skill, Urgency, ZoneKind } from '@/domain/types';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#F4F5F2',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6E8E3',
    textSecondary: '#5F6660',
    border: '#DADDD7',
    tint: '#1F7A4D',
    tintText: '#FFFFFF',
    mapGround: '#E3EEDA',
    mapBoundary: '#3E7A52',
    mapPath: '#2563EB',
  },
  dark: {
    text: '#EEF1EC',
    background: '#0E110F',
    backgroundElement: '#191D1A',
    backgroundSelected: '#262B27',
    textSecondary: '#A3ABA4',
    border: '#2E3530',
    tint: '#3DBB78',
    tintText: '#06140C',
    mapGround: '#16231A',
    mapBoundary: '#4E9C68',
    mapPath: '#60A5FA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const UrgencyColors: Record<Urgency, string> = {
  critical: '#E5484D',
  high: '#F76B15',
  medium: '#E2A100',
  low: '#30A46C',
};

export const SkillColors: Record<Skill | 'none', string> = {
  first_aid: '#E5484D',
  security_licence: '#8E4EC6',
  crowd_control: '#0090FF',
  rsa: '#E2A100',
  wwcc: '#12A594',
  none: '#8B8D98',
};

export const RoleColors: Record<Role, string> = {
  volunteer: '#0090FF',
  location_lead: '#8E4EC6',
  safety_lead: '#E5484D',
};

export const ZoneColors: Record<ZoneKind, string> = {
  stage: '#8E4EC6',
  water: '#0090FF',
  bar: '#E2A100',
  food: '#F76B15',
  washroom: '#8B8D98',
  games: '#12A594',
  kids: '#D6409F',
  medical: '#E5484D',
  gate: '#3E7A52',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
