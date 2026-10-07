/**
 * The pitch: problem, evidence, solution, live demo, close.
 *
 * Ground Control's own look: Apple's system type, muted solid colour slides
 * (sand, dark plum, dark blue) between off-white and near-black ones, 3D
 * extruded titles, a radio transcript that types itself and cuts out, and a
 * tilted 3D festival map with a responder walking to an incident.
 *
 * Motion: lines tilt up into place in 3D, rise and unblur, one after another;
 * slides tip away the way you're going; chapter openers swing in like a page.
 *
 * Keys: → / space / enter next, ← back, F full screen, N speaker notes.
 * Click the left quarter to go back, anywhere else to go on. Lives at /pitch.
 */
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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

type Theme = 'light' | 'dark' | 'sand' | 'plum' | 'midnight';

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
  sand: { bg: '#D8C7A6', ink: '#1F1C17', grey: '#5E5240', muted: '#3F3729', accent: '#1F1C17', fill: 'rgba(31,28,23,0.08)', depth: '#B8A27C', offscript: '#1F1C17' },
  plum: { bg: '#0E0816', ink: '#F4F1EA', grey: '#BDB2D2', muted: '#DED7E9', accent: '#C9B6F2', fill: 'rgba(244,241,234,0.1)', depth: '#2A1B3F', offscript: '#E3C27A' },
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
const useColors = () => useContext(ThemeCtx);

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

/**
 * One line of a slide. `rise` tilts up from below in 3D while rising and
 * unblurring; `flip` swings in around its vertical axis (for cards).
 * `order` staggers the lines 0.14 s apart.
 */
