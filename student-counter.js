import { db, FIREBASE_READY } from './firebase-config.js';
import {
  doc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

/**
 * عرض العدد العام للطلاب دون كشف أي بيانات شخصية.
 * يعتمد على publicStats/students ويتم تحديثه لحظيًا.
 */
export function watchStudentCount(elementOrId) {
  const element = typeof elementOrId === 'string'
    ? document.getElementById(elementOrId)
    : elementOrId;

  if (!element) return () => {};

  element.textContent = '0';

  if (!FIREBASE_READY || !db) {
    return () => {};
  }

  const counterRef = doc(db, 'publicStats', 'students');

  return onSnapshot(
    counterRef,
    (snapshot) => {
      const rawTotal = snapshot.exists() ? snapshot.data()?.total : 0;
      const total = Number(rawTotal);
      element.textContent = Number.isFinite(total) && total >= 0
        ? Math.floor(total).toLocaleString('ar-EG')
        : '0';
    },
    (error) => {
      console.warn('تعذر تحميل عداد الطلاب:', error);
      if (!element.textContent || element.textContent === '—') {
        element.textContent = '0';
      }
    }
  );
}
