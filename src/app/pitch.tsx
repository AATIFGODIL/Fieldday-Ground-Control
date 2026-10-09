/**
 * The pitch: problem, evidence, solution, live demo, close.
 *
 * Ground Control's own look: Apple's system type, all-dark slides tinted by
 * chapter (warm through the problem, plum for the solution, blue for the demo), 3D
 * extruded titles, the launch film's flat festival map with a responder
 * walking to an incident, and the launch film.
 *
 * Motion: lines fade up and unblur, one after another; slides fade out,
 * drifting the way you're going.
 *
 * Keys: → / space / enter next, ← back, F full screen, N speaker notes.
 * Click the left quarter to go back, anywhere else to go on. Lives at /pitch.
 */
import { router } from 'expo-router';
import { createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextStyle } from 'react-native';
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
  return <Text style={[t(clamp(s.width * 0.0105, 13, 17), '500', c.grey), { maxWidth: s.phone ? undefined : s.width * 0.75 }]}>Source: {children}</Text>;
}

/**
 * Chunky 3D letters: the same words stacked a pixel apart in a darker shade
 * underneath, so the title reads as a solid block. `lit` draws the face in
 * the slide's accent.
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

/** "Offscript" in its own face, for use inside a line of text. */
function OffscriptWord({ s }: { s: Sizes }) {
  const c = useColors();
  return <Text style={[OFFSCRIPT, { color: c.offscript, fontSize: s.sub * 1.25, letterSpacing: 0 }]}>Offscript</Text>;
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

/* ------------------------------ the inquiries ------------------------------ */

const INQUIRIES = [
  { to: 10, name: 'Astroworld', where: 'Houston, 2021' },
  { to: 22, name: 'Manchester Arena', where: 'Manchester, 2017' },
  { to: 159, name: 'Itaewon', where: 'Seoul, 2022' },
];

/** Three disasters side by side: how many died, and where. What went wrong is in the speaker notes. */
function Inquiries({ s }: { s: Sizes }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: s.phone ? 'column' : 'row', gap: clamp(s.width * 0.014, 14, 24), alignSelf: 'stretch', marginTop: 8 }}>
      {INQUIRIES.map((x, i) => (
        <View key={x.name} style={{ flex: s.phone ? undefined : 1, gap: 6, borderRadius: 32, padding: clamp(s.width * 0.02, 22, 36), backgroundColor: c.fill }}>
          <Stat to={x.to} delay={500 + i * 250} px={clamp(s.width * 0.075, 56, 128)} />
          <Text style={t(s.label, '700', c.muted, { textTransform: 'uppercase', letterSpacing: 0.6 })}>people died</Text>
          <Text style={[t(clamp(s.width * 0.02, 22, 34), '800', c.ink), { marginTop: 10 }]}>{x.name}</Text>
          <Text style={t(s.label, '500', c.grey)}>{x.where}</Text>
        </View>
      ))}
    </View>
  );
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

/* --------------------------- the four feature slides --------------------------- */

// Each feature slide pairs a few words with the app itself: a phone showing
// the real screen, and one simple visual beside it. The visuals differ slide
// to slide (tiles, rings, rows, a timeline) so the four never feel the same.
// Loops run off the wall clock, so a phone and the visual beside it stay in step.

/** Re-render every `ms`, for looping visuals. */
function useNow(ms = 60) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (REDUCE) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
/** Which of `n` steps a loop of `stepMs` each is on (the last step if motion is reduced). */
function useStep(n: number, stepMs: number) {
  const now = useNow(200);
  return REDUCE ? n - 1 : Math.floor(now / stepMs) % n;
}

const FEATURE_RED = '#FF453A';
const IOS_GREY = '#1C1C1E';
const IOS_GREY2 = '#2C2C2E';
const IOS_SECONDARY = 'rgba(235,235,245,0.62)';

