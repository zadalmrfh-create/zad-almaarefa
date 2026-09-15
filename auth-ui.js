import { auth, db, FIREBASE_READY } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';


// ═══════════════════════════════════════
// أزرار الحساب في الهيدر
// ═══════════════════════════════════════

const links = document.querySelectorAll('.login-nav-btn, .login-mobile-btn');
const dashboardLinks = document.querySelectorAll('.account-dashboard-link');
const ADMIN_EMAIL = 'maleksameh121@gmail.com';

if (FIREBASE_READY && links.length) {

  onAuthStateChanged(auth, async (user) => {

    // ─────────────────────────────────────
    // المستخدم غير مسجل الدخول
    // ─────────────────────────────────────

    if (!user) {

      dashboardLinks.forEach(link => {
        link.href = './login/index.html';
        link.innerHTML = '<i class="fa-solid fa-user-graduate"></i> لوحة الطالب';
      });

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

    let accountRole = user.email?.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'student';
    let userData = {};
    try { const profileSnap = await getDoc(doc(db, 'users', user.uid)); if (profileSnap.exists()) { userData = profileSnap.data(); accountRole = user.email?.toLowerCase() === ADMIN_EMAIL ? 'admin' : (userData.role || 'student'); } } catch(e) {}
    const isTeacherAccount = accountRole === 'teacher' && userData.status === 'active';

    // تغيير زر لوحة الحساب حسب نوع الحساب
    dashboardLinks.forEach(link => {
      link.href = accountRole === 'admin' ? './dashboard/admin/index.html' : (isTeacherAccount ? './dashboard/teacher/index.html' : './student/dashboard.html');
      link.innerHTML = accountRole === 'admin' ? '<i class="fa-solid fa-crown"></i> لوحة الإدارة' : (isTeacherAccount ? '<i class="fa-solid fa-chalkboard-user"></i> لوحة المعلم' : '<i class="fa-solid fa-user-graduate"></i> لوحة الطالب');
    });

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

      // عند تسجيل الدخول يصبح زر الحساب زر تسجيل خروج
      // ونمنع الانتقال لأي صفحة عند الضغط عليه.
      link.href = '#';
      link.setAttribute('title', 'تسجيل الخروج');
      link.setAttribute('aria-label', `تسجيل الخروج من حساب ${userName}`);

      link.innerHTML = `
        <i class="fa-solid fa-user-circle"></i>
        ${userName}
      `;

      // تجنب إضافة نفس الحدث أكثر من مرة إذا أعيد تشغيل الكود.
      link.onclick = async (event) => {
        event.preventDefault();

        if (link.dataset.loggingOut === 'true') return;
        link.dataset.loggingOut = 'true';

        const originalHtml = link.innerHTML;
        link.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> تسجيل الخروج...';

        try {
          await signOut(auth);
          window.location.href = userData?.role === 'admin' ? './dashboard/admin/index.html' : (userData?.role === 'teacher' ? './dashboard/teacher/index.html' : './student/dashboard.html');
        } catch (error) {
          console.error('خطأ أثناء تسجيل الخروج:', error);
          link.dataset.loggingOut = 'false';
          link.innerHTML = originalHtml;
          alert('تعذر تسجيل الخروج. حاول مرة أخرى.');
        }
      };
    });

  });

}


// ═══════════════════════════════════════
// التحويل بعد تسجيل الدخول / إنشاء الحساب
// ═══════════════════════════════════════

export function redirectAfterLogin(userData) {

  // الجميع يعود للصفحة الرئيسية بعد الدخول
  window.location.href = userData?.role === 'admin' ? './dashboard/admin/index.html' : (userData?.role === 'teacher' ? './dashboard/teacher/index.html' : './student/dashboard.html');

}