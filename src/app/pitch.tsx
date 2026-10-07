/**
 * The pitch, as a keynote: hook, problem, evidence, solution, how it works.
 * Apple's system type, white on black, one quiet accent. Arrow keys, space or
 * swipe to move. Lives at /pitch.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Glyph } from '@/components/ui/glyph';
import { EASE_OUT } from '@/constants/motion';

/* ----------------------------- look and type ----------------------------- */

const BG = '#000000';
const INK = '#F5F5F7';
const SOFT = '#A1A1A6';
const FAINT = '#86868B';
/** The one accent, used sparingly: a word or a number per slide at most. */
const BLUE = '#2997FF';
/** Offscript's own colour. */
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

function useSizes() {
  const { width, height } = useWindowDimensions();
  const w = Math.min(width, height * 1.9);
  return {
    width,
    height,
    phone: width < 700,
    giant: clamp(w * 0.088, 46, 140),
    title: clamp(w * 0.06, 34, 96),
    lead: clamp(w * 0.024, 21, 36),
    body: clamp(w * 0.018, 19, 28),
    label: clamp(w * 0.014, 17, 22),
    pad: clamp(width * 0.08, 24, 144),
  };
}
type Sizes = ReturnType<typeof useSizes>;

/* --------------------------------- motion --------------------------------- */

/** One line of a slide: fades in and rises into place, after the lines before it. */
function Reveal({ order, children, center }: { order: number; children: ReactNode; center?: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(120 + order * 140, withTiming(1, { duration: 900, easing: EASE_OUT })));
  }, [v, order]);
  const style = useAnimatedStyle(() => ({
    opacity: v.get(),
    transform: [{ translateY: (1 - v.get()) * 44 }],
  }));
  return <Animated.View style={[{ alignSelf: center ? 'center' : 'stretch', alignItems: center ? 'center' : 'flex-start' }, style]}>{children}</Animated.View>;
}

/* ------------------------------- building blocks ------------------------------- */

const Eyebrow = ({ s, children }: { s: Sizes; children: ReactNode }) => (
  <Text style={{ fontFamily: APPLE, color: SOFT, fontSize: s.label * 1.1, fontWeight: '600', letterSpacing: 0.2 }}>{children}</Text>
);

function Head({ s, size, children, center }: { s: Sizes; size: 'giant' | 'title'; children: ReactNode; center?: boolean }) {
  const px = s[size];
  return (
    <Text
      style={{
        fontFamily: APPLE,
        color: INK,
        fontSize: px,
        lineHeight: px * 1.06,
        fontWeight: '700',
        letterSpacing: -px * 0.028,
        textAlign: center ? 'center' : 'left',
        maxWidth: s.phone ? undefined : s.width * 0.82,
      }}>
      {children}
    </Text>
  );
}

function Lead({ s, children, center, max = 0.62 }: { s: Sizes; children: ReactNode; center?: boolean; max?: number }) {
  return (
    <Text
      style={{
        fontFamily: APPLE,
        color: SOFT,
        fontSize: s.lead,
        lineHeight: s.lead * 1.35,
        fontWeight: '500',
        letterSpacing: -s.lead * 0.01,
        textAlign: center ? 'center' : 'left',
        maxWidth: s.phone ? undefined : s.width * max,
      }}>
      {children}
    </Text>
  );
}

/** Where a number came from. Quiet, but never small. */
const Source = ({ s, children }: { s: Sizes; children: ReactNode }) => (
  <Text style={{ fontFamily: APPLE, color: FAINT, fontSize: s.label, lineHeight: s.label * 1.4, fontWeight: '500', maxWidth: s.phone ? undefined : s.width * 0.7 }}>
    Source: {children}
  </Text>
);

/** A word in white (on grey text) or in the one accent. */
const White = ({ children }: { children: ReactNode }) => <Text style={{ color: INK }}>{children}</Text>;
const Blue = ({ children }: { children: ReactNode }) => <Text style={{ color: BLUE }}>{children}</Text>;

function Offscript({ size }: { size: number }) {
  return (
    <Text style={{ fontFamily: APPLE, color: INK, fontSize: size, fontWeight: '500', letterSpacing: -size * 0.01 }}>
      A project by{' '}
      <Text style={[OFFSCRIPT, { color: OFFSCRIPT_ORANGE, fontSize: size * 1.25, letterSpacing: 0 }]}>Offscript</Text>
    </Text>
  );
}

