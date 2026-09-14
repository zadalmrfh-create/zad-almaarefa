importScripts(
  'https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js'
);

importScripts(
  'https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js'
);

firebase.initializeApp({
  apiKey: "AIzaSyB0RRPsezMpT1t7SPKAGC2nD7e5JI46Epo",
  authDomain: "zad-elmarefa.firebaseapp.com",
  projectId: "zad-elmarefa",
  storageBucket: "zad-elmarefa.firebasestorage.app",
  messagingSenderId: "838252439998",
  appId: "1:838252439998:web:76a1d6e22a057fdd99b1ef"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {

  console.log(
    '[firebase-messaging-sw.js] Background message:',
    payload
  );

  const notificationTitle =
    payload.notification?.title ||
    'زاد المعرفة';

  const notificationOptions = {

    body:
      payload.notification?.body ||
      'لديك إشعار جديد',

    icon:
      '/favicon.ico',

    badge:
      '/favicon.ico'

  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );

});