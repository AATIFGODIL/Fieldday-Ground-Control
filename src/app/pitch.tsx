/**
 * The pitch: problem, evidence, solution, live demo, close.
 *
 * Ground Control's own look: Apple's system type, all-dark slides tinted by
 * chapter (warm through the problem, plum for the solution, blue for the demo), 3D
 * extruded titles, a radio transcript that types itself and cuts out, a tilted
 * 3D festival map with a responder walking to an incident, and the launch film.
 *
 * Motion: lines fade up and unblur, one after another; slides fade out,
 * drifting the way you're going.
 *
 * Keys: → / space / enter next, ← back, F full screen, N speaker notes.
 * Click the left quarter to go back, anywhere else to go on. Lives at /pitch.
 */
import { router } from 'expo-router';
import { createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Glyph } from '@/components/ui/glyph';

/* ----------------------------- look and type ----------------------------- */

// Every slide is dark and follows the story's temperature: calm ink to open,
// warm through the problem (ember and char in turn), cooling through the
// solution (plum, dusk) to blue for the demo, and back to ink to close.

type Theme = 'light' | 'dark' | 'black' | 'ink' | 'ember' | 'char' | 'plum' | 'dusk' | 'midnight';

interface Colors {
  bg: string;
  ink: string;
  grey: string;
  muted: string;
  accent: string;
  fill: string;
  /** The shade a 3D title's extrusion is drawn in. */
  depth: string;
  /** Offscript's colour on this background. */
  offscript: string;
}

const PALETTE: Record<Theme, Colors> = {
  light: { bg: '#FBFAF7', ink: '#1D1D1F', grey: '#8A8780', muted: '#6B6862', accent: '#3E4C8A', fill: '#F1EFEA', depth: '#DCDDE6', offscript: '#A4502A' },
  dark: { bg: '#0B0B0C', ink: '#F2F1EE', grey: '#8E8C87', muted: '#A9A7A1', accent: '#9AA6D6', fill: '#1B1B1D', depth: '#2E3A66', offscript: '#E0A458' },
  ink: { bg: '#0C0F16', ink: '#F4F1EA', grey: '#9AA0AD', muted: '#C8CCD4', accent: '#9AA6D6', fill: 'rgba(244,241,234,0.08)', depth: '#2B3870', offscript: '#E3C27A' },
  ember: { bg: '#1C120D', ink: '#F2E9E1', grey: '#A8958A', muted: '#D6C6BA', accent: '#E0A458', fill: 'rgba(242,233,225,0.08)', depth: '#5A3418', offscript: '#E0A458' },
  char: { bg: '#160E0B', ink: '#F2E9E1', grey: '#A8958A', muted: '#D6C6BA', accent: '#E0A458', fill: '#241914', depth: '#4A2C18', offscript: '#E0A458' },
  plum: { bg: '#0E0816', ink: '#F4F1EA', grey: '#BDB2D2', muted: '#DED7E9', accent: '#C9B6F2', fill: 'rgba(244,241,234,0.1)', depth: '#2A1B3F', offscript: '#E3C27A' },
  dusk: { bg: '#0E0A14', ink: '#F4F1EA', grey: '#B3AAC4', muted: '#DAD3E6', accent: '#C9B6F2', fill: '#1C1626', depth: '#2A1B3F', offscript: '#E3C27A' },
  black: { bg: '#000000', ink: '#F4F1EA', grey: '#8E8C87', muted: '#A9A7A1', accent: '#9AA6D6', fill: 'rgba(244,241,234,0.1)', depth: '#2E3A66', offscript: '#E0A458' },
  midnight: { bg: '#0A1328', ink: '#F4F1EA', grey: '#B3BDD6', muted: '#DAE0EC', accent: '#F4F1EA', fill: 'rgba(244,241,234,0.1)', depth: '#030812', offscript: '#E3C27A' },
};

