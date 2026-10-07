import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Banner, Button, Card, Pill, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { Radius, Spacing, UrgencyColors, ZoneColors } from '@/constants/theme';
import { INCIDENT_TYPES, INCIDENT_TYPE_LABELS, URGENCIES, type IncidentType, type Urgency } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { submitReport } from '@/state/pipeline';
import { setReportDraft, useStore } from '@/state/store';

const URGENCY_HELP: Record<Urgency, string> = {
  critical: 'Life at risk or escalating fast',
  high: 'Needs someone within minutes',
  medium: 'Needs attention soon, stable',
  low: 'Minor, no immediate risk',
};

/**
 * Review the structured report. Every field is editable, and urgency must be
 * explicitly confirmed by the reporter before anything is logged.
 */
export default function ReportConfirm() {
  const t = useTheme();
  const draft = useStore((s) => s.reportDraft);
  const zones = useStore((s) => s.festival.zones);
  const st = draft?.structured;

  const [type, setType] = useState<IncidentType>(st?.type ?? 'other');
  const [description, setDescription] = useState(st?.description ?? draft?.transcript ?? '');
  const [zoneId, setZoneId] = useState(st?.zoneId ?? zones[0].id);
  const [locationNote, setLocationNote] = useState(st?.locationNote ?? '');
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  if (!draft || !st) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Txt variant="heading">Nothing to confirm.</Txt>
        <Button title="Close" onPress={() => router.back()} />
      </Screen>
    );
  }

  const aiOk = !draft.failReason;

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
        <View style={{ flex: 1 }}>
          <Txt variant="label" color={t.tint}>{aiOk ? 'STRUCTURED BY AI · CHECK IT' : 'MANUAL ENTRY'}</Txt>
          <Txt variant="title">Confirm report</Txt>
        </View>
        <Button
          title="Cancel"
          variant="secondary"
          size="sm"
          onPress={() => {
            setReportDraft(null);
            router.back();
          }}
        />
      </Row>

      {!aiOk && (
        <Banner tone="warn" title="Couldn't auto-fill this report" body="Please check each field below — we've pre-filled what we could.">
          <Txt variant="caption">Reason: {draft.failReason}</Txt>
        </Banner>
      )}

      <Section title="Urgency · you must confirm">
        {aiOk && st.suggestedUrgency && (
          <Txt variant="caption">
            AI suggests <Txt variant="caption" color={UrgencyColors[st.suggestedUrgency]} style={{ fontWeight: '800' }}>{st.suggestedUrgency.toUpperCase()}</Txt>
            {st.urgencyRationale ? ` — ${st.urgencyRationale}` : ''}
          </Txt>
        )}
        <View style={styles.urgencyGrid}>
          {[...URGENCIES].reverse().map((u) => {
            const on = urgency === u;
            const suggested = aiOk && st.suggestedUrgency === u;
            return (
              <Pressable
                key={u}
                onPress={() => setUrgency(u)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[
                  styles.urgency,
                  {
                    borderColor: UrgencyColors[u],
                    backgroundColor: on ? UrgencyColors[u] : `${UrgencyColors[u]}12`,
                    borderStyle: suggested && !on ? 'dashed' : 'solid',
                  },
                ]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="heading" color={on ? '#fff' : UrgencyColors[u]}>{u.toUpperCase()}</Txt>
                  {suggested && <Pill label="AI" color={on ? '#fff' : UrgencyColors[u]} />}
                </Row>
                <Txt variant="caption" color={on ? '#fff' : undefined}>{URGENCY_HELP[u]}</Txt>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="What's happening">
        <View style={styles.chips}>
          {INCIDENT_TYPES.map((k) => (
            <Pressable
              key={k}
              onPress={() => setType(k)}
              style={[styles.chip, { borderColor: type === k ? t.tint : t.border, backgroundColor: type === k ? `${t.tint}22` : t.backgroundElement }]}>
              <Txt variant="caption" color={type === k ? t.tint : t.text} style={{ fontWeight: type === k ? '800' : '500' }}>
                {INCIDENT_TYPE_LABELS[k]}
              </Txt>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          style={[styles.input, { color: t.text, backgroundColor: t.backgroundElement, borderColor: t.border }]}
        />
        {aiOk && st.missingInfo.length > 0 && (
          <Card style={{ gap: 4 }}>
            <Txt variant="label">RESPONDERS MAY ASK</Txt>
            {st.missingInfo.map((q) => (
              <Txt key={q} variant="caption">• {q}</Txt>
            ))}
          </Card>
        )}
      </Section>

      <Section title="Where">
        <View style={styles.chips}>
          {zones.map((z) => (
            <Pressable
              key={z.id}
              onPress={() => setZoneId(z.id)}
              style={[styles.chip, { borderColor: zoneId === z.id ? ZoneColors[z.kind] : t.border, backgroundColor: zoneId === z.id ? `${ZoneColors[z.kind]}22` : t.backgroundElement }]}>
              <Txt variant="caption" style={{ fontWeight: zoneId === z.id ? '800' : '500' }}>{z.name}</Txt>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={locationNote}
          onChangeText={setLocationNote}
          placeholder="Landmark (optional), e.g. by the water taps"
          placeholderTextColor={t.textSecondary}
          style={[styles.input, styles.single, { color: t.text, backgroundColor: t.backgroundElement, borderColor: t.border }]}
        />
        <Txt variant="caption">Your current position is attached automatically.</Txt>
      </Section>

      {draft.photoUri && <Image source={{ uri: draft.photoUri }} style={styles.photo} contentFit="cover" />}

      <Pressable onPress={() => setShowTranscript((v) => !v)}>
        <Txt variant="caption" color={t.tint}>{showTranscript ? 'Hide' : 'Show'} what you said</Txt>
      </Pressable>
      {showTranscript && (
        <Card>
          <Txt variant="body" style={{ fontStyle: 'italic' }}>“{draft.transcript}”</Txt>
        </Card>
      )}

      <Button
        title={urgency ? `Log ${urgency} incident` : 'Choose urgency to log'}
        size="lg"
        variant={urgency === 'critical' ? 'danger' : 'primary'}
        disabled={!urgency || !description.trim()}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  urgencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  urgency: { width: '48.5%', borderWidth: 2, borderRadius: Radius.md, padding: Spacing.three, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  input: { borderWidth: 1, borderRadius: Radius.md, padding: 12, fontSize: 16, minHeight: 80, textAlignVertical: 'top' },
  single: { minHeight: 0 },
  photo: { width: '100%', height: 180, borderRadius: Radius.md },
});
