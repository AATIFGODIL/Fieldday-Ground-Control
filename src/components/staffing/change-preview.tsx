import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/incident/parts';
import { Glyph } from '@/components/ui/glyph';
import { Button, Card, Row, Txt } from '@/components/ui/primitives';
import { Radius, Spacing } from '@/constants/theme';
import { planFill, skillName, targetFor, withTargets, type TargetChange } from '@/domain/staffing';
import { useTheme } from '@/hooks/use-theme';
import { applyStaffing, busyVolunteerIds, simNow, useStore, zoneById } from '@/state/store';

export interface PendingChange {
  /** Bump to recompute the plan for a new change. */
  key: number;
  title: string;
  note: string;
  source: 'preset' | 'ai' | 'manual';
  changes: TargetChange[];
  /** Zones to fill even if their numbers don't change (e.g. "Find cover"). */
  zoneIds?: string[];
}

const SOURCE_LABEL = { preset: 'Surge', ai: 'AI suggestion · you decide', manual: 'Your change' } as const;

/**
 * One staffing change, ready to approve: the new numbers, who would move to
 * meet them (untick anyone), and anything we couldn't cover.
 */
export function ChangePreview({ change, onDone }: { change: PendingChange; onDone: () => void }) {
  const t = useTheme();
  const volunteers = useStore((s) => s.volunteers);
  const temp = useStore((s) => s.temperatureC);

  // Plan once when the card opens, so the list doesn't reshuffle as people walk.
  const [plan] = useState(() => {
    const s = useStore.getState();
    const zoneIds = Array.from(new Set([...change.changes.map((c) => c.zoneId), ...(change.zoneIds ?? [])]));
    return planFill({
      festival: withTargets(s.festival, change.changes),
      volunteers: Object.values(s.volunteers),
      positionOf: (id) => s.positions[id],
      busyIds: busyVolunteerIds(s),
      now: simNow(),
      tempC: s.temperatureC,
      zoneIds,
    });
  });
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const chosen = plan.moves.filter((m) => !skip.has(m.volunteerId));

  const approve = () => {
    applyStaffing({ title: change.title, note: change.note, source: change.source, changes: change.changes, moves: chosen });
    onDone();
  };

  const isAI = change.source === 'ai';
  return (
    <Card tone={isAI ? 'ai' : 'strong'}>
      <Row>
        <Glyph name={isAI ? 'sparkle' : 'users'} size={18} color={isAI ? t.ai : t.accent} />
        <Txt variant="label" color={isAI ? t.ai : t.accent} style={{ flex: 1 }}>
          {SOURCE_LABEL[change.source]}
        </Txt>
        <Pressable hitSlop={12} onPress={onDone} accessibilityLabel="Cancel">
          <Glyph name="x" size={22} color={t.textSecondary} />
        </Pressable>
      </Row>
      <Txt variant="heading">{change.title}</Txt>

      {change.changes.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <Txt variant="label">New targets</Txt>
          {change.changes.map((c) => {
            const zone = zoneById(c.zoneId);
            const was = zone ? targetFor(zone, c.skill, temp) : 0;
            return (
              <Row key={`${c.zoneId}-${c.skill}`} style={[styles.row, { backgroundColor: t.background, borderColor: t.border }]}>
                <View style={{ flex: 1 }}>
                  <Txt variant="strong">{skillName(c.skill)}</Txt>
                  <Txt variant="caption">{zone?.name}</Txt>
                </View>
                <Txt variant="heading" color={t.textSecondary}>
                  {was}
                </Txt>
                <Glyph name="chevron" size={18} color={t.textSecondary} />
                <Txt variant="heading" color={t.accent}>
                  {c.min}
                </Txt>
              </Row>
            );
          })}
        </View>
      )}

      <View style={{ gap: Spacing.two }}>
        <Txt variant="label">{plan.moves.length ? `Who moves · ${chosen.length} of ${plan.moves.length}` : 'Who moves'}</Txt>
        {plan.moves.length === 0 && plan.shortfalls.length === 0 && <Txt variant="body">Everyone needed is already there.</Txt>}
        {plan.moves.map((m) => {
          const v = volunteers[m.volunteerId];
          const on = !skip.has(m.volunteerId);
          return (
            <Pressable
              key={m.volunteerId}
              onPress={() =>
                setSkip((prev) => {
                  const next = new Set(prev);
                  if (next.has(m.volunteerId)) next.delete(m.volunteerId);
                  else next.add(m.volunteerId);
                  return next;
                })
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [
                styles.row,
                on ? { borderColor: t.accent, backgroundColor: t.accentSoft } : { borderColor: t.border, backgroundColor: t.background },
                { opacity: pressed ? 0.85 : 1 },
              ]}>
              <Avatar name={v?.name} size={44} inverted={on} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="strong" numberOfLines={1}>
                  {v?.name}
                </Txt>
                <Txt variant="caption" numberOfLines={1}>
                  {zoneById(m.fromZoneId)?.name ?? 'Unassigned'} → {zoneById(m.toZoneId)?.name}
                </Txt>
                <Txt variant="label" color={t.accent} numberOfLines={1}>
                  {m.skill ? skillName(m.skill) : 'Extra hands'} · {m.distanceM} m
                </Txt>
              </View>
              <View style={[styles.check, on ? { backgroundColor: t.accent, borderColor: t.accent } : { borderColor: t.border }]}>
                {on && <Glyph name="check" size={18} color="#FFFFFF" strokeWidth={3} />}
              </View>
            </Pressable>
          );
        })}
        {plan.shortfalls.map((f) => (
          <Row key={`${f.zoneId}-${f.skill}`} style={[styles.row, { borderColor: t.high, backgroundColor: t.background, alignItems: 'flex-start' }]}>
            <Glyph name="alert" size={22} color={t.high} />
            <Txt variant="body" style={{ flex: 1 }}>
              Couldn’t find {f.missing} more {skillName(f.skill, f.missing !== 1).toLowerCase()} for {zoneById(f.zoneId)?.name} without leaving
              somewhere else short.
            </Txt>
          </Row>
        ))}
      </View>

      {chosen.length > 0 && (
        <View style={[styles.note, { backgroundColor: t.backgroundElement }]}>
          <Txt variant="label">They’ll be told</Txt>
          <Txt variant="body">{change.note}</Txt>
        </View>
      )}

      <Button
        title={chosen.length ? `Approve and move ${chosen.length === 1 ? '1 person' : `${chosen.length} people`}` : 'Approve'}
        size="lg"
        icon={<Glyph name="check" size={22} color="#FFFFFF" strokeWidth={3} />}
        disabled={change.changes.length === 0 && chosen.length === 0}
        onPress={approve}
      />
      <Button title="Cancel" variant="secondary" onPress={onDone} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1.5, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.three },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  note: { borderRadius: Radius.md, padding: Spacing.three, gap: 2 },
});
