import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
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
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing, UrgencyColors } from '@/constants/theme';
import type { Urgency } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentStyle]}
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

export function Txt({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
  selectable,
}: {
  children: ReactNode;
  variant?: 'title' | 'heading' | 'body' | 'label' | 'caption' | 'mono';
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const t = useTheme();
  const base = variant === 'caption' || variant === 'label' ? t.textSecondary : t.text;
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[textStyles[variant], { color: color ?? base }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const inner = (
    <View style={[styles.card, { backgroundColor: t.backgroundElement, borderColor: t.border }, style]}>{children}</View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {inner}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

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
    primary: t.tint,
    secondary: t.backgroundSelected,
    danger: UrgencyColors.critical,
    ghost: 'transparent',
  }[variant];
  const fg = { primary: t.tintText, secondary: t.text, danger: '#fff', ghost: t.tint }[variant];
  const pad = { sm: 8, md: 12, lg: 16 }[size];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(e) => {
        void Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, paddingVertical: pad, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { paddingHorizontal: 4 },
        style,
      ]}
      {...rest}>
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[styles.buttonText, { color: fg, fontSize: size === 'sm' ? 14 : size === 'lg' ? 18 : 16 }]}>{title}</Text>
    </Pressable>
  );
}

export function Pill({ label, color, solid, style }: { label: string; color?: string; solid?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const c = color ?? t.textSecondary;
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: solid ? c : `${c}22`, borderColor: solid ? c : `${c}55` },
        style,
      ]}>
      <Text style={[styles.pillText, { color: solid ? '#fff' : c }]}>{label}</Text>
    </View>
  );
}

export function UrgencyPill({ urgency }: { urgency: Urgency }) {
  return <Pill label={urgency.toUpperCase()} color={UrgencyColors[urgency]} solid />;
}

export function Row({ children, style, gap = Spacing.two }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="label">{title.toUpperCase()}</Txt>
        {right}
      </Row>
      {children}
    </View>
  );
}

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
  const color = { warn: UrgencyColors.medium, danger: UrgencyColors.critical, info: '#0090FF', ok: UrgencyColors.low }[tone];
  const t = useTheme();
  return (
    <View style={[styles.banner, { borderColor: color, backgroundColor: `${color}18` }]}>
      <Txt variant="heading" style={{ fontSize: 15 }} color={t.text}>
        {title}
      </Txt>
      {body ? <Txt variant="body" style={{ fontSize: 14 }}>{body}</Txt> : null}
      {children}
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border }} />;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: Spacing.four, gap: Spacing.one }}>
      <Txt variant="heading">{title}</Txt>
      {body ? <Txt variant="caption" style={{ textAlign: 'center' }}>{body}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 120 },
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  button: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  buttonText: { fontWeight: '700' },
  pill: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  banner: { borderRadius: Radius.md, borderWidth: 1.5, padding: Spacing.three, gap: Spacing.one },
});

const textStyles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  mono: { fontSize: 13, fontFamily: Fonts.mono },
});
