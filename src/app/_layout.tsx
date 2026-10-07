import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DemoOverlay } from '@/components/demo/demo-overlay';
import { Colors } from '@/constants/theme';
import { usePositionSources } from '@/positions/use-position-sources';
import { initNotifications } from '@/services/notify';
import { useDispatchTakeover } from '@/state/use-dispatch-takeover';

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  usePositionSources();
  useDispatchTakeover();

  useEffect(() => {
    // OS notifications are a native feature; the web preview uses in-app banners only.
    if (Platform.OS === 'web') return;
    void initNotifications();
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { dispatchId?: string; incidentId?: string };
      if (data?.dispatchId) router.push({ pathname: '/dispatch/[id]', params: { id: data.dispatchId } });
      else if (data?.incidentId) router.push({ pathname: '/incident/[id]', params: { id: data.incidentId } });
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider
        value={{
          ...base,
          colors: { ...base.colors, primary: palette.tint, background: palette.background, card: palette.backgroundElement, border: palette.border, text: palette.text },
        }}>
        <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="join" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="register" options={{ presentation: 'modal' }} />
          <Stack.Screen name="volunteer" />
          <Stack.Screen name="lead" />
          <Stack.Screen name="safety" />
          <Stack.Screen name="incident/[id]" options={{ headerShown: true, title: 'Incident' }} />
          <Stack.Screen name="incident/compare" options={{ headerShown: true, title: 'Possibly related' }} />
          <Stack.Screen name="dispatch/[id]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="report-confirm" options={{ presentation: 'modal' }} />
          <Stack.Screen name="inbox" options={{ presentation: 'modal' }} />
          <Stack.Screen name="audit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="demo" options={{ presentation: 'modal' }} />
        </Stack>
        <DemoOverlay />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
