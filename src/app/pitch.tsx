/**
 * The pitch: problem, evidence, solution, live demo, close.
 *
 * Ground Control's own look: Apple's system type, all-dark slides tinted by
 * chapter (warm through the problem, plum for the solution, blue for the demo), 3D
 * extruded titles, a radio transcript that types itself and cuts out, the
 * launch film's flat festival map with a responder walking to an incident, and
 * the launch film.
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

import Svg, { Circle, G, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

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

/* ------------------------------ the site map ------------------------------ */

// The launch film's map: flat and top-down, black, white zone outlines with
// bold names, the crowd as small dots, crew in violet, and a red incident with
// Sam walking his violet route to it. Map units are 1800 × 1100, as in the film.

const MAP_W = 1800;
const MAP_H = 1100;
const MAP_ZONES = [
  { name: 'LAWN STAGE', x: 110, y: 110, w: 540, h: 310, stage: true },
  { name: 'MAIN STAGE', x: 1150, y: 90, w: 560, h: 330, stage: true },
  { name: 'WATER', x: 770, y: 520, w: 250, h: 170 },
  { name: 'FOOD COURT', x: 1100, y: 560, w: 380, h: 270 },
  { name: 'BAR', x: 170, y: 560, w: 320, h: 200 },
  { name: 'KIDS ZONE', x: 180, y: 840, w: 380, h: 190 },
  { name: 'FIRST AID', x: 660, y: 850, w: 300, h: 170 },
  { name: 'GAMES', x: 1500, y: 870, w: 240, h: 170 },
];
const MAP_PATHS = ['M80 500 H1720', 'M380 420 L420 500', 'M1430 420 L1380 500', 'M600 500 L700 620 L770 640', 'M1020 640 L1100 680', 'M640 760 L760 830 L800 850', 'M1020 660 L1300 860 L1500 950', 'M480 760 L400 840'];
const LABEL_PX = 42;
/** A zone's name size: as big as the rest, but never wider than its zone. */
const labelPx = (z: (typeof MAP_ZONES)[number]) => Math.min(LABEL_PX, (z.w - 48) / (z.name.length * 0.68));
/** The patch each zone's name sits on: no dots go there, so names stay readable. */
const labelBox = (z: (typeof MAP_ZONES)[number]) => ({ x: z.x + 8, y: z.stage ? z.y + z.h - 70 : z.y + 8, w: z.name.length * 34 + 40, h: 62 });
const onLabel = (x: number, y: number) =>
  MAP_ZONES.some((z) => {
    const b = labelBox(z);
    return x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;
  });

/** A small seeded random, so the crowd is the same every time. */
const seeded = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const MAP_CROWD = (() => {
  const out: { x: number; y: number; o: number }[] = [];
  const put = (x: number, y: number) => {
    if (!onLabel(x, y)) out.push({ x, y, o: 0.3 + seeded(out.length * 3.3) * 0.45 });
  };
  for (let i = 0; i < 260; i++) put(130 + seeded(i) * 500, 204 + Math.pow(seeded(i + 0.5), 1.7) * 200);
  for (let i = 0; i < 260; i++) put(1170 + seeded(i + 900) * 520, 184 + Math.pow(seeded(i + 900.5), 1.7) * 222);
  for (let i = 0; i < 150; i++) put(100 + seeded(i + 1800) * 1600, 470 + seeded(i + 1800.5) * 60);
  MAP_ZONES.slice(2).forEach((z, k) => {
    for (let i = 0; i < Math.round((z.w * z.h) / 900); i++) put(z.x + 14 + seeded(i + k * 97 + 3000) * (z.w - 28), z.y + 14 + seeded(i + k * 97 + 3000.5) * (z.h - 28));
  });
  for (let i = 0; i < 160; i++) put(70 + seeded(i + 5000) * 1660, 70 + seeded(i + 5000.5) * 960);
  return out;
})();
const MAP_CREW = Array.from({ length: 46 }, (_, i) => {
  const z = MAP_ZONES[Math.floor(seeded(i + 7000) * MAP_ZONES.length)];
  return { x: z.x + 24 + seeded(i + 7100) * (z.w - 48), y: z.y + 70 + seeded(i + 7200) * (z.h - 94) };
}).filter((c) => !onLabel(c.x, c.y));
/** People don't stand still: a shuffle in place, two sines at different speeds so it never loops visibly (f in 60ths of a second). */
const shuffle = (f: number, ph: number, amp: number, speed = 1) => ({
  x: amp * (0.62 * Math.sin(f * 0.031 * speed + ph) + 0.38 * Math.sin(f * 0.0137 * speed + ph * 2.3)),
  y: amp * (0.62 * Math.cos(f * 0.027 * speed + ph * 1.7) + 0.38 * Math.sin(f * 0.0161 * speed + ph * 0.6)),
});
/** Crew walk a slow loop around their post. */
const patrol = (f: number, ph: number, amp: number) => {
  const heading = ph * 1.9;
  const fwd = Math.sin(f * 0.0115 + ph * 3.1);
  const side = Math.sin(f * 0.0083 + ph * 1.3) * 0.35;
  const sh = shuffle(f, ph, 3, 1.4);
  return { x: amp * (fwd * Math.cos(heading) - side * Math.sin(heading)) + sh.x, y: amp * 0.75 * (fwd * Math.sin(heading) + side * Math.cos(heading)) + sh.y };
};
/** Where dot i of the crowd is at f: most shuffle where they stand; one in six is strolling somewhere. */
const crowdAt = (p: { x: number; y: number }, i: number, f: number) => {
  const ph = seeded(i * 7.7 + 0.3) * Math.PI * 2;
  const r = seeded(i * 3.1 + 0.9);
  let x = p.x;
  let y = p.y;
  if (i % 6 === 0) {
    const go = Math.sin(f * 0.0105 + ph * 4.1) * (14 + r * 16);
    x += go * Math.cos(ph * 2.7);
    y += go * Math.sin(ph * 2.7) * 0.8;
  }
  const sh = shuffle(f, ph, 2.2 + r * 3.5, 0.8 + r);
  return { x: x + sh.x, y: y + sh.y };
};
const crewWalk = (c: { x: number; y: number }, i: number, f: number) => {
  const ph = seeded(i * 5.3 + 0.7) * Math.PI * 2;
  const w = patrol(f, ph, 18 + 14 * seeded(i * 2.9));
  return { x: c.x + w.x, y: c.y + w.y };
};

