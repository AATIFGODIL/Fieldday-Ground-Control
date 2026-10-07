/**
 * The pitch, as a keynote: one idea per slide, Apple's system type, big and
 * calm. Arrow keys, swipe, or the buttons to move. Lives at /pitch.
 */
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Glyph } from '@/components/ui/glyph';
import { EASE_OUT } from '@/constants/motion';

/* ----------------------------- look and type ----------------------------- */

const INK = '#F5F5F7';
const SOFT = '#A1A1A6';
const BG = '#000000';
const C = {
  blue: '#2F6BFF',
  violet: '#A259FF',
  orange: '#FF9F0A',
  pink: '#FF375F',
  green: '#30D158',
  teal: '#40C8E0',
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
    pad: clamp(width * 0.07, 24, 128),
  };
}
type Sizes = ReturnType<typeof useSizes>;

/* ------------------------------- building blocks ------------------------------- */

function Eyebrow({ s, color, children }: { s: Sizes; color: string; children: ReactNode }) {
  return <Text style={{ fontFamily: APPLE, color, fontSize: s.label * 1.1, fontWeight: '600', letterSpacing: 0.2 }}>{children}</Text>;
}

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

/** A word in colour. */
const Hi = ({ c, children }: { c: string; children: ReactNode }) => <Text style={{ color: c }}>{children}</Text>;

function Offscript({ s, size }: { s: Sizes; size: number }) {
  return (
    <Text style={{ fontFamily: APPLE, color: INK, fontSize: size, fontWeight: '500', letterSpacing: -size * 0.01 }}>
      A project by{' '}
      <Text style={[OFFSCRIPT, { color: C.orange, fontSize: size * 1.25, letterSpacing: 0 }]}>Offscript</Text>
    </Text>
  );
}

function Panel({ children, s, accent }: { children: ReactNode; s: Sizes; accent?: string }) {
  return (
    <View
      style={{
        flex: s.phone ? undefined : 1,
        borderRadius: 28,
        padding: clamp(s.width * 0.02, 20, 36),
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: accent ? `${accent}66` : 'rgba(255,255,255,0.1)',
      }}>
      {children}
    </View>
  );
}

const PanelTitle = ({ s, c, children }: { s: Sizes; c?: string; children: ReactNode }) => (
  <Text style={{ fontFamily: APPLE, color: c ?? INK, fontSize: s.lead, fontWeight: '700', letterSpacing: -s.lead * 0.015 }}>{children}</Text>
);
const PanelText = ({ s, children }: { s: Sizes; children: ReactNode }) => (
  <Text style={{ fontFamily: APPLE, color: SOFT, fontSize: s.body, lineHeight: s.body * 1.4, fontWeight: '500' }}>{children}</Text>
);

function Row({ s, children }: { s: Sizes; children: ReactNode }) {
  return <View style={{ flexDirection: s.phone ? 'column' : 'row', gap: clamp(s.width * 0.012, 12, 24), alignSelf: 'stretch' }}>{children}</View>;
}

/* ---------------------------------- slides ---------------------------------- */

interface Slide {
  id: string;
  chapter?: string;
  accent: string;
  center?: boolean;
  render: (s: Sizes) => ReactNode;
}

