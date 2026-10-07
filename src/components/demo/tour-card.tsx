import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Glyph } from '@/components/ui/glyph';
import { EASE_IN_OUT, rise, smoothLayout } from '@/constants/motion';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { endTour, nextBeat, setTourMinimised, TOURS, useTour } from '@/state/tour';

/**
 * The guided-demo card, pinned to the bottom of the screen above the tab bar.
 * Solid, so nothing shows through, and it reports its height so pages can
 * scroll their content clear of it.
 */
export function TourCard() {
  const t = useTheme();
  const { scenario, index, busy, minimised } = useTour();
  if (!scenario) return null;
  const story = TOURS[scenario];
  const beat = story.beats[index];

  if (minimised) {
    return (
      <Pressable
        onLayout={(e) => useTour.setState({ cardHeight: e.nativeEvent.layout.height })}
        onPress={() => setTourMinimised(false)}
        accessibilityLabel="Show the guide"
        style={({ pressed }) => [styles.mini, styles.shadow, { backgroundColor: t.accent, borderColor: t.accent, opacity: pressed ? 0.9 : 1 }]}>
        <Text style={[Type.label, { color: '#FFFFFF', flex: 1 }]} numberOfLines={1}>
          Guide · {index + 1} of {story.beats.length} · {beat.title}
        </Text>
        <Text style={[Type.label, { color: '#FFFFFF' }]}>Show</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View
      key={`${scenario}-${index}`}
      entering={rise(0, 12)}
      layout={smoothLayout}
      onLayout={(e) => useTour.setState({ cardHeight: e.nativeEvent.layout.height })}
      style={[styles.card, styles.shadow, { backgroundColor: t.backgroundElement, borderColor: t.accent }]}>
      <View style={styles.top}>
        <Text style={[Type.label, { color: t.accent, flex: 1 }]}>
          {story.title} · {index + 1} of {story.beats.length}
        </Text>
        <Pressable hitSlop={12} onPress={() => setTourMinimised(true)} accessibilityLabel="Hide the guide">
          <Text style={[Type.label, { color: t.textSecondary }]}>Hide</Text>
        </Pressable>
        <Pressable hitSlop={12} onPress={endTour} accessibilityLabel="End the guide">
          <Glyph name="x" size={22} color={t.textSecondary} />
        </Pressable>
      </View>
      <Text style={[Type.heading, { color: t.text }]}>{beat.title}</Text>
      <Text style={[Type.body, { color: t.textSecondary }]}>{beat.body}</Text>
      <View style={styles.progress}>
        {story.beats.map((_, i) => (
          <View key={i} style={[styles.tick, { backgroundColor: i <= index ? t.accent : t.backgroundSelected }]} />
        ))}
      </View>
      {busy ? (
        <View style={styles.hint}>
          <ActivityIndicator color={t.accent} />
          <Text style={[Type.label, { color: t.text }]}>Working on it…</Text>
        </View>
      ) : beat.next ? (
        <Pressable
          onPress={nextBeat}
          style={({ pressed }) => [styles.next, { backgroundColor: t.accent, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={[Type.strong, { color: t.accentText }]}>{beat.next}</Text>
        </Pressable>
      ) : (
        <View style={styles.hint}>
          <Blink color={t.accent} />
          <Text style={[Type.label, { color: t.accent, flex: 1 }]}>{beat.hint}</Text>
          <Glyph name="chevron" size={20} color={t.accent} />
        </View>
      )}
    </Animated.View>
  );
}

/** A dot that softly fades: "waiting for you to do this". */
function Blink({ color }: { color: string }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.set(
      withRepeat(
        withSequence(withTiming(0.3, { duration: 900, easing: EASE_IN_OUT }), withTiming(1, { duration: 900, easing: EASE_IN_OUT })),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      ),
    );
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 1.5, padding: Spacing.four, gap: Spacing.two },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  progress: { flexDirection: 'row', gap: 4, marginVertical: Spacing.one },
  tick: { flex: 1, height: 4, borderRadius: 2 },
  next: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.one },
  hint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.one, minHeight: 32 },
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.four,
    height: 48,
  },
});
