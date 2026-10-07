import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoleColors, UrgencyColors } from '@/constants/theme';
import type { NoticeKind } from '@/domain/types';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { dismissBanner, formatClock, useStore } from '@/state/store';

const KIND_COLOR: Partial<Record<NoticeKind, string>> = {
  dispatch: UrgencyColors.critical,
  incident: UrgencyColors.high,
  related: '#8E4EC6',
  no_suggestion: UrgencyColors.medium,
  escalated_approval: UrgencyColors.high,
  coverage: UrgencyColors.medium,
  offsite: UrgencyColors.critical,
};

/**
 * Always-on-top demo chrome: who you are (tap to open the demo panel and
 * switch role) plus an in-app banner for new notices.
 */
export function DemoOverlay() {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const pathname = usePathname();
  const user = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId] : undefined));
  const speed = useStore((s) => s.clock.speed);
  const mode = useStore((s) => s.mode);
  const chaos = useStore((s) => s.aiChaos);
  const banner = useStore((s) => s.banner);
  const now = useSimNow(5000);

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(dismissBanner, 6000);
    return () => clearTimeout(id);
  }, [banner]);

  // Only on the role home tabs, where the top-right corner is kept clear for it.
  const hidden = !user || !/^\/(safety|lead|volunteer)(\/|$)/.test(pathname);

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 4 }]}>
      {!hidden && (
        <Pressable
          onPress={() => router.push('/demo')}
          accessibilityLabel="Open demo controls"
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: t.backgroundElement, borderColor: t.border, opacity: pressed ? 0.8 : 0.96 },
          ]}>
          <View style={[styles.dot, { backgroundColor: RoleColors[user.role] }]} />
          <Text style={[styles.chipText, { color: t.text }]} numberOfLines={1}>
            {user.name.split(' ')[0]}
          </Text>
          <Text style={[styles.chipMeta, { color: t.textSecondary }]}>
            {formatClock(now)}
            {speed !== 1 ? ` ×${speed}` : ''}
            {mode === 'live' ? ' · GPS' : ''}
            {chaos !== 'off' ? ' · AI✕' : ''}
          </Text>
          <Text style={[styles.chipMeta, { color: t.tint, fontWeight: '800' }]}>DEMO</Text>
        </Pressable>
      )}
      {banner && user && (
        <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.bannerWrap}>
          <Pressable
            onPress={() => {
              dismissBanner();
              if (banner.dispatchId) router.push({ pathname: '/dispatch/[id]', params: { id: banner.dispatchId } });
              else if (banner.incidentId) router.push({ pathname: '/incident/[id]', params: { id: banner.incidentId } });
              else router.push('/inbox');
            }}
            style={[styles.banner, { backgroundColor: t.backgroundElement, borderLeftColor: KIND_COLOR[banner.kind] ?? t.tint }]}>
            <Text style={[styles.bannerTitle, { color: t.text }]} numberOfLines={1}>
              {banner.title}
            </Text>
            <Text style={{ color: t.textSecondary, fontSize: 13 }} numberOfLines={2}>
              {banner.body}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-end',
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    maxWidth: 260,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chipText: { fontWeight: '700', fontSize: 13 },
  chipMeta: { fontSize: 12, fontWeight: '600' },
  bannerWrap: { paddingHorizontal: 12, marginTop: 8 },
  banner: {
    borderRadius: 14,
    borderLeftWidth: 5,
    padding: 12,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bannerTitle: { fontWeight: '800', fontSize: 15 },
});
