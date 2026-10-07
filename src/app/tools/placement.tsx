import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Banner, Button, Card, Pill, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { SkillColors, UrgencyColors } from '@/constants/theme';
import { gapsAt } from '@/domain/coverage';
import { SKILL_SHORT } from '@/domain/types';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { proposePlacement, type PlacementProposal } from '@/state/pipeline';
import { applyPlacement, useStore, zoneById } from '@/state/store';

/** AI placement suggestions the safety lead reviews, trims and applies. */
export default function Placement() {
  const t = useTheme();
  const now = useSimNow(5000);
  const volunteers = useStore((s) => s.volunteers);
  const festival = useStore((s) => s.festival);
  const temperatureC = useStore((s) => s.temperatureC);
  const [proposal, setProposal] = useState<PlacementProposal | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);

  const gaps = gapsAt(festival, Object.values(volunteers), now);

  const suggest = async () => {
    setBusy(true);
    setApplied(null);
    setExcluded(new Set());
    setProposal(await proposePlacement());
    setBusy(false);
  };

  const chosen = proposal?.moves.filter((m) => !excluded.has(m.volunteerId)) ?? [];

  // Group moves by destination zone for review.
  const byZone = new Map<string, NonNullable<typeof proposal>['moves']>();
  for (const m of proposal?.moves ?? []) byZone.set(m.toZoneId, [...(byZone.get(m.toZoneId) ?? []), m]);

  return (
    <Screen>
      <View style={{ gap: 2, paddingRight: 160 }}>
        <Txt variant="label" color={t.tint}>{temperatureC}°C · {Object.values(volunteers).filter((v) => v.role === 'volunteer').length} VOLUNTEERS</Txt>
        <Txt variant="title">Placement</Txt>
        <Txt variant="caption">AI suggests where people should stand based on skills and today’s risks. You decide; you can also drag dots on the map.</Txt>
      </View>

      <Section title={`Unmet requirements now (${gaps.length})`}>
        {gaps.length === 0 ? (
          <Txt variant="caption">Every zone meets its requirements right now.</Txt>
        ) : (
          gaps.map((g) => (
            <Row key={`${g.zoneId}${g.skill}`} style={{ justifyContent: 'space-between' }}>
              <Txt variant="body">{g.label}</Txt>
              <Pill label={`NEED ${g.required - g.have}`} color={UrgencyColors.critical} solid />
            </Row>
          ))
        )}
      </Section>

      <Button title={busy ? 'Thinking about placement…' : proposal ? 'Suggest again' : 'Suggest placement'} size="lg" loading={busy} onPress={suggest} />

      {proposal && (
        <>
          {proposal.source === 'rules' && (
            <Banner tone="warn" title="AI placement unavailable — showing a rule-based plan" body={proposal.failReason} />
          )}
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="label">{proposal.source === 'ai' ? 'AI SUGGESTION' : 'RULE-BASED'}</Txt>
              <Pill label={`${chosen.length}/${proposal.moves.length} MOVES`} />
            </Row>
            <Txt variant="body">{proposal.summary}</Txt>
          </Card>

          {[...byZone.entries()].map(([zoneId, moves]) => (
            <Section key={zoneId} title={`→ ${zoneById(zoneId)?.name}`}>
              {proposal.zoneNotes[zoneId] && <Txt variant="caption">{proposal.zoneNotes[zoneId]}</Txt>}
              {moves.map((m) => {
                const v = volunteers[m.volunteerId];
                const on = !excluded.has(m.volunteerId);
                return (
                  <Pressable
                    key={m.volunteerId}
                    onPress={() =>
                      setExcluded((e) => {
                        const n = new Set(e);
                        if (n.has(m.volunteerId)) n.delete(m.volunteerId);
                        else n.add(m.volunteerId);
                        return n;
                      })
                    }>
                    <Card style={{ opacity: on ? 1 : 0.45, borderColor: on ? t.tint : t.border }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Txt variant="body" style={{ fontWeight: '700' }}>{v?.name}</Txt>
                        <Pill label={on ? 'INCLUDED' : 'SKIPPED'} color={on ? t.tint : undefined} />
                      </Row>
                      <Row gap={4} style={{ flexWrap: 'wrap' }}>
                        <Txt variant="caption">from {zoneById(v?.zoneId)?.name ?? '—'}</Txt>
                        {v?.skills.map((s) => (
                          <Pill key={s} label={SKILL_SHORT[s]} color={SkillColors[s]} />
                        ))}
                      </Row>
                      <Txt variant="caption">{m.reason}</Txt>
                    </Card>
                  </Pressable>
                );
              })}
            </Section>
          ))}

          {proposal.moves.length > 0 && (
            <Button
              title={`Apply ${chosen.length} move${chosen.length === 1 ? '' : 's'}`}
              size="lg"
              disabled={chosen.length === 0}
              onPress={() => {
                applyPlacement(chosen, excluded.size ? 'manual' : proposal.source);
                setApplied(chosen.length);
                setProposal(null);
              }}
            />
          )}
        </>
      )}
      {applied !== null && <Banner tone="ok" title={`Applied ${applied} moves`} body="Volunteers are walking to their new zones on the map." />}
    </Screen>
  );
}
