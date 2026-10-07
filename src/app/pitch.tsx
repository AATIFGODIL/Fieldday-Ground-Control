/**
 * The pitch: problem, evidence, solution, live demo, close. One idea per
 * slide, Apple's system type, light and dark slides with one quiet accent.
 *
 * Motion follows the Payback deck: each line rises in, unblurs and staggers;
 * the slide leaves in the direction you're going; the background eases
 * between light and dark; numbers count up.
 *
 * Keys: → / space / enter next, ← back, F full screen, N speaker notes.
 * Click the left quarter to go back, anywhere else to go on. Lives at /pitch.
 */
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

/* ----------------------------- look and type ----------------------------- */

type Theme = 'light' | 'dark';

const PALETTE = {
  light: { bg: '#FFFFFF', ink: '#1D1D1F', grey: '#86868B', muted: '#6E6E73', accent: '#0071E3', fill: '#F5F5F7', line: '#D2D2D7' },
  dark: { bg: '#000000', ink: '#F5F5F7', grey: '#86868B', muted: '#A1A1A6', accent: '#2997FF', fill: '#1C1C1E', line: '#2C2C2E' },
};
/** Offscript's own colour (only ever on dark slides). */
const OFFSCRIPT_ORANGE = '#FF9F0A';

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
    phone: width < 700,
    mega: clamp(w * 0.1, 50, 176),
    h: clamp(w * 0.064, 38, 112),
    h2: clamp(w * 0.05, 32, 80),
    sub: clamp(w * 0.026, 22, 44),
    label: clamp(w * 0.0155, 18, 24),
    pad: clamp(width * 0.075, 24, 128),
  };
}
type Sizes = ReturnType<typeof useSizes>;

/** The current slide's colours, for the blocks below. */
const ThemeCtx = createContext(PALETTE.light);
const useColors = () => useContext(ThemeCtx);

/* --------------------------------- motion --------------------------------- */

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

/**
 * One line of a slide: rises, fades and unblurs into place. `order` staggers
 * the lines (0.14 s apart, after 0.15 s), like the Payback deck.
 */
function Rise({ order, children, center }: { order: number; children: ReactNode; center?: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(150 + order * 140, withTiming(1, { duration: 800, easing: EASE })));
  }, [v, order]);
  const style = useAnimatedStyle(() => {
    const t = v.get();
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 36 }],
      ...(WEB ? { filter: `blur(${(1 - t) * 10}px)` } : {}),
    };
  });
  return <Animated.View style={[{ alignSelf: center ? 'center' : 'stretch', alignItems: center ? 'center' : 'flex-start' }, style]}>{children}</Animated.View>;
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
        const t = Math.min((Date.now() - start) / duration, 1);
        setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(tick);
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

const t = (s: Sizes, px: number, weight: TextStyle['fontWeight'], color: string, extra?: TextStyle): TextStyle => ({
  fontFamily: APPLE,
  fontSize: px,
  lineHeight: px * (px > 60 ? 1.04 : px > 36 ? 1.1 : 1.3),
  fontWeight: weight,
  letterSpacing: px > 36 ? -px * 0.028 : -px * 0.01,
  color,
  ...extra,
});

function Section({ s, n, name }: { s: Sizes; n: string; name: string }) {
  const c = useColors();
  return <Text style={t(s, s.label, '700', c.accent, { letterSpacing: 0.4 })}>{`${n} · ${name}`}</Text>;
}

function Big({ s, size, children, max }: { s: Sizes; size: 'mega' | 'h' | 'h2' | 'sub'; children: ReactNode; max?: number }) {
  const c = useColors();
  return (
    <Text style={[t(s, s[size], size === 'sub' ? '600' : '700', c.ink), { maxWidth: s.phone || !max ? undefined : s.width * max }]}>{children}</Text>
  );
}

/** Words in the grey that sits beside white or black. */
function Grey({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.grey }}>{children}</Text>;
}

function Muted({ s, children, max = 0.66 }: { s: Sizes; children: ReactNode; max?: number }) {
  const c = useColors();
  return <Text style={[t(s, s.sub, '600', c.muted), { maxWidth: s.phone ? undefined : s.width * max }]}>{children}</Text>;
}

function Source({ s, children }: { s: Sizes; children: ReactNode }) {
  const c = useColors();
  return <Text style={[t(s, s.label, '500', c.grey), { maxWidth: s.phone ? undefined : s.width * 0.75 }]}>Source: {children}</Text>;
}

function Offscript({ s }: { s: Sizes }) {
  const c = useColors();
  return (
    <Text style={t(s, s.sub, '600', c.ink)}>
      A project by <Text style={[OFFSCRIPT, { color: OFFSCRIPT_ORANGE, fontSize: s.sub * 1.3, letterSpacing: 0 }]}>Offscript</Text>
    </Text>
  );
}