/** Apple's own typeface: San Francisco on Apple devices, the closest system face elsewhere. */
const APPLE = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
  default: undefined,
});
const MONO = Platform.select({ web: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', default: 'Menlo' });

/** "Offscript" gets its own voice: a heavy italic serif. */
const OFFSCRIPT: TextStyle = Platform.select<TextStyle>({
  web: { fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', fontWeight: '900' },
  default: { fontFamily: 'Georgia', fontStyle: 'italic', fontWeight: '900' },
});

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const WEB = Platform.OS === 'web';

function useSizes() {
  const { width, height } = useWindowDimensions();
  const w = Math.min(width, height * 1.9);
  return {
    width,
    height,
    phone: width < 760,
    mega: clamp(w * 0.1, 50, 176),
    h: clamp(w * 0.064, 38, 112),
    h2: clamp(w * 0.05, 32, 80),
    sub: clamp(w * 0.026, 22, 44),
    label: clamp(w * 0.0155, 18, 24),
    pad: clamp(width * 0.075, 24, 128),
  };
}
type Sizes = ReturnType<typeof useSizes>;

const ThemeCtx = createContext<Colors>(PALETTE.light);
/** Whether this slide is the one on stage (false while it's on its way out). */
const OnStageCtx = createContext(true);
const useColors = () => useContext(ThemeCtx);

/** A big number that counts up, in the slide's accent. */
function Stat({ to, delay, px }: { to: number; delay: number; px: number }) {
  const c = useColors();
  return <CountUp to={to} delay={delay} style={t(px, '800', c.accent)} />;
}

const t = (px: number, weight: TextStyle['fontWeight'], color: string, extra?: TextStyle): TextStyle => ({
  fontFamily: APPLE,
  fontSize: px,
  lineHeight: px * (px > 60 ? 1.04 : px > 36 ? 1.1 : 1.3),
  fontWeight: weight,
  letterSpacing: px > 36 ? -px * 0.028 : -px * 0.01,
  color,
  ...extra,
});

/* --------------------------------- motion --------------------------------- */

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
/** A long, soft settle, like Apple's own slide builds. */
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
/** Respect the viewer's "reduce motion" setting: plain fades, no movement or blur. */
const REDUCE = WEB && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** One line of a slide: it fades up and unblurs. `order` staggers the lines 0.14 s apart. */
function Rise({ order, children, center }: { order: number; children: ReactNode; center?: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(180 + order * 140, withTiming(1, { duration: 900, easing: SETTLE })));
  }, [v, order]);
  const style = useAnimatedStyle(() => {
    const t = v.get();
    if (REDUCE) return { opacity: t };
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 28 }],
      ...(WEB ? { filter: t < 0.995 ? `blur(${(1 - t) * 8}px)` : 'none' } : {}),
    };
  });
  return <Animated.View style={[{ alignSelf: center ? 'center' : 'stretch', alignItems: center ? 'center' : 'flex-start' }, style]}>{children}</Animated.View>;
}

/**
 * A headline that slides up from behind an invisible edge, the way Apple's
 * pages bring in big type. The mask leaves room for 3D extrusion and shadows.
 */
function Reveal({ order, children, center }: { order: number; children: ReactNode; center?: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(180 + order * 140, withTiming(1, { duration: 1000, easing: SETTLE })));
  }, [v, order]);
  const style = useAnimatedStyle(() => {
    const t = v.get();
    if (REDUCE) return { opacity: t };
    return { opacity: Math.min(1, t * 1.6), transform: [{ translateY: `${(1 - t) * 105}%` }] };
  });
  const room = 28;
  return (
    <View style={{ alignSelf: center ? 'center' : 'stretch', alignItems: center ? 'center' : 'flex-start', overflow: 'hidden', paddingRight: room, paddingBottom: room, marginRight: -room, marginBottom: -room }}>
      <Animated.View style={[{ alignItems: center ? 'center' : 'flex-start' }, style]}>{children}</Animated.View>
    </View>
  );
}

/** A number that counts up from zero and always lands on the real value. */
function CountUp({ to, delay = 400, style }: { to: number; delay?: number; style: TextStyle }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const duration = 1300;
    let raf = 0;
    const begin = setTimeout(() => {
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    const land = setTimeout(() => setN(to), delay + duration + 150);
    return () => {
      clearTimeout(begin);
      clearTimeout(land);
      cancelAnimationFrame(raf);
    };
  }, [to, delay]);
  return <Text style={[style, { fontVariant: ['tabular-nums'] }]}>{n.toLocaleString('en-AU')}</Text>;
}

/* ------------------------------- building blocks ------------------------------- */

function Section({ n, name, s }: { n: string; name: string; s: Sizes }) {
  const c = useColors();
  return <Text style={t(s.label, '800', c.accent, { letterSpacing: 0.6, textTransform: 'uppercase' })}>{`${n} · ${name}`}</Text>;
}

function Big({ s, size, children, max }: { s: Sizes; size: 'mega' | 'h' | 'h2' | 'sub'; children: ReactNode; max?: number }) {
  const c = useColors();
  return <Text style={[t(s[size], size === 'sub' ? '600' : '700', c.ink), { maxWidth: s.phone || !max ? undefined : s.width * max }]}>{children}</Text>;
}

function Grey({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.grey }}>{children}</Text>;
}

function Muted({ s, children, max = 0.66 }: { s: Sizes; children: ReactNode; max?: number }) {
  const c = useColors();
  return <Text style={[t(s.sub, '600', c.muted), { maxWidth: s.phone ? undefined : s.width * max }]}>{children}</Text>;
}

function Source({ s, children }: { s: Sizes; children: ReactNode }) {
  const c = useColors();
  return <Text style={[t(s.label, '500', c.grey), { maxWidth: s.phone ? undefined : s.width * 0.75 }]}>Source: {children}</Text>;
}

/**
 * Chunky 3D letters: the same words stacked a pixel apart in a darker shade
 * underneath, so the title reads as a solid block. `lit` draws the face in
 * the slide's accent (the glowing 38°C).
 */
