import { auth, db, FIREBASE_READY } from './firebase-config.js';

import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

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


// =====================================================
// إعدادات عامة
// =====================================================

const STYLE_ID = 'zad-notifications-style';
const BELL_ID = 'zadNotificationsBell';
const PANEL_ID = 'zadNotificationsPanel';


// =====================================================
// إضافة CSS
// =====================================================

function injectStyles() {

  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');

  style.id = STYLE_ID;

  style.textContent = `

    #${BELL_ID}{
      position:relative;
      width:44px;
      height:44px;
      border:1px solid rgba(201,168,76,.55);
      border-radius:12px;
      background:rgba(15,23,42,.72);
      color:#f5d76e;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      font-size:18px;
      z-index:10000;
      box-shadow:0 4px 15px rgba(0,0,0,.18);
      transition:.2s;
    }

    #${BELL_ID}:hover{
      transform:translateY(-2px);
      border-color:#e5bd3d;
    }

    #${BELL_ID} .zad-notification-count{
      position:absolute;
      top:-6px;
      left:-6px;
      min-width:20px;
      height:20px;
      padding:0 5px;
      border-radius:999px;
      background:#dc2626;
      color:#fff;
      font:700 11px/20px Arial,sans-serif;
      text-align:center;
      border:2px solid #fff;
      display:none;
    }

    body.dark #${BELL_ID} .zad-notification-count{
      border-color:#111827;
    }

    .zad-notifications-wrap{
      position:relative;
      display:inline-flex;
      align-items:center;
      flex:0 0 auto;
      order:0;
    }

    .zad-notifications-panel{
      position:fixed;
      top:74px;
      right:24px;
      width:min(390px,calc(100vw - 28px));
      max-height:min(620px,calc(100vh - 95px));
      overflow:auto;
      background:#fff;
      color:#111827;
      border:1px solid rgba(201,168,76,.35);
      border-radius:18px;
      box-shadow:0 18px 55px rgba(0,0,0,.25);
      z-index:10001;
      display:none;
    }

    .zad-notifications-panel.open{
      display:block;
    }

    body.dark .zad-notifications-panel{
      background:#111827;
      color:#f8fafc;
      border-color:#374151;
    }

    .zad-notifications-head{
      position:sticky;
      top:0;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:15px 17px;
      background:inherit;
      border-bottom:1px solid #e5e7eb;
      z-index:1;
    }

    body.dark .zad-notifications-head{
      border-color:#374151;
    }

    .zad-notifications-head h3{
      margin:0;
      font:800 17px Cairo,Tajawal,sans-serif;
    }

    .zad-notifications-close{
      border:0;
      background:transparent;
      font-size:24px;
      cursor:pointer;
      color:inherit;
    }

    .zad-notification-item{
      padding:14px 17px;
      border-bottom:1px solid #e5e7eb;
      cursor:pointer;
      transition:.15s;
    }

    body.dark .zad-notification-item{
      border-color:#374151;
    }

    .zad-notification-item:hover{
      background:rgba(201,168,76,.08);
    }

    .zad-notification-item.unread{
      border-right:4px solid #c9a84c;
      background:rgba(201,168,76,.07);
    }

    .zad-notification-title{
      font:800 15px Cairo,Tajawal,sans-serif;
      margin-bottom:5px;
    }

    .zad-notification-message{
      font:400 13px Cairo,Tajawal,sans-serif;
      line-height:1.7;
      white-space:pre-wrap;
    }

    .zad-notification-time{
      font:400 11px Cairo,Tajawal,sans-serif;
      opacity:.6;
      margin-top:7px;
    }

    .zad-notifications-empty,
    .zad-notifications-login{
      padding:30px 18px;
      text-align:center;
      opacity:.7;
      font:500 13px Cairo,Tajawal,sans-serif;
    }

    @media(max-width:768px){

      .zad-notifications-panel{
        top:68px;
        right:14px;
      }

      .zad-notifications-wrap{
        margin-left:6px;
      }

      .zad-notifications-wrap #${BELL_ID}{
        width:42px;
        height:42px;
      }

    }

  `;

  document.head.appendChild(style);
}


// =====================================================
// حماية النصوص من HTML
// =====================================================

function escapeHtml(value) {

  return String(value ?? '').replace(
    /[&<>'"]/g,
    c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      "'":'&#39;',
      '"':'&quot;'
    }[c])
  );

}


// =====================================================
// تنسيق التاريخ
// =====================================================

function formatTime(timestamp) {

  if (!timestamp) {
    return 'منذ قليل';
  }

  const date =
    typeof timestamp.toDate === 'function'
      ? timestamp.toDate()
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 'منذ قليل';
  }

  try {

    return new Intl.DateTimeFormat(
      'ar-EG',
      {
        dateStyle:'medium',
        timeStyle:'short'
      }
    ).format(date);

  } catch {

    return 'منذ قليل';

  }

}


