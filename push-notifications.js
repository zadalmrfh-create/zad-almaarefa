import { auth, db, FCM_VAPID_KEY } from './firebase-config.js';

import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging.js';

import {
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';


async function setupPushNotifications() {
  try {
    // نتأكد إن المتصفح بيدعم الإشعارات
    const supported = await isSupported();

    if (!supported) {
      console.log('هذا المتصفح لا يدعم إشعارات Push.');
      return;
    }

    // لازم يكون المستخدم مسجل دخول
    if (!auth.currentUser) {
      console.log('المستخدم غير مسجل الدخول.');
      return;
    }

    // تسجيل Service Worker
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    );

    console.log('Service Worker تم تسجيله بنجاح.');

    // طلب إذن الإشعارات
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('المستخدم لم يسمح بالإشعارات.');
      return;
    }

    const messaging = getMessaging();

    // الحصول على Token
    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      console.log('لم يتم الحصول على FCM Token.');
      return;
    }

    console.log('FCM Token:', token);

    // حفظ Token للطالب
    const uid = auth.currentUser.uid;

    await addDoc(
      collection(db, 'users', uid, 'fcmTokens'),
      {
        token: token,
        createdAt: serverTimestamp()
      }
    );

    console.log('تم حفظ FCM Token بنجاح.');

    // استقبال الإشعار عندما الموقع مفتوح
    onMessage(messaging, (payload) => {
      console.log('إشعار أثناء فتح الموقع:', payload);

      const title =
        payload.notification?.title || 'زاد المعرفة';

      const body =
        payload.notification?.body || 'لديك إشعار جديد';

      new Notification(title, {
        body: body,
        icon: '/favicon.ico'
      });
    });

  } catch (error) {
    console.error('خطأ في إشعارات Push:', error);
  }
}


// تشغيل النظام بعد تسجيل الدخول
auth.onAuthStateChanged(async (user) => {
  if (user) {
    await setupPushNotifications();
  }
});