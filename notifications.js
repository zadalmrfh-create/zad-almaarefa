import { auth, db, FIREBASE_READY } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  updateDoc,
  doc,
  arrayUnion
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const STYLE_ID = 'zad-notifications-style';
const BELL_ID = 'zadNotificationsBell';
const PANEL_ID = 'zadNotificationsPanel';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BELL_ID}{position:relative;width:44px;height:44px;border:1px solid rgba(201,168,76,.55);border-radius:12px;background:rgba(15,23,42,.72);color:#f5d76e;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;z-index:10000;box-shadow:0 4px 15px rgba(0,0,0,.18);transition:.2s}
    #${BELL_ID}:hover{transform:translateY(-2px);border-color:#e5bd3d}
    #${BELL_ID} .zad-notification-count{position:absolute;top:-6px;left:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#dc2626;color:#fff;font:700 11px/20px Arial,sans-serif;text-align:center;border:2px solid #fff;display:none}
    body.dark #${BELL_ID} .zad-notification-count{border-color:#111827}
    .zad-notifications-wrap{position:relative;display:inline-flex;align-items:center;flex:0 0 auto;order:0}
    .zad-notifications-panel{position:fixed;top:74px;right:24px;width:min(390px,calc(100vw - 28px));max-height:min(620px,calc(100vh - 95px));overflow:auto;background:#fff;color:#111827;border:1px solid rgba(201,168,76,.35);border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.25);z-index:10001;display:none}
    .zad-notifications-panel.open{display:block}
    body.dark .zad-notifications-panel{background:#111827;color:#f8fafc;border-color:#374151}
    .zad-notifications-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:15px 17px;background:inherit;border-bottom:1px solid #e5e7eb;z-index:1}
    body.dark .zad-notifications-head{border-color:#374151}
    .zad-notifications-head h3{margin:0;font:800 17px Cairo,Tajawal,sans-serif}
    .zad-notifications-close{border:0;background:transparent;font-size:24px;cursor:pointer;color:inherit}
    .zad-notification-item{padding:14px 17px;border-bottom:1px solid #e5e7eb;cursor:pointer;transition:.15s}
    body.dark .zad-notification-item{border-color:#374151}
    .zad-notification-item:hover{background:rgba(201,168,76,.08)}
    .zad-notification-item.unread{border-right:4px solid #c9a84c;background:rgba(201,168,76,.07)}
    .zad-notification-title{font:800 15px Cairo,Tajawal,sans-serif;margin-bottom:5px}
    .zad-notification-message{font:400 13px Cairo,Tajawal,sans-serif;line-height:1.7;white-space:pre-wrap}
    .zad-notification-time{font:400 11px Cairo,Tajawal,sans-serif;opacity:.6;margin-top:7px}
    .zad-notifications-empty,.zad-notifications-login{padding:30px 18px;text-align:center;opacity:.7;font:500 13px Cairo,Tajawal,sans-serif}
    @media(max-width:768px){.zad-notifications-panel{top:68px;right:14px}.zad-notifications-wrap{margin-left:6px}.zad-notifications-wrap #${BELL_ID}{width:42px;height:42px}}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function formatTime(timestamp) {
  if (!timestamp) return 'منذ قليل';
  const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'منذ قليل';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle:'medium', timeStyle:'short' }).format(date);
}

async function loadNotifications(uid) {
  const results = [];
  const seen = new Set();
  const queries = [
    query(collection(db, 'notifications'), where('audience', '==', 'all'), limit(30)),
    query(collection(db, 'notifications'), where('audience', '==', 'user'), where('targetUid', '==', uid), limit(30))
  ];

  const snapshots = await Promise.all(queries.map(q => getDocs(q)));
  snapshots.forEach(snapshot => snapshot.forEach(item => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    results.push({ id:item.id, ...item.data() });
  }));
  results.sort((a,b) => {
    const at = a.createdAt?.toMillis?.() ?? 0;
    const bt = b.createdAt?.toMillis?.() ?? 0;
    return bt - at;
  });
  return results.slice(0, 30);
}

function mountUI() {
  if (document.getElementById(BELL_ID)) return;
  injectStyles();

  const wrap = document.createElement('div');
  wrap.className = 'zad-notifications-wrap';
  wrap.innerHTML = `
    <button id="${BELL_ID}" type="button" aria-label="الإشعارات" title="الإشعارات">
      🔔
      <span class="zad-notification-count">0</span>
    </button>
    <div id="${PANEL_ID}" class="zad-notifications-panel" role="dialog" aria-label="الإشعارات">
      <div class="zad-notifications-head">
        <h3>🔔 الإشعارات</h3>
        <button class="zad-notifications-close" type="button" aria-label="إغلاق">×</button>
      </div>
      <div class="zad-notifications-list"></div>
    </div>
  `;

  const navbar = document.querySelector('#navbar .nav-inner');
  const actions = document.querySelector('.actions');
  const target = navbar || actions || document.body;
  const loginButton = document.querySelector('.login-nav-btn');

  // Put the notification bell directly beside the login button in the top bar,
  // instead of letting it fall under the "ابدأ التعلم" button.
  if (navbar && loginButton) {
    loginButton.insertAdjacentElement('afterend', wrap);
  } else if (target) {
    target.insertBefore(wrap, target.firstChild);
  }

  const bell = document.getElementById(BELL_ID);
  const panel = document.getElementById(PANEL_ID);
  const close = panel.querySelector('.zad-notifications-close');
  bell.addEventListener('click', () => panel.classList.toggle('open'));
  close.addEventListener('click', () => panel.classList.remove('open'));
  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) panel.classList.remove('open');
  });

  return { bell, panel, list: panel.querySelector('.zad-notifications-list'), count: bell.querySelector('.zad-notification-count') };
}

export function initNotifications() {
  if (!FIREBASE_READY) return;
  const ui = mountUI();
  onAuthStateChanged(auth, async user => {
    if (!user) {
      ui.bell.style.display = 'none';
      ui.panel.classList.remove('open');
      return;
    }
    ui.bell.style.display = 'inline-flex';
    ui.list.innerHTML = '<div class="zad-notifications-empty">جارٍ تحميل الإشعارات…</div>';
    try {
      const notifications = await loadNotifications(user.uid);
      renderNotifications(ui, notifications, user.uid);
    } catch (error) {
      console.error('خطأ في تحميل الإشعارات:', error);
      ui.list.innerHTML = '<div class="zad-notifications-empty">تعذر تحميل الإشعارات. تأكد من Firestore Rules.</div>';
      ui.count.style.display = 'none';
    }
  });
}

function renderNotifications(ui, notifications, uid) {
  if (!notifications.length) {
    ui.list.innerHTML = '<div class="zad-notifications-empty">لا توجد إشعارات حتى الآن.</div>';
    ui.count.style.display = 'none';
    return;
  }

  const unread = notifications.filter(n => !(n.readBy || []).includes(uid)).length;
  ui.count.textContent = unread > 99 ? '99+' : String(unread);
  ui.count.style.display = unread ? 'block' : 'none';

  ui.list.innerHTML = notifications.map(n => {
    const isRead = (n.readBy || []).includes(uid);
    return `
      <article class="zad-notification-item ${isRead ? '' : 'unread'}" data-id="${escapeHtml(n.id)}">
        <div class="zad-notification-title">${escapeHtml(n.title || 'إشعار من زاد المعرفة')}</div>
        <div class="zad-notification-message">${escapeHtml(n.message || '')}</div>
        <div class="zad-notification-time">${escapeHtml(formatTime(n.createdAt))}</div>
      </article>`;
  }).join('');

  ui.list.querySelectorAll('.zad-notification-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = item.dataset.id;
      const current = notifications.find(n => n.id === id);
      if (!current || (current.readBy || []).includes(uid)) return;
      try {
        await updateDoc(doc(db, 'notifications', id), { readBy: arrayUnion(uid) });
        current.readBy = [...(current.readBy || []), uid];
        item.classList.remove('unread');
        const remaining = notifications.filter(n => !(n.readBy || []).includes(uid)).length;
        ui.count.textContent = remaining > 99 ? '99+' : String(remaining);
        ui.count.style.display = remaining ? 'block' : 'none';
      } catch (error) {
        console.error('خطأ في تعليم الإشعار كمقروء:', error);
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotifications);
} else {
  initNotifications();
}
