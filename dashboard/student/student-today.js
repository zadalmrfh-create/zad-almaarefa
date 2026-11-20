import {chooseLesson, latestExam, pendingBookings} from './student-today-core.js?v=20261120-today1';
import {money} from '../payment-utils.js';

const card = document.getElementById('studentToday');
const status = document.getElementById('studentTodayStatus');
const title = document.getElementById('studentTodayTitle');
const detail = document.getElementById('studentTodayDetail');
const action = document.getElementById('studentTodayAction');
const formatLesson = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit'
});
const formatNumber = new Intl.NumberFormat('ar-EG');
const snapshotSources = new Map();
let uid = '';
let lessons = [];
let lessonState = 'loading';
let account = {bookings: [], due: null, bookingState: 'loading', financeState: 'loading'};
let primaryAction;

function selectTab(tab) {
  document.querySelector('.student-tabs [data-student-tab="' + tab + '"]')?.click();
}
function focusSection(target) {
  if (!target) return;
  target.focus({preventScroll: true});
  target.scrollIntoView({block: 'start'});
}
function openLesson(id) {
  selectTab('lessons');
  requestAnimationFrame(() => {
    const row = [...document.querySelectorAll('[data-student-lesson-id]')].find(node => node.dataset.studentLessonId === id);
    focusSection(row || document.getElementById('liveLessonsCard'));
  });
}
function summaryCard(name, value, note, activate) {
  const box = document.querySelector('[data-today-summary="' + name + '"]');
  box.querySelector('strong').textContent = value;
  box.querySelector('small').textContent = note;
  box.onclick = activate;
  box.disabled = !uid;
}
function setCard(phase, label, heading, description, labelAction, activate) {
  if (card.dataset.phase !== phase) card.dataset.phase = phase;
  if (status.textContent !== label) status.textContent = label;
  if (title.textContent !== heading) title.textContent = heading;
  if (detail.textContent !== description) detail.textContent = description;
  if (action.textContent !== labelAction) action.textContent = labelAction;
  primaryAction = activate;
  action.disabled = !uid;
}

function renderLesson() {
  const now = Date.now();
  const next = chooseLesson(lessons, now);
  if (next) {
    const {lesson, phase} = next;
    const when = formatLesson.format(lesson.start);
    const caption = [when, lesson.teacher, 'بتوقيت القاهرة'].filter(Boolean).join(' · ');
    if (phase === 'available') {
      const started = lesson.start <= now;
      setCard(phase, started ? 'الحصة جارية الآن' : 'الدخول متاح الآن', lesson.title,
        caption, 'ادخل الحصة', () => lesson.join());
    } else if (phase === 'past') {
      setCard(phase, 'آخر حصة مجدولة', lesson.title, caption, 'راجع تفاصيل الحصة', () => openLesson(lesson.id));
    } else if (phase === 'details') {
      setCard(phase, 'موعد الحصة بدأ', lesson.title, caption, 'راجع تفاصيل الحصة', () => openLesson(lesson.id));
    } else {
      setCard(phase, 'حصتك الجاية', lesson.title, caption, 'عرض موعد الحصة', () => openLesson(lesson.id));
    }
    return;
  }

  if (lessonState === 'loading') {
    setCard('loading', 'جدول الحصص', 'بنحمّل مواعيد حصصك', '', 'افتح الجدول', () => selectTab('schedule'));
    return;
  }
  if (lessonState === 'error') {
    setCard('empty', 'جدول الحصص', 'تعذر تحميل مواعيد الحصص', 'تقدر تعيد المحاولة من الجدول.',
      'افتح الجدول', () => selectTab('schedule'));
    return;
  }
  if (account.bookingState === 'ready' && pendingBookings(account.bookings).length) {
    setCard('empty', 'الحجوزات', 'عندك حجز لسه قيد المتابعة', 'تابع آخر تحديث لطلبك من حسابك.',
      'تابع الحجز', () => selectTab('bookings'));
    return;
  }
  if (account.financeState === 'ready' && account.due > 0) {
    setCard('empty', 'المدفوعات', 'فيه مبلغ مستحق على حسابك', money(account.due),
      'عرض المدفوعات', () => selectTab('payments'));
    return;
  }
  setCard('empty', 'الخطوة التالية', 'مفيش حصة قريبة في جدولك', 'تقدر تستغل الوقت في امتحان مجاني.',
    'استعرض الامتحانات', () => { location.href = '../../sections/tests/code-exams.html'; });
}

function renderSummary() {
  const sources = [...snapshotSources.values()];
  const result = latestExam(sources.flatMap(source => source.items));
  const goToResults = () => {
    if (result?.href) location.href = result.href;
    else focusSection(document.getElementById('zad-results-heading'));
  };
  const noResult = sources.length < 3 || sources.some(x => x.state === 'loading') ? 'جارٍ التحميل'
    : sources.some(x => x.state === 'error') ? 'تعذر التحديث' : 'لا توجد نتائج';
  summaryCard('exam', result?.label || noResult, result?.title || 'عرض سجل الامتحانات', goToResults);

  const pending = pendingBookings(account.bookings);
  const bookingText = account.bookingState === 'loading' ? 'جارٍ التحميل'
    : account.bookingState === 'error' ? 'تعذر التحديث' : pending.length
      ? formatNumber.format(pending.length) + ' قيد المتابعة' : 'مفيش حجز معلّق';
  summaryCard('bookings', bookingText, pending[0]?.subject || 'عرض طلبات الحجز', () => selectTab('bookings'));

  const dueText = account.financeState === 'loading' ? 'جارٍ التحميل'
    : account.financeState === 'error' ? 'تعذر التحديث' : account.due > 0
      ? money(account.due) : 'مفيش مستحقات';
  summaryCard('payments', dueText, account.due > 0 ? 'بعد خصم الرصيد المقدم' : 'عرض المدفوعات',
    () => selectTab('payments'));
}

action.addEventListener('click', () => primaryAction?.());
window.addEventListener('zad:student-today-account', event => {
  uid = event.detail.uid;
  lessons = [];
  lessonState = 'loading';
  account = {bookings: [], due: null, bookingState: 'loading', financeState: 'loading'};
  snapshotSources.clear();
  renderLesson();
  renderSummary();
});
window.addEventListener('zad:student-today-lessons', event => {
  if (event.detail.uid !== uid) return;
  lessons = event.detail.lessons;
  lessonState = event.detail.state;
  renderLesson();
});
window.addEventListener('zad:stage4-dashboard-data', event => {
  if (event.detail.uid !== uid) return;
  account = event.detail;
  renderLesson();
  renderSummary();
});
window.addEventListener('zad:student-today-results', event => {
  if (event.detail.uid !== uid) return;
  snapshotSources.set(event.detail.source, event.detail);
  renderSummary();
});
setInterval(renderLesson, 10_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderLesson(); });
renderLesson();