// =====================================================
// تحميل إشعارات الطالب
// =====================================================
//
// مهم:
// الطالب لا يقرأ audience = admin.
// لذلك نقرأ فقط:
// 1- الإشعارات العامة all
// 2- الإشعارات الخاصة user
//
// وهذا يمنع خطأ Permission Denied
// =====================================================

async function loadNotifications(uid) {

  if (!uid) {
    return [];
  }

  const results = [];
  const seen = new Set();

  // ---------------------------------------------------
  // الإشعارات العامة
  // ---------------------------------------------------

  const publicQuery = query(
    collection(db, 'notifications'),
    where('audience', '==', 'all'),
    limit(30)
  );


  // ---------------------------------------------------
  // الإشعارات الخاصة بالطالب
  // ---------------------------------------------------

  const personalQuery = query(
    collection(db, 'notifications'),
    where('audience', '==', 'user'),
    where('targetUid', '==', uid),
    limit(30)
  );


  // ---------------------------------------------------
  // تنفيذ الاستعلامين فقط
  // ---------------------------------------------------

  const [
    publicSnapshot,
    personalSnapshot
  ] = await Promise.all([
    getDocs(publicQuery),
    getDocs(personalQuery)
  ]);


  // ---------------------------------------------------
  // الإشعارات العامة
  // ---------------------------------------------------

  publicSnapshot.forEach(item => {

    if (seen.has(item.id)) {
      return;
    }

    seen.add(item.id);

    results.push({
      id:item.id,
      ...item.data()
    });

  });


  // ---------------------------------------------------
  // الإشعارات الخاصة
  // ---------------------------------------------------

  personalSnapshot.forEach(item => {

    if (seen.has(item.id)) {
      return;
    }

    seen.add(item.id);

    results.push({
      id:item.id,
      ...item.data()
    });

  });


  // ---------------------------------------------------
  // ترتيب الأحدث أولاً
  // ---------------------------------------------------

  results.sort((a,b) => {

    const at =
      a.createdAt?.toMillis?.() ?? 0;

    const bt =
      b.createdAt?.toMillis?.() ?? 0;

    return bt - at;

  });


  return results.slice(0,30);

}


// =====================================================
// إنشاء واجهة الإشعارات
// =====================================================

function mountUI() {

  const existingBell =
    document.getElementById(BELL_ID);

  if (existingBell) {

    const existingPanel =
      document.getElementById(PANEL_ID);

    return {
      bell:existingBell,
      panel:existingPanel,
      list:existingPanel?.querySelector(
        '.zad-notifications-list'
      ),
      count:existingBell.querySelector(
        '.zad-notification-count'
      )
    };

  }


  injectStyles();


  const wrap =
    document.createElement('div');

  wrap.className =
    'zad-notifications-wrap';


  wrap.innerHTML = `

    <button
      id="${BELL_ID}"
      type="button"
      aria-label="الإشعارات"
      title="الإشعارات"
    >
      🔔
      <span class="zad-notification-count">0</span>
    </button>

    <div
      id="${PANEL_ID}"
      class="zad-notifications-panel"
      role="dialog"
      aria-label="الإشعارات"
    >

      <div class="zad-notifications-head">

        <h3>🔔 الإشعارات</h3>

        <button
          class="zad-notifications-close"
          type="button"
          aria-label="إغلاق"
        >
          ×
        </button>

      </div>

      <div class="zad-notifications-list"></div>

    </div>

  `;


  // ---------------------------------------------------
  // أماكن وضع زر الإشعارات
  // ---------------------------------------------------

  const navbar =
    document.querySelector('#navbar .nav-inner');

  const actions =
    document.querySelector('.actions');

  const target =
    navbar || actions || document.body;

  const loginButton =
    document.querySelector('.login-nav-btn');


  // ---------------------------------------------------
  // وضع الجرس بجوار تسجيل الدخول
  // ---------------------------------------------------

  if (navbar && loginButton) {

    loginButton.insertAdjacentElement(
      'afterend',
      wrap
    );

  } else if (target) {

    target.insertBefore(
      wrap,
      target.firstChild
    );

  }


  // ---------------------------------------------------
  // عناصر الواجهة
  // ---------------------------------------------------

  const bell =
    document.getElementById(BELL_ID);

  const panel =
    document.getElementById(PANEL_ID);

  const close =
    panel.querySelector(
      '.zad-notifications-close'
    );

  const list =
    panel.querySelector(
      '.zad-notifications-list'
    );

  const count =
    bell.querySelector(
      '.zad-notification-count'
    );


  // ---------------------------------------------------
  // فتح وإغلاق اللوحة
  // ---------------------------------------------------

  bell.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      panel.classList.toggle('open');

    }
  );


  close.addEventListener(
    'click',
    () => {

      panel.classList.remove('open');

    }
  );


  document.addEventListener(
    'click',
    event => {

      if (!wrap.contains(event.target)) {

        panel.classList.remove('open');

      }

    }
  );


  return {
    bell,
    panel,
    list,
    count
  };

}


// =====================================================
// تهيئة النظام
// =====================================================