const SLIDES: Slide[] = [
  {
    id: 'cover',
    accent: C.blue,
    center: true,
    render: (s) => (
      <>
        <Eyebrow s={s} color={C.blue}>
          Fieldday · Riverside
        </Eyebrow>
        <Head s={s} size="giant" center>
          Ground Control.
        </Head>
        <Lead s={s} center>
          Every call heard. <Hi c={INK}>Every decision human.</Hi>
        </Lead>
        <Text style={{ fontFamily: APPLE, color: SOFT, fontSize: s.label, fontWeight: '600', marginTop: 12 }}>Track 3 · Crew and safety operations</Text>
      </>
    ),
  },
  {
    id: 'moment',
    chapter: '01 · The moment',
    accent: C.orange,
    render: (s) => (
      <>
        <Head s={s} size="giant">
          Saturday. 2pm. <Hi c={C.orange}>38°C.</Hi>
        </Head>
        <Lead s={s}>A man collapses at the water station. The two first-aiders rostered there never turned up.</Lead>
      </>
    ),
  },
  {
    id: 'problem',
    chapter: '01 · The problem',
    accent: C.pink,
    render: (s) => (
      <>
        <Head s={s} size="title">
          Radio calls <Hi c={C.pink}>disappear.</Hi>
        </Head>
        <Lead s={s}>
          Reports come in short, noisy and full of jargon, and they’re gone once they’re said. Mo, the safety lead, is on foot with an earpiece and a
          phone in a pocket.
        </Lead>
      </>
    ),
  },
  {
    id: 'scale',
    chapter: '01 · The problem',
    accent: C.teal,
    render: (s) => (
      <>
        <Head s={s} size="title">
          Too much for one person to hold.
        </Head>
        <Row s={s}>
          {[
            ['300', 'volunteers across the site', C.teal],
            ['15,000', 'people a day, for three days', C.blue],
            ['1', 'safety lead: Mo', C.orange],
          ].map(([n, label, color]) => (
            <Panel key={n} s={s} accent={color}>
              <Text style={{ fontFamily: APPLE, color, fontSize: s.title, fontWeight: '700', letterSpacing: -s.title * 0.03 }}>{n}</Text>
              <PanelText s={s}>{label}</PanelText>
            </Panel>
          ))}
        </Row>
      </>
    ),
  },
  {
    id: 'solution',
    chapter: '02 · The solution',
    accent: C.violet,
    render: (s) => (
      <>
        <Head s={s} size="giant">
          Ground Control.
        </Head>
        <Offscript s={s} size={s.lead * 1.15} />
        <Lead s={s}>
          Volunteers say what they see. <Hi c={C.violet}>AI writes it up</Hi> and finds the right person. <Hi c={INK}>Mo decides.</Hi> Help arrives,
          already briefed.
        </Lead>
      </>
    ),
  },
  {
    id: 'how',
    chapter: '02 · How it works',
    accent: C.blue,
    render: (s) => (
      <>
        <Head s={s} size="title">
          Four steps from radio call to help.
        </Head>
        <Row s={s}>
          {[
            ['1', 'Speak', 'A volunteer just talks. No forms.', C.blue],
            ['2', 'Structure', 'AI turns it into a clear report.', C.violet],
            ['3', 'Approve', 'Mo sees who’s closest and taps once.', C.green],
            ['4', 'Go', 'Their phone says where to go, out loud.', C.orange],
          ].map(([n, t, d, color]) => (
            <Panel key={n} s={s} accent={color}>
              <Text style={{ fontFamily: APPLE, color, fontSize: s.lead * 1.3, fontWeight: '800' }}>{n}</Text>
              <PanelTitle s={s}>{t}</PanelTitle>
              <PanelText s={s}>{d}</PanelText>
            </Panel>
          ))}
        </Row>
      </>
    ),
  },
  {
    id: 'ai',
    chapter: '03 · Use of AI',
    accent: C.violet,
    render: (s) => (
      <>
        <Head s={s} size="title">
          <Hi c={C.violet}>AI does the legwork.</Hi> People make the calls.
        </Head>
        <View style={{ gap: clamp(s.width * 0.01, 10, 18) }}>
          {[
            'Writes up voice reports in plain language',
            'Suggests who to send, by distance and skill',
            'Flags reports that may be the same incident',
            'Briefs responders out loud, sized to their walk',
            'Turns “more de-escalation at the Lawn Stage” into a plan',
          ].map((line) => (
            <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Glyph name="sparkle" size={s.body * 1.2} color={C.violet} />
              <Text style={{ fontFamily: APPLE, color: INK, fontSize: s.lead, fontWeight: '600', letterSpacing: -s.lead * 0.012, flexShrink: 1 }}>{line}</Text>
            </View>
          ))}
        </View>
      </>
    ),
  },
  {
    id: 'control',
    chapter: '03 · A person always decides',
    accent: C.green,
    render: (s) => (
      <>
        <Head s={s} size="title">
          Nothing moves without <Hi c={C.green}>a name on it.</Hi>
        </Head>
        <Row s={s}>
          <Panel s={s} accent={C.green}>
            <PanelTitle s={s} c={C.green}>
              Mo approves
            </PanelTitle>
            <PanelText s={s}>Every response, and every change to who stands where.</PanelText>
          </Panel>
          <Panel s={s} accent={C.blue}>
            <PanelTitle s={s} c={C.blue}>
              Leads step in
            </PanelTitle>
            <PanelText s={s}>Critical and no answer in 30 seconds? The zone’s lead can approve.</PanelText>
          </Panel>
          <Panel s={s} accent={C.orange}>
            <PanelTitle s={s} c={C.orange}>
              Everything logged
            </PanelTitle>
            <PanelText s={s}>Who decided, what was sent, and when.</PanelText>
          </Panel>
        </Row>
      </>
    ),
  },
  {
    id: 'brief',
    chapter: '04 · Built for the moment',
    accent: C.orange,
    render: (s) => (
      <>
        <Head s={s} size="title">
          A brief that <Hi c={C.orange}>fits the walk.</Hi>
        </Head>
        <View style={{ gap: 0, alignSelf: 'stretch', maxWidth: s.phone ? undefined : s.width * 0.75 }}>
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
                borderColor: 'rgba(255,255,255,0.12)',
              }}>
              <Text style={{ fontFamily: APPLE, color: C.orange, fontSize: s.lead, fontWeight: '700', width: s.phone ? undefined : s.lead * 7.5 }}>{d}</Text>
              <Text style={{ fontFamily: APPLE, color: INK, fontSize: s.lead, fontWeight: '500', flexShrink: 1 }}>{what}</Text>
            </View>
          ))}
        </View>
      </>
    ),
  },
  {
    id: 'duplicates',
    chapter: '04 · Built for the moment',
    accent: C.pink,
    render: (s) => (
      <>
        <Head s={s} size="title">
          Two reports. <Hi c={C.pink}>One fight.</Hi> One response.
        </Head>
        <Lead s={s}>
          Reports that sound alike, close in time and place, are linked. Mo compares them side by side before anyone is sent, so no fight gets two teams.
        </Lead>
      </>
    ),
  },
  {
    id: 'staffing',
    chapter: '04 · Built for the moment',
    accent: C.teal,
    render: (s) => (
      <>
        <Head s={s} size="title">
          Move <Hi c={C.teal}>skills</Hi>, not just people.
        </Head>
        <Lead s={s}>
          Concert at the Lawn Stage? One tap asks for more de-escalation there. Or just say it. Mo approves who moves, and no zone is left short.
        </Lead>
      </>
    ),
  },
  {
    id: 'design',
    chapter: '04 · Built for the moment',
    accent: C.blue,
    render: (s) => (
      <>
        <Head s={s} size="title">
          Big type. One tap. <Hi c={C.blue}>Readable in the sun.</Hi>
        </Head>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {[
            ['Nothing under 17 pt', C.blue],
            ['Royal blue for actions', C.blue],
            ['Violet means AI wrote it', C.violet],
            ['Liquid Glass on iPhone', C.teal],
            ['Guided demo built in', C.orange],
          ].map(([label, color]) => (
            <View key={label} style={{ borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, backgroundColor: `${color}26`, borderWidth: 1, borderColor: `${color}80` }}>
              <Text style={{ fontFamily: APPLE, color: INK, fontSize: s.body, fontWeight: '600' }}>{label}</Text>
            </View>
          ))}
        </View>
      </>
    ),
  },
  {
    id: 'leftout',
    chapter: '05 · What we left out',
    accent: C.teal,
    render: (s) => (
      <>
        <Head s={s} size="title">
          What we left out, <Hi c={C.teal}>on purpose.</Hi>
        </Head>
        <Row s={s}>
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
        </Row>
      </>
    ),
  },
  {
    id: 'close',
    accent: C.violet,
    center: true,
    render: (s) => (
      <>
        <Head s={s} size="giant" center>
          Ground Control.
        </Head>
        <Lead s={s} center>
          Every call heard. <Hi c={INK}>Every decision human.</Hi>
        </Lead>
        <Offscript s={s} size={s.lead * 1.1} />
        <Pressable
          onPress={() => router.push('/')}
          style={({ pressed }) => ({
            marginTop: 16,
            borderRadius: 999,
            paddingHorizontal: 32,
            paddingVertical: 16,
            backgroundColor: C.blue,
            opacity: pressed ? 0.85 : 1,
          })}>
          <Text style={{ fontFamily: APPLE, color: '#FFFFFF', fontSize: s.body, fontWeight: '700' }}>Open the app</Text>
        </Pressable>
      </>
    ),
  },
];