/** An iPhone in dark mode, drawn in points (402 × 874 screen) and scaled to fit the slide. */
function PhoneMock({ s, children, time = '14:31' }: { s: Sizes; children: ReactNode; time?: string }) {
  const h = (phoneMockWidth(s) * 896) / 424;
  const k = h / 896;
  return (
    <View style={{ width: 424 * k, height: h }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: 424, height: 896, transform: [{ scale: k }], transformOrigin: 'top left' }}>
        <View style={{ flex: 1, borderRadius: 72, backgroundColor: '#3A3A3E', padding: 4 }}>
          <View style={{ flex: 1, borderRadius: 68, backgroundColor: '#000', padding: 7 }}>
            <View style={{ flex: 1, borderRadius: 61, overflow: 'hidden', backgroundColor: '#000' }}>
              {children}
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 34 }}>
                <Text style={t(17, '600', '#FFFFFF')}>{time}</Text>
                <View style={{ width: 125, height: 37, borderRadius: 19, backgroundColor: '#000', marginTop: 4 }} />
                <View style={{ flexDirection: 'row', gap: 5, alignItems: 'flex-end' }}>
                  {[4, 7, 10, 13].map((b) => (
                    <View key={b} style={{ width: 3.5, height: b, borderRadius: 1, backgroundColor: '#FFFFFF' }} />
                  ))}
                  <View style={{ width: 24, height: 12, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', marginLeft: 4, padding: 1.5 }}>
                    <View style={{ flex: 1, borderRadius: 2, backgroundColor: '#FFFFFF' }} />
                  </View>
                </View>
              </View>
              <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: 131, width: 140, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' }} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function PhoneButton({ title, tone = 'violet', icon }: { title: string; tone?: 'violet' | 'grey'; icon?: 'check' }) {
  return (
    <View style={{ height: 54, borderRadius: 27, backgroundColor: tone === 'violet' ? '#8B5CF6' : IOS_GREY2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
      {icon && <Glyph name={icon} size={18} color="#FFFFFF" strokeWidth={3} />}
      <Text style={t(17, '600', '#FFFFFF')}>{title}</Text>
    </View>
  );
}

/* --- 1. duplicates --- */

const DUP_REPORTS = [
  { who: 'Aisha', at: '14:31', said: '“Two guys throwing punches by the barrier.”' },
  { who: 'Tom', at: '14:32', said: '“Fight near the front, people pushing back.”' },
];

/** Mo's compare screen: two reports the AI thinks are one fight. */
function CompareMock() {
  return (
    <View style={{ flex: 1, paddingTop: 66, paddingHorizontal: 18 }}>
      <Text style={t(16, '600', VIOLET)}>‹ Incidents</Text>
      <Text style={[t(30, '800', '#FFFFFF'), { marginTop: 8 }]}>Same thing, or two?</Text>
      <View style={{ marginTop: 14, borderRadius: 18, padding: 14, gap: 4, backgroundColor: 'rgba(167,139,250,0.14)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Glyph name="sparkle" size={16} color={VIOLET} />
          <Text style={t(15, '700', VIOLET)}>AI · 88% likely the same</Text>
        </View>
        <Text style={t(15, '500', IOS_SECONDARY)}>Flagged because they’re close in time and place.</Text>
      </View>
      {DUP_REPORTS.map((r, i) => (
        <View key={r.who}>
          {i > 0 && (
            <View style={{ alignItems: 'center', height: 26, justifyContent: 'center' }}>
              <View style={{ position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: VIOLET, opacity: 0.6 }} />
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#000', borderWidth: 2, borderColor: VIOLET, alignItems: 'center', justifyContent: 'center' }}>
                <Glyph name="link" size={14} color={VIOLET} />
              </View>
            </View>
          )}
          <View style={{ marginTop: i ? 0 : 14, borderRadius: 18, padding: 14, gap: 8, backgroundColor: IOS_GREY }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: IOS_GREY2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={t(14, '700', '#FFFFFF')}>{r.who[0]}</Text>
              </View>
              <Text style={[t(16, '600', '#FFFFFF'), { flex: 1 }]}>
                {r.who} <Text style={{ color: IOS_SECONDARY, fontWeight: '500' }}>· {r.at}</Text>
              </Text>
              <View style={{ backgroundColor: 'rgba(255,69,58,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={t(12, '700', '#FF8A80')}>Fight</Text>
              </View>
            </View>
            <Text style={t(17, '500', '#F2F2F7')}>{r.said}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Glyph name="pin" size={13} color={IOS_SECONDARY} />
              <Text style={t(13, '500', IOS_SECONDARY)}>Lawn Stage, front barrier</Text>
            </View>
          </View>
        </View>
      ))}
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 40, gap: 10 }}>
        <PhoneButton title="Same thing · merge them" />
        <PhoneButton title="Two separate things" tone="grey" />
      </View>
    </View>
  );
}

/** How wide the phone mock is, so the words beside it can size themselves to the space left. */
const phoneMockWidth = (s: Sizes) => ((s.phone ? clamp(s.height * 0.42, 300, 400) : clamp(s.height * 0.74, 420, 720)) * 424) / 896;

/**
 * "AI spots reports…" on one line, and under it the three things the AI
 * compares (when, where, what) as tiles that together match the line's width.
 */
function SpotsBlock({ s }: { s: Sizes }) {
  const c = useColors();
  const line = 'AI spots reports that might be the same thing.';
  // The space beside the phone, and a size that keeps the line on one line in it.
  const room = s.width - 2 * s.pad - phoneMockWidth(s) - 40;
  const px = s.phone ? s.sub : Math.min(s.sub, room / (line.length * 0.5));
  const tiles: { icon: 'clock' | 'pin' | 'radio'; title: string; text: string }[] = [
    { icon: 'clock', title: 'When', text: 'Logged a minute apart' },
    { icon: 'pin', title: 'Where', text: 'Same spot on the map' },
    { icon: 'radio', title: 'What', text: 'Described the same way' },
  ];
  return (
    <View style={{ alignSelf: 'flex-start', gap: clamp(s.width * 0.018, 18, 32) }}>
      <Text numberOfLines={s.phone ? undefined : 1} style={t(px, '600', c.muted)}>
        {line}
      </Text>
      {/* Zero width of its own, full width of the line: the line sets how wide the tiles are. */}
      <View style={{ flexDirection: s.phone ? 'column' : 'row', gap: 18, ...(s.phone ? {} : { width: 0, minWidth: '100%' }) }}>
        {tiles.map((x) => (
          <View key={x.title} style={{ flex: s.phone ? undefined : 1, minHeight: s.phone ? undefined : clamp(s.height * 0.3, 210, 300), borderRadius: 32, padding: clamp(s.width * 0.017, 22, 32), gap: 16, backgroundColor: c.fill, justifyContent: 'space-between' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Glyph name={x.icon} size={32} color={c.bg} strokeWidth={2.4} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={t(clamp(s.width * 0.024, 26, 40), '800', c.ink)}>{x.title}</Text>
              <Text style={t(clamp(s.width * 0.014, 17, 24), '500', c.muted)}>{x.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* --- 2. when Mo doesn't answer --- */

const ESC_CYCLE = 9000;
const ESC_CRIT = 3000; // the 30-second clock, played fast
const ESC_OTHER = 7200; // the 2-minute clock, played fast

/** A zone lead's incident screen: Mo hasn't answered, so after 30 s they can approve. */
function EscalationMock() {
  const now = useNow(60);
  const p = REDUCE ? ESC_CRIT + 1 : now % ESC_CYCLE;
  const secs = Math.min(30, Math.floor((p / ESC_CRIT) * 30));
  const open = p >= ESC_CRIT;
  const done = p >= ESC_CRIT + 1600;
  return (
    <View style={{ flex: 1, paddingTop: 66, paddingHorizontal: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: IOS_GREY, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Glyph name="person" size={14} color="#FFFFFF" />
        <Text style={t(14, '600', '#FFFFFF')}>Grace · Water Station lead</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <View style={{ backgroundColor: FEATURE_RED, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={t(13, '700', '#FFFFFF')}>Critical</Text>
        </View>
        <Text style={t(14, '500', IOS_SECONDARY)}>Water Station · 14:02</Text>
      </View>
      <Text style={[t(30, '800', '#FFFFFF'), { marginTop: 8 }]}>Heat collapse</Text>
      <View style={{ marginTop: 16, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: open ? 'rgba(167,139,250,0.16)' : 'rgba(255,69,58,0.14)' }}>
        <Glyph name="clock" size={26} color={open ? VIOLET : '#FF8A80'} />
        <View style={{ flex: 1 }}>
          <Text style={t(16, '700', '#FFFFFF')}>{open ? 'You can approve now' : 'Waiting for Mo'}</Text>
          <Text style={t(14, '500', IOS_SECONDARY)}>{open ? 'Mo hasn’t answered in 30 s.' : 'No answer yet.'}</Text>
        </View>
        <Text style={[t(28, '800', open ? VIOLET : '#FF8A80'), { fontVariant: ['tabular-nums'] }]}>0:{String(secs).padStart(2, '0')}</Text>
      </View>
      <View style={{ marginTop: 12, borderRadius: 20, padding: 14, backgroundColor: IOS_GREY, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={t(15, '700', '#FFFFFF')}>SL</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Glyph name="sparkle" size={13} color={VIOLET} />
            <Text style={t(13, '600', VIOLET)}>AI suggests</Text>
          </View>
          <Text style={t(17, '600', '#FFFFFF')}>Sam Lee</Text>
          <Text style={t(14, '500', IOS_SECONDARY)}>First aid · 70 m away</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 40, gap: 10 }}>
        <View style={{ opacity: open ? 1 : 0.35 }}>
          <PhoneButton title={done ? 'Sent to Sam' : 'Approve and send'} icon="check" />
        </View>
        <Text style={[t(13, '500', IOS_SECONDARY), { textAlign: 'center' }]}>You’re approving as location lead. This is logged and Mo is told.</Text>
      </View>
    </View>
  );
}

/** A countdown ring that fills, then shows the lead stepping in. */
function CountdownRing({ s, label, value, fillMs, color }: { s: Sizes; label: string; value: string; fillMs: number; color: string }) {
  const c = useColors();
  const now = useNow(60);
  const p = REDUCE ? 1 : Math.min(1, (now % ESC_CYCLE) / fillMs);
  const size = s.phone ? 104 : clamp(s.width * 0.1, 150, 200);
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.fill} strokeWidth={12} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={12} fill="none" strokeLinecap="round" strokeDasharray={`${circ * p} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
        <Text style={t(s.phone ? 24 : clamp(s.width * 0.026, 30, 46), '800', c.ink)}>{value}</Text>
      </View>
      <Text style={t(clamp(s.width * 0.013, 17, 22), '700', p >= 1 ? c.ink : c.muted)}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: p >= 1 ? 1 : 0.25 }}>
        <Glyph name="person" size={16} color={color} />
        <Text style={t(clamp(s.width * 0.011, 14, 18), '600', color)}>{s.phone ? 'Lead steps in' : 'Zone lead can approve'}</Text>
      </View>
    </View>
  );
}

function Reasons({ s }: { s: Sizes }) {
  const c = useColors();
  const items: { icon: 'clock' | 'radio' | 'phone' | 'bell'; text: string }[] = [
    { icon: 'clock', text: 'On a break' },
    { icon: 'radio', text: 'No signal' },
    { icon: 'phone', text: 'Phone died' },
    { icon: 'bell', text: 'Missed the buzz' },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((x) => (
        <View key={x.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1.5, borderColor: c.grey, paddingHorizontal: 16, paddingVertical: 9 }}>
          <Glyph name={x.icon} size={18} color={c.muted} />
          <Text style={t(clamp(s.width * 0.012, 16, 20), '600', c.muted)}>{x.text}</Text>
        </View>
      ))}
    </View>
  );
}

function Rings({ s }: { s: Sizes }) {
  return (
    <View style={{ flexDirection: 'row', gap: clamp(s.width * 0.04, 24, 64), marginTop: 6 }}>
      <CountdownRing s={s} label="Critical" value="30 s" fillMs={ESC_CRIT} color={FEATURE_RED} />
      <CountdownRing s={s} label="Everything else" value="2 min" fillMs={ESC_OTHER} color={VIOLET} />
    </View>
  );
}

/* --- 3. briefed on the move --- */

const BRIEF_STEP = 2200;
const BRIEF_SAY = [
  'Man collapsed by the water taps. Likely heat. Go now.',
  'He’s red and confused. Priya is with him. Bring water.',
  'Head past the Food Court, then left at the taps. Call 000 if he stops responding.',
];

/** Sam's brief, read into his earpiece: it grows with the walk. */
function BriefMock() {
  const level = useStep(3, BRIEF_STEP);
  const now = useNow(90);
  const dist = [70, 400, 900][level];
  const mins = [1, 5, 11][level];
  return (
    <View style={{ flex: 1, paddingTop: 66, paddingHorizontal: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,69,58,0.18)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: FEATURE_RED }} />
        <Text style={t(14, '700', '#FF8A80')}>Critical</Text>
      </View>
      <Text style={[t(32, '800', '#FFFFFF'), { marginTop: 12 }]}>You’re needed</Text>
      <Text style={t(15, '500', IOS_SECONDARY)}>Heat collapse · Water Station</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 14 }}>
        <Text style={[t(46, '800', VIOLET), { fontVariant: ['tabular-nums'] }]}>{dist} m</Text>
        <Text style={t(17, '500', IOS_SECONDARY)}>· {mins} min walk</Text>
      </View>
      <View style={{ marginTop: 16, borderRadius: 22, padding: 16, gap: 12, backgroundColor: IOS_GREY }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={t(13, '700', IOS_SECONDARY, { letterSpacing: 0.4, textTransform: 'uppercase' })}>Your brief</Text>
          <View style={{ backgroundColor: 'rgba(167,139,250,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={t(13, '700', VIOLET)}>{['Short', 'Medium', 'Full'][level]}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' }}>
            <Glyph name="volume" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 32 }}>
            {Array.from({ length: 30 }, (_, i) => (
              <View key={i} style={{ width: 3.5, borderRadius: 2, backgroundColor: VIOLET, height: 4 + 24 * Math.abs(Math.sin(now / 160 + i * 1.7) * Math.sin(now / 410 + i * 0.6)) }} />
            ))}
          </View>
          <Text style={t(13, '600', VIOLET)}>In your ear</Text>
        </View>
        <View style={{ gap: 6 }}>
          {BRIEF_SAY.slice(0, level + 1).map((line) => (
            <Text key={line} style={t(17, '500', '#F2F2F7')}>
              {line}
            </Text>
          ))}
        </View>
      </View>
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 40 }}>
        <PhoneButton title="I’m on my way" />
      </View>
    </View>
  );
}

/** The three brief lengths, lighting up in step with the phone. */
function BriefRows({ s }: { s: Sizes }) {
  const c = useColors();
  const level = useStep(3, BRIEF_STEP);
  const rows = [
    { when: 'Under 100 m', what: 'Short' },
    { when: 'A few minutes away', what: 'Medium' },
    { when: 'A longer walk', what: 'Full' },
  ];
  return (
    <View style={{ gap: 12, alignSelf: 'stretch', maxWidth: s.phone ? undefined : 640, marginTop: 6 }}>
      {rows.map((r, i) => {
        const on = i === level;
        return (
          <View
            key={r.what}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 999,
              paddingHorizontal: 28,
              minHeight: clamp(s.width * 0.045, 58, 78),
              borderWidth: 2,
              borderColor: on ? c.accent : 'transparent',
              backgroundColor: on ? 'rgba(201,182,242,0.16)' : c.fill,
            }}>
            <Text style={t(clamp(s.width * 0.015, 18, 26), '600', on ? c.ink : c.muted)}>{r.when}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Glyph name="volume" size={20} color={on ? c.accent : c.grey} />
              <Text style={t(clamp(s.width * 0.015, 18, 26), '800', on ? c.accent : c.grey)}>{r.what}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* --- 4. conditions change --- */

const DAY_STEP = 2600;
const DAY = [
  { time: '6 pm', what: 'Headliner on', change: '+4 crowd control', where: 'Lawn Stage', icon: 'music' as const },
  { time: '10 pm', what: 'Bars get busy', change: '+3 security', where: 'Both bars', icon: 'glass' as const },
  { time: 'Any time', what: 'Storm coming', change: 'Crowd help to the gates', where: 'Gates', icon: 'cloud' as const },
];

/** Mo's one-tap moves: the right preset lights up as the evening goes on. */
function MovesMock() {
  const step = useStep(3, DAY_STEP);
  return (
    <View style={{ flex: 1, paddingTop: 66, paddingHorizontal: 18 }}>
      <Text style={t(34, '800', '#FFFFFF')}>Staff</Text>
      <Text style={[t(13, '700', IOS_SECONDARY, { letterSpacing: 0.4, textTransform: 'uppercase' }), { marginTop: 18 }]}>One-tap surges</Text>
      <View style={{ marginTop: 10, gap: 10 }}>
        {DAY.map((d, i) => {
          const on = i === step;
          return (
            <View key={d.time} style={{ borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? 'rgba(139,92,246,0.22)' : IOS_GREY, borderWidth: 1.5, borderColor: on ? VIOLET : 'transparent' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? '#8B5CF6' : IOS_GREY2, alignItems: 'center', justifyContent: 'center' }}>
                <Glyph name={d.icon} size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={t(16, '600', '#FFFFFF')}>{d.what}</Text>
                <Text style={t(14, '500', on ? VIOLET : IOS_SECONDARY)}>
                  {d.change} · {d.where}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ marginTop: 18, borderRadius: 20, padding: 16, gap: 6, backgroundColor: IOS_GREY }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Glyph name="sparkle" size={14} color={VIOLET} />
          <Text style={t(13, '600', VIOLET)}>Who moves</Text>
        </View>
        <Text style={t(16, '500', '#F2F2F7')}>Nearest free people with the right skills, picked for you.</Text>
      </View>
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 40, gap: 10 }}>
        <PhoneButton title="Preview changes" tone="grey" />
        <PhoneButton title="Approve the moves" icon="check" />
      </View>
    </View>
  );
}

/** An evening at the festival, left to right: what changes, and what Mo sends. */
function DayTimeline({ s }: { s: Sizes }) {
  const c = useColors();
  const step = useStep(3, DAY_STEP);
  return (
    <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
      <View style={{ flexDirection: s.phone ? 'column' : 'row', gap: 20 }}>
        {DAY.map((d, i) => {
          const on = i === step;
          return (
            <View key={d.time} style={{ flex: s.phone ? undefined : 1, gap: 10 }}>
              {/* The line runs from this circle's edge to the next one's, lit once the evening has passed it. */}
              {!s.phone && i < DAY.length - 1 && (
                <View style={{ position: 'absolute', left: 34, right: -14, top: 12, height: 4, borderRadius: 2, backgroundColor: i < step ? c.accent : c.fill }} />
              )}
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: on ? c.accent : c.bg, borderWidth: 3, borderColor: i <= step ? c.accent : c.grey }} />
              <Text style={t(clamp(s.width * 0.024, 26, 40), '800', on ? c.accent : c.ink)}>{d.time}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Glyph name={d.icon} size={20} color={c.muted} />
                <Text style={t(clamp(s.width * 0.014, 18, 24), '600', c.ink)}>{d.what}</Text>
              </View>
              <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: on ? 'rgba(201,182,242,0.18)' : c.fill }}>
                <Text style={t(clamp(s.width * 0.011, 15, 19), '700', on ? c.accent : c.muted)}>{d.change}</Text>
              </View>
            </View>
          );
        })}
      </View>
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
  /** Put the aside on the left on wide screens. */
  asideFirst?: boolean;
  /** Lines that animate themselves (cards) aren't wrapped again. */
  raw?: number[];
  /** Fills the whole slide, edge to edge, instead of lines (the launch film). */
  full?: (s: Sizes) => ReactNode;
}

const SLIDES: Slide[] = [
  /* ===== Opening ===== */
  {
    theme: 'ink',
    notes:
      'Astroworld. Manchester Arena. Itaewon. Every inquiry after an accident ends the same way: with a list of ‘what ifs’. Our job at Offscript is to make sure Riverside never has to write one.',
    lines: (s) => [
      <Extrude key="h" px={s.h}>
        Astroworld.{'\n'}Manchester Arena.{'\n'}Itaewon.
      </Extrude>,
      <View key="gap" style={{ height: clamp(s.height * 0.015, 6, 18) }} />,
      <Big key="b" s={s} size="h2" max={0.78}>
        Every inquiry after an accident ends the same way: <Grey>with a list of ‘what ifs’.</Grey>
      </Big>,
      <Muted key="m" s={s} max={0.8}>
        Our job at <OffscriptWord s={s} /> is to make sure{'\n'}Riverside never has to write one.
      </Muted>,
    ],
  },
  {
    theme: 'char',
    notes:
      'This isn’t hypothetical. Astroworld, 2021: ten people died, and Texas’s concert safety task force named poor communication as a key factor; firefighters outside weren’t on the same radio as the event’s medics. Manchester Arena, 2017: 22 people were killed, and the inquiry said the emergency response was far below the standard it should have been; better coordination might have saved one, possibly two lives. Itaewon, 2022: 159 people died in a crowd crush, and police had received at least 11 emergency calls warning of it, the first almost four hours before. Three different events, the same breakdown.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        Three disasters. <Grey>Every inquiry found the response broke down.</Grey>
      </Big>,
      <Inquiries key="stats" s={s} />,
      <Source key="src" s={s}>
        Texas Task Force on Concert Safety, via KERA News (2022); Manchester Arena Inquiry, Volume 2 (2022); Korean National Police Agency call records, via Korea JoongAng Daily (2022).
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
  /* ===== What it does ===== */
  {
    theme: 'plum',
    notes:
      'Incidents get duplicated, especially big, visible ones like fights. Mo shouldn’t be overwhelmed. Ground Control tells him when reports might be the same thing, using AI that looks at when each was logged, where, and what was described. He merges them in one tap, or keeps them apart.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.5}>
        Big incidents get reported twice.{'\n'}
        <Grey>Mo sees one.</Grey>
      </Big>,
      <SpotsBlock key="spots" s={s} />,
    ],
    aside: (s) => (
      <PhoneMock s={s}>
        <CompareMock />
      </PhoneMock>
    ),
  },
  {
    theme: 'dusk',
    asideFirst: true,
    notes:
      'What if Mo doesn’t respond in time? He might be dealing with something of his own or on a break; wifi and signal cut out; phones die; you don’t feel a buzz in your pocket. So there’s a fallback: the zone’s lead can take over the approval, after 30 seconds for a critical incident and 2 minutes for anything else. This isn’t a quirk of the app, it’s a critical design feature. In every one of these cases people could die, you could be liable for millions, and reputations and future contracts are at risk, not to mention living with it. For Fieldday, a small company with 45,000 people over three days, 300 volunteers and one person at the top, it’s a necessity. And the app is built to be reused at future festivals, where something is certain to go wrong.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.5}>
        What if Mo doesn’t answer?
      </Big>,
      <Reasons key="why" s={s} />,
      <Rings key="rings" s={s} />,
      <Muted key="m" s={s} max={0.5}>
        45,000 people. 300 volunteers. One Mo.
      </Muted>,
    ],
    aside: (s) => (
      <PhoneMock s={s} time="14:02">
        <EscalationMock />
      </PhoneMock>
    ),
  },
  {
    theme: 'plum',
    notes:
      'Walking and reading a brief at the same time doesn’t work. So the AI speaks it into their earpiece, and sizes it to the walk: short if they’re close, longer if they’ve got further to go, so they’re briefed by the time they arrive.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.5}>
        Briefed on the move.
      </Big>,
      <Muted key="m" s={s} max={0.45}>
        Read into their earpiece, sized to the walk.
      </Muted>,
      <BriefRows key="rows" s={s} />,
    ],
    aside: (s) => (
      <PhoneMock s={s} time="14:03">
        <BriefMock />
      </PhoneMock>
    ),
  },
  {
    theme: 'dusk',
    asideFirst: true,
    notes:
      'Conditions change. A popular concert might need more crowd control; the bars need more security as the night goes on; a storm sends everyone to the gates. Mo gets flexible control: one tap moves the right people, and he approves every move.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.5}>
        Conditions change. <Grey>So does the plan.</Grey>
      </Big>,
      <DayTimeline key="day" s={s} />,
      <Muted key="m" s={s} max={0.5}>
        One tap moves the right people. Mo approves every move.
      </Muted>,
    ],
    aside: (s) => (
      <PhoneMock s={s} time="18:00">
        <MovesMock />
      </PhoneMock>
    ),
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
    theme: 'plum',
    notes:
      'Next: pattern-based staffing suggestions that spot rising altercations and recommend security or de-escalation-trained volunteers before things escalate. Real multi-device sync so every phone shares one live picture; today’s demo runs on one device with a role switcher. Proper sign-in and Fieldday rostering integration. Native distribution through TestFlight and Google Play, with offline-first reporting for patchy festival signal. Optional Whisper transcription at scale where the accuracy justifies the cost.',
    lines: (s) => [
      <Big key="h" s={s} size="h2">
        What’s next for Ground Control
      </Big>,
      <CardRow key="top" s={s} from={1} items={[
        { title: 'Spot patterns early', text: 'Rising altercations? Suggest more security or de-escalation-trained crew.' },
        { title: 'One live picture', text: 'Sync every crew member’s phone. Today’s demo uses one device and a role switcher.' },
        { title: 'Sign in. Join the roster.', text: 'Proper sign-in and integration with Fieldday’s rostering.' },
      ]} />,
      <CardRow key="bottom" s={s} from={4} items={[
        { title: 'Built for the field', text: 'TestFlight and Google Play builds, with offline-first reporting for patchy signal.' },
        { title: 'Optional Whisper', text: 'Transcription at scale, where better accuracy is worth the cost.' },
      ]} />,
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
      <Text style={t(s.label, '800', c.ink, { letterSpacing: 1.5 })}>ON AIR</Text>
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
        flexDirection: aside && !s.phone ? (slide.asideFirst ? 'row-reverse' : 'row') : 'column',
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

/* ------------------------------- speaker notes ------------------------------- */

// Notes are editable in the deck (press N). Edits are saved in this browser,
// keyed by the slide's own note, so they stay with the slide if slides move.
const NOTES_KEY = 'pitch-notes-v1';
const noteKeyOf = (slide: Slide) => {
  let h = 5381;
  for (let i = 0; i < slide.notes.length; i++) h = ((h * 33) ^ slide.notes.charCodeAt(i)) >>> 0;
  return h.toString(36);
};
function loadNoteEdits(): Record<string, string> {
  if (!WEB) return {};
  try {
    return JSON.parse(window.localStorage.getItem(NOTES_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function saveNoteEdits(edits: Record<string, string>) {
  if (!WEB) return;
  try {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(edits));
  } catch {
    // Private browsing or storage full: the edit still shows until the page reloads.
  }
}

export default function Pitch() {
  const s = useSizes();
  const [index, setIndex] = useState(() => {
    if (!WEB || typeof window === 'undefined') return 0;
    const n = parseInt(window.location.hash.slice(1), 10);
    return Number.isFinite(n) ? clamp(n - 1, 0, SLIDES.length - 1) : 0;
  });
  const [notes, setNotes] = useState(false);
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>(loadNoteEdits);
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
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) {
        if (e.key === 'Escape') el.blur();
        return;
      }
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <Text style={t(24, '700', '#FFFFFF')}>
                Notes · slide {index + 1} of {SLIDES.length}
              </Text>
              {noteEdits[noteKeyOf(slide)] !== undefined && <Text style={t(15, '700', '#A78BFA')}>Edited</Text>}
              <View style={{ flex: 1 }} />
              {noteEdits[noteKeyOf(slide)] !== undefined && (
                <Pressable
                  onPress={() => {
                    const { [noteKeyOf(slide)]: _, ...rest } = noteEdits;
                    setNoteEdits(rest);
                    saveNoteEdits(rest);
                  }}
                  style={({ hovered }) => ({ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: hovered ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)' })}>
                  <Text style={t(15, '600', '#FFFFFF')}>Reset to original</Text>
                </Pressable>
              )}
              <Text style={t(14, '500', 'rgba(255,255,255,0.5)')}>Saved in this browser · Esc to stop editing · N to hide</Text>
            </View>
            <TextInput
              value={noteEdits[noteKeyOf(slide)] ?? slide.notes}
              onChangeText={(text) => {
                const next = { ...noteEdits, [noteKeyOf(slide)]: text };
                setNoteEdits(next);
                saveNoteEdits(next);
              }}
              multiline
              placeholder="What to say on this slide…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={[t(24, '500', '#FFFFFF', { lineHeight: 34 }), { flex: 1, textAlignVertical: 'top', padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)' }]}
            />
          </View>
        )}
      </Animated.View>
    </ThemeCtx.Provider>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 6 },
  fullBtn: { position: 'absolute', top: 24, right: 24, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  notes: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', padding: 28, gap: 14, backgroundColor: '#1C1C1E' },
});