function Panel({ children, s }: { children: ReactNode; s: Sizes }) {
  return (
    <View style={{ flex: s.phone ? undefined : 1, borderRadius: 28, padding: clamp(s.width * 0.02, 20, 36), gap: 10, backgroundColor: '#1C1C1E' }}>
      {children}
    </View>
  );
}
const PanelTitle = ({ s, children }: { s: Sizes; children: ReactNode }) => (
  <Text style={{ fontFamily: APPLE, color: INK, fontSize: s.lead, fontWeight: '700', letterSpacing: -s.lead * 0.015 }}>{children}</Text>
);
const PanelText = ({ s, children }: { s: Sizes; children: ReactNode }) => (
  <Text style={{ fontFamily: APPLE, color: SOFT, fontSize: s.body, lineHeight: s.body * 1.4, fontWeight: '500' }}>{children}</Text>
);
function Row({ s, children }: { s: Sizes; children: ReactNode }) {
  return <View style={{ flexDirection: s.phone ? 'column' : 'row', gap: clamp(s.width * 0.012, 12, 24), alignSelf: 'stretch' }}>{children}</View>;
}

/** A big figure with what it means underneath. */
function Figure({ s, value, children }: { s: Sizes; value: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: APPLE, color: BLUE, fontSize: s.giant * 1.25, lineHeight: s.giant * 1.25, fontWeight: '700', letterSpacing: -s.giant * 0.04 }}>
        {value}
      </Text>
      <Text
        style={{
          fontFamily: APPLE,
          color: INK,
          fontSize: s.lead * 1.1,
          lineHeight: s.lead * 1.4,
          fontWeight: '600',
          letterSpacing: -s.lead * 0.012,
          maxWidth: s.phone ? undefined : s.width * 0.6,
        }}>
        {children}
      </Text>
    </View>
  );
}

/* ---------------------------------- slides ---------------------------------- */

interface Slide {
  id: string;
  chapter?: string;
  center?: boolean;
  /** Each entry is one line that reveals in turn. */
  lines: (s: Sizes) => ReactNode[];
}

