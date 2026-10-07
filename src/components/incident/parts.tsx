import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Glyph, type GlyphName } from '@/components/ui/glyph';
import { Button, Card, Pill, Row, Txt, UrgencyPill } from '@/components/ui/primitives';
import { Radius, Spacing, Type, urgencyColor } from '@/constants/theme';
import { dist } from '@/domain/geo';
import {
  INCIDENT_TYPE_LABELS,
  type Candidate,
  type Dispatch,
  type Incident,
  type IncidentStatus,
  type RelatedLink,
  type ResponsePlan,
} from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, useStore, zoneById } from '@/state/store';

/** Plain-language status, from the safety lead's point of view. */
export const STATUS_LABEL: Record<IncidentStatus, string> = {
  logged: 'Finding the nearest help…',
  suggested: 'Waiting for approval',
  no_suggestion: 'Choose who to send',
  approved: 'Help is on the way',
  resolved: 'Resolved',
  merged: 'Merged with another report',
};

/** Kept for older screens; everything is monochrome now. */
export function statusColor(_s: IncidentStatus): string {
  return '#8E8E93';
}

export function minutesAgo(at: number, now: number) {
  const m = Math.max(0, Math.round((now - at) / 60000));
  return m === 0 ? 'Just now' : m === 1 ? '1 min ago' : `${m} min ago`;
}

export function firstName(name?: string) {
  return name?.split(' ')[0] ?? 'Someone';
}

/** Round initial — the only avatar we need. */
export function Avatar({ name, size = 48, inverted }: { name?: string; size?: number; inverted?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: inverted ? t.accent : t.backgroundSelected,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Txt variant="strong" color={inverted ? '#FFFFFF' : t.text} style={{ fontSize: size * 0.42, lineHeight: size * 0.5 }}>
        {name?.charAt(0) ?? '?'}
      </Txt>
    </View>
  );
}

/** One incident in a list. Big, scannable, one tap to open. */
export function IncidentRow({ incident, now, links }: { incident: Incident; now: number; links: RelatedLink[] }) {
  const t = useTheme();
  const zone = zoneById(incident.zoneId);
  const reporter = useStore((s) => s.volunteers[incident.reporterId]);
  const viewerIsLead = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId]?.role !== 'volunteer' : false));
  const volunteers = useStore((s) => s.volunteers);
  const related = viewerIsLead && links.find((l) => l.resolution === 'pending' && (l.a === incident.id || l.b === incident.id));
  const needsYou = viewerIsLead && (incident.status === 'suggested' || incident.status === 'no_suggestion');
  const status = viewerIsLead
    ? STATUS_LABEL[incident.status]
    : incident.status === 'approved'
      ? 'Help is on the way'
      : incident.status === 'resolved' || incident.status === 'merged'
        ? 'Closed'
        : 'Sent to the safety lead';
  const first = incident.suggestion?.assignments[0];
  const firstCand = first && incident.candidates.find((c) => c.volunteerId === first.volunteerId);

  return (
    <Card
      tone={needsYou ? 'strong' : 'plain'}
      style={[{ overflow: 'hidden', paddingLeft: Spacing.four + 6 }, needsYou && incident.urgency === 'critical' && { borderColor: t.critical }]}
      onPress={() => router.push({ pathname: '/incident/[id]', params: { id: incident.id } })}>
      <View style={[styles.stripe, { backgroundColor: urgencyColor(incident.urgency, t) }]} />
      <Row style={{ justifyContent: 'space-between' }}>
        <UrgencyPill urgency={incident.urgency} />
        <Txt variant="caption">{minutesAgo(incident.createdAt, now)}</Txt>
      </Row>
      <View style={{ gap: 2 }}>
        <Txt variant="heading">{INCIDENT_TYPE_LABELS[incident.type]}</Txt>
        <Txt variant="caption">
          {zone?.name} · from {firstName(reporter?.name)}
        </Txt>
      </View>
      {related && (
        <View style={[styles.flag, { backgroundColor: t.ai }]}>
          <Glyph name="link" size={20} color="#FFFFFF" />
          <Txt variant="label" color="#FFFFFF" style={{ flex: 1 }}>
            Might be the same as another report
          </Txt>
        </View>
      )}
      {viewerIsLead && incident.status === 'suggested' && first && (
        <View style={[styles.suggest, { backgroundColor: t.aiSoft, borderColor: t.ai }]}>
          <Glyph name="sparkle" size={18} color={t.ai} />
          <Txt variant="label" color={t.ai} style={{ flex: 1 }}>
            Send {firstName(volunteers[first.volunteerId]?.name)}
            {firstCand ? ` · ${firstCand.distanceM} m away` : ''}
            {incident.suggestion!.assignments.length > 1 ? ` + ${incident.suggestion!.assignments.length - 1} more` : ''}
          </Txt>
        </View>
      )}
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="label" color={needsYou ? t.accent : t.textSecondary}>{status}</Txt>
        <Glyph name="chevron" size={22} color={t.textSecondary} />
      </Row>
    </Card>
  );
}

