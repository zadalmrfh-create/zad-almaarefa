import { auth, db, ADMIN_EMAIL, FIREBASE_READY } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

export function guard(requiredRole, onReady){
  const loading = document.getElementById('loading');

  if(!FIREBASE_READY){
    if(loading) loading.textContent='أكمل إعداد Firebase في firebase-config.js أولًا.';
    return;
  }

  onAuthStateChanged(auth, async user => {
    try {
      if(!user){
        location.href='../../login/index.html';
        return;
      }

      const email = String(user.email || '').trim().toLowerCase();
      const primaryAdmin = String(ADMIN_EMAIL || '').trim().toLowerCase();

      let profile = null;

      // الأدمن الرئيسي لا يحتاج قراءة admins/{uid} إطلاقًا.
      if(email && primaryAdmin && email === primaryAdmin){
        profile = {
          role: 'admin',
          name: user.displayName || 'مالك المنصة',
          email: user.email || primaryAdmin,
          status: 'active'
        };
      } else {
        // نحاول أولًا ملف الأدمن، لكن لا نترك الصفحة معلقة إذا رفضت القواعد القراءة.
        try {
          const adminSnap = await getDoc(doc(db, 'admins', user.uid));
          if(adminSnap.exists()) {
            const adminData = adminSnap.data() || {};
            profile = {
              role: 'admin',
              name: adminData.name || user.displayName || 'مدير المنصة',
              email: user.email || adminData.email || '',
              status: 'active'
            };
          }
        } catch (adminError) {
          console.warn('تعذر فحص admins، سيتم فحص users:', adminError);
        }

        if(!profile){
          try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            profile = snap.exists() ? snap.data() : null;
          } catch (profileError) {
            console.error('تعذر قراءة ملف المستخدم:', profileError);
          }
        }
      }

      const effectiveRole =
        profile?.role === 'teacher' && profile?.status !== 'active'
          ? 'student'
          : (profile?.role || 'student');

      if(!profile || (requiredRole && effectiveRole !== requiredRole)){
        if (effectiveRole === 'admin') {
          location.href = '../../dashboard/admin/index.html';
        } else if (effectiveRole === 'teacher') {
          location.href = '../../dashboard/teacher/index.html';
        } else {
          location.href = '../../dashboard/student/index.html';
        }
        return;
      }

      document.querySelectorAll('[data-name]').forEach(x =>
        x.textContent = profile.name || user.displayName || 'مستخدم'
      );
      document.querySelectorAll('[data-email]').forEach(x =>
        x.textContent = user.email || ''
      );

      if(loading) loading.remove();
      await onReady?.({user, profile});
    } catch (error) {
      console.error('خطأ غير متوقع في حماية لوحة التحكم:', error);
      if(loading){
        loading.textContent = 'تعذر التحقق من الحساب. سيتم إعادة المحاولة...';
        loading.style.display = 'block';
      }
      // لا نترك الصفحة في حالة تحميل صامتة.
      setTimeout(() => {
        if(document.visibilityState === 'visible') location.href='../../login/index.html';
      }, 2500);
    }
  });
}