/**
 * The crowd and crew, walking about (web): a canvas redrawn every frame. On a
 * phone build, or with reduce motion on, they're drawn once and stand still.
 */
function WalkingDots({ w, h }: { w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const k = (w / MAP_W) * dpr;
    let raf = 0;
    const start = performance.now();
    const draw = () => {
      const f = REDUCE ? 0 : ((performance.now() - start) / 1000) * 60;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      for (const [lo, hi] of [
        [0, 0.45],
        [0.45, 0.6],
        [0.6, 1],
      ]) {
        ctx.beginPath();
        MAP_CROWD.forEach((p, i) => {
          if (p.o < lo || p.o >= hi) return;
          const q = crowdAt(p, i, f);
          ctx.moveTo(q.x + 4.2, q.y);
          ctx.arc(q.x, q.y, 4.2, 0, Math.PI * 2);
        });
        ctx.fillStyle = `rgba(255,255,255,${(lo + hi) / 2})`;
        ctx.fill();
      }
      ctx.beginPath();
      MAP_CREW.forEach((c, i) => {
        const q = crewWalk(c, i, f);
        ctx.moveTo(q.x + 11, q.y);
        ctx.arc(q.x, q.y, 11, 0, Math.PI * 2);
      });
      ctx.fillStyle = VIOLET;
      ctx.fill();
      if (!REDUCE) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [w]);
  return <canvas ref={ref} width={Math.round(w * (window.devicePixelRatio || 1))} height={Math.round(h * (window.devicePixelRatio || 1))} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} />;
}

const PIN = { x: 892, y: 606 };
const ROUTE = [
  { x: 640, y: 716 },
  { x: 702, y: 738 },
  { x: 778, y: 686 },
  { x: 868, y: 616 },
];
const ROUTE_LEN = ROUTE.slice(1).map((p, i) => Math.hypot(p.x - ROUTE[i].x, p.y - ROUTE[i].y));
const ROUTE_TOTAL = ROUTE_LEN.reduce((a, b) => a + b, 0);
const VIOLET = '#A78BFA';
const RED = '#FF453A';