function Extrude({ px, children, center, lit }: { px: number; children: ReactNode; center?: boolean; lit?: boolean }) {
  const c = useColors();
  const layers = Math.max(4, Math.round(px * 0.06));
  const style = t(px, '800', lit ? c.accent : c.ink, { textAlign: center ? 'center' : 'left' });
  return (
    <View>
      {Array.from({ length: layers }, (_, i) => {
        const d = layers - i;
        return (
          <Text key={i} aria-hidden style={[style, { position: 'absolute', left: d, right: -d, top: d, color: c.depth }]}>
            {children}
          </Text>
        );
      })}
      <Text style={style}>{children}</Text>
    </View>
  );
}

function Offscript({ s }: { s: Sizes }) {
  const c = useColors();
  return (
    <Text style={t(s.sub, '600', c.ink)}>
      A project by <Text style={[OFFSCRIPT, { color: c.offscript, fontSize: s.sub * 1.3, letterSpacing: 0 }]}>Offscript</Text>
    </Text>
  );
}

function Card({ s, n, title, text }: { s: Sizes; n?: number; title: string; text: string }) {
  const c = useColors();
  return (
    <View style={{ borderRadius: 32, padding: clamp(s.width * 0.02, 22, 32), gap: 12, backgroundColor: c.fill, minHeight: s.phone ? undefined : 220 }}>
      {n !== undefined && (
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={t(24, '800', c.bg === '#FFFFFF' ? '#FFFFFF' : c.bg)}>{n}</Text>
        </View>
      )}
      <Text style={t(clamp(s.width * 0.022, 24, 36), '700', c.ink)}>{title}</Text>
      <Text style={t(clamp(s.width * 0.016, 20, 26), '500', c.muted)}>{text}</Text>
    </View>
  );
}

/**
 * A row of cards (a column on phones) that fade up one after another.
 * `line` draws a thin line beneath as they land (for the four steps).
 */
function CardRow({ s, from, line, items }: { s: Sizes; from: number; line?: boolean; items: { n?: number; title: string; text: string }[] }) {
  return (
    <View style={{ alignSelf: 'stretch', marginTop: 12, gap: 28 }}>
      <View style={{ flexDirection: s.phone ? 'column' : 'row', gap: 20, alignSelf: 'stretch' }}>
        {items.map((it, i) => (
          <View key={it.title} style={{ flex: s.phone ? undefined : 1 }}>
            <Rise order={from + i}>
              <View style={{ alignSelf: 'stretch' }}>
                <Card s={s} {...it} />
              </View>
            </Rise>
          </View>
        ))}
      </View>
      {line && !s.phone && <StepLine delay={150 + from * 140} duration={items.length * 140 + 700} />}
    </View>
  );
}

/** A thin line that draws left to right under the steps as they land. */
function StepLine({ delay, duration }: { delay: number; duration: number }) {
  const c = useColors();
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(delay, withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) })));
  }, [v, delay, duration]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: v.get() }] }));
  return <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: c.accent, transformOrigin: 'left center' }, style]} />;
}

function CTA({ s, title, onPress }: { s: Sizes; title: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginTop: 24,
        borderRadius: 999,
        paddingHorizontal: 44,
        minHeight: 76,
        justifyContent: 'center',
        backgroundColor: c.ink,
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <Text style={t(clamp(s.width * 0.02, 22, 32), '800', c.bg)}>{title}</Text>
    </Pressable>
  );
}

/* --------------------------------- radio --------------------------------- */

const RADIO = [
  { time: '14:02', text: 'Water stn to control. Man down by the taps.' },
  { time: '14:02', text: 'He’s red, sweating, not making sense…' },
  { time: '14:03', text: '[ static ]', cut: true },
];

/** The call, typed out as it comes in, then cut off. */
function RadioLog({ s, delay = 700 }: { s: Sizes; delay?: number }) {
  const c = useColors();
  const total = RADIO.reduce((n, l) => n + l.text.length, 0);
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => setTyped((n) => (n >= total ? n : n + 1)), 34);
    }, delay);
    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [total, delay]);

  const px = clamp(s.width * 0.021, 20, 34);
  // Where each line starts in the overall typing, so each knows how much of itself to show.
  const starts = RADIO.map((_, i) => RADIO.slice(0, i).reduce((n, l) => n + l.text.length, 0));
  return (
    <View style={{ gap: 14, alignSelf: 'stretch', maxWidth: s.phone ? undefined : s.width * 0.78 }}>
      {RADIO.map((l, i) => {
        const left = typed - starts[i];
        const shown = l.text.slice(0, Math.max(0, left));
        const typing = left > 0 && left < l.text.length;
        if (!shown && i > 0) return null;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 22, alignItems: 'baseline' }}>
            <Text style={{ fontFamily: MONO, fontSize: px, color: c.grey, fontWeight: '600' }}>{l.time}</Text>
            <Text style={{ fontFamily: MONO, fontSize: px, lineHeight: px * 1.35, color: l.cut ? '#E07A6E' : c.ink, fontWeight: '600', flexShrink: 1 }}>
              {shown}
              {typing ? '▍' : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** A crackling radio level that drops dead after `liveMs`. */
function Waveform({ s, liveMs = 4200 }: { s: Sizes; liveMs?: number }) {
  const bars = s.phone ? 22 : 40;
  const h = clamp(s.width * 0.06, 48, 96);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: h }}>
      {Array.from({ length: bars }, (_, i) => (
        <Bar key={i} i={i} h={h} liveMs={liveMs} />
      ))}
    </View>
  );
}

