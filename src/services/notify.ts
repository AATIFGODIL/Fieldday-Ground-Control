import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let ready = false;

/**
 * Local notifications only — in the single-device demo the "push" is raised on
 * the device the recipient is using. Swapping to remote push later only
 * changes this module.
 */
export async function initNotifications() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (n) => {
        // In the foreground our own banner shows; let the OS banner through for dispatches only.
        const isDispatch = Boolean((n.request.content.data as { dispatchId?: string } | null)?.dispatchId);
        return {
          shouldShowBanner: isDispatch,
          shouldShowList: true,
          shouldPlaySound: isDispatch,
          shouldSetBadge: false,
        };
      },
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('dispatch', {
        name: 'Dispatches & alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    ready = status === 'granted';
  } catch (e) {
    console.warn('Notifications unavailable', e);
    ready = false;
  }
}

export function notifyDevice(title: string, body: string, data: Record<string, string | undefined>) {
  if (!ready) return;
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  Notifications.scheduleNotificationAsync({
    content: { title, body, data: clean, sound: true },
    trigger: Platform.OS === 'android' ? { channelId: 'dispatch' } : null,
  }).catch((e) => console.warn('Failed to show notification', e));
}
