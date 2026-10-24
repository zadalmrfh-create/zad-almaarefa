import {db, ADMIN_EMAIL} from '../firebase-config.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const requestedRole = new URLSearchParams(location.search).get('previewRole');
const requestedUid = new URLSearchParams(location.search).get('previewUid');
const validRole = requestedRole === 'student' || requestedRole === 'teacher';
const promises = new Map();

export const previewRequested = Boolean(validRole && requestedUid);

export function isAdminAccount(user) {
  if (!user) return Promise.resolve(false);
  if (promises.has(user.uid)) return promises.get(user.uid);
  const check = (async () => {
    if ((user.email || '').trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase()) return true;
    try {if ((await getDoc(doc(db,'admins',user.uid))).exists()) return true;} catch(e) {console.warn('Admin claim unavailable',e);}
    try {const profile = await getDoc(doc(db,'users',user.uid));return profile.exists() && profile.data().role === 'admin';} catch(e) {console.warn('Admin profile unavailable',e);}
    return false;
  })();
  promises.set(user.uid,check);
  return check;
}

export async function getPreviewContext(user,expectedRole) {
  if (!previewRequested || requestedRole !== expectedRole) return {active:false,uid:user.uid};
  if (!(await isAdminAccount(user))) return {active:false,uid:user.uid,denied:true};
  try {
    const target = await getDoc(doc(db,'users',requestedUid));
    if (!target.exists() || target.data().role !== expectedRole) {
      return {active:false,uid:user.uid,denied:true,reason:'الحساب المحدد غير موجود أو نوع الحساب لا يطابق اللوحة.'};
    }
    return {active:true,uid:requestedUid,profile:target.data(),adminUid:user.uid};
  } catch(e) {return {active:false,uid:user.uid,denied:true,reason:e.code || e.message};}
}
