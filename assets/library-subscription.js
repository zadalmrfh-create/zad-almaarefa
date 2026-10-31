import { auth, db, ADMIN_EMAIL } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

// One subscription applies to both the public library and the Azhar library.
const loginUrl = new URL('../login/index.html?required=1', import.meta.url).href;
const paymentUrl = new URL('../sections/library-payment.html', import.meta.url).href;
export const MONEY_RECEIVER = '01042239704';
export const DEFAULT_LIBRARY_PRICE_PIASTRES = 20000; // 200 Egyptian pounds
let userPromise;

function currentUserReady() {
  if (!userPromise) userPromise = new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, user => { unsubscribe(); resolve(user); }, error => {console.error(error); unsubscribe(); resolve(null);});
  });
  return userPromise;
}

function keepDestination() {
  try {
    const path = location.pathname + location.search + location.hash;
    if (path.startsWith('/') && !path.startsWith('//')) sessionStorage.setItem('redirectAfterLogin', path);
  } catch (_) { /* storage can be disabled */ }
}

export async function libraryAccessState() {
  const user = await currentUserReady();
  if (!user) return {status:'login'};
  try {
    // Rules enforce admin grants; a student cannot set an active subscription.
    if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && user.emailVerified)
      return {status:'active', user};
    const [adminSnap, accessSnap] = await Promise.all([
      getDoc(doc(db,'admins',user.uid)),
      getDoc(doc(db,'librarySubscriptions',user.uid))
    ]);
    if (adminSnap.exists()) return {status:'active', user};
    const item=accessSnap.exists()?accessSnap.data():{};
    const notExpired=!item.expiresAt || (item.expiresAt.toMillis && item.expiresAt.toMillis() > Date.now());
    return {status: item.status==='active' && notExpired ? 'active':'payment', user};
  } catch(error) {
    console.error('Library permission check error:',error);
    return {status:'error',user}; // deny by default if Firebase cannot confirm access
  }
}

export async function requireLibraryAccess() {
  const access=await libraryAccessState();
  if (access.status==='active') return true;
  if (access.status==='login') {
    keepDestination();
    window.location.assign(loginUrl);
  } else if (access.status==='payment') {
    window.location.assign(paymentUrl);
  } else {
    alert('تعذر التحقق من صلاحية الاشتراك. افحص الإنترنت وحاول مجددًا.');
  }
  return false;
}
