import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { SiteMap } from '@/components/map/site-map';
import { Icon } from '@/components/ui/icon';
import { Button, Card, Pill, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing, UrgencyColors } from '@/constants/theme';
import { BRIEF_LEVEL_LABELS, briefLevelForDistance } from '@/domain/brief';
import { centroid, compassDirection, dist } from '@/domain/geo';
import { WALK_SPEED_MPS } from '@/domain/matching';
import { INCIDENT_TYPE_LABELS, type BriefLevel } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { speak, stopSpeaking } from '@/services/speech';
import { setDispatchStatus, useStore, zoneById } from '@/state/store';

/**
 * "You're needed": where to go, what to expect, and a spoken brief whose
 * detail matches how far the volunteer has to walk.
 */
export default function DispatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const d = useStore((s) => s.dispatches.find((x) => x.id === id));
  const incident = useStore((s) => s.incidents.find((i) => i.id === d?.incidentId));
  const plan = incident?.approvedPlan;
  const movement = useStore((s) => (d ? s.movements[d.volunteerId] : undefined));
  const pos = useStore((s) => (d ? s.positions[d.volunteerId] : undefined));
  const me = useStore((s) => s.currentUserId);
  const reporter = useStore((s) => (incident ? s.volunteers[incident.reporterId] : undefined));

  const autoLevel: BriefLevel = d ? briefLevelForDistance(d.distanceM) : 'oneSentence';
  const [level, setLevel] = useState<BriefLevel>(autoLevel);
  const [speaking, setSpeaking] = useState(false);
  const autoPlayed = useRef(false);

  const play = (lvl: BriefLevel) => {
    if (!d?.brief) return;
    setLevel(lvl);
    setSpeaking(true);
    speak(d.brief[lvl], { onDone: () => setSpeaking(false) });
  };

  // Read the brief out as soon as it's ready — the volunteer is already walking.
  useEffect(() => {
    if (d?.brief && !autoPlayed.current && d.volunteerId === me && d.status !== 'declined') {
      autoPlayed.current = true;
      play(autoLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.brief]);

  useEffect(() => () => stopSpeaking(), []);

  if (!d || !incident || !plan) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Txt variant="heading">Dispatch not found.</Txt>
        <Button title="Close" onPress={() => router.back()} />
      </Screen>
    );
  }

  const zone = zoneById(incident.zoneId);
  const target = incident.location;
  const remaining = movement?.dispatchId === d.id ? Math.round(movement.total - movement.travelled) : pos ? Math.round(dist(pos, target)) : d.distanceM;
  const direction = compassDirection(pos ?? d.path[0], target);
  const eta = Math.max(1, Math.round(remaining / WALK_SPEED_MPS / 60));
  const color = UrgencyColors[incident.urgency];
  const isMine = d.volunteerId === me;

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ paddingTop: Spacing.two }}>
      <View style={[styles.hero, { backgroundColor: color }]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="label" color="#fff">{d.status === 'on_scene' ? "YOU'RE ON SCENE" : "YOU'RE NEEDED"} · {incident.ref}</Txt>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              stopSpeaking();
              router.back();
            }}>
            <Txt variant="label" color="#fff">CLOSE ✕</Txt>
          </Pressable>
        </Row>
        <Txt variant="title" color="#fff">{INCIDENT_TYPE_LABELS[incident.type]}</Txt>
        <Txt variant="heading" color="#fff">
          {zone?.name}
          {incident.locationNote ? ` · ${incident.locationNote}` : ''}
        </Txt>
        <Row gap={Spacing.three} style={{ marginTop: 4 }}>
          <Stat label="TO GO" value={d.status === 'on_scene' ? '0 m' : `${remaining} m`} />
          <Stat label="HEAD" value={direction.charAt(0).toUpperCase() + direction.slice(1)} />
          <Stat label="ETA" value={d.status === 'on_scene' ? 'now' : `${eta} min`} />
        </Row>
      </View>

      <SiteMap
        focus={{ center: centroid([d.path[0], target]), radius: Math.max(60, d.distanceM * 0.62) }}
        height={200}
        interactive={false}
        pathDispatchIds={[d.id]}
        focusIncidentIds={[incident.id]}
        highlightIds={[d.volunteerId]}
        showLabels
      />

      <Card style={{ gap: Spacing.three }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="label">SPOKEN BRIEF</Txt>
          {d.brief && <Pill label={d.brief.source === 'ai' ? 'AI' : 'TEMPLATE'} />}
        </Row>
        {d.briefPending || !d.brief ? (
          <Row>
            <ActivityIndicator />
            <Txt variant="body">Preparing your brief…</Txt>
          </Row>
        ) : (
          <>
            <Txt variant="caption">
              {BRIEF_LEVEL_LABELS[autoLevel]} brief chosen for a {d.distanceM} m walk. Replay at any level:
            </Txt>
            <Segmented
              value={level}
              options={(['oneSentence', 'locationAndExpect', 'full'] as BriefLevel[]).map((l) => [l, BRIEF_LEVEL_LABELS[l]])}
              onChange={(v) => play(v as BriefLevel)}
            />
            <Txt variant="body" style={{ fontSize: 18, lineHeight: 26 }} selectable>
              {d.brief[level]}
            </Txt>
            <Button
              title={speaking ? 'Stop reading' : 'Read aloud'}
              variant={speaking ? 'secondary' : 'primary'}
              icon={<Icon ios={speaking ? 'stop.fill' : 'speaker.wave.2.fill'} android={speaking ? 'stop' : 'volume_up'} color={speaking ? t.text : t.tintText} />}
              onPress={() => {
                if (speaking) {
                  stopSpeaking();
                  setSpeaking(false);
                } else play(level);
              }}
            />
          </>
        )}
      </Card>

      <Section title="Your instructions">
        <Card>
          <Txt variant="heading" style={{ fontSize: 16 }}>{d.role}</Txt>
          <Txt variant="body">{d.message}</Txt>
          <Txt variant="caption"><Txt variant="caption" style={{ fontWeight: '800' }}>Expect: </Txt>{plan.whatToExpect}</Txt>
          <Txt variant="caption"><Txt variant="caption" style={{ fontWeight: '800' }}>Find: </Txt>{plan.whoToFind}</Txt>
          {reporter && <Txt variant="caption">Reported by {reporter.name}{reporter.phone ? ` · ${reporter.phone}` : ''}</Txt>}
        </Card>
      </Section>

      {isMine && d.status !== 'declined' && d.status !== 'on_scene' && (
        <View style={{ gap: Spacing.two }}>
          {d.status === 'notified' && (
            <Button title="On my way" size="lg" onPress={() => setDispatchStatus(d.id, 'acknowledged')} />
          )}
          <Button title="I'm on scene" size="lg" variant={d.status === 'notified' ? 'secondary' : 'primary'} onPress={() => setDispatchStatus(d.id, 'on_scene')} />
          <Button
            title="Can't attend"
            variant="ghost"
            onPress={() => {
              stopSpeaking();
              setDispatchStatus(d.id, 'declined');
              router.back();
            }}
          />
        </View>
      )}
      {d.status === 'on_scene' && <Pill label="ARRIVED — the safety lead has been notified" color={UrgencyColors.low} solid style={{ alignSelf: 'center' }} />}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Txt variant="label" color="#ffffffcc">{label}</Txt>
      <Txt variant="heading" color="#fff">{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.lg, padding: Spacing.three, gap: 4 },
});
