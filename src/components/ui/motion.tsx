/**
 * Small looping animations that make the app feel alive without getting in
 * the way. All respect reduced-motion by settling to a still state.
 */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EASE_IN_OUT } from '@/constants/motion';

import { Glyph } from './glyph';
import { Txt } from './primitives';

/** Rings that radiate out from whatever sits in the middle (radar / "live"). */
export function PulseRings({ size, color, count = 2, duration = 2000 }: { size: number; color: string; count?: number; duration?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {Array.from({ length: count }, (_, i) => (
        <Ring key={i} size={size} color={color} delay={(duration / count) * i} duration={duration} />
      ))}
    </View>
  );
}

function Ring({ size, color, delay, duration }: { size: number; color: string; delay: number; duration: number }) {
  const p = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    p.set(withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.cubic) }), -1, false)));
  }, [p, delay, duration, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.get()), transform: [{ scale: 0.6 + p.get() * 0.9 }] }));
  return (
    <Animated.View
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, backgroundColor: `${color}22` }, style]}
    />
  );
}

/** Gentle in-and-out scale, for the one thing on screen you should tap. */
export function Breathe({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.set(
      withRepeat(
        withSequence(withTiming(1.02, { duration: 2200, easing: EASE_IN_OUT }), withTiming(1, { duration: 2200, easing: EASE_IN_OUT })),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      ),
    );
  }, [s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Voice bars: bounce while `active`, rest flat when not. */
export function SoundBars({ active, color, height = 28, bars = 5 }: { active: boolean; color: string; height?: number; bars?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height }}>
      {Array.from({ length: bars }, (_, i) => (
        <Bar key={i} index={i} active={active} color={color} height={height} />
      ))}
    </View>
  );
}

function Bar({ index, active, color, height }: { index: number; active: boolean; color: string; height: number }) {
  const h = useSharedValue(0.25);
  useEffect(() => {
    if (!active) {
      h.set(withTiming(0.25, { duration: 200 }));
      return;
    }
    const peak = 0.55 + ((index * 37) % 45) / 100;
    h.set(
      withDelay(
        index * 90,
        withRepeat(withSequence(withTiming(peak, { duration: 340 + index * 30, easing: EASE_IN_OUT }), withTiming(0.2, { duration: 320 + index * 20, easing: EASE_IN_OUT })), -1, false, undefined, ReduceMotion.System),
      ),
    );
  }, [active, h, index]);
  const style = useAnimatedStyle(() => ({ height: Math.max(4, h.get() * height) }));
  return <Animated.View style={[{ width: 5, borderRadius: 3, backgroundColor: color }, style]} />;
}

/** "AI is working" — a sparkle that turns and a line that shimmers. */
export function AIWorking({ label, color }: { label: string; color: string }) {
  const r = useSharedValue(0);
  const o = useSharedValue(0.4);
  useEffect(() => {
    r.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false, undefined, ReduceMotion.System));
    o.set(withRepeat(withSequence(withTiming(1, { duration: 900, easing: EASE_IN_OUT }), withTiming(0.45, { duration: 900, easing: EASE_IN_OUT })), -1, false, undefined, ReduceMotion.System));
  }, [r, o]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.get() * 360}deg` }] }));
  const glow = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Animated.View style={spin}>
        <Glyph name="sparkle" size={26} color={color} />
      </Animated.View>
      <Animated.View style={[{ flex: 1 }, glow]}>
        <Txt variant="strong" color={color}>
          {label}
        </Txt>
      </Animated.View>
    </View>
  );
}