/** The festival from above, as in the launch film: the incident pulsing, Sam walking to it. */
function SiteMap({ s }: { s: Sizes }) {
  const w = s.phone ? Math.min(s.width - 48, 420) : clamp(s.width * 0.42, 360, 760);
  const h = (w * MAP_H) / MAP_W;
  const walk = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    walk.set(withRepeat(withSequence(withDelay(700, withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) })), withDelay(1400, withTiming(0, { duration: 0 }))), -1, false));
    pulse.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }), -1, false));
  }, [walk, pulse]);
  const sam = useAnimatedStyle(() => {
    let d = walk.get() * ROUTE_TOTAL;
    let x = ROUTE[ROUTE.length - 1].x;
    let y = ROUTE[ROUTE.length - 1].y;
    for (let i = 0; i < ROUTE_LEN.length; i++) {
      if (d <= ROUTE_LEN[i]) {
        const k = d / ROUTE_LEN[i];
        x = ROUTE[i].x + (ROUTE[i + 1].x - ROUTE[i].x) * k;
        y = ROUTE[i].y + (ROUTE[i + 1].y - ROUTE[i].y) * k;
        break;
      }
      d -= ROUTE_LEN[i];
    }
    return { left: `${(x / MAP_W) * 100}%`, top: `${(y / MAP_H) * 100}%` };
  });
  const ring = useAnimatedStyle(() => ({ opacity: 0.8 * (1 - pulse.get()), transform: [{ scale: 0.6 + pulse.get() * 2.4 }] }));
  const u = MAP_W / w; // map units per screen pixel, for strokes that stay crisp at any size
  return (
    <View style={{ width: w, height: h, borderRadius: 28, overflow: 'hidden', backgroundColor: '#000000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
      <Svg width={w} height={h} viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {MAP_PATHS.map((d, i) => (
          <Path key={i} d={d} stroke="rgba(255,255,255,0.085)" strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
        <Rect x={40} y={40} width={MAP_W - 80} height={MAP_H - 80} rx={60} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2.5 * u} strokeDasharray={`${14 * u} ${10 * u}`} />
        {MAP_ZONES.map((z) => (
          <G key={z.name}>
            <Rect x={z.x} y={z.y} width={z.w} height={z.h} rx={26} fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.5)" strokeWidth={2 * u} />
            {z.stage && <Rect x={z.x + 40} y={z.y + 24} width={z.w - 80} height={50} rx={12} fill="rgba(255,255,255,0.16)" />}
          </G>
        ))}
        {!WEB && MAP_CROWD.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={4.2} fill="#FFFFFF" opacity={p.o} />)}
        {!WEB && MAP_CREW.map((c, i) => <Circle key={i} cx={c.x} cy={c.y} r={11} fill={VIOLET} />)}
      </Svg>
      {WEB && <WalkingDots w={w} h={h} />}
      <Svg width={w} height={h} viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {MAP_ZONES.map((z) => {
          const b = labelBox(z);
          return (
            <SvgText key={z.name} x={b.x + 22} y={b.y + b.h / 2 + labelPx(z) * 0.36} fill="#FFFFFF" fillOpacity={0.92} fontSize={labelPx(z)} fontWeight="700" letterSpacing={2} fontFamily={APPLE}>
              {z.name}
            </SvgText>
          );
        })}
        <Polyline points={ROUTE.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={VIOLET} strokeOpacity={0.3} strokeWidth={10 * u} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={ROUTE.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#D9CCFF" strokeWidth={3 * u} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={{ position: 'absolute', left: `${(PIN.x / MAP_W) * 100}%`, top: `${(PIN.y / MAP_H) * 100}%`, width: 0, height: 0 }}>
        <Animated.View style={[{ position: 'absolute', left: -12, top: -12, width: 24, height: 24, borderRadius: 12, borderWidth: 2.5, borderColor: RED }, ring]} />
        <View style={{ position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: RED, borderWidth: 2.5, borderColor: '#FFFFFF' }} />
      </View>
      <Animated.View style={[{ position: 'absolute', width: 0, height: 0 }, sam]}>
        <View style={{ position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: VIOLET, borderWidth: 2.5, borderColor: '#FFFFFF' }} />
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

  /* ===== Introducing Ground Control ===== */
  {
    theme: 'plum',
    notes: 'So we built Ground Control. Every call heard, every decision human.',
    lines: (s) => [
      <Muted key="intro" s={s}>
        Introducing
      </Muted>,
      <Extrude key="h" px={clamp(s.width * (s.phone ? 0.12 : 0.072), 48, 132)}>
        Ground Control.
      </Extrude>,
      <Offscript key="o" s={s} />,
      <Big key="tag" s={s} size="sub" max={0.5}>
        Every call heard. Every decision human.
      </Big>,
    ],
    aside: (s) => <SiteMap s={s} />,
  },
  {
    theme: 'black',
    hasButton: true,
    notes: 'The launch film plays by itself (about 45 seconds). When it ends, press → to go on.',
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

  /* ===== 02 Build ===== */
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
      <Text style={t(s.label, '800', c.ink, { letterSpacing: 1.5 })}>02 · ON AIR</Text>
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
