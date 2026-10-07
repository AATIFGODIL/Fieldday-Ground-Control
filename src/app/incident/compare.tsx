import { router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { ReportSummary } from '@/components/incident/parts';
import { SiteMap } from '@/components/map/site-map';
import { Banner, Button, Card, Pill, Row, Screen, Section, Txt } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { canResolveLinks } from '@/domain/escalation';
import { centroid, dist } from '@/domain/geo';
import { useSimNow } from '@/hooks/use-sim-now';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, resolveLink, useStore } from '@/state/store';

/** Two possibly-related reports side by side, before any response is approved. */
export default function Compare() {
  const { link: linkId } = useLocalSearchParams<{ link: string }>();
  const t = useTheme();
  const now = useSimNow(1000);
  const link = useStore((s) => s.links.find((l) => l.id === linkId));
  const a = useStore((s) => s.incidents.find((i) => i.id === link?.a));
  const b = useStore((s) => s.incidents.find((i) => i.id === link?.b));
  const user = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId] : undefined));
  if (!link || !a || !b || !user) return null;

  const allowed = canResolveLinks(user, a, now) || canResolveLinks(user, b, now);
  const resolve = (r: 'same' | 'separate') => {
    const err = resolveLink(link.id, r);
    if (err) Alert.alert("Can't resolve", err);
    else router.back();
  };

  const minutes = Math.round(Math.abs(a.createdAt - b.createdAt) / 60000);
  const metres = Math.round(dist(a.location, b.location));

  return (
    <Screen edges={[]}>
      <Card style={{ borderColor: '#8E4EC6', borderWidth: 1.5 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="label" color="#8E4EC6">{link.source === 'ai' ? 'AI ASSESSMENT' : 'RULE-BASED MATCH'}</Txt>
          {link.source === 'ai' && <Pill label={`${Math.round(link.confidence * 100)}% SAME`} color="#8E4EC6" solid />}
        </Row>
        <Txt variant="body">{link.reason}</Txt>
        <Txt variant="caption">
          Reported {minutes === 0 ? 'within a minute' : `${minutes} min`} apart, {metres} m apart.
        </Txt>
      </Card>

      <SiteMap
        focus={{ center: centroid([a.location, b.location]), radius: Math.max(80, metres * 0.75) }}
        height={200}
        interactive={false}
        focusIncidentIds={[a.id, b.id]}
        highlightIds={[a.reporterId, b.reporterId]}
      />

      <Row style={{ alignItems: 'flex-start', gap: Spacing.two }}>
        {[a, b].map((inc) => (
          <Card key={inc.id} style={{ flex: 1 }}>
            <Txt variant="heading">{inc.ref}</Txt>
            <Txt variant="caption">{formatClock(inc.createdAt)}</Txt>
            <ReportSummary incident={inc} compact />
          </Card>
        ))}
      </Row>

      <Section title="Decision">
        {!allowed && <Banner tone="info" title="Waiting for the safety lead" body="Only the safety lead can decide this until the escalation window opens." />}
        <View style={{ gap: Spacing.two }}>
          <Button title="Same incident — merge reports" disabled={!allowed} onPress={() => resolve('same')} />
          <Button title="Separate incidents" variant="secondary" disabled={!allowed} onPress={() => resolve('separate')} />
        </View>
        <Txt variant="caption" color={t.textSecondary}>
          Merging keeps the earlier report and folds the later one into it, so only one response is dispatched.
        </Txt>
      </Section>
    </Screen>
  );
}
