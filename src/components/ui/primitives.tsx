import * as Haptics from 'expo-haptics';
import type { ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { rise, smoothLayout } from '@/constants/motion';
import { BottomTabInset, MaxContentWidth, Radius, Spacing, Type, urgencyStyle } from '@/constants/theme';
import type { Urgency } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { useTour } from '@/state/tour';

const MIN_FONT = 17;

/** Clears the floating bell and Demo buttons (10 from the top, 40 tall) with a little room. */
export const TAB_SCREEN_TOP = 58;

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  contentStyle,
  tabs = false,
  scrollRef,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Leave room for the floating tab bar. */
  tabs?: boolean;
  /** For screens that need to scroll themselves (e.g. back to the top). */
  scrollRef?: Ref<ScrollView>;
}) {
  const t = useTheme();
  // Leave room to scroll everything clear of the pinned guide card.
  const guide = useTour((s) => (s.scenario ? s.cardHeight + 16 : 0));
  const bottom = (tabs ? BottomTabInset : 48) + guide;
  // Tab screens have the alerts bell and Demo button floating top right, so the title starts below them.
  const top = tabs ? TAB_SCREEN_TOP : Spacing.three;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.background }}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.screenContent, { paddingTop: top, paddingBottom: bottom }, contentStyle]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type TxtVariant = 'hero' | 'title' | 'heading' | 'body' | 'strong' | 'label' | 'caption' | 'mono';

export function Txt({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
  selectable,
  center,
}: {
  children: ReactNode;
  variant?: TxtVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
  center?: boolean;
}) {
  const t = useTheme();
  const v = variant === 'mono' ? 'caption' : variant;
  const base = v === 'caption' || v === 'label' ? t.textSecondary : t.text;
  // Safety net: nothing renders smaller than the minimum, whatever a screen asks for.
  const flat = StyleSheet.flatten(style) ?? {};
  const clamp = flat.fontSize !== undefined && flat.fontSize < MIN_FONT ? { fontSize: MIN_FONT, lineHeight: undefined } : null;
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[Type[v], { color: color ?? base }, center && { textAlign: 'center' }, flat, clamp]}>
      {children}
    </Text>
  );
}

/** Scales down the instant a finger lands — feedback on press, not release. */
export function Tappable({
  children,
  onPress,
  style,
  disabled,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [style, { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
  tone = 'plain',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** strong = needs you; ai = written by AI; alert = something's wrong; inverted = solid. */
  tone?: 'plain' | 'strong' | 'inverted' | 'ai' | 'alert';
}) {
  const t = useTheme();
  const toneStyle =
    tone === 'strong'
      ? { backgroundColor: t.background, borderColor: t.accent, borderWidth: 2 }
      : tone === 'inverted'
        ? { backgroundColor: t.text, borderColor: t.text }
        : tone === 'ai'
          ? { backgroundColor: t.aiSoft, borderColor: t.ai, borderWidth: 1.5 }
          : tone === 'alert'
            ? { backgroundColor: t.criticalSoft, borderColor: t.critical, borderWidth: 1.5 }
            : { backgroundColor: t.backgroundElement, borderColor: t.backgroundElement };
  const inner = <View style={[styles.card, toneStyle, style]}>{children}</View>;
  if (!onPress) return inner;
  return <Tappable onPress={onPress}>{inner}</Tappable>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  size = 'md',
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const t = useTheme();
  const bg = {
    primary: t.accent,
    danger: t.critical,
    secondary: t.backgroundSelected,
    outline: 'transparent',
    ghost: 'transparent',
  }[variant];
  const fg = { primary: t.accentText, danger: '#FFFFFF', secondary: t.text, outline: t.accent, ghost: t.accent }[variant];
  const height = { sm: 48, md: 56, lg: 64 }[size];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPressIn={() => {
        void Haptics.selectionAsync().catch(() => {});
      }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          minHeight: height,
          opacity: disabled ? 0.35 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        variant === 'outline' && { borderWidth: 2, borderColor: t.accent },
        variant === 'ghost' && { paddingHorizontal: Spacing.two },
        style,
      ]}
      {...rest}>
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[Type.strong, { color: fg, fontSize: size === 'lg' ? 20 : 19 }, variant === 'ghost' && { textDecorationLine: 'underline' }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Pill({
  label,
  solid,
  outline,
  tone,
  style,
}: {
  label: string;
  color?: string;
  solid?: boolean;
  outline?: boolean;
  tone?: 'accent' | 'ai' | 'success';
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const toneColor = tone === 'accent' ? t.accent : tone === 'ai' ? t.ai : tone === 'success' ? t.success : null;
  const bg = toneColor ?? (solid ? t.text : outline ? 'transparent' : t.backgroundSelected);
  const fg = toneColor ? '#FFFFFF' : solid ? t.background : t.text;
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: solid || outline ? t.text : bg }, style]}>
      <Text style={[Type.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const URGENCY_WORD: Record<Urgency, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

export function UrgencyPill({ urgency, style }: { urgency: Urgency; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const u = urgencyStyle(urgency, t);
  return (
    <View style={[styles.pill, { backgroundColor: u.bg, borderColor: u.border }, style]}>
      <Text style={[Type.label, { color: u.fg, fontWeight: '800' }]}>{URGENCY_WORD[urgency]}</Text>
    </View>
  );
}

export function Row({ children, style, gap = Spacing.two }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.three }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="heading">{title}</Txt>
        {right}
      </Row>
      {children}
    </View>
  );
}

/** A callout. danger/warn get a heavy rule; info/ok stay quiet. */
export function Banner({
  tone,
  title,
  body,
  children,
}: {
  tone: 'warn' | 'danger' | 'info' | 'ok';
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  const t = useTheme();
  const toneStyle =
    tone === 'danger'
      ? { backgroundColor: t.criticalSoft, borderColor: t.critical, borderWidth: 1.5 }
      : tone === 'warn'
        ? { backgroundColor: t.background, borderColor: t.high, borderWidth: 2 }
        : tone === 'ok'
          ? { backgroundColor: t.accentSoft, borderColor: t.accentSoft }
          : { backgroundColor: t.backgroundElement, borderColor: t.backgroundElement };
  return (
    <Animated.View entering={rise()} style={[styles.banner, toneStyle]}>
      <Txt variant="strong">{title}</Txt>
      {body ? <Txt variant="caption">{body}</Txt> : null}
      {children}
    </Animated.View>
  );
}

/**
 * Slides content up into place when it first appears. `index` staggers a list
 * so cards arrive one after another instead of all at once.
 */
export function Appear({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      entering={rise(Math.min(index, 8) * 70)}
      layout={smoothLayout}
      style={style}>
      {children}
    </Animated.View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border }} />;
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: Spacing.five, paddingHorizontal: Spacing.three, gap: Spacing.two }}>
      <Txt variant="heading" center>{title}</Txt>
      {body ? <Txt variant="caption" center>{body}</Txt> : null}
      {children}
    </View>
  );
}

/** Page header: a big title with an optional line under it. */
export function Header({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  const t = useTheme();
  return (
    <Animated.View entering={rise(0, 6)} style={{ gap: Spacing.one, marginBottom: Spacing.one }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: Spacing.one }}>
          {eyebrow ? (
            <Txt variant="label" color={t.accent}>
              {eyebrow}
            </Txt>
          ) : null}
          <Txt variant="title">{title}</Txt>
        </View>
        {right}
      </Row>
      {subtitle ? <Txt variant="caption">{subtitle}</Txt> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    padding: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
  button: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  banner: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.four, gap: Spacing.two },
});
