import { Redirect, router, usePathname, type Href } from 'expo-router';

import { Button, EmptyState, Screen } from '@/components/ui/primitives';

/**
 * An address that doesn't exist. Routes are case-sensitive and phones often
 * capitalise the first letter of a typed address (/Pitch), so try the
 * lower-case path before giving up.
 */
export default function NotFound() {
  const path = usePathname();
  const lower = path.toLowerCase();
  if (lower !== path) return <Redirect href={lower as Href} />;
  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <EmptyState title="This page doesn’t exist" body={path}>
        <Button title="Open Ground Control" size="lg" onPress={() => router.replace('/')} />
        <Button title="Open the pitch" variant="secondary" onPress={() => router.replace('/pitch')} />
      </EmptyState>
    </Screen>
  );
}