/** What was reported: the AI's tidy version first, their own words a tap away. */
export function ReportSummary({ incident, compact }: { incident: Incident; compact?: boolean }) {
  const t = useTheme();
  const reporter = useStore((s) => s.volunteers[incident.reporterId]);
  const zone = zoneById(incident.zoneId);
  const [showWords, setShowWords] = useState(!!compact);
  return (
    <View style={{ gap: Spacing.three }}>
      <Txt variant={compact ? 'body' : 'strong'}>{incident.description}</Txt>
      <View style={{ gap: 2 }}>
        <Txt variant="caption">
          {zone?.name}
          {incident.locationNote ? ` · ${incident.locationNote}` : ''}
        </Txt>
        <Txt variant="caption">
          {formatClock(incident.createdAt)} · {reporter?.name} · by {incident.source === 'voice' ? 'voice' : 'text'}
        </Txt>
      </View>
      {incident.aiSuggestedUrgency && incident.aiSuggestedUrgency !== incident.urgency && (
        <Txt variant="caption">
          AI thought {incident.aiSuggestedUrgency}; {firstName(reporter?.name)} said {incident.urgency}.
        </Txt>
      )}
      {!compact && (
        <Pressable onPress={() => setShowWords((v) => !v)} hitSlop={8}>
          <Txt variant="label" color={t.accent}>
            {showWords ? 'Hide' : 'Show'} what {firstName(reporter?.name)} said
          </Txt>
        </Pressable>
      )}
      {showWords && (
        <View style={[styles.quote, { borderLeftColor: t.accent }]}>
          <Txt variant="body" style={{ fontStyle: 'italic' }} numberOfLines={compact ? 8 : undefined}>
            “{incident.transcript}”
          </Txt>
        </View>
      )}
      {incident.photoUri && <Image source={{ uri: incident.photoUri }} style={styles.photo} contentFit="cover" />}
    </View>
  );
}

/** Which job icon fits this person: first aid, security, crowd, or just a person. */
function jobGlyph(skills: Candidate['matchedSkills'], role?: string): GlyphName {
  const r = role?.toLowerCase() ?? '';
  if (skills.includes('first_aid') || r.includes('first aid') || r.includes('medic')) return 'cross';
  if (skills.includes('security_licence') || r.includes('secur')) return 'shield';
  if (skills.includes('deescalation') || r.includes('calm') || r.includes('de-esc')) return 'users';
  if (skills.includes('crowd_control') || r.includes('crowd')) return 'users';
  return 'person';
}

/** Short skill name for a chip. */
const SKILL_CHIP: Partial<Record<Candidate['skills'][number], string>> = {
  first_aid: 'First aid',
  security_licence: 'Security',
  crowd_control: 'Crowd',
  deescalation: 'De-escalation',
  wwcc: 'Kids check',
  rsa: 'RSA',
};

/** Distance block on the right of a person row: "70 m" over "1 min". */
function Distance({ c }: { c: Candidate }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Txt variant="strong">{c.distanceM} m</Txt>
      <Row gap={4}>
        <Glyph name="clock" size={15} color={t.textSecondary} />
        <Txt variant="caption">{c.etaMin} min</Txt>
      </Row>
    </View>
  );
}

