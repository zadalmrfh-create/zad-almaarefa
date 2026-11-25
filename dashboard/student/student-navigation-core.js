/* URL and focus helpers shared by the standalone student navigation controller. */
export const STUDENT_TABS = Object.freeze([
  'overview', 'attendance', 'payments', 'notes', 'lectureRatings', 'progress',
  'schedule', 'bookings', 'lessons', 'profile', 'notifications'
]);

const LEGACY_PANELS = Object.freeze({
  profileCard: 'profile', studentAttendanceCard: 'attendance',
  zadVodafoneStudentPanel: 'payments', studentNotesCard: 'notes',
  studentProgressCard: 'progress', recentBooksCard: 'progress',
  zadStage4ScheduleSection: 'schedule', myBookingsCard: 'bookings',
  liveLessonsCard: 'lessons', studentLectureRatingsPanel: 'lectureRatings',
  studentNotificationsCard: 'notifications'
});

function pageURL(value) {
  return new URL(String(value), 'https://zad.invalid/dashboard/student/index.html');
}

export function studentTabFromURL(value, available = STUDENT_TABS) {
  let url;
  try { url = pageURL(value); } catch { return 'overview'; }
  let fragment = '';
  try { fragment = decodeURIComponent(url.hash.slice(1)); } catch { /* invalid fragments are ignored */ }
  const legacy = LEGACY_PANELS[fragment] || fragment;
  if (available.includes(legacy)) return legacy;
  const requested = url.searchParams.get('tab');
  return available.includes(requested) ? requested : 'overview';
}

export function studentTabURL(value, tab, available = STUDENT_TABS) {
  if (!available.includes(tab)) throw new RangeError('Unknown student tab');
  const url = pageURL(value);
  url.searchParams.set('tab', tab);
  url.hash = '';
  return url.pathname + url.search + url.hash;
}

/** Move keyboard focus into the visible content without losing its heading. */
export function focusStudentPanel(panel, { scroll = true } = {}) {
  if (!panel || panel.hidden) return false;
  const target = panel.querySelector('h1, h2, h3') || panel;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  if (scroll) panel.scrollIntoView({ block: 'start', behavior: 'auto' });
  return true;
}

export function studentErrorMessage(error, subject = 'البيانات') {
  const code = String(error?.code || '');
  if (code.includes('permission-denied')) return `تعذر عرض ${subject} لهذا الحساب. تأكد من حسابك، وتواصل مع الإدارة إذا استمرت المشكلة.`;
  if (code === 'auth/requires-recent-login') return 'سجّل الدخول مرة أخرى لحماية حسابك، ثم أعد المحاولة.';
  if (code.includes('network') || code.includes('unavailable') || code.includes('deadline') || /مهلة/.test(error?.message || '')) return `تعذر تحميل ${subject} بسبب الاتصال. تأكد من الإنترنت ثم اضغط إعادة المحاولة.`;
  return `تعذر إكمال طلب ${subject} الآن. أعد المحاولة، وتواصل مع الإدارة إذا استمرت المشكلة.`;
}
