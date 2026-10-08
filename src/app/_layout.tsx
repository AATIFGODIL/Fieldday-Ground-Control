import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DemoOverlay } from '@/components/demo/demo-overlay';
import { PhoneFrame } from '@/components/phone-frame';
import { Colors } from '@/constants/theme';
import { useApplyAppearance, useColorScheme } from '@/hooks/use-color-scheme';
import { usePositionSources } from '@/positions/use-position-sources';
import { initNotifications } from '@/services/notify';
import { useDispatchTakeover } from '@/state/use-dispatch-takeover';

// Expo Go can't do remote push; local notifications still work. Don't nag about it.
LogBox.ignoreLogs(['expo-notifications']);

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useApplyAppearance();
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
          colors: { ...base.colors, primary: palette.text, background: palette.background, card: palette.background, border: palette.border, text: palette.text },
        }}>
        <PhoneFrame>
          <Stack
            screenOptions={{
              headerShown: false,
              headerBackButtonDisplayMode: 'minimal',
              headerShadowVisible: false,
              headerTintColor: palette.text,
              headerTitleStyle: { fontSize: 19, fontWeight: '700' },
              headerStyle: { backgroundColor: palette.background },
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
            <Stack.Screen name="pitch" options={{ animation: 'fade' }} />
            <Stack.Screen name="join" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="register" options={{ presentation: 'modal' }} />
            <Stack.Screen name="volunteer" />
            <Stack.Screen name="lead" />
            <Stack.Screen name="safety" />
            <Stack.Screen name="incident/[id]" options={{ headerShown: true, title: 'Incident' }} />
            <Stack.Screen name="incident/compare" options={{ headerShown: true, title: 'Compare reports' }} />
            <Stack.Screen name="tools/placement" options={{ headerShown: true, title: 'Find cover' }} />
            <Stack.Screen name="tools/coverage" options={{ headerShown: true, title: 'Coverage' }} />
            <Stack.Screen name="tools/zones" options={{ headerShown: true, title: 'Zones' }} />
            <Stack.Screen name="tools/shift" options={{ headerShown: true, title: 'My availability' }} />
            <Stack.Screen name="tools/team" options={{ headerShown: true, title: 'My team' }} />
            {/* Pushed as pages (sliding up), not native modals, so the guide card and alerts stay on top. */}
            <Stack.Screen name="dispatch/[id]" options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
            <Stack.Screen name="report-confirm" options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
            <Stack.Screen name="inbox" options={{ presentation: 'modal' }} />
            <Stack.Screen name="audit" options={{ presentation: 'modal' }} />
            <Stack.Screen name="demo" options={{ presentation: 'modal' }} />
          </Stack>
          <DemoOverlay />
        </PhoneFrame>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