/** A person who could go: job icon, name, skill, how far. Tap to choose when editing. */
export function CandidateLine({ c, selected, onPress }: { c: Candidate; selected?: boolean; onPress?: () => void }) {
  const t = useTheme();
  const skill = (c.matchedSkills[0] ?? c.skills[0]) as Candidate['skills'][number] | undefined;
  const body = (
    <View
      style={[
        styles.cand,
        selected ? { borderColor: t.accent, borderWidth: 2, backgroundColor: t.accentSoft } : { borderColor: t.border, borderWidth: 1, backgroundColor: t.background },
      ]}>
      <View style={[styles.job, { backgroundColor: selected ? t.accent : t.backgroundSelected }]}>
        <Glyph name={jobGlyph(c.matchedSkills)} size={22} color={selected ? '#FFFFFF' : t.text} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="strong" numberOfLines={1}>
          {c.name}
        </Txt>
        {skill && SKILL_CHIP[skill] ? <Txt variant="caption">{SKILL_CHIP[skill]}</Txt> : null}
      </View>
      <Distance c={c} />
      {onPress && (
        <View style={[styles.check, selected ? { backgroundColor: t.accent, borderColor: t.accent } : { borderColor: t.border }]}>
          {selected && <Glyph name="check" size={18} color="#FFFFFF" strokeWidth={3} />}
        </View>
      )}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** One person in the suggested plan. Their job and distance up front; what they're told is a tap away (and editable). */
function AssignmentRow({
  name,
  role,
  message,
  c,
  onChangeMessage,
}: {
  name: string;
  role: string;
  message: string;
  c?: Candidate;
  onChangeMessage?: (message: string) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.assign, { backgroundColor: t.background, borderColor: open ? t.accent : t.border }]}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={`${name}, ${role}. Tap for instructions.`}>
        <View style={styles.assignTop}>
          <View style={[styles.job, { backgroundColor: t.accent }]}>
            <Glyph name={jobGlyph(c?.matchedSkills ?? [], role)} size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="strong" numberOfLines={1}>
              {name}
            </Txt>
            <Txt variant="label" color={t.accent} numberOfLines={1}>
              {role}
            </Txt>
          </View>
          {c && <Distance c={c} />}
        </View>
        {!open && (
          <Row gap={6} style={{ marginTop: Spacing.two }}>
            <Txt variant="caption" numberOfLines={1} style={{ flex: 1 }}>
              {message}
            </Txt>
            <Glyph name="chevron" size={18} color={t.textSecondary} />
          </Row>
        )}
      </Pressable>
      {open && (
        <View style={[styles.task, { backgroundColor: t.backgroundElement }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="label">They’ll be told</Txt>
            {onChangeMessage && (
              <Row gap={4}>
                <Glyph name="edit" size={15} color={t.accent} />
                <Txt variant="label" color={t.accent}>
                  Tap to edit
                </Txt>
              </Row>
            )}
          </Row>
          {onChangeMessage ? (
            <TextInput
              value={message}
              onChangeText={onChangeMessage}
              multiline
              style={[styles.taskInput, { color: t.text, borderColor: t.border, backgroundColor: t.background }]}
            />
          ) : (
            <Txt variant="body">{message}</Txt>
          )}
        </View>
      )}
    </View>
  );
}

/** "Where to meet" and "What they'll find" — part of every brief, editable before sending. */
function BriefDetails({ plan, onChange }: { plan: ResponsePlan; onChange?: (plan: ResponsePlan) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const input = [styles.taskInput, { color: t.text, borderColor: t.border, backgroundColor: t.background }];
  return (
    <View style={[styles.assign, { backgroundColor: t.background, borderColor: open ? t.accent : t.border }]}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel="Where to meet and what they'll find">
        <View style={styles.assignTop}>
          <View style={[styles.job, { backgroundColor: t.backgroundSelected }]}>
            <Glyph name="pin" size={22} color={t.text} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="strong">Where to meet</Txt>
            <Txt variant="caption" numberOfLines={open ? undefined : 1}>
              {plan.whoToFind}
            </Txt>
          </View>
          <Glyph name={open ? 'x' : 'chevron'} size={18} color={t.textSecondary} />
        </View>
      </Pressable>
      {open && (
        <View style={{ gap: Spacing.two }}>
          {onChange && (
            <TextInput value={plan.whoToFind} onChangeText={(whoToFind) => onChange({ ...plan, whoToFind })} multiline style={input} />
          )}
          <Txt variant="label">What they’ll find</Txt>
          {onChange ? (
            <TextInput value={plan.whatToExpect} onChangeText={(whatToExpect) => onChange({ ...plan, whatToExpect })} multiline style={input} />
          ) : (
            <Txt variant="body">{plan.whatToExpect}</Txt>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * The suggested response, readable in five seconds: how many, who, why.
 * Pass `onChange` to let the approver edit what people are told before sending.
 */
export function PlanView({ plan, candidates, onChange }: { plan: ResponsePlan; candidates: Candidate[]; onChange?: (plan: ResponsePlan) => void }) {
  const t = useTheme();
  const volunteers = useStore((s) => s.volunteers);
  const [why, setWhy] = useState(false);
  const n = plan.assignments.length;
  const call000 = /\b000\b|ambulance/i.test(`${plan.summary} ${plan.whatToExpect}`);
  return (
    <View style={{ gap: Spacing.three }}>
      <View style={{ gap: Spacing.one }}>
        <Txt variant="heading">
          Send {n} {n === 1 ? 'person' : 'people'}
        </Txt>
        <Txt variant="body" color={t.textSecondary} numberOfLines={3}>
          {plan.summary.replace(/\s*Call 000\.?/i, '')}
        </Txt>
      </View>

      {call000 && (
        <View style={[styles.callout, { backgroundColor: t.criticalSoft, borderColor: t.critical }]}>
          <View style={[styles.job, { backgroundColor: t.critical }]}>
            <Glyph name="phone" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="strong">Call 000 as well</Txt>
            <Txt variant="caption">The AI thinks this needs an ambulance.</Txt>
          </View>
        </View>
      )}

      <View style={{ gap: Spacing.two }}>
        {plan.assignments.map((a, i) => (
          <AssignmentRow
            key={a.volunteerId}
            name={volunteers[a.volunteerId]?.name ?? 'Volunteer'}
            role={a.role}
            message={a.message}
            c={candidates.find((x) => x.volunteerId === a.volunteerId)}
            onChangeMessage={
              onChange
                ? (message) => onChange({ ...plan, assignments: plan.assignments.map((x, j) => (j === i ? { ...x, message } : x)) })
                : undefined
            }
          />
        ))}
        <BriefDetails plan={plan} onChange={onChange} />
      </View>

      {plan.reasoning ? (
        <Pressable onPress={() => setWhy((w) => !w)} hitSlop={8}>
          <Row gap={Spacing.two}>
            <Glyph name="sparkle" size={16} color={t.ai} />
            <Txt variant="label" color={t.ai} style={{ flex: 1 }}>
              {why ? 'Why these people' : 'Why these people?'}
            </Txt>
            <Glyph name={why ? 'x' : 'chevron'} size={18} color={t.ai} />
          </Row>
          {why && (
            <Txt variant="body" color={t.textSecondary} style={{ marginTop: Spacing.two }}>
              {plan.reasoning}
            </Txt>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Choose who to send. The nearest match is already ticked, so the common
 * case is one tap; editing the words is optional and tucked away.
 */
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
        ? 'First aid'
        : c.matchedSkills.includes('security_licence')
          ? 'Security'
          : 'Responder';
  const message = () => `Head to ${where} now. ${INCIDENT_TYPE_LABELS[incident.type]}: ${incident.description}`;
  const [picked, setPicked] = useState<Record<string, { role: string; message: string }>>(() => {
    if (initial) return Object.fromEntries(initial.assignments.map((a) => [a.volunteerId, { role: a.role, message: a.message }]));
    const nearest = incident.candidates.find((c) => c.tier === 'primary') ?? incident.candidates[0];
    return nearest ? { [nearest.volunteerId]: { role: defaultRole(nearest), message: message() } } : {};
  });
  const [expect, setExpect] = useState(initial?.whatToExpect ?? incident.description);
  const [find, setFind] = useState(initial?.whoToFind ?? `${reporter?.name ?? 'The reporter'}, at ${where}.`);
  const [showWords, setShowWords] = useState(false);

  const toggle = (c: Candidate) =>
    setPicked((p) => {
      if (p[c.volunteerId]) {
        const { [c.volunteerId]: _, ...rest } = p;
        return rest;
      }
      return { ...p, [c.volunteerId]: { role: defaultRole(c), message: message() } };
    });

  const ids = Object.keys(picked);
  const input = [styles.input, { color: t.text, backgroundColor: t.backgroundElement, borderColor: t.border }];

  return (
    <View style={{ gap: Spacing.three }}>
      <Txt variant="caption">Nearest free people with the right skills. Tap to choose.</Txt>
      {incident.candidates.length === 0 && <Txt variant="body">Nobody with matching skills is free right now.</Txt>}
      {incident.candidates.map((c) => (
        <CandidateLine key={c.volunteerId} c={c} selected={!!picked[c.volunteerId]} onPress={() => toggle(c)} />
      ))}
      <Pressable onPress={() => setShowWords((v) => !v)} hitSlop={8}>
        <Txt variant="label" color={t.accent}>
          {showWords ? 'Hide the instructions' : 'Edit what they’re told'}
        </Txt>
      </Pressable>
      {showWords && (
        <View style={{ gap: Spacing.two }}>
          {ids.map((id) => (
            <TextInput
              key={id}
              value={picked[id].message}
              onChangeText={(m) => setPicked((p) => ({ ...p, [id]: { ...p[id], message: m } }))}
              multiline
              style={input}
            />
          ))}
          <Txt variant="label">What to expect</Txt>
          <TextInput value={expect} onChangeText={setExpect} multiline style={input} />
          <Txt variant="label">Who to find</Txt>
          <TextInput value={find} onChangeText={setFind} multiline style={input} />
        </View>
      )}
      <Button
        title={submitLabel}
        size="lg"
        disabled={disabled || ids.length === 0 || !expect.trim() || !find.trim()}
        onPress={() =>
          onSubmit({
            summary: initial?.summary ?? `Send ${ids.length} to ${zone?.name}`,
            reasoning: initial ? `${initial.reasoning} (Changed by a person before approval.)` : 'Chosen by a person.',
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

/** One responder's walk to the scene. */
export function DispatchProgress({ d }: { d: Dispatch }) {
  const t = useTheme();
  const v = useStore((s) => s.volunteers[d.volunteerId]);
  const movement = useStore((s) => s.movements[d.volunteerId]);
  const pos = useStore((s) => s.positions[d.volunteerId]);
  const target = d.path[d.path.length - 1];
  const remaining =
    movement && movement.dispatchId === d.id ? Math.round(movement.total - movement.travelled) : pos && target ? Math.round(dist(pos, target)) : 0;
  const statusText = { notified: 'Told', acknowledged: 'On the way', on_scene: 'There', declined: 'Can’t go' }[d.status];
  const pct = d.status === 'on_scene' ? 1 : d.distanceM > 0 ? Math.min(1, Math.max(0, 1 - remaining / d.distanceM)) : 0;
  return (
    <View style={{ gap: Spacing.two }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <Avatar name={v?.name} size={40} inverted={d.status === 'on_scene'} />
          <View>
            <Txt variant="strong">{v?.name}</Txt>
            <Txt variant="caption">{d.status === 'on_scene' ? 'Arrived' : `${remaining} m to go`}</Txt>
          </View>
        </Row>
        <Pill label={statusText} tone={d.status === 'on_scene' ? 'success' : d.status === 'declined' ? undefined : 'accent'} />
      </Row>
      <View style={[styles.track, { backgroundColor: t.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: d.status === 'on_scene' ? t.success : t.accent }]} />
      </View>
    </View>
  );
}

export function IncidentLog({ incidentId }: { incidentId: string }) {
  const audit = useStore((s) => s.audit);
  const entries = audit.filter((a) => a.incidentId === incidentId).slice().reverse();
  return (
    <View style={{ gap: Spacing.three }}>
      {entries.map((a) => (
        <View key={a.id} style={{ gap: 2 }}>
          <Txt variant="label">{formatClock(a.at)}</Txt>
          <Txt variant="body">
            <Txt variant="strong">{a.actorName}</Txt> {a.action.charAt(0).toLowerCase() + a.action.slice(1)}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  quote: { borderLeftWidth: 3, paddingLeft: Spacing.three },
  photo: { width: '100%', height: 200, borderRadius: Radius.md },
  cand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.lg, padding: Spacing.three },
  job: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  assign: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  assignTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  task: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.two },
  taskInput: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, ...Type.body, minHeight: 56, textAlignVertical: 'top' },
  callout: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.three },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, ...Type.body, minHeight: 56, textAlignVertical: 'top' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
