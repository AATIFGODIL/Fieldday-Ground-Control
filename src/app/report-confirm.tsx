import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Glyph } from '@/components/ui/glyph';
import { Appear, Banner, Button, Card, Row, Screen, Txt } from '@/components/ui/primitives';
import { Radius, Spacing, Type, urgencyStyle } from '@/constants/theme';
import { INCIDENT_TYPES, INCIDENT_TYPE_LABELS, URGENCIES, type IncidentType, type Urgency } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { submitReport } from '@/state/pipeline';
import { setReportDraft, useStore } from '@/state/store';

const URGENCY_WORD: Record<Urgency, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const URGENCY_HELP: Record<Urgency, string> = {
  critical: 'Someone’s life could be at risk',
  high: 'Needs someone within minutes',
  medium: 'Needs attention soon, but stable',
  low: 'Minor, no one at risk',
};

/**
 * Check what the AI wrote. Everything can be changed, and nothing is sent
 * until the reporter picks how urgent it is themselves.
 */
export default function ReportConfirm() {
  const t = useTheme();
  const draft = useStore((s) => s.reportDraft);
  const zones = useStore((s) => s.festival.zones);
  const st = draft?.structured;

  const [type, setType] = useState<IncidentType>(st?.type ?? 'other');
  const [description, setDescription] = useState(st?.description ?? draft?.transcript ?? '');
  const [zoneId, setZoneId] = useState(st?.zoneId ?? zones[0].id);
  const [locationNote] = useState(st?.locationNote ?? '');
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [editing, setEditing] = useState<null | 'what' | 'where'>(null);

  if (!draft || !st) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Txt variant="heading">Nothing to check.</Txt>
        <Button title="Close" onPress={() => router.back()} />
      </Screen>
    );
  }

  const aiOk = !draft.failReason;
  const zone = zones.find((z) => z.id === zoneId);

  const submit = () => {
    if (!urgency) return;
    const incident = submitReport(draft, {
      type,
      description: description.trim(),
      zoneId,
      locationNote: locationNote.trim() || undefined,
      urgency,
    });
    router.dismissAll();
    router.replace({ pathname: '/volunteer', params: { reported: incident.ref } });
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="title">Check your report</Txt>
        <Pressable
          hitSlop={12}
          accessibilityLabel="Cancel"
          onPress={() => {
            setReportDraft(null);
            router.back();
          }}>
          <Glyph name="x" size={28} color={t.text} />
        </Pressable>
      </Row>

      {!aiOk && <Banner tone="info" title="Please check each part" body="We couldn’t write this up automatically, so we’ve filled in what we could." />}

      <Appear>
      <Card tone={aiOk ? 'ai' : 'plain'}>
        <Row>
          <Glyph name="sparkle" size={18} color={aiOk ? t.ai : t.textSecondary} />
          <Txt variant="label" color={aiOk ? t.ai : undefined}>
            {aiOk ? 'AI wrote this from what you said' : 'Your report'}
          </Txt>
        </Row>

        <Field label="What" value={INCIDENT_TYPE_LABELS[type]} onEdit={() => setEditing(editing === 'what' ? null : 'what')} open={editing === 'what'} />
        {editing === 'what' && (
          <View style={styles.chips}>
            {INCIDENT_TYPES.map((k) => (
              <Chip key={k} label={INCIDENT_TYPE_LABELS[k]} on={type === k} onPress={() => setType(k)} />
            ))}
          </View>
        )}

        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          style={[styles.input, { color: t.text, backgroundColor: t.background, borderColor: t.border }]}
        />

        <Field
          label="Where"
          value={`${zone?.name ?? ''}${locationNote ? ` · ${locationNote}` : ''}`}
          onEdit={() => setEditing(editing === 'where' ? null : 'where')}
          open={editing === 'where'}
        />
        {editing === 'where' && (
          <View style={styles.chips}>
            {zones.map((z) => (
              <Chip key={z.id} label={z.name} on={zoneId === z.id} onPress={() => setZoneId(z.id)} />
            ))}
          </View>
        )}
        <Txt variant="caption">Your location is attached automatically.</Txt>
      </Card>
      </Appear>

      {draft.photoUri && <Image source={{ uri: draft.photoUri }} style={styles.photo} contentFit="cover" />}

      <Appear index={2} style={{ gap: Spacing.three }}>
        <Txt variant="heading">How urgent is it?</Txt>
        {aiOk && st.suggestedUrgency && (
          <Txt variant="caption">
            AI thinks <Txt variant="label" color={t.ai}>{URGENCY_WORD[st.suggestedUrgency].toLowerCase()}</Txt>
            {st.urgencyRationale ? `: ${st.urgencyRationale}` : ''}. You decide.
          </Txt>
        )}
        {[...URGENCIES].reverse().map((u) => {
          const on = urgency === u;
          const suggested = aiOk && st.suggestedUrgency === u;
          const s = urgencyStyle(u, t);
          const onBg = u === 'critical' || u === 'high' ? s.bg : t.accent;
          const onFg = u === 'high' ? s.fg : '#FFFFFF';
          return (
            <Pressable
              key={u}
              onPress={() => setUrgency(u)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.urgency,
                on
                  ? { backgroundColor: onBg, borderColor: onBg }
                  : { backgroundColor: t.background, borderColor: suggested ? t.ai : t.border, borderStyle: suggested ? 'dashed' : 'solid' },
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}>
              <View style={[styles.swatch, on ? { backgroundColor: onFg, borderColor: onFg } : { backgroundColor: s.bg, borderColor: s.border }]} />
              <View style={{ flex: 1 }}>
                <Txt variant="strong" color={on ? onFg : t.text}>
                  {URGENCY_WORD[u]}
                  {suggested ? '  · AI’s pick' : ''}
                </Txt>
                <Txt variant="caption" color={on ? onFg : t.textSecondary}>
                  {URGENCY_HELP[u]}
                </Txt>
              </View>
              {on && <Glyph name="check" size={24} color={onFg} strokeWidth={3} />}
            </Pressable>
          );
        })}
      </Appear>

      <Button title={urgency ? 'Send to the safety lead' : 'Pick how urgent first'} size="lg" disabled={!urgency || !description.trim()} onPress={submit} />
    </Screen>
  );
}

function Field({ label, value, onEdit, open }: { label: string; value: string; onEdit: () => void; open: boolean }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ flex: 1 }}>
        <Txt variant="label">{label}</Txt>
        <Txt variant="heading">{value}</Txt>
      </View>
      <Pressable hitSlop={10} onPress={onEdit}>
        <Txt variant="label" color={t.accent}>
          {open ? 'Done' : 'Change'}
        </Txt>
      </Pressable>
    </Row>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on ? { backgroundColor: t.accent, borderColor: t.accent } : { backgroundColor: t.background, borderColor: t.border }]}>
      <Txt variant="label" color={on ? '#FFFFFF' : t.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  urgency: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 2, borderRadius: Radius.lg, padding: Spacing.three, minHeight: 76 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, ...Type.body, minHeight: 100, textAlignVertical: 'top' },
  photo: { width: '100%', height: 200, borderRadius: Radius.lg },
});
