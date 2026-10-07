import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glyph, type GlyphName } from '@/components/ui/glyph';
import { PulseRings, SoundBars } from '@/components/ui/motion';
import { Button, Txt } from '@/components/ui/primitives';
import { glide, settle } from '@/constants/motion';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FESTIVAL_ID } from '@/sim/seed/festival';
import { finishOnboarding, joinFestival } from '@/state/store';
import { startTour } from '@/state/tour';

const SLIDES: { glyph: GlyphName; title: string; body: string }[] = [
  {
    glyph: 'radio',
    title: 'Radio calls get lost.',
    body: 'At a festival, problems come in over noisy radio and disappear once they’re said. Ground Control keeps every one.',
  },
  {
    glyph: 'mic',
    title: 'Say what you see.',
    body: 'Volunteers just talk. AI turns it into a clear report and finds the nearest person with the right skills to help.',
  },
  {
    glyph: 'shield',
    title: 'A person always decides.',
    body: 'Mo, the safety lead, approves every response. Whoever is sent gets told where to go, out loud, while they walk.',
  },
];

/** Three screens on what this is, then straight into the guided demo. */
export default function Welcome() {
  const t = useTheme();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const last = i === SLIDES.length - 1;

  const goTo = (n: number) => {
    if (n < 0 || n >= SLIDES.length) return;
    setDir(n > i ? 1 : -1);
    setI(n);
  };

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -50 || e.velocityX < -500) goTo(i + 1);
      else if (e.translationX > 50 || e.velocityX > 500) goTo(i - 1);
    });

  const startDemo = () => {
    finishOnboarding();
    joinFestival(FESTIVAL_ID);
    startTour('heat');
  };

  const explore = () => {
    finishOnboarding();
    router.replace('/join');
  };

  const slide = SLIDES[i];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <Txt variant="label">Ground Control · Fieldday</Txt>
          {!last && (
            <Pressable hitSlop={12} onPress={() => goTo(SLIDES.length - 1)}>
              <Txt variant="label" color={t.accent}>
                Skip
              </Txt>
            </Pressable>
          )}
        </View>

        <GestureDetector gesture={swipe}>
          <View style={styles.stage}>
            <Animated.View
              key={i}
              entering={glide(dir)}
              exiting={FadeOut.duration(120)}
              style={styles.slide}>
              <View style={styles.badgeWrap}>
                {i === 0 && <PulseRings size={180} color={t.accent} count={3} duration={2400} />}
                <Animated.View entering={settle(80)} style={[styles.badge, { backgroundColor: i === 1 ? t.ai : t.accent }]}>
                  <Glyph name={slide.glyph} size={64} color="#FFFFFF" strokeWidth={1.8} />
                </Animated.View>
                {i === 1 && (
                  <View style={styles.bars}>
                    <SoundBars active color={t.ai} height={48} bars={7} />
                  </View>
                )}
                {i === 2 && (
                  <Animated.View entering={settle(420, 500)} style={[styles.tick, { backgroundColor: t.success, borderColor: t.background }]}>
                    <Glyph name="check" size={28} color="#FFFFFF" strokeWidth={3.2} />
                  </Animated.View>
                )}
              </View>
              <Txt variant="hero">{slide.title}</Txt>
              <Txt variant="body" style={{ fontSize: 21, lineHeight: 30 }} color={t.textSecondary}>
                {slide.body}
              </Txt>
            </Animated.View>
          </View>
        </GestureDetector>

        <View style={{ gap: Spacing.four }}>
          <View style={styles.dots}>
            {SLIDES.map((_, n) => (
              <Pressable key={n} hitSlop={8} onPress={() => goTo(n)} accessibilityLabel={`Page ${n + 1}`}>
                <View style={[styles.dot, { backgroundColor: n === i ? t.accent : t.backgroundSelected, width: n === i ? 28 : 10 }]} />
              </Pressable>
            ))}
          </View>
          {last ? (
            <Animated.View entering={FadeIn.duration(420)} style={{ gap: Spacing.two }}>
              <Button title="Show me how it works" size="lg" onPress={startDemo} />
              <Button title="I’ll explore on my own" size="lg" variant="secondary" onPress={explore} />
            </Animated.View>
          ) : (
            <Button title="Next" size="lg" onPress={() => goTo(i + 1)} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.four, gap: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  stage: { flex: 1, justifyContent: 'center', overflow: 'hidden' },
  slide: { gap: Spacing.four },
  badgeWrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two, marginLeft: -30 },
  badge: { width: 120, height: 120, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  bars: { position: 'absolute', right: -40 },
  tick: { position: 'absolute', right: 14, bottom: 14, width: 52, height: 52, borderRadius: 26, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  dot: { height: 10, borderRadius: 5 },
});
