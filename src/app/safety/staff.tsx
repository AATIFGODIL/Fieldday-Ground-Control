import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ChangePreview, type PendingChange } from '@/components/staffing/change-preview';
import { Glyph, type GlyphName } from '@/components/ui/glyph';
import { AIWorking } from '@/components/ui/motion';
import { Appear, Button, Card, Header, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { Radius, Spacing, Type } from '@/constants/theme';
import {
  countWith,
  onShiftIn,
  resolveSurge,
  skillName,
  STAFF_SKILLS,
  SURGES,
  targetFor,
  type TargetChange,
} from '@/domain/staffing';
import type { Skill, Zone } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { askStaffing } from '@/state/pipeline';
import { endSurge, formatClock, useStore } from '@/state/store';

const ROWS: (Skill | null)[] = [null, ...STAFF_SKILLS];

let changeCount = 0;
const nextKey = () => (changeCount += 1);

const EXAMPLES = [
  'Headliner at the Lawn Stage soon. More de-escalation there.',
  'Both bars are slammed.',
  'Storm coming, get crowd help to the gates.',
];

/**
 * Mo decides how skills are spread across the site: say it, tap a surge, or
 * nudge numbers per zone. Every route ends at the same card: approve or not.
 */
export default function Staff() {
  const t = useTheme();
  const params = useLocalSearchParams<{ zone?: string }>();
  const festival = useStore((s) => s.festival);
  const volunteers = useStore((s) => s.volunteers);
  const temp = useStore((s) => s.temperatureC);
  const surges = useStore((s) => s.surges);
  const all = Object.values(volunteers);

  const [pending, setPending] = useState<PendingChange | null>(null);
  const [open, setOpen] = useState<string | null>(params.zone ?? null);
  const [handledZone, setHandledZone] = useState<string | undefined>(undefined);

  const propose = (p: Omit<PendingChange, 'key'>) => setPending({ ...p, key: nextKey() });
  // The change shows at the top of the screen, so glide up to it from wherever it was asked for.
  const scroll = useRef<ScrollView>(null);
  const show = (p: Omit<PendingChange, 'key'>) => {
    propose(p);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  // Arriving from "Find cover": open that zone and show who could fill it.
  if (params.zone && params.zone !== handledZone) {
    setHandledZone(params.zone);
    const zone = festival.zones.find((z) => z.id === params.zone);
    if (zone) {
      setOpen(zone.id);
      propose({ title: `Cover ${zone.name}`, note: `${zone.name} is short. Please head over and help.`, source: 'manual', changes: [], zoneIds: [zone.id] });
    }
  }

  const shortBy = (zone: Zone) =>
    ROWS.reduce((n, k) => n + Math.max(0, targetFor(zone, k, temp) - countWith(onShiftIn(zone.id, all), k)), 0);
  const zones = [...festival.zones].sort((a, b) => shortBy(b) - shortBy(a));

  return (
    <Screen tabs scrollRef={scroll}>
      <Header eyebrow="Mo · Safety lead" title="Staff" subtitle="Where each skill is needed, and who can move. Nothing moves until you approve." />

      {pending && (
        <Appear key={pending.key}>
          <ChangePreview change={pending} onDone={() => setPending(null)} />
        </Appear>
      )}

      <AskBox onProposal={show} busy={!!pending} />

      {surges.length > 0 && (
        <Section title="Running now">
          {surges.map((s) => (
            <Card key={s.id} tone="strong">
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={[styles.tile, { backgroundColor: t.accent }]}>
                  <Glyph name={s.source === 'ai' ? 'sparkle' : 'music'} size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="heading">{s.title}</Txt>
                  <Txt variant="caption">
                    Since {formatClock(s.startedAt)} · {s.moves.length} {s.moves.length === 1 ? 'person' : 'people'} moved
                  </Txt>
                </View>
              </Row>
              <Button title="End and send people back" onPress={() => endSurge(s.id, true)} />
              <Button title="End, but keep them there" variant="secondary" onPress={() => endSurge(s.id, false)} />
            </Card>
          ))}
        </Section>
      )}

      <Section title="One-tap surges">
        <View style={styles.grid}>
          {SURGES.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => show({ title: p.title, note: p.note, source: 'preset', changes: resolveSurge(festival, p, temp, all) })}
              style={({ pressed }) => [styles.surge, { backgroundColor: t.backgroundElement, opacity: pressed ? 0.85 : 1 }]}>
              <View style={[styles.tile, { backgroundColor: SURGE_TINT[p.glyph](t) }]}>
                <Glyph name={p.glyph as GlyphName} size={22} color="#FFFFFF" />
              </View>
              <Txt variant="strong">{p.title}</Txt>
              <Txt variant="caption">{p.subtitle}</Txt>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title="Zones">
        {zones.map((z) => (
          <ZoneTargets key={z.id} zone={z} open={open === z.id} onToggle={() => setOpen(open === z.id ? null : z.id)} onProposal={show} />
        ))}
      </Section>
    </Screen>
  );
}

const SURGE_TINT: Record<string, (t: ReturnType<typeof useTheme>) => string> = {
  music: (t) => t.ai,
  glass: (t) => t.high,
  sun: (t) => t.critical,
  cloud: (t) => t.accent,
};

/** "Just say it": a sentence in, a change card out. */
function AskBox({ onProposal, busy }: { onProposal: (p: Omit<PendingChange, 'key'>) => void; busy: boolean }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<TextInput>(null);

  const ask = async () => {
    const said = text.trim();
    if (!said) return;
    setWorking(true);
    setProblem(null);
    const res = await askStaffing(said);
    setWorking(false);
    if (!res.ok) {
      setProblem(res.reason);
      return;
    }
    onProposal({ title: res.title, note: res.note, source: 'ai', changes: res.changes });
    setText('');
  };

  return (
    <Card tone="ai">
      <Row>
        <Glyph name="sparkle" size={18} color={t.ai} />
        <Txt variant="label" color={t.ai}>
          Just say it
        </Txt>
      </Row>
      <View style={[styles.ask, { backgroundColor: t.background, borderColor: t.border }]}>
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          multiline
          placeholder="e.g. More de-escalation at the Lawn Stage for the headliner"
          placeholderTextColor={t.textSecondary}
          style={[Type.body, { flex: 1, color: t.text, minHeight: 56, textAlignVertical: 'top' }]}
        />
        <Pressable
          onPress={() => input.current?.focus()}
          accessibilityLabel="Speak instead (use your keyboard's microphone)"
          style={({ pressed }) => [styles.mic, { backgroundColor: t.ai, opacity: pressed ? 0.85 : 1 }]}>
          <Glyph name="mic" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
      {!text && (
        <View style={styles.examples}>
          {EXAMPLES.map((e) => (
            <Pressable key={e} onPress={() => setText(e)} style={[styles.example, { borderColor: t.border }]}>
              <Txt variant="label" color={t.text}>
                {e}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
      {working ? (
        <AIWorking label="Working out the new numbers…" color={t.ai} />
      ) : (
        <Button title="Suggest changes" disabled={!text.trim() || busy} onPress={ask} />
      )}
      {problem && (
        <Txt variant="caption">
          Couldn’t work that out ({problem}). Try a one-tap surge, or change the numbers below.
        </Txt>
      )}
    </Card>
  );
}

/** One zone: have vs need for each skill, with − and + to change what's needed. */
function ZoneTargets({
  zone,
  open,
  onToggle,
  onProposal,
}: {
  zone: Zone;
  open: boolean;
  onToggle: () => void;
  onProposal: (p: Omit<PendingChange, 'key'>) => void;
}) {
  const t = useTheme();
  const temp = useStore((s) => s.temperatureC);
  const volunteers = useStore((s) => s.volunteers);
  const here = onShiftIn(zone.id, Object.values(volunteers));
  const [draft, setDraft] = useState<Record<string, number>>({});

  const key = (k: Skill | null) => k ?? 'people';
  const target = (k: Skill | null) => draft[key(k)] ?? targetFor(zone, k, temp);
  const short = ROWS.map((k) => ({ k, gap: Math.max(0, targetFor(zone, k, temp) - countWith(here, k)) })).filter((x) => x.gap > 0);
  const changes: TargetChange[] = ROWS.filter((k) => draft[key(k)] !== undefined && draft[key(k)] !== targetFor(zone, k, temp)).map((k) => ({
    zoneId: zone.id,
    skill: k,
    min: draft[key(k)],
  }));

  return (
    <Card style={short.length ? { borderColor: t.high, borderWidth: 1.5 } : undefined}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={`${zone.name}, ${short.length ? 'short' : 'covered'}`}>
        <Row>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading">{zone.name}</Txt>
            <Txt variant="caption" color={short.length ? t.high : t.success}>
              {short.length ? `Short: ${short.map((x) => `${x.gap} ${skillName(x.k, x.gap !== 1).toLowerCase()}`).join(', ')}` : 'Covered'}
            </Txt>
          </View>
          <Txt variant="caption">{here.length} here</Txt>
          <Glyph name={open ? 'x' : 'chevron'} size={20} color={t.textSecondary} />
        </Row>
      </Pressable>

      {open && (
        <View style={{ gap: Spacing.two }}>
          {ROWS.map((k) => {
            const have = countWith(here, k);
            const need = target(k);
            const changed = draft[key(k)] !== undefined && draft[key(k)] !== targetFor(zone, k, temp);
            return (
              <Row key={key(k)} style={[styles.skillRow, { backgroundColor: t.background }]}>
                <View style={{ flex: 1 }}>
                  <Txt variant="strong">{skillName(k)}</Txt>
                  <Txt variant="caption" color={have < need ? t.high : t.textSecondary}>
                    {have} here
                  </Txt>
                </View>
                <Stepper
                  value={need}
                  changed={changed}
                  // "+" means one more person than are here now, even if the minimum was lower.
                  onChange={(n) => setDraft((d) => ({ ...d, [key(k)]: Math.max(0, Math.min(80, n > need ? Math.max(n, have + 1) : n)) }))}
                />
              </Row>
            );
          })}
          {changes.length > 0 ? (
            <Button
              title="Preview changes"
              onPress={() => {
                onProposal({
                  title: `New targets for ${zone.name}`,
                  note: `${zone.name} needs more hands. Please head over.`,
                  source: 'manual',
                  changes,
                  zoneIds: [zone.id],
                });
                setDraft({});
              }}
            />
          ) : short.length > 0 ? (
            <Button
              title="Find cover"
              onPress={() =>
                onProposal({
                  title: `Cover ${zone.name}`,
                  note: `${zone.name} is short. Please head over and help.`,
                  source: 'manual',
                  changes: [],
                  zoneIds: [zone.id],
                })
              }
            />
          ) : null}
        </View>
      )}
    </Card>
  );
}

function Stepper({ value, changed, onChange }: { value: number; changed: boolean; onChange: (n: number) => void }) {
  const t = useTheme();
  const btn = (label: 'minus' | 'plus', delta: number) => (
    <Pressable
      onPress={() => onChange(value + delta)}
      accessibilityLabel={label === 'minus' ? 'Fewer' : 'More'}
      hitSlop={6}
      style={({ pressed }) => [styles.stepBtn, { backgroundColor: t.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}>
      <Txt variant="heading">{label === 'minus' ? '−' : '+'}</Txt>
    </Pressable>
  );
  return (
    <Row gap={Spacing.two}>
      {btn('minus', -1)}
      <Txt variant="heading" color={changed ? t.accent : t.text} style={{ minWidth: 32, textAlign: 'center' }}>
        {value}
      </Txt>
      {btn('plus', 1)}
    </Row>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  surge: { width: '48.5%', flexGrow: 1, minWidth: 150, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.one },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  ask: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.three },
  mic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  examples: { gap: Spacing.two },
  example: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  skillRow: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.three },
  stepBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