const SLIDES: Slide[] = [
  /* ---------- hook ---------- */
  {
    id: 'hook',
    chapter: '01 · Problem',
    lines: (s) => [
      <Head key="h" s={s} size="giant">
        Imagine you’re Mo.
      </Head>,
      <Lead key="l" s={s}>
        Safety lead at Riverside. Fifteen thousand people a day. Three hundred volunteers. One radio earpiece.
      </Lead>,
    ],
  },
  {
    id: 'moment',
    chapter: '01 · Problem',
    lines: (s) => [
      <Head key="h" s={s} size="giant">
        2pm. <Blue>38°C.</Blue>
      </Head>,
      <Lead key="l" s={s}>
        A call crackles in: someone has collapsed at the water station. The two first-aiders rostered there never showed up.
      </Lead>,
    ],
  },
  {
    id: 'gone',
    chapter: '01 · Problem',
    lines: (s) => [
      <Head key="h" s={s} size="title">
        Then the radio goes quiet.
      </Head>,
      <Lead key="l" s={s}>
        The call lasted seconds and nobody wrote it down. <White>Who’s closest? Who’s trained? Has someone else already reported it?</White> Mo has
        to work it out on foot.
      </Lead>,
    ],
  },

  /* ---------- evidence ---------- */
  {
    id: 'astroworld',
    chapter: '02 · What the record shows',
    lines: (s) => [
      <Figure key="f" s={s} value="10">
        people died at Astroworld in 2021. Texas’s task force named poor communication as a key factor.
      </Figure>,
      <Lead key="l" s={s}>
        Firefighters outside weren’t on the same radio as the event’s medics. They were given phone numbers instead.
      </Lead>,
      <Source key="src" s={s}>
        Texas Task Force on Concert Safety report, via KERA News (2022); Pollstar (2021).
      </Source>,
    ],
  },
  {
    id: 'manchester',
    chapter: '02 · What the record shows',
    lines: (s) => [
      <Head key="h" s={s} size="title">
        “Far below the standard it should have been.”
      </Head>,
      <Lead key="l" s={s}>
        The Manchester Arena Inquiry on the emergency response in 2017. Better coordination and <White>communication</White> might have saved one,
        possibly two lives.
      </Lead>,
      <Source key="src" s={s}>
        Manchester Arena Inquiry, Volume 2 (2022).
      </Source>,
    ],
  },
  {
    id: 'demand',
    chapter: '02 · What the record shows',
    lines: (s) => [
      <Figure key="f" s={s} value="12 in 1,000">
        festival-goers needed medical help, in a seven-year study of one large festival. Hotter days brought more heat cases.
      </Figure>,
      <Lead key="l" s={s}>
        At Riverside’s size, that rate would mean <White>around 180 people a day.</White>
      </Lead>,
      <Source key="src" s={s}>
        Medical care at a mass gathering music festival, 2011–2017 (Wiener klinische Wochenschrift, 2021). Our estimate applies its median rate to
        15,000 people.
      </Source>,
    ],
  },

  /* ---------- solution ---------- */
  {
    id: 'solution',
    chapter: '03 · Solution',
    lines: (s) => [
      <Head key="h" s={s} size="giant">
        Ground Control.
      </Head>,
      <Offscript key="o" size={s.lead * 1.15} />,
      <Lead key="l" s={s}>
        Every call heard. <White>Every decision human.</White>
      </Lead>,
    ],
  },
  {
    id: 'how',
    chapter: '03 · Solution',
    lines: (s) => [
      <Head key="h" s={s} size="title">
        From radio call to help, in four steps.
      </Head>,
      <Row key="r" s={s}>
        {[
          ['Say it', 'A volunteer just talks. No forms.'],
          ['AI writes it up', 'A clear report, checked for duplicates.'],
          ['Mo approves', 'The nearest people with the right skills, one tap.'],
          ['Help arrives', 'Their phone says where to go, out loud.'],
        ].map(([t, d], i) => (
          <Panel key={t} s={s}>
            <Text style={{ fontFamily: APPLE, color: FAINT, fontSize: s.label * 1.1, fontWeight: '700' }}>{i + 1}</Text>
            <PanelTitle s={s}>{t}</PanelTitle>
            <PanelText s={s}>{d}</PanelText>
          </Panel>
        ))}
      </Row>,
    ],
  },

  /* ---------- how it works ---------- */
  {
    id: 'ai',
    chapter: '04 · How it works',
    lines: (s) => [
      <Head key="h" s={s} size="title">
        AI does the legwork. <Blue>People make the calls.</Blue>
      </Head>,
      <View key="list" style={{ gap: clamp(s.width * 0.01, 10, 18) }}>
        {[
          'Writes up voice reports in plain language',
          'Suggests who to send, by distance and skill',
          'Flags reports that may be the same incident',
          'Briefs responders out loud, sized to their walk',
          'Turns “more de-escalation at the Lawn Stage” into a plan',
        ].map((line) => (
          <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Glyph name="check" size={s.body * 1.2} color={SOFT} strokeWidth={2.5} />
            <Text style={{ fontFamily: APPLE, color: INK, fontSize: s.lead, fontWeight: '600', letterSpacing: -s.lead * 0.012, flexShrink: 1 }}>{line}</Text>
          </View>
        ))}
      </View>,
    ],
  },
  {
    id: 'control',
    chapter: '04 · How it works',
    lines: (s) => [
      <Head key="h" s={s} size="title">
        Nothing moves without a name on it.
      </Head>,
      <Row key="r" s={s}>
        <Panel s={s}>
          <PanelTitle s={s}>Mo approves</PanelTitle>
          <PanelText s={s}>Every response, and every change to who stands where.</PanelText>
        </Panel>
        <Panel s={s}>
          <PanelTitle s={s}>Leads step in</PanelTitle>
          <PanelText s={s}>Critical and no answer in 30 seconds? The zone’s lead can approve.</PanelText>
        </Panel>
        <Panel s={s}>
          <PanelTitle s={s}>Everything logged</PanelTitle>
          <PanelText s={s}>Who decided, what was sent, and when.</PanelText>
        </Panel>
      </Row>,
    ],
  },
  {
    id: 'brief',
    chapter: '04 · How it works',
    lines: (s) => [
      <Head key="h" s={s} size="title">
        A brief that fits the walk.
      </Head>,
      <View key="t" style={{ alignSelf: 'stretch', maxWidth: s.phone ? undefined : s.width * 0.75 }}>
        {[
          ['Under 100 m', 'One sentence.'],
          ['100 to 300 m', 'Where to go and what to expect.'],
          ['Over 300 m', 'The full picture, and who to find.'],
        ].map(([d, what], i) => (
          <View
            key={d}
            style={{
              flexDirection: s.phone ? 'column' : 'row',
              gap: s.phone ? 4 : 32,
              paddingVertical: clamp(s.width * 0.012, 14, 22),
              borderTopWidth: i ? 1 : 0,
              borderColor: '#2C2C2E',
            }}>
            <Text style={{ fontFamily: APPLE, color: INK, fontSize: s.lead, fontWeight: '700', width: s.phone ? undefined : s.lead * 7.5 }}>{d}</Text>
            <Text style={{ fontFamily: APPLE, color: SOFT, fontSize: s.lead, fontWeight: '500', flexShrink: 1 }}>{what}</Text>
          </View>
        ))}
      </View>,
    ],
  },
  {
    id: 'duplicates',
    chapter: '04 · How it works',
    lines: (s) => [
      <Head key="h" s={s} size="title">
        Two reports. One fight. <Blue>One response.</Blue>
      </Head>,
      <Lead key="l" s={s}>
        Reports that sound alike, close in time and place, are linked. Mo compares them side by side before anyone is sent.
      </Lead>,
    ],
  },
  {
    id: 'staffing',
    chapter: '04 · How it works',
    lines: (s) => [
      <Head key="h" s={s} size="title">
        Move skills, not just people.
      </Head>,
      <Lead key="l" s={s}>
        Concert at the Lawn Stage? One tap asks for more de-escalation there. Or just say it. <White>Mo approves who moves,</White> and no zone is
        left short.
      </Lead>,
    ],
  },
  {
    id: 'leftout',
    chapter: '05 · Choices',
    lines: (s) => [
      <Head key="h" s={s} size="title">
        What we left out, on purpose.
      </Head>,
      <Row key="r" s={s}>
        {[
          ['A chatbot', 'Mo needs decisions, not a conversation.'],
          ['Auto-dispatch', 'AI never sends anyone on its own.'],
          ['Freehand zones', 'Preset zones Mo can adjust are faster on the day.'],
        ].map(([t, why]) => (
          <Panel key={t} s={s}>
            <PanelTitle s={s}>{t}</PanelTitle>
            <PanelText s={s}>{why}</PanelText>
          </Panel>
        ))}
      </Row>,
    ],
  },
  {
    id: 'close',
    center: true,
    lines: (s) => [
      <Head key="h" s={s} size="giant" center>
        Ground Control.
      </Head>,
      <Lead key="l" s={s} center>
        Every call heard. <White>Every decision human.</White>
      </Lead>,
      <Offscript key="o" size={s.lead * 1.1} />,
      <Pressable
        key="b"
        onPress={() => router.push('/')}
        style={({ pressed }) => ({ marginTop: 16, borderRadius: 999, paddingHorizontal: 32, paddingVertical: 16, backgroundColor: BLUE, opacity: pressed ? 0.85 : 1 })}>
        <Text style={{ fontFamily: APPLE, color: '#FFFFFF', fontSize: s.body, fontWeight: '700' }}>Open the app</Text>
      </Pressable>,
    ],
  },
];