function Card({ s, n, title, text }: { s: Sizes; n?: number; title: string; text: string }) {
  const c = useColors();
  return (
    <View style={{ flex: s.phone ? undefined : 1, borderRadius: 32, padding: clamp(s.width * 0.02, 22, 32), gap: 12, backgroundColor: c.fill }}>
      {n !== undefined && (
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={t(s, 24, '700', '#FFFFFF')}>{n}</Text>
        </View>
      )}
      <Text style={t(s, clamp(s.width * 0.022, 24, 36), '700', c.ink)}>{title}</Text>
      <Text style={t(s, clamp(s.width * 0.016, 20, 26), '500', c.muted)}>{text}</Text>
    </View>
  );
}

function Cards({ s, children }: { s: Sizes; children: ReactNode }) {
  return <View style={{ flexDirection: s.phone ? 'column' : 'row', gap: 20, alignSelf: 'stretch', marginTop: 16 }}>{children}</View>;
}

function CTA({ s, title, onPress }: { s: Sizes; title: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ marginTop: 24, borderRadius: 999, paddingHorizontal: 44, minHeight: 76, justifyContent: 'center', backgroundColor: c.accent, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Text style={t(s, clamp(s.width * 0.02, 22, 32), '700', '#FFFFFF')}>{title}</Text>
    </Pressable>
  );
}

/* ---------------------------------- slides ---------------------------------- */

interface Slide {
  theme: Theme;
  center?: boolean;
  /** Slides with a button don't advance on click (so the button gets it). */
  hasButton?: boolean;
  notes: string;
  /** Each entry is one line that rises in turn. */
  lines: (s: Sizes) => ReactNode[];
}

const SLIDES: Slide[] = [
  /* ===== 01 Problem ===== */
  {
    theme: 'light',
    notes: 'Imagine you’re Mo, the safety lead at Riverside.',
    lines: (s) => [
      <Section key="sec" s={s} n="01" name="Problem" />,
      <Big key="h" s={s} size="mega" max={0.85}>
        Imagine you’re Mo.
      </Big>,
      <Muted key="m" s={s}>
        Safety lead at Riverside. 15,000 people a day. 300 volunteers. One radio earpiece.
      </Muted>,
    ],
  },
  {
    theme: 'light',
    notes: 'Saturday, 2pm, 38 degrees. A call comes in: someone has collapsed at the water station. The two first-aiders rostered there never showed up.',
    lines: (s) => [
      <Big key="a" s={s} size="h">
        2pm. <Grey>Saturday.</Grey>
      </Big>,
      <Big key="b" s={s} size="h">
        38°C. <Grey>40 people queuing for water.</Grey>
      </Big>,
      <Big key="c" s={s} size="h">
        Someone collapses. <Grey>The first-aiders never showed.</Grey>
      </Big>,
    ],
  },
  {
    theme: 'dark',
    notes: 'The call lasts a few seconds over a noisy radio, and then it’s gone. Who’s closest? Who’s trained? Has someone already reported it? Mo has to work it out on foot, from memory.',
    lines: (s) => [
      <Muted key="m" s={s}>
        The call lasts seconds. Then:
      </Muted>,
      <Big key="h" s={s} size="h" max={0.8}>
        “Who’s closest? Who’s trained? Did anyone else call it in?”
      </Big>,
    ],
  },
  {
    theme: 'light',
    notes:
      'This isn’t hypothetical. Ten people died at Astroworld in 2021. Texas’s concert safety task force named poor communication as a key factor: firefighters outside weren’t on the same radio as the event’s medics, they were given phone numbers instead.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        When the radio fails, <Grey>people get hurt.</Grey>
      </Big>,
      <View key="n" style={{ gap: 8, marginTop: 16 }}>
        <CountUp to={10} delay={600} style={t(s, clamp(s.width * 0.11, 64, 168), '700', PALETTE.light.accent)} />
        <Text style={[t(s, s.sub, '600', PALETTE.light.ink), { maxWidth: s.phone ? undefined : s.width * 0.6 }]}>
          people died at Astroworld in 2021. Medics and firefighters weren’t on the same radio.
        </Text>
      </View>,
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
      <Big key="h" s={s} size="h" max={0.8}>
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
      <CountUp key="n" to={180} delay={500} style={t(s, clamp(s.width * 0.13, 72, 200), '700', PALETTE.light.accent)} />,
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
    theme: 'dark',
    notes: 'So we built Ground Control.',
    lines: (s) => [
      <Section key="sec" s={s} n="02" name="Solution" />,
      <Muted key="meet" s={s}>
        Meet
      </Muted>,
      <Big key="h" s={s} size="mega">
        Ground Control<Text style={{ color: PALETTE.dark.accent }}>.</Text>
      </Big>,
      <Offscript key="o" s={s} />,
      <Big key="tag" s={s} size="sub">
        Every call heard. Every decision human.
      </Big>,
    ],
  },
  {
    theme: 'light',
    notes:
      'Four steps. A volunteer just says what they see. AI writes it up as a clear incident and checks whether someone already reported it. Mo sees the nearest people with the right skills and approves in one tap. Their phone tells them where to go, out loud, while they walk.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        From radio call to help, <Grey>in four steps.</Grey>
      </Big>,
      <Cards key="c" s={s}>
        <Card s={s} n={1} title="Say it" text="A volunteer just talks. No forms." />
        <Card s={s} n={2} title="AI writes it up" text="A clear report, checked for duplicates." />
        <Card s={s} n={3} title="Mo approves" text="The nearest people with the right skills." />
        <Card s={s} n={4} title="Help arrives" text="Their phone says where to go, out loud." />
      </Cards>,
    ],
  },
  {
    theme: 'light',
    notes:
      'The AI does the legwork, but it never acts alone. Mo approves every response and every move. If a critical report gets no answer in 30 seconds, the zone’s location lead can step in, and Mo is told. Every decision is logged with a name.',
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        AI does the legwork. <Grey>People make the calls.</Grey>
      </Big>,
      <Cards key="c" s={s}>
        <Card s={s} title="Mo approves" text="Every response, and every change to who stands where." />
        <Card s={s} title="Leads step in" text="Critical with no answer in 30 seconds? The zone’s lead can approve." />
        <Card s={s} title="Everything logged" text="Who decided, what was sent, and when." />
      </Cards>,
    ],
  },

  /* ===== 03 Build ===== */
  {
    theme: 'dark',
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
      <Section key="sec" s={s} n="03" name="Build" />,
      <Big key="h" s={s} size="mega">
        Live demo
      </Big>,
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
    lines: (s) => [
      <Big key="h" s={s} size="h2" max={0.8}>
        What we left out, <Grey>on purpose.</Grey>
      </Big>,
      <Cards key="c" s={s}>
        <Card s={s} title="A chatbot" text="Mo needs decisions, not a conversation." />
        <Card s={s} title="Auto-dispatch" text="AI never sends anyone on its own." />
        <Card s={s} title="Freehand zones" text="Preset zones Mo can adjust are faster on the day." />
      </Cards>,
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
      <Big key="h" s={s} size="mega">
        Ground Control<Text style={{ color: PALETTE.dark.accent }}>.</Text>
      </Big>,
      <Offscript key="o" s={s} />,
    ],
  },
];

