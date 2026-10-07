import { Alert, Platform, View } from 'react-native';

import { Glyph } from '@/components/ui/glyph';
import { Button, Card, Row, Txt } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { isOnSite } from '@/domain/geo';
import { useTheme } from '@/hooks/use-theme';
import { checkIn, checkOut, formatClock, useStore, zoneById } from '@/state/store';

/** Check in/out. Your location is tracked and shared only while you're checked in. */
export function ShiftCard({ volunteerId }: { volunteerId: string }) {
  const t = useTheme();
  const v = useStore((s) => s.volunteers[volunteerId]);
  const onSite = useStore((s) => {
    const p = s.positions[volunteerId];
    return p ? isOnSite(p, s.festival) : true;
  });
  if (!v) return null;
  const onShift = v.status === 'checked_in';

  const confirmOut = () => {
    if (Platform.OS === 'web') {
      checkOut(volunteerId);
      return;
    }
    Alert.alert('Check out?', 'We stop sharing your location and won’t send you to incidents.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Check out', style: 'destructive', onPress: () => checkOut(volunteerId) },
    ]);
  };

  return (
    <Card tone={onShift && !onSite ? 'strong' : 'plain'}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, marginTop: 8, backgroundColor: onShift ? t.text : 'transparent', borderWidth: 2, borderColor: t.text }} />
        <View style={{ flex: 1, gap: Spacing.one }}>
          <Txt variant="heading">{onShift ? 'You’re on shift' : v.status === 'no_show' ? 'Marked as not here' : 'You’re off shift'}</Txt>
          <Txt variant="caption">
            {onShift
              ? `Since ${v.checkedInAt ? formatClock(v.checkedInAt) : 'earlier'} · ${zoneById(v.zoneId)?.name ?? 'Unassigned'}. The team can see where you are until you check out.`
              : 'Check in when you reach your zone. Your location is only shared while you’re checked in.'}
          </Txt>
        </View>
      </Row>
      {onShift && !onSite && (
        <Row style={{ alignItems: 'flex-start' }}>
          <Glyph name="alert" size={22} color={t.text} />
          <Txt variant="strong" style={{ flex: 1 }}>
            You seem to be outside the festival. Head back, or check out if you’re done.
          </Txt>
        </Row>
      )}
      {onShift ? <Button title="Check out" variant="secondary" onPress={confirmOut} /> : <Button title="Check in" onPress={() => checkIn(volunteerId)} />}
    </Card>
  );
}