/* ------------------------------------ page ------------------------------------ */

export default function Pitch() {
  const s = useSizes();
  const [shown, setShown] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return 0;
    const n = parseInt(window.location.hash.slice(1), 10);
    return Number.isFinite(n) ? clamp(n - 1, 0, SLIDES.length - 1) : 0;
  });
  const slide = SLIDES[shown];
  const busy = useSharedValue(false);

  // Leaving: the whole slide fades and drifts up, then the next one's lines rise in.
  const out = useSharedValue(1);
  const leaving = useAnimatedStyle(() => ({ opacity: out.get(), transform: [{ translateY: (out.get() - 1) * 30 }] }));

  const go = (delta: number) => {
    const next = clamp(shown + delta, 0, SLIDES.length - 1);
    if (next === shown || busy.get()) return;
    busy.set(true);
    out.set(withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }));
    setTimeout(() => {
      setShown(next);
      out.set(1);
      busy.set(false);
    }, 330);
  };

  // Keep the address in step (/pitch#3) and load Offscript's face on the web.
  useEffect(() => {
    if (Platform.OS === 'web') window.history.replaceState(null, '', `#${shown + 1}`);
  }, [shown]);
  useEffect(() => {
    if (Platform.OS !== 'web' || document.getElementById('offscript-face')) return;
    const link = document.createElement('link');
    link.id = 'offscript-face';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,900&display=swap';
    document.head.appendChild(link);
  }, []);

  // Arrow keys, space and page keys, like a keynote.
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        goRef.current(1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        goRef.current(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-30, 30])
    .onEnd((e) => {
      if (e.translationX < -60) go(1);
      else if (e.translationX > 60) go(-1);
    });
  const tap = Gesture.Tap()
    .runOnJS(true)
    .enabled(slide.id !== 'close')
    .onEnd((e) => go(e.x < s.width * 0.3 ? -1 : 1));

  const lines = [...(slide.chapter ? [<Eyebrow key="eyebrow" s={s}>{slide.chapter}</Eyebrow>] : []), ...slide.lines(s)];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <GestureDetector gesture={Gesture.Race(swipe, tap)}>
        <Animated.View
          style={[
            {
              flex: 1,
              paddingHorizontal: s.pad,
              paddingVertical: s.pad * 0.8,
              justifyContent: 'center',
              alignItems: slide.center ? 'center' : 'flex-start',
              gap: clamp(s.width * 0.02, 18, 40),
            },
            leaving,
          ]}>
          {lines.map((line, i) => (
            <Reveal key={`${slide.id}-${i}`} order={i} center={slide.center}>
              {line}
            </Reveal>
          ))}
        </Animated.View>
      </GestureDetector>
      <View style={styles.track}>
        <View style={{ height: 3, width: `${((shown + 1) / SLIDES.length) * 100}%`, backgroundColor: INK, opacity: 0.7 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: '#1C1C1E' },
});
