/**
 * On a desktop browser the app runs inside an iPhone-sized screen, so it looks
 * and lays out exactly as it does on a phone: same width, the status bar and
 * Dynamic Island on top, the home indicator below, and safe areas to match.
 * On a phone-sized window, and for the pitch deck, it fills the window.
 *
 * The tree is the same either way (only styles change), so moving between
 * the deck and the app never remounts the navigator.
 */
import { usePathname, router } from 'expo-router';
import makeQr from 'qrcode-generator';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { ScreenSizeContext } from '@/hooks/use-screen-size';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/** iPhone 17 Pro, in points. */
const W = 402;
const MAX_H = 874;
const BEZEL = 13;
const INSETS = { top: 54, bottom: 30, left: 0, right: 0 };

export function PhoneFrame({ children }: { children: ReactNode }) {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const win = useWindowDimensions();
  const pathname = usePathname();
  const parentInsets = useSafeAreaInsets();
  const framed = win.width >= 720 && win.height >= 620 && !pathname.startsWith('/pitch');
  const H = Math.min(MAX_H, win.height - 2 * BEZEL - 40);
  const wide = win.width >= 1180;

  return (
    <View style={[styles.fill, framed && [styles.stage, { backgroundColor: dark ? '#08080A' : '#E8E8ED' }]]}>
      {framed && wide ? <Aside key="aside" dark={dark} /> : null}
      <View
        key="device"
        style={
          framed
            ? [
                styles.device,
                {
                  width: W + 2 * BEZEL,
                  height: H + 2 * BEZEL,
                  boxShadow: dark
                    ? '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)'
                    : '0 40px 100px rgba(20,20,40,0.28), 0 0 0 1px rgba(0,0,0,0.08)',
                } as object,
              ]
            : styles.fill
        }>
        {framed ? <Buttons key="buttons" /> : null}
        <View key="screen" style={framed ? [styles.screen, { width: W, height: H, backgroundColor: t.background }] : styles.fill}>
          <ScreenSizeContext.Provider value={framed ? { width: W, height: H } : null}>
            <SafeAreaInsetsContext.Provider value={framed ? INSETS : parentInsets}>{children}</SafeAreaInsetsContext.Provider>
          </ScreenSizeContext.Provider>
          {framed ? <StatusBar key="status" color={t.text} /> : null}
          {framed ? <View key="home" pointerEvents="none" style={[styles.home, { backgroundColor: t.text }]} /> : null}
        </View>
      </View>
    </View>
  );
}

/** 9:41, the Dynamic Island, signal, Wi-Fi and battery. */
function StatusBar({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={styles.status}>
      <Text style={[styles.time, { color }]}>9:41</Text>
      <View style={styles.island} />
      <View style={styles.icons}>
        <Svg width={19} height={12} viewBox="0 0 19 12">
          {[0, 1, 2, 3].map((i) => (
            <Rect key={i} x={i * 5} y={9 - i * 3} width={3.2} height={3 + i * 3} rx={1} fill={color} />
          ))}
        </Svg>
        <Svg width={17} height={12} viewBox="0 0 17 12">
          <Path d="M8.5 11.2 6.3 8.8a3.2 3.2 0 0 1 4.4 0Z" fill={color} />
          <Path d="M3.9 6.4a6.6 6.6 0 0 1 9.2 0l-1.6 1.7a4.3 4.3 0 0 0-6 0Z" fill={color} />
          <Path d="M1.4 3.9a10.2 10.2 0 0 1 14.2 0L14 5.6a7.9 7.9 0 0 0-11 0Z" fill={color} />
        </Svg>
        <Svg width={27} height={13} viewBox="0 0 27 13">
          <Rect x={0.5} y={0.5} width={23} height={12} rx={3.6} fill="none" stroke={color} strokeOpacity={0.4} />
          <Rect x={2.2} y={2.2} width={19.6} height={8.6} rx={2.2} fill={color} />
          <Path d="M25 4.4v4.2c.8-.3 1.4-1.1 1.4-2.1s-.6-1.8-1.4-2.1Z" fill={color} fillOpacity={0.45} />
        </Svg>
      </View>
    </View>
  );
}

/** Side buttons, for the silhouette. */
function Buttons() {
  return (
    <>
      <View style={[styles.button, { left: -3, top: 150, height: 34 }]} />
      <View style={[styles.button, { left: -3, top: 205, height: 62 }]} />
      <View style={[styles.button, { left: -3, top: 280, height: 62 }]} />
      <View style={[styles.button, { right: -3, top: 230, height: 96 }]} />
    </>
  );
}

/** Beside the phone on wide screens: what this is, the pitch, and a code to open it on a real phone. */
function Aside({ dark }: { dark: boolean }) {
  const ink = dark ? '#F4F1EA' : '#111114';
  const grey = dark ? '#9A9AA2' : '#5C5C61';
  const url = typeof window === 'undefined' ? '' : window.location.origin;
  const cells = useMemo(() => {
    if (!url) return null;
    const qr = makeQr(0, 'M');
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    const dots: { x: number; y: number }[] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) dots.push({ x, y });
    return { n, dots };
  }, [url]);

  return (
    <View style={styles.aside}>
      <Text style={[styles.brand, { color: ink }]}>Ground Control</Text>
      <Text style={[styles.line, { color: grey }]}>Crew and safety ops for Fieldday festivals. This is the phone app, running live.</Text>
      <Pressable onPress={() => router.push('/pitch')} style={({ hovered }) => [styles.pitch, { borderColor: grey, opacity: hovered ? 0.75 : 1 }]}>
        <Text style={[styles.pitchText, { color: ink }]}>Watch the pitch →</Text>
      </Pressable>
      {cells ? (
        <View style={styles.qrRow}>
          <View style={styles.qr}>
            <Svg width={132} height={132} viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`}>
              <Rect x={-2} y={-2} width={cells.n + 4} height={cells.n + 4} fill="#FFFFFF" />
              {cells.dots.map((d) => (
                <Rect key={`${d.x}-${d.y}`} x={d.x} y={d.y} width={1.02} height={1.02} fill="#000000" />
              ))}
            </Svg>
          </View>
          <Text style={[styles.qrText, { color: grey }]}>Best on your phone. Scan to open it there.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 88 },
  device: { borderRadius: 70, backgroundColor: '#0B0B0D', padding: BEZEL, position: 'relative' },
  screen: { borderRadius: 57, overflow: 'hidden', position: 'relative' },
  button: { position: 'absolute', width: 4, borderRadius: 2, backgroundColor: '#1D1D20' },
  status: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 34,
    paddingTop: 6,
    zIndex: 1000,
  },
  time: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2, width: 72, textAlign: 'center' },
  island: { position: 'absolute', top: 11, left: W / 2 - 63, width: 126, height: 37, borderRadius: 19, backgroundColor: '#000000' },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 82, justifyContent: 'flex-end' },
  home: { position: 'absolute', bottom: 8, left: W / 2 - 72, width: 144, height: 5, borderRadius: 3, opacity: 0.85, zIndex: 1000 },
  aside: { width: 340, gap: 18 },
  brand: { fontSize: 40, fontWeight: '800', letterSpacing: -1.2 },
  line: { fontSize: 19, lineHeight: 27, fontWeight: '500' },
  pitch: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, marginTop: 4 },
  pitchText: { fontSize: 17, fontWeight: '700' },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 18 },
  qr: { borderRadius: 14, overflow: 'hidden' },
  qrText: { flex: 1, fontSize: 17, lineHeight: 24, fontWeight: '500' },
});