export function initNotifications() {

  if (!FIREBASE_READY) {

    console.warn(
      'Firebase غير جاهز لتشغيل الإشعارات.'
    );

    return;
  }


  const ui = mountUI();


  if (
    !ui ||
    !ui.bell ||
    !ui.panel ||
    !ui.list ||
    !ui.count
  ) {

    console.error(
      'تعذر إنشاء واجهة الإشعارات.'
    );

    return;
  }


  // ---------------------------------------------------
  // متابعة حالة تسجيل الدخول
  // ---------------------------------------------------

  onAuthStateChanged(
    auth,
    async user => {

      // =================================================
      // المستخدم غير مسجل
      // =================================================

      if (!user) {

        ui.bell.style.display =
          'none';

        ui.panel.classList.remove(
          'open'
        );

        ui.list.innerHTML =
          '<div class="zad-notifications-login">سجّل الدخول لرؤية الإشعارات.</div>';

        ui.count.style.display =
          'none';

        return;
      }


      // =================================================
      // المستخدم مسجل
      // =================================================

      ui.bell.style.display =
        'inline-flex';


      ui.list.innerHTML =
        '<div class="zad-notifications-empty">جارٍ تحميل الإشعارات…</div>';


      try {

        const notifications =
          await loadNotifications(
            user.uid
          );


        renderNotifications(
          ui,
          notifications,
          user.uid
        );


      } catch (error) {

        console.error(
          'خطأ في تحميل إشعارات المستخدم:',
          error
        );


        ui.list.innerHTML =
          `
          <div class="zad-notifications-empty">
            تعذر تحميل الإشعارات.
            <br>
            حاول تحديث الصفحة.
          </div>
          `;


        ui.count.style.display =
          'none';

      }

    }
  );

}


// =====================================================
// عرض الإشعارات
// =====================================================

function renderNotifications(
  ui,
  notifications,
  uid
) {

  // ---------------------------------------------------
  // لا توجد إشعارات
  // ---------------------------------------------------

  if (!notifications.length) {

    ui.list.innerHTML =
      `
      <div class="zad-notifications-empty">
        لا توجد إشعارات حتى الآن.
      </div>
      `;

    ui.count.style.display =
      'none';

    return;
  }


  // ---------------------------------------------------
  // حساب غير المقروء
  // ---------------------------------------------------

  const unread =
    notifications.filter(
      n =>
        !(n.readBy || []).includes(uid)
    ).length;


  ui.count.textContent =
    unread > 99
      ? '99+'
      : String(unread);


  ui.count.style.display =
    unread
      ? 'block'
      : 'none';


  // ---------------------------------------------------
  // بناء قائمة الإشعارات
  // ---------------------------------------------------

  ui.list.innerHTML =
    notifications.map(n => {

      const isRead =
        (n.readBy || []).includes(uid);


      return `

        <article
          class="zad-notification-item ${isRead ? '' : 'unread'}"
          data-id="${escapeHtml(n.id)}"
        >

          <div class="zad-notification-title">
            ${escapeHtml(
              n.title ||
              'إشعار من زاد المعرفة'
            )}
          </div>

          <div class="zad-notification-message">
            ${escapeHtml(
              n.message || ''
            )}
          </div>

          <div class="zad-notification-time">
            ${escapeHtml(
              formatTime(n.createdAt)
            )}
          </div>

        </article>

      `;

    }).join('');


  // ---------------------------------------------------
  // الضغط على إشعار
  // ---------------------------------------------------

  ui.list
    .querySelectorAll(
      '.zad-notification-item'
    )
    .forEach(item => {

      item.addEventListener(
        'click',
        async () => {

          const id =
            item.dataset.id;


          const current =
            notifications.find(
              n => n.id === id
            );


          if (!current) {
            return;
          }


          // ------------------------------------------------
          // لو مقروء بالفعل
          // ------------------------------------------------

          if (
            (current.readBy || [])
              .includes(uid)
          ) {

            return;
          }


          try {

            // ------------------------------------------------
            // تعليم الإشعار كمقروء
            // ------------------------------------------------

            await updateDoc(
              doc(
                db,
                'notifications',
                id
              ),
              {
                readBy:
                  arrayUnion(uid)
              }
            );


            // ------------------------------------------------
            // تحديث البيانات محليًا
            // ------------------------------------------------

            current.readBy = [
              ...(current.readBy || []),
              uid
            ];


            item.classList.remove(
              'unread'
            );


            // ------------------------------------------------
            // تحديث العداد
            // ------------------------------------------------

            const remaining =
              notifications.filter(
                n =>
                  !(n.readBy || [])
                    .includes(uid)
              ).length;


            ui.count.textContent =
              remaining > 99
                ? '99+'
                : String(remaining);


            ui.count.style.display =
              remaining
                ? 'block'
                : 'none';


          } catch (error) {

            console.error(
              'خطأ في تعليم الإشعار كمقروء:',
              error
            );

          }

        }
      );

    });

}


// =====================================================
// تشغيل النظام
// =====================================================

if (
  document.readyState === 'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    initNotifications
  );

} else {

  initNotifications();

}