import { Redirect } from 'expo-router';

import { useStore } from '@/state/store';

/** Route to the right place for whoever is holding the phone. */
export default function Index() {
  const onboarded = useStore((s) => s.onboarded);
  const festivalId = useStore((s) => s.festivalId);
  const user = useStore((s) => (s.currentUserId ? s.volunteers[s.currentUserId] : undefined));

  if (!onboarded) return <Redirect href="/welcome" />;
  if (!festivalId) return <Redirect href="/join" />;
  if (!user) return <Redirect href="/sign-in" />;
  if (user.role === 'safety_lead') return <Redirect href="/safety" />;
  if (user.role === 'location_lead') return <Redirect href="/lead" />;
  return <Redirect href="/volunteer" />;
}
