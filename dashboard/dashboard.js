import { auth, db, ADMIN_EMAIL, FIREBASE_READY } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

export function guard(requiredRole, onReady){
  const loading=document.getElementById('loading');
  if(!FIREBASE_READY){ if(loading) loading.textContent='أكمل إعداد Firebase في firebase-config.js أولًا.'; return; }
  onAuthStateChanged(auth, async user=>{
    if(!user){ location.href='../../login/index.html'; return; }
    let profile=null;

    // الأدمن الأساسي يتم التعرف عليه من البريد مباشرة
    // أو من خلال مستند admins/{uid}
    const isPrimaryAdmin =
      user.email &&
      user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const adminSnap = isPrimaryAdmin
      ? { exists: () => true, data: () => ({ name: 'مالك سامح', email: user.email }) }
      : await getDoc(doc(db, 'admins', user.uid));

    if (adminSnap.exists()) {
      const adminData = adminSnap.data() || {};
      profile = {
        role: 'admin',
        name: adminData.name || user.displayName || 'مدير المنصة',
        email: user.email || adminData.email || '',
        status: 'active'
      };
    } else {
      const snap = await getDoc(doc(db, 'users', user.uid));
      profile = snap.exists() ? snap.data() : null;
    }
    // المعلم غير المعتمد أو المعطل يُعامل كطالب.
    const effectiveRole = profile?.role === 'teacher' && profile?.status !== 'active'
      ? 'student'
      : (profile?.role || 'student');

    if(!profile || (requiredRole && effectiveRole!==requiredRole)){
      if (effectiveRole === 'admin') {
        location.href = '../../dashboard/admin/index.html';
      } else if (effectiveRole === 'teacher') {
        location.href = '../../dashboard/teacher/index.html';
      } else {
        location.href = '../../dashboard/student/index.html';
      }
      return;
    }
    document.querySelectorAll('[data-name]').forEach(x=>x.textContent=profile.name||user.displayName||'مستخدم');
    document.querySelectorAll('[data-email]').forEach(x=>x.textContent=user.email||'');
    if(loading) loading.remove();
    onReady?.({user,profile});
  });
}