function Bar({ i, h, liveMs }: { i: number; h: number; liveMs: number }) {
  const c = useColors();
  const v = useSharedValue(0.06);
  useEffect(() => {
    let k = 0;
    const tick = setInterval(() => {
      k += 1;
      // Deterministic jitter per bar, louder in the middle like speech.
      const shape = 0.35 + 0.65 * Math.sin((i / 6) + k * 0.9) ** 2;
      v.set(withTiming(0.12 + shape * 0.88 * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7 + k))), { duration: 110 }));
    }, 120);
    const stop = setTimeout(() => {
      clearInterval(tick);
      v.set(withTiming(0.04, { duration: 260 }));
    }, liveMs);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
  }, [i, liveMs, v]);
  const style = useAnimatedStyle(() => ({ height: Math.max(3, v.get() * h) }));
  return <Animated.View style={[{ width: 6, borderRadius: 3, backgroundColor: c.ink, opacity: 0.85 }, style]} />;
}

/* ------------------------------ the 3D map ------------------------------ */

const ZONES = [
  { x: 6, y: 8, w: 30, h: 22, color: '#D9B26F' }, // stage
  { x: 62, y: 6, w: 32, h: 26, color: '#D9B26F' }, // main stage
  { x: 42, y: 44, w: 14, h: 12, color: '#86A9B5' }, // water
  { x: 60, y: 46, w: 18, h: 18, color: '#C4865A' }, // food
  { x: 10, y: 46, w: 16, h: 12, color: '#9C8CB4' }, // bar
  { x: 12, y: 72, w: 20, h: 16, color: '#C48D96' }, // kids
  { x: 38, y: 78, w: 10, h: 10, color: '#B5574D' }, // first aid
  { x: 80, y: 74, w: 14, h: 18, color: '#86A38C' }, // games
];
const DOTS = Array.from({ length: 34 }, (_, i) => ({ x: 6 + ((i * 37) % 88), y: 8 + ((i * 53) % 84) }));
const INCIDENT = { x: 49, y: 50 };
const RESPONDER_FROM = { x: 70, y: 22 };

