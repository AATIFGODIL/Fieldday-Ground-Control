import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Pill, Row, Txt, UrgencyPill } from '@/components/ui/primitives';
import { Radius, SkillColors, Spacing, UrgencyColors } from '@/constants/theme';
import { dist } from '@/domain/geo';
import {
  INCIDENT_TYPE_LABELS,
  SKILL_SHORT,
  type Candidate,
  type Dispatch,
  type Incident,
  type IncidentStatus,
  type RelatedLink,
  type ResponsePlan,
} from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, useStore, zoneById } from '@/state/store';

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  logged: 'Drafting response',
  suggested: 'Awaiting approval',
  no_suggestion: 'Needs manual response',
  approved: 'Responders dispatched',
  resolved: 'Resolved',
  merged: 'Merged',
};

export function statusColor(s: IncidentStatus): string {
  return {
    logged: '#0090FF',
    suggested: UrgencyColors.high,
    no_suggestion: UrgencyColors.critical,
    approved: '#8E4EC6',
    resolved: UrgencyColors.low,
    merged: '#8B8D98',
  }[s];
}

export function minutesAgo(at: number, now: number) {
  const m = Math.max(0, Math.round((now - at) / 60000));
  return m === 0 ? 'just now' : `${m} min ago`;
}

/** Compact row used in queues. */
export function IncidentRow({ incident, now, links }: { incident: Incident; now: number; links: RelatedLink[] }) {
  const t = useTheme();
  const zone = zoneById(incident.zoneId);
  const reporter = useStore((s) => s.volunteers[incident.reporterId]);
  const viewerIsLead = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId]?.role !== 'volunteer' : false));
  const related = viewerIsLead && links.some((l) => l.resolution === 'pending' && (l.a === incident.id || l.b === incident.id));
  const status = viewerIsLead
    ? STATUS_LABEL[incident.status]
    : incident.status === 'approved'
      ? 'Help on the way'
      : incident.status === 'resolved' || incident.status === 'merged'
        ? 'Closed'
        : 'With the safety lead';
  return (
    <Card onPress={() => router.push({ pathname: '/incident/[id]', params: { id: incident.id } })} style={{ borderLeftWidth: 5, borderLeftColor: UrgencyColors[incident.urgency] }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          <UrgencyPill urgency={incident.urgency} />
          <Txt variant="label" color={t.text}>{incident.ref}</Txt>
        </Row>
        <Txt variant="caption">{minutesAgo(incident.createdAt, now)}</Txt>
      </Row>
      <Txt variant="heading" style={{ fontSize: 16 }}>
        {INCIDENT_TYPE_LABELS[incident.type]} · {zone?.name}
      </Txt>
      <Txt variant="caption" numberOfLines={2}>{incident.description}</Txt>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Pill label={status} color={viewerIsLead ? statusColor(incident.status) : t.tint} />
        {related && <Pill label="POSSIBLY RELATED" color="#8E4EC6" solid />}
        {viewerIsLead && incident.status === 'suggested' && <Pill label="AI PLAN READY" color={t.tint} />}
        <Txt variant="caption">by {reporter?.name}</Txt>
      </Row>
    </Card>
  );
}

/** The volunteer's report: who, what, where, verbatim. */
export function ReportSummary({ incident, compact }: { incident: Incident; compact?: boolean }) {
  const t = useTheme();
  const reporter = useStore((s) => s.volunteers[incident.reporterId]);
  const zone = zoneById(incident.zoneId);
  return (
    <View style={{ gap: Spacing.two }}>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <UrgencyPill urgency={incident.urgency} />
        {compact ? (
          <Txt variant="caption" style={{ fontWeight: '700' }}>{INCIDENT_TYPE_LABELS[incident.type]}</Txt>
        ) : (
          <>
            <Pill label={INCIDENT_TYPE_LABELS[incident.type].toUpperCase()} />
            <Pill label={incident.structuredBy === 'ai' ? 'AI-STRUCTURED' : 'MANUAL'} />
          </>
        )}
      </Row>
      <Txt variant="body" style={{ fontWeight: '600', fontSize: compact ? 14 : 16, lineHeight: compact ? 19 : 22 }}>{incident.description}</Txt>
      <Txt variant="caption">
        {zone?.name}
        {incident.locationNote ? ` · ${incident.locationNote}` : ''} · {formatClock(incident.createdAt)} · {reporter?.name} ({incident.source})
      </Txt>
      {incident.aiSuggestedUrgency && incident.aiSuggestedUrgency !== incident.urgency && (
        <Txt variant="caption" color={UrgencyColors.medium}>
          AI suggested {incident.aiSuggestedUrgency}; reporter confirmed {incident.urgency}.
        </Txt>
      )}
      <View style={[styles.quote, { borderLeftColor: t.border }]}>
        <Txt variant="caption" style={{ fontStyle: 'italic' }} numberOfLines={compact ? 6 : undefined}>
          “{incident.transcript}”
        </Txt>
      </View>
      {incident.photoUri && <Image source={{ uri: incident.photoUri }} style={styles.photo} contentFit="cover" />}
    </View>
  );
}

