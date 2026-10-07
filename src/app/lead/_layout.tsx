import { Redirect } from 'expo-router';

import { RoleTabs } from '@/components/role-tabs';
import { useStore } from '@/state/store';

export default function LeadLayout() {
  const open = useStore((s) => {
    const zone = s.currentUserId ? s.volunteers[s.currentUserId]?.leadsZoneId : undefined;
    return s.incidents.filter((i) => i.zoneId === zone && (i.status === 'suggested' || i.status === 'no_suggestion' || i.status === 'logged')).length;
  });
  const allowed = useStore((s) => {
    const v = s.currentUserId ? s.volunteers[s.currentUserId] : undefined;
    return !!v && v.role === 'location_lead';
  });
  // Signed out or wrong role (e.g. after switching identity): route home.
  if (!allowed) return <Redirect href="/" />;
  return (
    <RoleTabs
      base="/lead"
      tabs={[
        { name: 'index', label: 'My zone', sf: 'exclamationmark.triangle.fill', md: 'warning', glyph: 'alert', badge: open ? String(open) : undefined },
        { name: 'map', label: 'Map', sf: 'map.fill', md: 'map', glyph: 'map' },
      ]}
    />
  );
}
