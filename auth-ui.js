import { auth, db, FIREBASE_READY } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';


// ═══════════════════════════════════════
// أزرار الحساب في الهيدر
// ═══════════════════════════════════════

const links = document.querySelectorAll(
  '.login-nav-btn, .login-mobile-btn'
);

if (FIREBASE_READY && links.length) {

  onAuthStateChanged(auth, async (user) => {

    // ─────────────────────────────────────
    // المستخدم غير مسجل الدخول
    // ─────────────────────────────────────

    if (!user) {

      links.forEach(link => {
        link.href = 'login/index.html';

        link.innerHTML = `
          <i class="fa-solid fa-right-to-bracket"></i>
          تسجيل الدخول
        `;
      });

      return;
    }


    // ─────────────────────────────────────
    // المستخدم مسجل الدخول
    // ─────────────────────────────────────

    let userName =
      user.displayName ||
      user.email?.split('@')[0] ||
      'حسابي';

    let isAdmin = false;


    // ═══════════════════════════════════════
    // التحقق من الأدمن من:
    // admins/{uid}
    // ═══════════════════════════════════════

    try {

      const adminSnap = await getDoc(
        doc(db, 'admins', user.uid)
      );

      if (adminSnap.exists()) {
        isAdmin = true;
      }

    } catch (error) {

      console.error(
        'خطأ في التحقق من صلاحيات الأدمن:',
        error
      );

    }


    // ─────────────────────────────────────
    // جلب اسم المستخدم من users/{uid}
    // ─────────────────────────────────────

    try {

      const userSnap = await getDoc(
        doc(db, 'users', user.uid)
      );

      if (userSnap.exists()) {

        const userData = userSnap.data();

        if (userData.fullName) {
          userName = userData.fullName;
        }

      }

    } catch (error) {

      console.error(
        'خطأ في جلب بيانات المستخدم:',
        error
      );

    }


    // ═══════════════════════════════════════
    // تحديد مكان زر حسابي
    // ═══════════════════════════════════════

    links.forEach(link => {

      if (isAdmin) {

        // الأدمن → لوحة تحكم الأدمن
        link.href = 'dashboard/admin/index.html';

        link.innerHTML = `
          <i class="fa-solid fa-gauge-high"></i>
          لوحة التحكم
        `;

      } else {

        // المستخدم العادي → الصفحة الرئيسية
        link.href = 'index.html';

        link.innerHTML = `
          <i class="fa-solid fa-user-circle"></i>
          ${userName}
        `;

      }

    });

  });

}


// ═══════════════════════════════════════
// التحويل بعد تسجيل الدخول / إنشاء الحساب
// ═══════════════════════════════════════

export function redirectAfterLogin(userData) {

  // الجميع يعود للصفحة الرئيسية بعد الدخول
  window.location.href = 'index.html';

}