import {auth} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {todayQueue, todayQueues} from './today-queues.js?v=20261122-step5';

const $ = id => document.getElementById(id);
const home = $('zadAdminToday');
const queue = $('zadAdminEssayList');
const count = new Intl.NumberFormat('ar-EG');
const sources = ['code', 'unit', 'special'];
const labels = {'code':'امتحان بالكود', 'unit':'امتحان الوحدة الأولى', 'special':'امتحان من بنك المنصة'};
let opened = false;
let owner = '';

function item(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function open(tab, sectionId, financeMode) {
  window.dispatchEvent(new CustomEvent('zad:open-admin-tab', {detail:{tab, sectionId, financeMode}}));
}

function select(id, value) {
  const input = $(id);
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event('change', {bubbles:true}));
}

function essaySources() {
  const values = sources.map(key => todayQueue(key, owner));
  const entries = values.flatMap(value => value?.items || []).sort((a,b) => b.when-a.when);
  return {entries, complete: values.every(value => value && !value.error && !value.limited), 
    waiting: values.some(value => !value), limited: values.some(value => value?.limited),
    error: values.some(value => value?.error)};
}

function renderEssays(view) {
  queue.replaceChildren();
  if (view.waiting || view.limited || view.error) {
    const message = view.waiting ? 'جارٍ تحميل بعض الامتحانات…' :
      view.error ? 'تعذر تحميل بعض المصادر. حدّث الصفحة وأعد المحاولة.' :
      'امتحانات بنك المنصة معروضة من أحدث ١٥٠ محاولة.';
    queue.append(item('p', message));
  }
  if (!view.entries.length) {
    if (view.complete) queue.append(item('p', 'مفيش أسئلة مقالية مستنية تصحيح.'));
    return;
  }

  const list = document.createElement('ul');
  list.className = 'zad-today-list';
  for (const entry of view.entries) {
    const row = document.createElement('li');
    const info = document.createElement('div');
    info.append(item('strong', entry.student + ' · ' + entry.title),
      item('small', labels[entry.source] + ' · عدد الأسئلة المقالية: ' + count.format(entry.count)));
    const button = item('button','افتح التصحيح');
    button.type = 'button';
    button.className = 'btn';
    button.addEventListener('click', () => {
      const detail = {attemptId:entry.id};
      if (entry.source === 'unit') {
        window.dispatchEvent(new CustomEvent('zad:unit-one-review', {detail}));
      } else if (entry.source === 'special') {
        open('exams', 'zadSpecialExamResults');
        window.dispatchEvent(new CustomEvent('zad:today-special-essay', {detail}));
      } else {
        open('exams', 'codeExamResultsSection');
        window.dispatchEvent(new CustomEvent('zad:today-code-essay', {detail}));
      }
    });
    row.append(info, button);
    list.append(row);
  }
  queue.append(list);
}

function render() {
  if (!home) return;
  const essays = essaySources();
  for (const source of ['bookings','payments']) {
    const value = todayQueue(source, owner);
    const counter = home.querySelector('[data-today-count="' + source + '"]');
    counter.textContent = !value ? '…' : value.error ? '—' : count.format(value.count);
    counter.title = value?.error ? 'تعذر تحميل العدد' : '';
  }
  const essayCounter = home.querySelector('[data-today-count="essays"]');
  const total = essays.entries.reduce((acc, entry) => acc + entry.count, 0);
  essayCounter.textContent = essays.complete ? count.format(total) :
    total ? '≥ ' + count.format(total) : essays.waiting ? '…' : '—';
  essayCounter.title = essays.complete ? '' : 'بعض المصادر لم تكتمل أو لها حد قراءة';
  if (opened) renderEssays(essays);
}

home?.addEventListener('click', event => {
  const action = event.target.closest('[data-today-open]')?.dataset.todayOpen;
  if (action === 'bookings') {
    open('bookings', 'bookingsManagement');
    document.querySelector('[data-booking-tab="requests"]')?.click();
    select('zadBookingQueueFilter', 'pending');
  } else if (action === 'payments') {
    open('payments', 'zadVodafoneAdminPanel', 'review');
    select('zadVodafoneFilter', 'pending');
  } else if (action === 'essays') {
    opened = true;
    renderEssays(essaySources());
    open('exams', 'zadAdminEssayQueue');
  }
});

todayQueues.addEventListener('change', render);
onAuthStateChanged(auth, user => {
  if (owner !== user?.uid) {
    opened = false;
    queue?.replaceChildren();
  }
  owner = user?.uid || '';
  render();
});
