// صلاحيات لوحة الإدارة — البريد وحده لا يكفي؛ تُفحص هوية Firebase ووثيقة admins/{UID}.
import {configured} from './firebase-config.js';

export const ADMIN_EMAIL = 'maleksameh121@gmail.com';

export function hasApprovedAdminIdentity(user) {
  return !!user && !user.isAnonymous &&
    String(user.email || '').trim().toLowerCase() === ADMIN_EMAIL &&
    user.emailVerified === true;
}

// نفس الفحص يُستخدم في صفحة الإدارة وفي إظهار روابطها داخل الموقع.
export async function isAuthorizedAdmin(user, firebase) {
  if (!hasApprovedAdminIdentity(user)) return false;
  const snap = await firebase.getDoc(firebase.doc(firebase.db, 'admins', user.uid));
  return snap.exists() && snap.data()?.active === true;
}

// لا تُظهر رابط الإدارة مطلقًا قبل أن تنتهي قراءة صلاحية المستخدم من Firestore.
export async function startAdminLinks() {
  const links = Array.from(document.querySelectorAll('[data-admin-link]'));
  if (links.length === 0) return;
  function display(allowed) { for (const link of links) link.hidden = !allowed; }
  display(false);
  if (!configured) return;
  try {
    const firebase = await import('./firebase-service.js');
    let version = 0;
    firebase.onAuthStateChanged(firebase.auth, async user => {
      const requestVersion = ++version;
      display(false);
      if (!hasApprovedAdminIdentity(user)) return;
      try {
        const allowed = await isAuthorizedAdmin(user, firebase);
        if (requestVersion === version && firebase.auth.currentUser?.uid === user.uid) {
          display(allowed);
        }
      } catch (error) {
        console.warn('تعذّر التحقق من صلاحية رابط الإدارة:', error);
        display(false);
      }
    });
  } catch (error) {
    console.warn('تعذّر تحميل وحدة صلاحية الإدارة:', error);
    display(false);
  }
}
