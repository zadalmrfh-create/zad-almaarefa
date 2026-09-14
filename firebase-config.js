// إعدادات Firebase — استبدل القيم بقيم مشروعك من Firebase Console.
// هذه القيم ليست كلمة مرور سرية، لكنها يجب أن تخص مشروعك أنت.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyB0RRPsezMpT1t7SPKAGC2nD7e5JI46Epo",
  authDomain: "zad-elmarefa.firebaseapp.com",
  projectId: "zad-elmarefa",
  storageBucket: "zad-elmarefa.firebasestorage.app",
  messagingSenderId: "838252439998",
  appId: "1:838252439998:web:76a1d6e22a057fdd99b1ef"
};

export const ADMIN_EMAIL = 'maleksameh121@gmail.com';
export const FCM_VAPID_KEY = 'BJTiIKho0Y0w-8DK60vnRm3-SRm1jHfbRei5oI5Nj_65_P5iYXrZVdwigvSfrf303cLSx_AkFp4Opl6YFM1acvg';
export const FIREBASE_READY = !Object.values(firebaseConfig).some(v => String(v).includes('ضع_')) && !ADMIN_EMAIL.includes('ضع_');

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
