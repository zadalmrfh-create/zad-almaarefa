import { auth, db, ADMIN_EMAIL, FIREBASE_READY } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

export function guard(requiredRole, onReady){
  const loading=document.getElementById('loading');
  if(!FIREBASE_READY){ if(loading) loading.textContent='أكمل إعداد Firebase في firebase-config.js أولًا.'; return; }
  onAuthStateChanged(auth, async user=>{
    if(!user){ location.href='../../login/index.html'; return; }
    let profile=null;

    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    if (adminSnap.exists()) {
      const adminData = adminSnap.data() || {};
      profile = {role:'admin', name:adminData.name || user.displayName || 'مدير المنصة', email:user.email || '', status:'active'};
    } else {
      const snap = await getDoc(doc(db, 'users', user.uid));
      profile = snap.exists() ? snap.data() : null;
    }
    if(!profile || (requiredRole && profile.role!==requiredRole)){
      location.href=requiredRole==='admin'?'../../index.html':'../../dashboard/'+(profile?.role||'student')+'/index.html'; return;
    }
    document.querySelectorAll('[data-name]').forEach(x=>x.textContent=profile.name||user.displayName||'مستخدم');
    document.querySelectorAll('[data-email]').forEach(x=>x.textContent=user.email||'');
    if(loading) loading.remove();
    onReady?.({user,profile});
  });
}
