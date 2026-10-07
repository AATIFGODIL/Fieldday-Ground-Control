import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Row, Screen, Txt } from '@/components/ui/primitives';
import { formatClock, useStore } from '@/state/store';

/** Who did what, when — including every approval and who made it. */
export default function Audit() {
  const audit = useStore((s) => s.audit);
  const incidents = useStore((s) => s.incidents);
  return (
    <Screen edges={['top', 'bottom']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="title">Audit log</Txt>
        <Button title="Done" variant="secondary" size="sm" onPress={() => router.back()} />
      </Row>
      <Card>
        {audit.map((a) => (
          <Row key={a.id} style={{ alignItems: 'flex-start' }}>
            <Txt variant="caption" style={{ width: 64 }}>{formatClock(a.at)}</Txt>
            <View style={{ flex: 1 }}>
              <Txt variant="caption" style={{ fontWeight: '700' }}>
                {a.actorName}
                {a.incidentId ? ` · ${incidents.find((i) => i.id === a.incidentId)?.ref ?? ''}` : ''}
              </Txt>
              <Txt variant="caption">{a.action}</Txt>
              {a.detail ? <Txt variant="caption" numberOfLines={2}>{a.detail}</Txt> : null}
            </View>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
