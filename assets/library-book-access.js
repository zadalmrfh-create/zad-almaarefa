import {libraryAccessState} from './library-subscription.js';
import {auth,db} from '../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {getStorage,ref,getBlob} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js';
import {trackBookDownload} from '../sections/book-download-tracker.js';
import {MIGRATION_COLLECTION,legacyKeyForUrl,validLegacyKey,validProtectedBookId,
  safeLegacyUrl,resolveLibraryRoute} from './library-migration-core.mjs';

window.zadBookGateReady = true;
const params = new URLSearchParams(location.search);
const title = String(params.get('title') || 'الكتاب').slice(0,180);
const rawUrl = String(params.get('url') || '').trim();
const bookId = String(params.get('id') || '').trim();
const suppliedKey = String(params.get('legacy') || '').trim();
const source = params.get('source') === 'azhar' ? 'azhar' : 'general';
const siteRoot = new URL('../',import.meta.url).href;
const statusEl = document.getElementById('accessStatus');
document.getElementById('bookName').textContent = title;

const updateStatus = message => {statusEl.textContent = message;};
function rememberReturn() {
  try {sessionStorage.setItem('redirectAfterLogin',location.pathname+location.search+location.hash);} catch {}
}
function sameUser(user) {
  if (!user || auth.currentUser?.uid !== user.uid) throw new Error('ACCOUNT_CHANGED');
}
function userReady() {
  return new Promise((resolve,reject) => {
    let stop;
    stop = onAuthStateChanged(auth,user=>{resolve(user);queueMicrotask(()=>stop?.());},error=>{reject(error);queueMicrotask(()=>stop?.());});
  });
}
function timed(promise) {
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('ACCESS_TIMEOUT')),12000);})])
    .finally(()=>clearTimeout(timer));
}
function logOpen(url) {
  trackBookDownload({title,url,grade:params.get('grade')||'',category:params.get('cat')||'',source,
    sourceLabel:source==='azhar'?'مكتبة التعليم الأزهري':'المكتبة العامة'})
    .catch(error=>console.warn('تعذر تسجيل فتح الكتاب:',error.code||'unknown'));
}
async function openProtectedBook(id,user) {
  if (!validProtectedBookId(id)) throw new Error('INVALID_BOOK');
  const snap = await getDoc(doc(db,'libraryProtectedBooks',id));
  sameUser(user);
  if (!snap.exists() || snap.data().published !== true) throw new Error('BOOK_UNAVAILABLE');
  const book = snap.data();
  const storagePath = 'libraryProtected/'+id+'/content.pdf';
  if (book.storagePath !== storagePath) throw new Error('INVALID_BOOK_PATH');
  updateStatus('اشتراكك فعّال. جارٍ تجهيز الكتاب المحمي للتنزيل…');
  // Storage Rules enforce the subscription again. Never create a public token URL.
  const blob = await getBlob(ref(getStorage(),storagePath));
  sameUser(user);
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = String(book.title||title).replace(/[\\/:*?"<>|]/g,'_')+'.pdf';
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(href),60000);
  logOpen(new URL('sections/book-access.html?'+new URLSearchParams({id}),siteRoot).href);
  updateStatus('تم تجهيز الكتاب للتنزيل. لو التنزيل ما بدأش، حدّث الصفحة وجرب مرة تانية.');
}
async function checkAccess() {
  try {
    if (bookId && !validProtectedBookId(bookId)) throw new Error('INVALID_BOOK');
    if (suppliedKey && !validLegacyKey(suppliedKey)) throw new Error('INVALID_LEGACY_KEY');
    if (!bookId && !rawUrl && !suppliedKey) throw new Error('INVALID_LINK');
    const user = await timed(userReady());
    if (!user) {
      rememberReturn();updateStatus('سجّل دخولك أولًا لفتح الكتاب. جارٍ فتح صفحة الدخول…');
      location.replace(new URL('login/index.html?required=1',siteRoot).href);return;
    }
    document.getElementById('accessLogin').hidden = true;
    let legacyUrl = '',mapping = null;
    if (!bookId) {
      legacyUrl = rawUrl ? safeLegacyUrl(rawUrl,siteRoot) : '';
      const calculatedKey = legacyUrl ? await legacyKeyForUrl(legacyUrl,siteRoot) : '';
      if (suppliedKey && calculatedKey && suppliedKey !== calculatedKey) throw new Error('LEGACY_KEY_MISMATCH');
      const key = suppliedKey || calculatedKey;
      // A rejected/failed lookup must never fall through to the old public URL.
      const snap = await timed(getDoc(doc(db,MIGRATION_COLLECTION,key)));
      sameUser(user);
      mapping = snap.exists() ? snap.data() : null;
    }
    let route = resolveLibraryRoute({mapping,legacyUrl,bookId,hasSession:true,isSubscribed:false});
    if (route.kind === 'payment') {
      const access = await timed(libraryAccessState());
      sameUser(user);
      if (access.status === 'error') throw new Error('SUBSCRIPTION_LOOKUP_FAILED');
      route = resolveLibraryRoute({mapping,legacyUrl,bookId,hasSession:true,isSubscribed:access.status==='active'});
    }
    if (route.kind === 'payment') {
      rememberReturn();updateStatus('هذا الكتاب يحتاج اشتراكًا فعّالًا في المكتبة. جارٍ فتح صفحة الاشتراك…');
      location.replace(new URL('sections/library-payment.html',siteRoot).href);return;
    }
    if (route.kind === 'denied') {
      document.getElementById('accessPayment').hidden = true;
      updateStatus(route.reason === 'unclassified'
        ? 'هذا الرابط ينتظر مراجعة تصنيف الكتاب. تواصل مع إدارة زاد المعرفة باسم الكتاب، أو ارجع للمكتبة واختر النسخة المتاحة.'
        : 'بيانات رابط الكتاب غير مكتملة أو غير صالحة. ارجع للمكتبة واختر الكتاب مرة تانية.');return;
    }
    document.getElementById('accessPayment').hidden = true;
    if (route.kind === 'protected') {await openProtectedBook(route.bookId,user);return;}
    sameUser(user);
    updateStatus(route.kind === 'free' ? 'هذا المصدر مصنّف مجانيًا. جارٍ فتحه…' : 'اشتراكك فعّال. جارٍ فتح المصدر القديم…');
    logOpen(route.url);
    location.replace(route.url);
  } catch (error) {
    console.error('تعذر فتح الكتاب:',error.code||error.message||'unknown');
    const inputError = /^(INVALID_|LEGACY_KEY_MISMATCH)/.test(error.message||'');
    updateStatus(inputError ? 'رابط الكتاب غير صالح. ارجع للمكتبة واختر الكتاب مرة تانية.'
      : error.message === 'ACCOUNT_CHANGED' ? 'تغيّر الحساب أثناء التحقق. حدّث الصفحة وسجّل الدخول بالحساب المطلوب.'
      : error.message === 'BOOK_UNAVAILABLE' ? 'الكتاب غير متاح حاليًا. تواصل مع الإدارة أو اختر كتابًا آخر.'
      : 'تعذر التحقق من صلاحية الكتاب أو تجهيز الملف. تأكد من الإنترنت وحاول مرة أخرى. إذا استمرت المشكلة، تواصل مع الإدارة باسم الكتاب.');
  }
}
checkAccess();
