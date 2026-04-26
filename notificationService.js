// ═══════════════════════════════════════════════════
// src/services/notificationService.js
// Firebase Cloud Messaging for VEGA
// ═══════════════════════════════════════════════════

import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { updateFCMToken } from './firestoreService';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
export const requestNotificationPermission = async () => {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('Notification permission granted:', authStatus);
    return true;
  }
  return false;
};

// Get FCM token and save to Firestore
export const getFCMToken = async (userPhone) => {
  try {
    if (!Device.isDevice) {
      console.log('FCM: physical device required for push notifications');
      return null;
    }

    const token = await messaging().getToken();
    console.log('FCM Token:', token);

    if (userPhone) {
      await updateFCMToken(userPhone, token);
    }

    return token;
  } catch (error) {
    console.error('getFCMToken error:', error);
    return null;
  }
};

// Listen for foreground messages
export const setupForegroundListener = (onMessage) => {
  return messaging().onMessage(async remoteMessage => {
    console.log('FCM foreground message:', remoteMessage);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: remoteMessage.notification?.title || 'VEGA',
        body: remoteMessage.notification?.body || '',
        data: remoteMessage.data || {},
        sound: 'default',
      },
      trigger: null, // immediate
    });

    if (onMessage) onMessage(remoteMessage);
  });
};

// Handle background/quit state messages
export const setupBackgroundHandler = () => {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('FCM background message:', remoteMessage);
  });
};

// Standard VEGA notifications
export const VEGA_NOTIFICATIONS = {
  bookingConfirmed: (orderId, proName, otp) => ({
    title: '🎉 Booking Confirmed! — VEGA',
    body: `Order #${orderId} confirmed. ${proName} assigned. OTP: ${otp}`,
  }),
  professionalOnWay: (proName, eta) => ({
    title: `🏍️ ${proName} is on the way!`,
    body: `Arriving in ~${eta} minutes. Keep your OTP ready.`,
  }),
  serviceStarted: (serviceName) => ({
    title: `⚡ Service Started — ${serviceName}`,
    body: 'Your VEGA professional has started the service.',
  }),
  serviceCompleted: (orderId) => ({
    title: '✅ Service Completed!',
    body: `Order #${orderId} done. Please rate your experience and earn ₹50!`,
  }),
  offerAlert: (code, discount) => ({
    title: `🎁 Special Offer — ${discount}`,
    body: `Use code ${code} before it expires today!`,
  }),
  walletCredit: (amount) => ({
    title: `💰 ₹${amount} added to VEGA Wallet!`,
    body: 'Your wallet balance has been updated.',
  }),
};