/* ------------------------------------ page ------------------------------------ */

export default function Pitch() {
  const s = useSizes();
  const [i, setI] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return 0;
    const n = parseInt(window.location.hash.slice(1), 10);
    return Number.isFinite(n) ? clamp(n - 1, 0, SLIDES.length - 1) : 0;
  });
  const slide = SLIDES[i];

  const go = (next: number) => setI(clamp(next, 0, SLIDES.length - 1));

  // Keep the address in step (/pitch#3) and load Offscript's face on the web.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    window.history.replaceState(null, '', `#${i + 1}`);
  }, [i]);
  useEffect(() => {
    if (Platform.OS !== 'web' || document.getElementById('offscript-face')) return;
    const link = document.createElement('link');
    link.id = 'offscript-face';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,900&display=swap';
    document.head.appendChild(link);
  }, []);

  // Arrow keys, space and page keys, like a keynote.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        setI((n) => clamp(n + 1, 0, SLIDES.length - 1));
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        setI((n) => clamp(n - 1, 0, SLIDES.length - 1));
      } else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(SLIDES.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Each slide fades in and settles a few pixels up.
  const t = useSharedValue(1);
  useEffect(() => {
    t.set(0);
    t.set(withTiming(1, { duration: 650, easing: EASE_OUT }));
  }, [i, t]);
  const enter = useAnimatedStyle(() => ({ opacity: t.get(), transform: [{ translateY: (1 - t.get()) * 18 }] }));

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-30, 30])
    .onEnd((e) => {
      if (e.translationX < -60) go(i + 1);
      else if (e.translationX > 60) go(i - 1);
    });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <GestureDetector gesture={swipe}>
        <Animated.View
          style={[
            {
              flex: 1,
              paddingHorizontal: s.pad,
              paddingTop: s.pad * 0.8,
              paddingBottom: s.pad * 0.8 + 56,
              justifyContent: 'center',
              alignItems: slide.center ? 'center' : 'flex-start',
              gap: clamp(s.width * 0.02, 18, 40),
            },
            enter,
          ]}>
          {slide.chapter && (
            <Eyebrow s={s} color={slide.accent}>
              {slide.chapter}
            </Eyebrow>
          )}
          {slide.render(s)}
        </Animated.View>
      </GestureDetector>

      {/* Footer: progress, count and arrows. Outside the swipe area so clicks go straight to them. */}
      <View pointerEvents="box-none" style={[styles.footer, { paddingHorizontal: s.pad }]}>
        <Text style={{ fontFamily: APPLE, color: SOFT, fontSize: s.label, fontWeight: '600' }}>Ground Control</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontFamily: APPLE, color: SOFT, fontSize: s.label, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
            {String(i + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
          </Text>
          <Arrow dir="back" disabled={i === 0} onPress={() => go(i - 1)} />
          <Arrow dir="chevron" disabled={i === SLIDES.length - 1} onPress={() => go(i + 1)} />
        </View>
      </View>
      <View style={styles.track}>
        <View style={{ height: 4, width: `${((i + 1) / SLIDES.length) * 100}%`, backgroundColor: slide.accent, borderRadius: 2 }} />
      </View>
    </View>
  );
}

function Arrow({ dir, disabled, onPress }: { dir: 'back' | 'chevron'; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={dir === 'back' ? 'Previous slide' : 'Next slide'}
      style={({ pressed }) => [styles.arrow, { opacity: disabled ? 0.3 : pressed ? 0.7 : 1 }]}>
      <Glyph name={dir} size={22} color={INK} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
});
