import { auth, db, ADMIN_EMAIL, FIREBASE_READY } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

export function firebaseReadyOrMessage(messageEl) {
  if (FIREBASE_READY) return true;
  if (messageEl) messageEl.textContent = 'أكمل إعداد Firebase أولًا في ملف firebase-config.js';
  return false;
}

export async function getUserProfile(user) {
  if (!user) return null;
  if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return { name: user.displayName || 'مالك سامح', email: user.email, role: 'teacher', status: 'active' };
  }
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? snap.data() : null;
}

export function redirectByRole(profile) {
  if (!profile) return '../index.html';
  if (profile.role === 'admin') return '../dashboard/admin/index.html';
  if (profile.role === 'teacher') return '../dashboard/teacher/index.html';
  return '../dashboard/student/index.html';
}

export function watchNavbar() {
  const loginLinks = document.querySelectorAll('.login-nav-btn, .login-mobile-btn');
  if (!loginLinks.length || !FIREBASE_READY) return;
  onAuthStateChanged(auth, async user => {
    if (!user) {
      loginLinks.forEach(link => { link.href = 'login/index.html'; link.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> تسجيل الدخول'; });
      return;
    }
    const profile = await getUserProfile(user);

    // الأدمن يتم التحقق منه من admins/{uid}
    let isAdmin = false;
    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      isAdmin = adminSnap.exists();
    } catch (error) {
      console.error('خطأ في التحقق من صلاحية الأدمن:', error);
    }

    loginLinks.forEach(link => {
      link.href = isAdmin
        ? 'dashboard/admin/index.html'
        : 'dashboard/' + (profile?.role || 'student') + '/index.html';
      link.innerHTML = '<i class="fa-solid fa-user-circle"></i> حسابي';
    });
  });
}

export async function logout() {
  await signOut(auth);
  location.href = '../../index.html';
}