/* ------------------------------------ deck ------------------------------------ */

export default function Pitch() {
  const s = useSizes();
  const [index, setIndex] = useState(() => {
    if (!WEB || typeof window === 'undefined') return 0;
    const n = parseInt(window.location.hash.slice(1), 10);
    return Number.isFinite(n) ? clamp(n - 1, 0, SLIDES.length - 1) : 0;
  });
  const [notes, setNotes] = useState(false);
  const slide = SLIDES[index];
  const colors = PALETTE[slide.theme];

  // Leaving: the slide drifts the way you're going, fades and blurs, then the next one rises in.
  const leave = useSharedValue(0);
  const dir = useSharedValue(1);
  const busy = useSharedValue(false);
  const sectionStyle = useAnimatedStyle(() => {
    const p = leave.get();
    return {
      opacity: 1 - p,
      transform: [{ translateY: p * (dir.get() > 0 ? -24 : 24) }],
      ...(WEB ? { filter: `blur(${p * 8}px)` } : {}),
    };
  });

  // The background eases between light and dark slides.
  const dark = useSharedValue(slide.theme === 'dark' ? 1 : 0);
  useEffect(() => {
    dark.set(withTiming(slide.theme === 'dark' ? 1 : 0, { duration: 500 }));
  }, [slide.theme, dark]);
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(dark.get(), [0, 1], [PALETTE.light.bg, PALETTE.dark.bg]) }));

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
    leave.set(withTiming(1, { duration: 250, easing: EASE }));
    setTimeout(() => {
      setIndex(next);
      leave.set(0);
      busy.set(false);
    }, 260);
  };

  // Keep the slide in the address (/pitch#10), so Back from the demo returns here.
  useEffect(() => {
    if (WEB) window.history.replaceState(null, '', `#${index + 1}`);
  }, [index]);

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
                justifyContent: 'center',
                alignItems: slide.center ? 'center' : 'flex-start',
                gap: clamp(s.width * 0.016, 14, 28),
              },
              sectionStyle,
            ]}>
            {slide.lines(s).map((line, i) => (
              <Rise key={`${index}-${i}`} order={i} center={slide.center}>
                {line}
              </Rise>
            ))}
          </Animated.View>
        </GestureDetector>

        <View pointerEvents="none" style={styles.track}>
          <Animated.View style={[{ height: 6, backgroundColor: colors.accent }, barStyle]} />
        </View>

        {notes && (
          <View style={styles.notes}>
            <ScrollView contentContainerStyle={{ padding: 32, gap: 12 }}>
              <Text style={t(s, 24, '700', '#FFFFFF')}>
                Notes · slide {index + 1} of {SLIDES.length}
              </Text>
              <Text style={t(s, 24, '500', '#FFFFFF', { lineHeight: 34 })}>{slide.notes}</Text>
            </ScrollView>
          </View>
        )}
      </Animated.View>
    </ThemeCtx.Provider>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 6 },
  notes: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '50%', backgroundColor: '#1C1C1E' },
});
