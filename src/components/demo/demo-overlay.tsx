import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInUp, FadeOutUp, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TourCard } from '@/components/demo/tour-card';
import { Glyph } from '@/components/ui/glyph';
import { EASE_OUT } from '@/constants/motion';
import { Radius, Spacing, Type } from '@/constants/theme';
import type { Notice } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { dismissBanner, useStore } from '@/state/store';
import { useTour } from '@/state/tour';

const glass = Platform.OS === 'web' ? ({ backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' } as object) : null;

/** Tab screens have a floating bar at the bottom; everything else doesn't. */
const onTabScreen = (path: string) => /^\/(safety|lead|volunteer)(\/(map|report|staff))?\/?$/.test(path);

/**
 * Always-on-top layer: the alerts bell and "Demo" button, the in-app alert
 * banner, and the guided-demo card pinned above the tab bar.
 */
export function DemoOverlay() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const user = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId] : undefined));
  const banner = useStore((s) => s.banner);
  const unread = useStore((s) => s.notices.filter((n) => n.to === s.currentUserId && !n.read).length);
  const tour = useTour();
  const t = useTheme();

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(dismissBanner, 6000);
    return () => clearTimeout(id);
  }, [banner]);

  const showDemoButton = !!user && !tour.scenario && onTabScreen(pathname);
  const onPitch = pathname.startsWith('/pitch');
  // Sit just above the tab bar (Apple's on iPhone, the floating dock elsewhere).
  const tabBar = onTabScreen(pathname) ? (Platform.OS === 'ios' ? 58 : Math.max(insets.bottom, 12) - insets.bottom + 88) : 4;
  const bottom = insets.bottom + tabBar;

  // The pitch is a presentation: no app chrome over it.
  if (onPitch) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {showDemoButton && (
        <View pointerEvents="box-none" style={[styles.topRight, { top: insets.top + 10 }]}>
          <Pressable
            onPress={() => router.push('/inbox')}
            accessibilityLabel={unread ? `Alerts, ${unread} new` : 'Alerts'}
            style={({ pressed }) => [
              styles.bellBtn,
              glass,
              { backgroundColor: t.glass, borderColor: t.border, transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}>
            <Glyph name="bell" size={19} color={t.text} />
            {unread > 0 && (
              <View style={[styles.badge, { backgroundColor: t.critical, borderColor: t.background }]}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/demo')}
            accessibilityLabel="Open the demo menu"
            style={({ pressed }) => [styles.demoBtn, glass, { backgroundColor: t.glass, borderColor: t.border, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
            <Glyph name="play" size={16} color={t.accent} />
            <Text style={[Type.label, { color: t.accent }]}>Demo</Text>
          </Pressable>
        </View>
      )}

      {banner && user && !tour.scenario && (
        <Animated.View
          key={banner.id}
          entering={FadeInUp.duration(380)}
          exiting={FadeOutUp.duration(220)}
          pointerEvents="box-none"
          style={[styles.bannerWrap, { top: insets.top + 8 }]}>
          <SwipeBanner notice={banner} />
        </Animated.View>
      )}

      {tour.scenario && (
        <View pointerEvents="box-none" style={[styles.tourWrap, { bottom }]}>
          <View style={styles.tourInner}>
            <TourCard />
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * The alert banner. Tap to open it; flick or drag it up and it slides off the
 * top and goes away. Pulling down resists, and letting go early eases it back.
 */
function SwipeBanner({ notice }: { notice: Notice }) {
  const t = useTheme();
  const y = useSharedValue(0);
  const fade = useSharedValue(1);

  const open = () => {
    dismissBanner();
    if (notice.dispatchId) router.push({ pathname: '/dispatch/[id]', params: { id: notice.dispatchId } });
    else if (notice.incidentId) router.push({ pathname: '/incident/[id]', params: { id: notice.incidentId } });
    else router.push('/inbox');
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-6, 6])
    .onUpdate((e) => {
      // Up follows the finger 1:1; down gives a little and then stops giving.
      y.set(e.translationY < 0 ? e.translationY : 12 * (1 - Math.exp(-e.translationY / 40)));
    })
    .onEnd((e) => {
      if (e.translationY < -36 || e.velocityY < -450) {
        y.set(withTiming(-220, { duration: 260, easing: EASE_OUT }));
        fade.set(withTiming(0, { duration: 220 }));
        setTimeout(dismissBanner, 240);
      } else {
        y.set(withSpring(0, { duration: 380, dampingRatio: 1 }));
      }
    });

  const tap = Gesture.Tap().runOnJS(true).maxDistance(8).onEnd(open);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }], opacity: fade.get() }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View accessibilityRole="button" accessibilityLabel={`${notice.title}. ${notice.body}`} style={[styles.banner, glass, { backgroundColor: t.glass, borderColor: t.border }, style]}>
        <View style={[styles.bell, { backgroundColor: t.accent }]}>
          <Glyph name="bell" size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Type.strong, { color: t.text }]} numberOfLines={2}>
            {notice.title}
          </Text>
          <Text style={[Type.caption, { color: t.textSecondary }]} numberOfLines={2}>
            {notice.body}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  tourWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  tourInner: { width: '100%', maxWidth: 560 },
  topRight: { position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 13, fontWeight: '800' },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  banner: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  bell: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