function Rise({ order, children, center, kind = 'rise' }: { order: number; children: ReactNode; center?: boolean; kind?: 'rise' | 'flip' }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(150 + order * 140, withTiming(1, { duration: 900, easing: EASE })));
  }, [v, order]);
  const style = useAnimatedStyle(() => {
    const p = 1 - v.get();
    return {
      opacity: v.get(),
      transform:
        kind === 'flip'
          ? [{ perspective: 1400 }, { rotateY: `${p * -75}deg` }, { translateX: p * -30 }]
          : [{ perspective: 1200 }, { translateY: p * 40 }, { rotateX: `${p * 32}deg` }],
      ...(WEB ? { filter: `blur(${p * 10}px)` } : {}),
    };
  });
  return (
    <Animated.View style={[{ alignSelf: center ? 'center' : 'stretch', alignItems: center ? 'center' : 'flex-start', transformOrigin: 'center bottom' }, style]}>
      {children}
    </Animated.View>
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
 * underneath, so the title reads as a solid block.
 */
function Extrude({ px, children, center }: { px: number; children: ReactNode; center?: boolean }) {
  const c = useColors();
  const layers = Math.max(4, Math.round(px * 0.06));
  const style = t(px, '800', c.ink, { textAlign: center ? 'center' : 'left' });
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

/** Cards that swing in one after another. */
function FlipCards({ s, from, items }: { s: Sizes; from: number; items: { n?: number; title: string; text: string }[] }) {
  return (
    <View style={{ flexDirection: s.phone ? 'column' : 'row', gap: 20, alignSelf: 'stretch', marginTop: 12 }}>
      {items.map((it, i) => (
        <View key={it.title} style={{ flex: s.phone ? undefined : 1 }}>
          <Rise order={from + i} kind="flip">
            <View style={{ alignSelf: 'stretch' }}>
              <Card s={s} {...it} />
            </View>
          </Rise>
        </View>
      ))}
    </View>
  );
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

/* ---------------------------------- slides ---------------------------------- */

interface Slide {
  theme: Theme;
  center?: boolean;
  /** Chapter openers swing in like a turning page. */
  turn?: boolean;
  hasButton?: boolean;
  notes: string;
  /** Lines that rise in turn. */
  lines: (s: Sizes) => ReactNode[];
  /** Something drawn beside the lines on wide screens (below on phones). */
  aside?: (s: Sizes) => ReactNode;
  /** Lines that animate themselves (cards) aren't wrapped again. */
  raw?: number[];
}

const SLIDES: Slide[] = [
  /* ===== 01 Problem ===== */
  {
    theme: 'light',
    turn: true,
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
    theme: 'sand',
    notes: 'Saturday, 2pm, 38 degrees. The queue at the water station is 40 deep. Someone collapses, and the two first-aiders rostered there never showed up.',
    lines: (s) => [
      <Big key="t" s={s} size="sub">
        Saturday · 2pm
      </Big>,
      <Extrude key="h" px={clamp(s.width * 0.17, 96, 280)}>
        38°C
      </Extrude>,
      <Big key="b" s={s} size="h2" max={0.8}>
        40 people queuing for water. <Grey>Someone collapses. The first-aiders never showed.</Grey>
      </Big>,
    ],
  },
  {
    theme: 'dark',
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
    theme: 'light',
    notes:
      'This isn’t hypothetical. Ten people died at Astroworld in 2021. Texas’s concert safety task force named poor communication as a key factor: firefighters outside weren’t on the same radio as the event’s medics.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        When the radio fails, <Grey>people get hurt.</Grey>
      </Big>,
      <CountUp key="n" to={10} delay={600} style={t(clamp(s.width * 0.13, 72, 200), '800', PALETTE.light.accent)} />,
      <Big key="d" s={s} size="sub" max={0.62}>
        people died at Astroworld in 2021. Medics and firefighters weren’t on the same radio.
      </Big>,
      <Source key="src" s={s}>
        Texas Task Force on Concert Safety report, via KERA News (2022); Pollstar (2021).
      </Source>,
    ],
  },
  {
    theme: 'dark',
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
    theme: 'light',
    notes:
      'And the load is real. A seven-year study of a large music festival found about 12 in every 1,000 people needed medical help, more on hot days. At Riverside’s size, that’s around 180 people a day, all coming in over the radio.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        Every day at Riverside, <Grey>around</Grey>
      </Big>,
      <CountUp key="n" to={180} delay={500} style={t(clamp(s.width * 0.15, 80, 220), '800', PALETTE.light.accent)} />,
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
    turn: true,
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
    theme: 'light',
    notes:
      'Four steps. A volunteer just says what they see. AI writes it up as a clear incident and checks whether someone already reported it. Mo sees the nearest people with the right skills and approves in one tap. Their phone tells them where to go, out loud, while they walk.',
    raw: [1],
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        From radio call to help, <Grey>in four steps.</Grey>
      </Big>,
      <FlipCards
        key="c"
        s={s}
        from={1}
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
    theme: 'dark',
    notes:
      'The AI does the legwork, but it never acts alone. Mo approves every response and every move. If a critical report gets no answer in 30 seconds, the zone’s location lead can step in, and Mo is told. Every decision is logged with a name.',
    raw: [1],
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        AI does the legwork. <Grey>People make the calls.</Grey>
      </Big>,
      <FlipCards
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
    turn: true,
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
    theme: 'light',
    notes:
      'What we left out, on purpose. No chatbot: Mo needs decisions, not a conversation. No auto-dispatch: AI never sends anyone on its own. No freehand zone drawing: preset zones Mo can adjust are faster on the day.',
    raw: [1],
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        What we left out, <Grey>on purpose.</Grey>
      </Big>,
      <FlipCards
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
    theme: 'dark',
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

  // Leaving: the slide tips away in 3D the way you're going, fading and blurring.
  const leave = useSharedValue(0);
  const dir = useSharedValue(1);
  const busy = useSharedValue(false);
  // Chapter openers swing in like a turning page.
  const turn = useSharedValue(1);
  useEffect(() => {
    if (!SLIDES[index].turn) return;
    turn.set(0);
    turn.set(withTiming(1, { duration: 1000, easing: EASE }));
  }, [index, turn]);
  const sectionStyle = useAnimatedStyle(() => {
    const p = leave.get();
    const q = 1 - turn.get();
    return {
      opacity: 1 - p,
      transform: [
        { perspective: 1600 },
        { translateY: p * (dir.get() > 0 ? -40 : 40) },
        { rotateX: `${p * (dir.get() > 0 ? 16 : -16)}deg` },
        { rotateY: `${q * 55}deg` },
        { scale: 1 - p * 0.05 },
      ],
      ...(WEB ? { filter: `blur(${p * 8}px)` } : {}),
    };
  });

  // The background eases from the last slide's colour to this one's.
  const bgFrom = useSharedValue(colors.bg);
  const bgTo = useSharedValue(colors.bg);
  const bgP = useSharedValue(1);
  const lastBg = useRef(colors.bg);
  useEffect(() => {
    bgFrom.set(lastBg.current);
    bgTo.set(colors.bg);
    bgP.set(0);
    bgP.set(withTiming(1, { duration: 550, easing: EASE }));
    lastBg.current = colors.bg;
  }, [colors.bg, bgFrom, bgTo, bgP]);
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(bgP.get(), [0, 1], [bgFrom.get(), bgTo.get()]) }));

  // Progress line.
  const progress = useSharedValue((index + 1) / SLIDES.length);
  useEffect(() => {
    progress.set(withTiming((index + 1) / SLIDES.length, { duration: 500, easing: EASE }));
  }, [index, progress]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  const go = (delta: number) => {
    const next = clamp(index + delta, 0, SLIDES.length - 1);
    if (next === index || busy.get()) return;
    busy.set(true);
    dir.set(delta);
    leave.set(withTiming(1, { duration: 280, easing: EASE }));
    setTimeout(() => {
      setIndex(next);
      leave.set(0);
      busy.set(false);
    }, 290);
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  const lines = slide.lines(s).map((line, i) =>
    slide.raw?.includes(i) ? (
      <View key={`${index}-${i}`} style={{ alignSelf: 'stretch' }}>
        {line}
      </View>
    ) : (
      <Rise key={`${index}-${i}`} order={i} center={slide.center}>
        {line}
      </Rise>
    ),
  );
  const aside = slide.aside?.(s);

  return (
    <ThemeCtx.Provider value={colors}>
      <Animated.View style={[{ flex: 1, overflow: 'hidden' }, bgStyle]}>
        <GestureDetector gesture={Gesture.Race(swipe, tap)}>
          <Animated.View
            style={[
              {
                flex: 1,
                paddingHorizontal: s.pad,
                paddingVertical: 56,
                flexDirection: aside && !s.phone ? 'row' : 'column',
                alignItems: aside && !s.phone ? 'center' : slide.center ? 'center' : 'flex-start',
                justifyContent: 'center',
                gap: aside ? 32 : 0,
              },
              sectionStyle,
            ]}>
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
            {aside && (
              <Rise order={lines.length} center>
                {aside}
              </Rise>
            )}
          </Animated.View>
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

        <View pointerEvents="none" style={styles.track}>
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
