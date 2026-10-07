/**
 * Floating dock tab bar (web + Android). Ported from the PhysEd-Pro dock and
 * rebuilt for touch: a highlight that springs between tabs, press-and-drag to
 * slide it, and a flick that lands where it was heading. The highlight never
 * leaves the bar — dragging is clamped to the first and last tab.
 */
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Glyph } from './ui/glyph';
import type { TabSpec } from './role-tabs';

const PAD = 6;
const BAR_H = 72;
const WIDTH_FACTOR = 0.9;
const DECELERATION = 0.998;

/** Where a flick would coast to rest (exponential decay, like scrolling). */
function project(velocity: number) {
  'worklet';
  return ((velocity / 1000) * DECELERATION) / (1 - DECELERATION);
}

/** Critically damped everywhere: it glides and stops, never overshoots. */
const SETTLE = { duration: 380, dampingRatio: 1 } as const;
const FLICK = { duration: 460, dampingRatio: 1 } as const;
const FOLLOW = { duration: 140, dampingRatio: 1 } as const;

export function DockTabs({ tabs, base }: { tabs: TabSpec[]; base: string }) {
  const href = (name: string) => (name === 'index' ? base : `${base}/${name}`);
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      {/* Registers the routes with the headless navigator; the dock draws the UI. */}
      <TabList style={{ display: 'none' }}>
        {tabs.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={href(tab.name) as never} />
        ))}
      </TabList>
      <Dock tabs={tabs} hrefs={tabs.map((x) => href(x.name))} base={base} />
    </Tabs>
  );
}

function Dock({ tabs, hrefs, base }: { tabs: TabSpec[]; hrefs: string[]; base: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const n = tabs.length;

  const active = Math.max(
    0,
    tabs.findIndex((tab) => (tab.name === 'index' ? pathname === base || pathname === `${base}/` : pathname.startsWith(`${base}/${tab.name}`))),
  );

  const [barW, setBarW] = useState(0);
  const itemW = barW > 0 ? (barW - PAD * 2) / n : 0;
  const gliderW = itemW * WIDTH_FACTOR;
  const leftOf = (i: number) => PAD + i * itemW + (itemW - gliderW) / 2;

  const x = useSharedValue(0);
  const dragging = useSharedValue(false);
  const pressed = useSharedValue(-1);
  const placed = useSharedValue(false);
  const geom = useSharedValue({ itemW: 0, gliderW: 0, n });

  useEffect(() => {
    geom.set({ itemW, gliderW, n });
    if (!itemW) return;
    if (!placed.get()) {
      // First placement is instant — there's nothing to animate from.
      x.set(leftOf(active));
      placed.set(true);
    } else if (!dragging.get()) {
      x.set(withSpring(leftOf(active), SETTLE));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemW, n]);

  const go = (i: number) => {
    if (i !== active) router.navigate(hrefs[i] as never);
  };

  const indexAt = (px: number) => Math.min(n - 1, Math.max(0, Math.floor((px - PAD) / Math.max(itemW, 1))));
  const minX = leftOf(0);
  const maxX = leftOf(n - 1);
  const clamp = (v: number) => Math.min(maxX, Math.max(minX, v));

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(8)
    .onBegin((e) => {
      pressed.set(indexAt(e.x));
    })
    .onStart((e) => {
      cancelAnimation(x);
      dragging.set(true);
      x.set(withSpring(clamp(e.x - gliderW / 2), FOLLOW));
    })
    .onUpdate((e) => {
      // Follows the finger, but never past the ends of the bar.
      x.set(withSpring(clamp(e.x - gliderW / 2), FOLLOW));
    })
    .onEnd((e) => {
      const center = x.get() + gliderW / 2 + project(e.velocityX);
      const i = indexAt(center);
      dragging.set(false);
      x.set(withSpring(leftOf(i), { ...FLICK, velocity: e.velocityX }));
      go(i);
    })
    .onFinalize(() => {
      pressed.set(-1);
      if (dragging.get()) {
        dragging.set(false);
        x.set(withSpring(leftOf(active), SETTLE));
      }
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(8)
    .onBegin((e) => {
      pressed.set(indexAt(e.x));
    })
    .onEnd((e) => go(indexAt(e.x)))
    .onFinalize(() => pressed.set(-1));

  const gliderStyle = useAnimatedStyle(() => ({
    width: geom.get().gliderW,
    transform: [{ translateX: x.get() }, { scale: withSpring(dragging.get() ? 1.03 : 1, { duration: 300, dampingRatio: 1 }) }],
    shadowOpacity: withSpring(dragging.get() ? 0.25 : 0, { duration: 250, dampingRatio: 1 }),
  }));

  const gliderCenter = useDerivedValue(() => x.get() + geom.get().gliderW / 2);

  const onLayout = (e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          onLayout={onLayout}
          accessibilityRole="tablist"
          style={[
            styles.bar,
            {
              backgroundColor: t.glass,
              borderColor: t.border,
              shadowColor: '#000',
            },
            Platform.OS === 'web' && ({ backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)' } as object),
          ]}>
          {barW > 0 && (
            <Animated.View pointerEvents="none" style={[styles.glider, { backgroundColor: t.glider, shadowColor: '#000' }, gliderStyle]} />
          )}
          {tabs.map((tab, i) => (
            <DockItem
              key={tab.name}
              tab={tab}
              index={i}
              active={i === active}
              center={PAD + i * itemW + itemW / 2}
              radius={itemW * 0.9}
              gliderCenter={gliderCenter}
              pressed={pressed}
            />
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}

function DockItem({
  tab,
  index,
  active,
  center,
  radius,
  gliderCenter,
  pressed,
}: {
  tab: TabSpec;
  index: number;
  active: boolean;
  center: number;
  radius: number;
  gliderCenter: SharedValue<number>;
  pressed: SharedValue<number>;
}) {
  const t = useTheme();
  const color = active ? t.accent : t.textSecondary;

  // Items rise toward the highlight as it passes, and shrink a touch under a finger.
  const style = useAnimatedStyle(() => {
    const d = Math.abs(center - gliderCenter.get());
    const lift = radius > 0 && d < radius ? -3 * Math.cos((d / radius) * (Math.PI / 2)) : 0;
    const scale = withSpring(pressed.get() === index ? 0.95 : 1, { duration: 220, dampingRatio: 1 });
    return { transform: [{ translateY: lift }, { scale }] };
  });

  return (
    <View style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={tab.label}>
      <Animated.View style={[styles.itemInner, style]}>
        <View>
          <Glyph name={tab.glyph} size={24} color={color} strokeWidth={active ? 2.4 : 2} />
          {tab.badge ? (
            <View style={[styles.badge, { backgroundColor: t.critical, borderColor: t.background }]}>
              <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>{tab.badge}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[Type.label, { color, fontWeight: active ? '700' : '500' }]}>
          {tab.label}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bar: {
    width: '100%',
    maxWidth: 480,
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: PAD,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    userSelect: 'none',
  },
  glider: {
    position: 'absolute',
    left: 0,
    top: PAD,
    bottom: PAD,
    borderRadius: 999,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemInner: { alignItems: 'center', gap: 2 },
  badge: {
    position: 'absolute',
    top: -8,
    right: -16,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 17, fontWeight: '800', lineHeight: 20 },
});