/** A tilted, slowly turning model of the site: a red incident pulsing, a responder walking to it. */
function IsoMap({ s }: { s: Sizes }) {
  const size = s.phone ? Math.min(s.width - 48, 340) : clamp(s.width * 0.34, 320, 560);
  const sway = useSharedValue(0);
  const walk = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    sway.set(withRepeat(withSequence(withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.sin) })), -1, false));
    walk.set(withRepeat(withSequence(withDelay(900, withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) })), withDelay(1200, withTiming(0, { duration: 0 }))), -1, false));
    pulse.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }), -1, false));
  }, [sway, walk, pulse]);

  const plane = useAnimatedStyle(() => ({
    transform: [{ perspective: 1800 }, { rotateX: '58deg' }, { rotateZ: `${-42 + sway.get() * 10}deg` }],
  }));
  const responder = useAnimatedStyle(() => ({
    left: `${RESPONDER_FROM.x + (INCIDENT.x - RESPONDER_FROM.x) * walk.get()}%`,
    top: `${RESPONDER_FROM.y + (INCIDENT.y - RESPONDER_FROM.y) * walk.get()}%`,
  }));
  const ring = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - pulse.get()), transform: [{ scale: 0.5 + pulse.get() * 2.2 }] }));

  return (
    <View style={{ width: size, height: size * 0.82, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            width: size * 0.82,
            height: size * 0.82,
            borderRadius: 28,
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.35)',
          },
          plane,
        ]}>
        {ZONES.map((z, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${z.x}%`,
              top: `${z.y}%`,
              width: `${z.w}%`,
              height: `${z.h}%`,
              borderRadius: 8,
              backgroundColor: z.color,
              shadowColor: '#140D1E',
              shadowOpacity: 0.9,
              shadowRadius: 0,
              shadowOffset: { width: 6, height: 6 },
            }}
          />
        ))}
        {DOTS.map((d, i) => (
          <View key={i} style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', opacity: 0.85 }} />
        ))}
        <View style={{ position: 'absolute', left: `${INCIDENT.x}%`, top: `${INCIDENT.y}%`, width: 0, height: 0 }}>
          <Animated.View style={[{ position: 'absolute', left: -22, top: -22, width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: '#E07A6E' }, ring]} />
          <View style={{ position: 'absolute', left: -11, top: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: '#E07A6E', borderWidth: 3, borderColor: '#F4F1EA' }} />
        </View>
        <Animated.View style={[{ position: 'absolute', width: 0, height: 0 }, responder]}>
          <View style={{ position: 'absolute', left: -10, top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#E3C27A', borderWidth: 3, borderColor: '#170F22' }} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * The launch film, playing as soon as its slide opens. Advancing the deck
 * counts as a click, so browsers let it play with sound; if one won't, it
 * plays muted with a button to turn the sound on. When it ends, the deck
 * goes on to the next slide.
 */
function LaunchFilm({ s }: { s: Sizes }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const onStage = useContext(OnStageCtx);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      void v.play().catch(() => {});
    });
    return () => v.pause();
  }, []);
  if (!WEB) return <Muted s={s}>The launch film plays in the web version of this deck.</Muted>;
  return (
    <View style={{ flex: 1, alignSelf: 'stretch', backgroundColor: '#000' }}>
      <video
        ref={ref}
        src="/launch.mp4"
        // When the film ends, the deck moves on to the next slide by itself.
        onEnded={() => {
          if (onStage) window.dispatchEvent(new Event('pitch:next'));
        }}
        playsInline
        preload="auto"
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', background: '#000' }} />
      {muted && (
        <Pressable
          onPress={() => {
            const v = ref.current;
            if (v) v.muted = false;
            setMuted(false);
          }}
          style={({ hovered }) => ({ position: 'absolute', right: 32, bottom: 32, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, backgroundColor: hovered ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)' })}>
          <Text style={t(18, '700', '#FFFFFF')}>Turn sound on</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ---------------------------------- slides ---------------------------------- */

interface Slide {
  theme: Theme;
  center?: boolean;
  hasButton?: boolean;
  notes: string;
  /** Lines that rise in turn. */
  lines: (s: Sizes) => ReactNode[];
  /** Something drawn beside the lines on wide screens (below on phones). */
  aside?: (s: Sizes) => ReactNode;
  /** Lines that animate themselves (cards) aren't wrapped again. */
  raw?: number[];
  /** Fills the whole slide, edge to edge, instead of lines (the launch film). */
  full?: (s: Sizes) => ReactNode;
}

const SLIDES: Slide[] = [
  /* ===== 01 Problem ===== */
  {
    theme: 'ink',
    notes: 'Imagine you’re Mo, the safety lead at Riverside.',
    lines: (s) => [
      <Section key="sec" s={s} n="01" name="Problem" />,
      <Extrude key="h" px={s.mega}>
        Imagine you’re Mo.
      </Extrude>,
      <Muted key="m" s={s}>
        Safety lead at Riverside. 15,000 people a day. 300 volunteers. One radio earpiece.
      </Muted>,
    ],
  },
  {
    theme: 'ember',
    notes: 'Saturday, 2pm, 38 degrees. The queue at the water station is 40 deep. Someone collapses, and the two first-aiders rostered there never showed up.',
    lines: (s) => [
      <Big key="t" s={s} size="sub">
        Saturday · 2pm
      </Big>,
      <Extrude key="h" px={clamp(s.width * 0.17, 96, 280)} lit>
        38°C
      </Extrude>,
      <Big key="b" s={s} size="h2" max={0.8}>
        40 people queuing for water. <Grey>Someone collapses. The first-aiders never showed.</Grey>
      </Big>,
    ],
  },
  {
    theme: 'char',
    notes: 'This is how it reaches Mo: a few seconds of radio, through static, and then it’s gone. Who’s closest? Who’s trained? Did anyone else call it in?',
    lines: (s) => [
      <Muted key="m" s={s}>
        How it reaches Mo:
      </Muted>,
      <Waveform key="w" s={s} />,
      <RadioLog key="r" s={s} />,
      <Big key="h" s={s} size="h2" max={0.8}>
        Then it’s gone. <Grey>Who’s closest? Who’s trained?</Grey>
      </Big>,
    ],
  },
  {
    theme: 'ember',
    notes:
      'This isn’t hypothetical. Ten people died at Astroworld in 2021. Texas’s concert safety task force named poor communication as a key factor: firefighters outside weren’t on the same radio as the event’s medics.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        When the radio fails, <Grey>people get hurt.</Grey>
      </Big>,
      <Stat key="n" to={10} delay={600} px={clamp(s.width * 0.13, 72, 200)} />,
      <Big key="d" s={s} size="sub" max={0.62}>
        people died at Astroworld in 2021. Medics and firefighters weren’t on the same radio.
      </Big>,
      <Source key="src" s={s}>
        Texas Task Force on Concert Safety report, via KERA News (2022); Pollstar (2021).
      </Source>,
    ],
  },
  {
    theme: 'char',
    notes:
      'The Manchester Arena Inquiry said the emergency response was far below the standard it should have been, and that better coordination and communication might have saved one, possibly two lives.',
    lines: (s) => [
      <Muted key="m" s={s}>
        The Manchester Arena Inquiry, on the emergency response:
      </Muted>,
      <Big key="h" s={s} size="h" max={0.82}>
        “Far below the standard it should have been.”
      </Big>,
      <Source key="src" s={s}>
        Manchester Arena Inquiry, Volume 2 (2022).
      </Source>,
    ],
  },
  {
    theme: 'ember',
    notes:
      'And the load is real. A seven-year study of a large music festival found about 12 in every 1,000 people needed medical help, more on hot days. At Riverside’s size, that’s around 180 people a day, all coming in over the radio.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        Every day at Riverside, <Grey>around</Grey>
      </Big>,
      <Stat key="n" to={180} delay={500} px={clamp(s.width * 0.15, 80, 220)} />,
      <Big key="s" s={s} size="sub">
        people could need medical help.
      </Big>,
      <Source key="src" s={s}>
        12 in 1,000 festival-goers, Medical care at a mass gathering music festival, 2011–2017 (Wiener klinische Wochenschrift, 2021). Our estimate for
        15,000 people.
      </Source>,
    ],
  },

  /* ===== 02 Solution ===== */
  {
    theme: 'plum',
    notes: 'So we built Ground Control. Every call heard, every decision human.',
    lines: (s) => [
      <Section key="sec" s={s} n="02" name="Solution" />,
      <Muted key="meet" s={s}>
        Meet
      </Muted>,
      <Extrude key="h" px={clamp(s.width * (s.phone ? 0.12 : 0.072), 48, 132)}>
        Ground Control.
      </Extrude>,
      <Offscript key="o" s={s} />,
      <Big key="tag" s={s} size="sub" max={0.5}>
        Every call heard. Every decision human.
      </Big>,
    ],
    aside: (s) => <IsoMap s={s} />,
  },
  {
    theme: 'black',
    hasButton: true,
    notes: 'The launch film plays by itself (30 seconds). When it ends, press → to go on.',
    lines: () => [],
    full: (s) => <LaunchFilm s={s} />,
  },
  {
    theme: 'dusk',
    notes:
      'Four steps. A volunteer just says what they see. AI writes it up as a clear incident and checks whether someone already reported it. Mo sees the nearest people with the right skills and approves in one tap. Their phone tells them where to go, out loud, while they walk.',
    raw: [1],
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        From radio call to help, <Grey>in four steps.</Grey>
      </Big>,
      <CardRow
        key="c"
        s={s}
        from={1}
        line
        items={[
          { n: 1, title: 'Say it', text: 'A volunteer just talks. No forms.' },
          { n: 2, title: 'AI writes it up', text: 'A clear report, checked for duplicates.' },
          { n: 3, title: 'Mo approves', text: 'The nearest people with the right skills.' },
          { n: 4, title: 'Help arrives', text: 'Their phone says where to go, out loud.' },
        ]}
      />,
    ],
  },
  {
    theme: 'dusk',
    notes:
      'The AI does the legwork, but it never acts alone. Mo approves every response and every move. If a critical report gets no answer in 30 seconds, the zone’s location lead can step in, and Mo is told. Every decision is logged with a name.',
    raw: [1],
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        AI does the legwork. <Grey>People make the calls.</Grey>
      </Big>,
      <CardRow
        key="c"
        s={s}
        from={1}
        items={[
          { title: 'Mo approves', text: 'Every response, and every change to who stands where.' },
          { title: 'Leads step in', text: 'Critical with no answer in 30 seconds? The zone’s lead can approve.' },
          { title: 'Everything logged', text: 'Who decided, what was sent, and when.' },
        ]}
      />,
    ],
  },

  /* ===== 03 Build ===== */
  {
    theme: 'midnight',
    hasButton: true,
    notes:
      'DEMO (about 2 minutes). Open the app. First launch: tap “Show me how it works” (or Demo → Heat collapse). ' +
      '1) Mo’s Now screen: the Water Station is short after two no-shows. ' +
      '2) As Priya: play the example voice report, Continue. AI writes it up; Priya picks Critical and sends. ' +
      '3) As Mo: open the incident. AI suggests Sam, about 70 m away, first aid. Edit what Sam is told if you like, then Approve and send. ' +
      '4) As Sam: “You’re needed”, the brief is read aloud, and the dot walks over on the map. ' +
      '5) Optional: Staff tab → “Concert at the Lawn Stage” → approve the moves. Or the second story: two fight reports → compare → merge. ' +
      'Then press the browser’s Back button to return here.',
    lines: (s) => [
      <OnAir key="air" s={s} />,
      <Extrude key="h" px={s.mega}>
        Live demo
      </Extrude>,
      <Muted key="m" s={s}>
        Riverside · simulated festival, example data
      </Muted>,
      <CTA key="b" s={s} title="Open Ground Control →" onPress={() => router.push('/')} />,
    ],
  },
  {
    theme: 'ink',
    notes:
      'What we left out, on purpose. No chatbot: Mo needs decisions, not a conversation. No auto-dispatch: AI never sends anyone on its own. No freehand zone drawing: preset zones Mo can adjust are faster on the day.',
    raw: [1],
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        What we left out, <Grey>on purpose.</Grey>
      </Big>,
      <CardRow
        key="c"
        s={s}
        from={1}
        items={[
          { title: 'A chatbot', text: 'Mo needs decisions, not a conversation.' },
          { title: 'Auto-dispatch', text: 'AI never sends anyone on its own.' },
          { title: 'Freehand zones', text: 'Preset zones Mo can adjust are faster on the day.' },
        ]}
      />,
    ],
  },
  {
    theme: 'ink',
    center: true,
    notes: 'Every call heard. Every decision human. That’s Ground Control. Thank you.',
    lines: (s) => [
      <Muted key="m" s={s} max={0.9}>
        Every call heard. Every decision human.
      </Muted>,
      <Extrude key="h" px={s.mega} center>
        Ground Control.
      </Extrude>,
      <Offscript key="o" s={s} />,
    ],
  },
];

/** "On air": a pulsing light, like the sign outside a studio. */
function OnAir({ s }: { s: Sizes }) {
  const c = useColors();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.25, { duration: 700 })), -1, false));
  }, [p]);
  const dot = useAnimatedStyle(() => ({ opacity: p.get() }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: c.ink, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 }}>
      <Animated.View style={[{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.ink }, dot]} />
      <Text style={t(s.label, '800', c.ink, { letterSpacing: 1.5 })}>03 · ON AIR</Text>
    </View>
  );
}

/* ------------------------------------ deck ------------------------------------ */

/** One slide's content, laid out (lines, aside, or something full-bleed). */
function SlideBody({ i, s }: { i: number; s: Sizes }) {
  const slide = SLIDES[i];
  const lines = slide.lines(s).map((line, n) => {
    const key = `${i}-${n}`;
    if (slide.raw?.includes(n)) {
      return (
        <View key={key} style={{ alignSelf: 'stretch' }}>
          {line}
        </View>
      );
    }
    const headline = isValidElement(line) && (line.type === Big || line.type === Extrude);
    return headline ? (
      <Reveal key={key} order={n} center={slide.center}>
        {line}
      </Reveal>
    ) : (
      <Rise key={key} order={n} center={slide.center}>
        {line}
      </Rise>
    );
  });
  const aside = slide.aside?.(s);
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: slide.full ? 0 : s.pad,
        paddingVertical: slide.full ? 0 : 56,
        flexDirection: aside && !s.phone ? 'row' : 'column',
        alignItems: aside && !s.phone ? 'center' : slide.center ? 'center' : 'flex-start',
        justifyContent: 'center',
        gap: aside ? 32 : 0,
      }}>
      {slide.full ? (
        slide.full(s)
      ) : (
        <View
          style={{
            flex: aside && !s.phone ? 1 : undefined,
            alignSelf: slide.center ? 'center' : 'stretch',
            alignItems: slide.center ? 'center' : 'flex-start',
            // Beside an aside the column fills the slide's height, so centre its lines in it.
            justifyContent: 'center',
            gap: clamp(s.width * 0.016, 14, 28),
          }}>
          {lines}
        </View>
      )}
      {aside && (
        <Rise order={lines.length} center>
          {aside}
        </Rise>
      )}
    </View>
  );
}

/**
 * A slide on the stage. Going forward, the outgoing slide sinks back (smaller,
 * softer) while the incoming one settles in from just in front; going back
 * reverses it, so direction always reads in depth. A slide that's leaving can
 * be called back mid-way and simply turns round.
 */
function Layer({ i, s, exiting, dir }: { i: number; s: Sizes; exiting: boolean; dir: number }) {
  const p = useSharedValue(0);
  const away = useSharedValue(0);
  useEffect(() => {
    if (exiting) {
      away.set(1);
      p.set(withTiming(0, { duration: 480, easing: Easing.bezier(0.4, 0, 0.7, 1) }));
    } else {
      away.set(0);
      p.set(withDelay(60, withTiming(1, { duration: 820, easing: SETTLE })));
    }
  }, [exiting, p, away]);
  const style = useAnimatedStyle(() => {
    const k = 1 - p.get();
    if (REDUCE) return { opacity: p.get() };
    const depth = (away.get() ? -1 : 1) * dir * 0.045 * k;
    return {
      opacity: p.get(),
      transform: [{ scale: 1 + depth }],
      ...(WEB ? { filter: k > 0.005 ? `blur(${k * 8}px)` : 'none' } : {}),
    };
  });
  return (
    <ThemeCtx.Provider value={PALETTE[SLIDES[i].theme]}>
      <OnStageCtx.Provider value={!exiting}>
        <Animated.View pointerEvents={exiting ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, style]}>
          <SlideBody i={i} s={s} />
        </Animated.View>
      </OnStageCtx.Provider>
    </ThemeCtx.Provider>
  );
}

export default function Pitch() {
  const s = useSizes();
  const [index, setIndex] = useState(() => {
    if (!WEB || typeof window === 'undefined') return 0;
    const n = parseInt(window.location.hash.slice(1), 10);
    return Number.isFinite(n) ? clamp(n - 1, 0, SLIDES.length - 1) : 0;
  });
  const [notes, setNotes] = useState(false);
  const [full, setFull] = useState(false);
  const slide = SLIDES[index];
  const colors = PALETTE[slide.theme];

  // The slide that's on its way out, and which way we're going.
  const [leaving, setLeaving] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  // Once the outgoing slide has faded, take it off the stage.
  useEffect(() => {
    if (leaving === null) return;
    const done = setTimeout(() => setLeaving(null), 560);
    return () => clearTimeout(done);
  }, [leaving, index]);

  // The background eases from the last slide's colour to this one's.
  const bgFrom = useSharedValue(colors.bg);
  const bgTo = useSharedValue(colors.bg);
  const bgP = useSharedValue(1);
  const lastBg = useRef(colors.bg);
  useEffect(() => {
    bgFrom.set(lastBg.current);
    bgTo.set(colors.bg);
    bgP.set(0);
    bgP.set(withTiming(1, { duration: 700, easing: SETTLE }));
    lastBg.current = colors.bg;
  }, [colors.bg, bgFrom, bgTo, bgP]);
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(bgP.get(), [0, 1], [bgFrom.get(), bgTo.get()]) }));

  // Progress line.
  const progress = useSharedValue((index + 1) / SLIDES.length);
  useEffect(() => {
    progress.set(withTiming((index + 1) / SLIDES.length, { duration: 500, easing: EASE }));
  }, [index, progress]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  // Never locked: pressing again mid-transition just carries on from there.
  const go = (delta: number) => {
    const next = clamp(index + delta, 0, SLIDES.length - 1);
    if (next === index) return;
    setDir(delta > 0 ? 1 : -1);
    setLeaving(index);
    setIndex(next);
  };

  // Keep the slide in the address (/pitch#10), so Back from the demo returns here.
  useEffect(() => {
    if (WEB) window.history.replaceState(null, '', `#${index + 1}`);
  }, [index]);

  // Full screen: the browser's tabs and toolbars go away; Esc or F brings them back.
  useEffect(() => {
    if (!WEB) return;
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  // Offscript's face on the web.
  useEffect(() => {
    if (!WEB || document.getElementById('offscript-face')) return;
    const link = document.createElement('link');
    link.id = 'offscript-face';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,900&display=swap';
    document.head.appendChild(link);
  }, []);

  // Keys, like a keynote.
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });
  useEffect(() => {
    if (!WEB) return;
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        goRef.current(1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        goRef.current(-1);
      } else if (e.key === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      } else if (e.key === 'n') {
        setNotes((v) => !v);
      }
    };
    const onNext = () => goRef.current(1);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pitch:next', onNext);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pitch:next', onNext);
    };
  }, []);

  const tap = Gesture.Tap()
    .runOnJS(true)
    .enabled(!slide.hasButton)
    .onEnd((e) => go(e.x < s.width * 0.25 ? -1 : 1));
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-30, 30])
    .onEnd((e) => {
      if (e.translationX < -60) go(1);
      else if (e.translationX > 60) go(-1);
    });

  const layers = leaving !== null && leaving !== index ? [leaving, index] : [index];

  return (
    <ThemeCtx.Provider value={colors}>
      <Animated.View style={[{ flex: 1, overflow: 'hidden' }, bgStyle]}>
        <GestureDetector gesture={Gesture.Race(swipe, tap)}>
          <View style={{ flex: 1 }}>
            {layers.map((i) => (
              <Layer key={i} i={i} s={s} exiting={i !== index} dir={dir} />
            ))}
          </View>
        </GestureDetector>

        {WEB && !full && (
          <Pressable
            onPress={toggleFull}
            accessibilityLabel="Full screen"
            style={({ pressed, hovered }) => [
              styles.fullBtn,
              { backgroundColor: colors.fill, opacity: pressed ? 0.7 : hovered ? 1 : 0.85, transform: [{ scale: pressed ? 0.94 : 1 }] },
            ]}>
            <Glyph name="expand" size={24} color={colors.ink} />
          </Pressable>
        )}

        <View pointerEvents="none" style={[styles.track, slide.full && { opacity: 0 }]}>
          <Animated.View style={[{ height: 6, backgroundColor: colors.ink, opacity: 0.85 }, barStyle]} />
        </View>

        {notes && (
          <View style={styles.notes}>
            <ScrollView contentContainerStyle={{ padding: 32, gap: 12 }}>
              <Text style={t(24, '700', '#FFFFFF')}>
                Notes · slide {index + 1} of {SLIDES.length}
              </Text>
              <Text style={t(24, '500', '#FFFFFF', { lineHeight: 34 })}>{slide.notes}</Text>
            </ScrollView>
          </View>
        )}
      </Animated.View>
    </ThemeCtx.Provider>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 6 },
  fullBtn: { position: 'absolute', top: 24, right: 24, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  notes: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '50%', backgroundColor: '#1C1C1E' },
});