export function CandidateLine({ c, selected, onPress }: { c: Candidate; selected?: boolean; onPress?: () => void }) {
  const t = useTheme();
  const body = (
    <Row style={[styles.cand, { borderColor: selected ? t.tint : t.border, backgroundColor: selected ? `${t.tint}14` : 'transparent' }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={6}>
          <Txt variant="body" style={{ fontWeight: '700' }}>{c.name}</Txt>
          <Pill label={c.tier === 'primary' ? 'PRIMARY' : 'SUPPORT'} color={c.tier === 'primary' ? t.tint : undefined} />
        </Row>
        <Row gap={4} style={{ flexWrap: 'wrap' }}>
          {c.skills.map((s) => (
            <Pill key={s} label={SKILL_SHORT[s]} color={SkillColors[s]} solid={c.matchedSkills.includes(s)} />
          ))}
          {c.languages.filter((l) => l !== 'English').map((l) => (
            <Txt key={l} variant="caption">· {l}</Txt>
          ))}
        </Row>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Txt variant="heading" style={{ fontSize: 16 }}>{c.distanceM} m</Txt>
        <Txt variant="caption">~{c.etaMin} min · {c.zoneName}</Txt>
      </View>
    </Row>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function PlanView({ plan, candidates }: { plan: ResponsePlan; candidates: Candidate[] }) {
  const volunteers = useStore((s) => s.volunteers);
  return (
    <View style={{ gap: Spacing.two }}>
      <Txt variant="heading" style={{ fontSize: 16 }}>{plan.summary}</Txt>
      {plan.assignments.map((a) => {
        const c = candidates.find((x) => x.volunteerId === a.volunteerId);
        return (
          <View key={a.volunteerId} style={{ gap: 4 }}>
            {c ? <CandidateLine c={c} selected /> : <Txt variant="body" style={{ fontWeight: '700' }}>{volunteers[a.volunteerId]?.name}</Txt>}
            <Txt variant="caption" style={{ paddingHorizontal: 4 }}>
              <Txt variant="caption" style={{ fontWeight: '800' }}>{a.role}: </Txt>
              {a.message}
            </Txt>
          </View>
        );
      })}
      <Txt variant="caption"><Txt variant="caption" style={{ fontWeight: '800' }}>What to expect: </Txt>{plan.whatToExpect}</Txt>
      <Txt variant="caption"><Txt variant="caption" style={{ fontWeight: '800' }}>Who to find: </Txt>{plan.whoToFind}</Txt>
      {plan.reasoning ? (
        <Txt variant="caption"><Txt variant="caption" style={{ fontWeight: '800' }}>Why: </Txt>{plan.reasoning}</Txt>
      ) : null}
    </View>
  );
}

/** Pick responders and write their instructions — used for manual plans and editing AI plans. */
export function PlanEditor({
  incident,
  initial,
  onSubmit,
  submitLabel,
  disabled,
  authorId,
}: {
  incident: Incident;
  initial?: ResponsePlan;
  onSubmit: (plan: ResponsePlan) => void;
  submitLabel: string;
  disabled?: boolean;
  authorId: string;
}) {
  const t = useTheme();
  const zone = zoneById(incident.zoneId);
  const reporter = useStore((s) => s.volunteers[incident.reporterId]);
  const where = `${zone?.name}${incident.locationNote ? `, ${incident.locationNote}` : ''}`;
  const defaultRole = (c: Candidate) =>
    c.tier === 'support'
      ? 'Crowd support'
      : c.matchedSkills.includes('first_aid')
        ? 'First aid responder'
        : c.matchedSkills.includes('security_licence')
          ? 'Security responder'
          : 'Responder';
  const [picked, setPicked] = useState<Record<string, { role: string; message: string }>>(() =>
    Object.fromEntries((initial?.assignments ?? []).map((a) => [a.volunteerId, { role: a.role, message: a.message }])),
  );
  const [expect, setExpect] = useState(initial?.whatToExpect ?? incident.description);
  const [find, setFind] = useState(initial?.whoToFind ?? `${reporter?.name ?? 'The reporter'}, who reported it, at ${where}.`);

  const toggle = (c: Candidate) =>
    setPicked((p) => {
      if (p[c.volunteerId]) {
        const { [c.volunteerId]: _, ...rest } = p;
        return rest;
      }
      return { ...p, [c.volunteerId]: { role: defaultRole(c), message: `Head to ${where} now and assist.` } };
    });

  const ids = Object.keys(picked);
  const input = [styles.input, { color: t.text, backgroundColor: t.backgroundElement, borderColor: t.border }];

  return (
    <View style={{ gap: Spacing.two }}>
      <Txt variant="label">CHOOSE RESPONDERS (NEAREST AVAILABLE, SKILL-MATCHED)</Txt>
      {incident.candidates.length === 0 && <Txt variant="caption">No available volunteers with matching skills.</Txt>}
      {incident.candidates.map((c) => (
        <View key={c.volunteerId} style={{ gap: 4 }}>
          <CandidateLine c={c} selected={!!picked[c.volunteerId]} onPress={() => toggle(c)} />
          {picked[c.volunteerId] && (
            <View style={{ gap: 4, paddingLeft: 8 }}>
              <TextInput
                value={picked[c.volunteerId].role}
                onChangeText={(role) => setPicked((p) => ({ ...p, [c.volunteerId]: { ...p[c.volunteerId], role } }))}
                placeholder="Role"
                style={input}
              />
              <TextInput
                value={picked[c.volunteerId].message}
                onChangeText={(message) => setPicked((p) => ({ ...p, [c.volunteerId]: { ...p[c.volunteerId], message } }))}
                placeholder="Instructions"
                multiline
                style={input}
              />
            </View>
          )}
        </View>
      ))}
      <Txt variant="label">WHAT TO EXPECT</Txt>
      <TextInput value={expect} onChangeText={setExpect} multiline style={input} />
      <Txt variant="label">WHO TO FIND</Txt>
      <TextInput value={find} onChangeText={setFind} multiline style={input} />
      <Button
        title={submitLabel}
        size="lg"
        disabled={disabled || ids.length === 0 || !expect.trim() || !find.trim()}
        onPress={() =>
          onSubmit({
            summary: initial?.summary ?? `Manual response: ${ids.length} responder${ids.length === 1 ? '' : 's'} to ${zone?.name}`,
            reasoning: initial ? `${initial.reasoning} (Edited by a human before approval.)` : 'Written by a human.',
            assignments: ids.map((volunteerId) => ({ volunteerId, ...picked[volunteerId] })),
            whatToExpect: expect.trim(),
            whoToFind: find.trim(),
            source: 'manual',
            authorId,
          })
        }
      />
    </View>
  );
}

export function DispatchProgress({ d }: { d: Dispatch }) {
  const t = useTheme();
  const v = useStore((s) => s.volunteers[d.volunteerId]);
  const movement = useStore((s) => s.movements[d.volunteerId]);
  const pos = useStore((s) => s.positions[d.volunteerId]);
  const target = d.path[d.path.length - 1];
  const remaining = movement && movement.dispatchId === d.id ? Math.round(movement.total - movement.travelled) : pos && target ? Math.round(dist(pos, target)) : 0;
  const statusText = {
    notified: 'Notified',
    acknowledged: 'On the way',
    on_scene: 'On scene',
    declined: "Can't attend",
  }[d.status];
  const pct = d.status === 'on_scene' ? 1 : d.distanceM > 0 ? Math.min(1, Math.max(0, 1 - remaining / d.distanceM)) : 0;
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="body" style={{ fontWeight: '700' }}>{v?.name} · <Txt variant="caption">{d.role}</Txt></Txt>
        <Pill label={statusText.toUpperCase()} color={d.status === 'declined' ? UrgencyColors.critical : d.status === 'on_scene' ? UrgencyColors.low : t.tint} />
      </Row>
      <View style={[styles.track, { backgroundColor: t.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: d.status === 'on_scene' ? UrgencyColors.low : t.tint }]} />
      </View>
      <Txt variant="caption">
        {d.status === 'on_scene' ? 'Arrived' : `${remaining} m to go of ${d.distanceM} m`} · brief {d.briefPending ? 'preparing…' : d.brief?.source === 'ai' ? 'ready (AI)' : 'ready (template)'}
      </Txt>
    </View>
  );
}

export function IncidentLog({ incidentId }: { incidentId: string }) {
  const audit = useStore((s) => s.audit);
  const entries = audit.filter((a) => a.incidentId === incidentId).slice().reverse();
  return (
    <View style={{ gap: 6 }}>
      {entries.map((a) => (
        <Row key={a.id} style={{ alignItems: 'flex-start' }}>
          <Txt variant="caption" style={{ width: 64 }}>{formatClock(a.at)}</Txt>
          <View style={{ flex: 1 }}>
            <Txt variant="caption" style={{ fontWeight: '700' }}>{a.actorName}: <Txt variant="caption">{a.action}</Txt></Txt>
            {a.detail ? <Txt variant="caption" numberOfLines={3}>{a.detail}</Txt> : null}
          </View>
        </Row>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  quote: { borderLeftWidth: 3, paddingLeft: 10 },
  photo: { width: '100%', height: 180, borderRadius: Radius.md },
  cand: { borderWidth: 1.5, borderRadius: Radius.md, padding: 10, alignItems: 'flex-start' },
  input: { borderWidth: 1, borderRadius: Radius.sm, padding: 10, fontSize: 15 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
