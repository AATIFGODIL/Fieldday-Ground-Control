import { Alert } from 'react-native';

import { Button, Card, Pill, Row, Txt } from '@/components/ui/primitives';
import { UrgencyColors } from '@/constants/theme';
import { isOnSite } from '@/domain/geo';
import { checkIn, checkOut, formatClock, useStore, zoneById } from '@/state/store';

/** Check-in/out. Location is tracked and shared only while checked in. */
export function ShiftCard({ volunteerId }: { volunteerId: string }) {
  const v = useStore((s) => s.volunteers[volunteerId]);
  const mode = useStore((s) => s.mode);
  const onSite = useStore((s) => {
    const p = s.positions[volunteerId];
    return p ? isOnSite(p, s.festival) : true;
  });
  if (!v) return null;
  const onShift = v.status === 'checked_in';

  return (
    <Card style={onShift && !onSite ? { borderColor: UrgencyColors.critical, borderWidth: 2 } : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="heading">{onShift ? 'On shift' : v.status === 'no_show' ? 'Marked no-show' : 'Off shift'}</Txt>
        <Pill
          label={onShift ? (mode === 'live' ? 'SHARING GPS' : 'SHARING LOCATION') : 'LOCATION OFF'}
          color={onShift ? UrgencyColors.low : undefined}
          solid={onShift}
        />
      </Row>
      <Txt variant="caption">
        {onShift
          ? `Checked in${v.checkedInAt ? ` at ${formatClock(v.checkedInAt)}` : ''} · ${zoneById(v.zoneId)?.name ?? 'Unassigned'}. Your position is visible to the team while you're on shift.`
          : 'Check in when you arrive at your zone. Your location is only tracked and shared while you are checked in.'}
      </Txt>
      {onShift && !onSite && (
        <Txt variant="caption" color={UrgencyColors.critical} style={{ fontWeight: '700' }}>
          You appear to be outside the festival grounds. Head back, or check out if your shift is over.
        </Txt>
      )}
      {onShift ? (
        <Button
          title="Check out"
          variant="secondary"
          onPress={() =>
            Alert.alert('Check out?', 'Location sharing stops and you will no longer be dispatched.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Check out', style: 'destructive', onPress: () => checkOut(volunteerId) },
            ])
          }
        />
      ) : (
        <Button title="Check in" onPress={() => checkIn(volunteerId)} />
      )}
    </Card>
  );
}
