import { libraryAccessState } from './library-subscription.js';
import { db } from '../firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { getStorage, ref, getBlob } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js';
import { trackBookDownload } from '../sections/book-download-tracker.js';
window.zadBookGateReady = true;
const params = new URLSearchParams(window.location.search);
const title = String(params.get('title') || 'الكتاب');
const rawUrl = String(params.get('url') || '').trim();
const bookId=String(params.get('id')||'').trim();
const source = params.get('source') === 'azhar' ? 'azhar' : 'general';
const statusEl = document.getElementById('accessStatus');
document.getElementById('bookName').textContent = title;

function updateStatus(message) {statusEl.textContent = message;}
function getSafeBookUrl(value) {
  if (!value || /^\s*(?:javascript|data|vbscript):/i.test(value)) return null;
  try {
    const parsed = new URL(value, window.location.href);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch (_) {return null;}
}
async function openProtectedBook(id){
  if(!/^[a-zA-Z0-9_-]{6,150}$/.test(id))throw new Error('معرف الكتاب غير صالح.');
  const snap=await getDoc(doc(db,'libraryProtectedBooks',id));
  if(!snap.exists()||snap.data().published!==true)throw new Error('هذا الكتاب غير منشور أو غير متاح للاشتراك الحالي.');
  const book=snap.data(),storagePath='libraryProtected/'+id+'/content.pdf';
  if(book.storagePath!==storagePath)throw new Error('مسار الملف لا يطابق بيانات الكتاب.');
  updateStatus('✅ الاشتراك مفعّل، جارٍ تنزيل الملف المحمي...');
  // Do not use getDownloadURL: a public token URL can outlive the subscription.
  const blob=await getBlob(ref(getStorage(),storagePath));
  const href=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=href;a.download=String(book.title||title).replace(/[\\/:*?"<>|]/g,'_')+'.pdf';
  document.body.append(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(href),60000);
  updateStatus('✅ تم تجهيز الكتاب للتنزيل.');
}
function rememberReturn() {
  try {sessionStorage.setItem('redirectAfterLogin', location.pathname+location.search+location.hash);} catch (_) {}
}
async function checkAccess() {
  const bookUrl = getSafeBookUrl(rawUrl);
  if (!bookId && !bookUrl) {updateStatus('رابط الملف غير صالح. ارجع إلى المكتبة واختر ملفًا آخر.');return;}
  try {
    const access=await Promise.race([
      libraryAccessState(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ACCESS_CHECK_TIMEOUT')), 12000))
    ]);
    if (access.status === 'login') {
      updateStatus('يجب تسجيل الدخول أولًا. جارٍ نقلك لصفحة تسجيل الدخول...');
      rememberReturn();
      window.location.replace('../login/index.html?required=1');
    } else if (access.status === 'payment') {
      updateStatus('اشتراك المكتبتين غير مفعّل. جارٍ نقلك لصفحة الدفع (200 جنيه)...');
      window.location.replace('library-payment.html');
    } else if (access.status === 'active') {
      if(bookId){await openProtectedBook(bookId);return;}
      updateStatus('✅ الاشتراك مفعّل. جارٍ فتح الملف الخارجي...');
      // Usage logs should not block actual access when notification rules fail.
      trackBookDownload({title, url:rawUrl, grade:params.get('grade')||'',
        category:params.get('cat')||'', source,
        sourceLabel:source==='azhar'?'مكتبة التعليم الأزهري':'المكتبة العامة'
      }).catch(e=>console.warn('تعذر تسجيل الفتح؛ لا يؤثر على الصلاحية:',e));
      window.location.replace(bookUrl);
    } else {
      updateStatus('تعذر التحقق من صلاحية الاشتراك. تأكد من اتصال الإنترنت ونشر قواعد Firestore المحدثة، ثم حاول مرة أخرى.');
    }
  } catch(error) {
    console.error('Library book gate failure:',error);
    updateStatus(bookId?'تعذر تنزيل الكتاب المحمي: '+(error.code||error.message||'خطأ غير معروف')+' — تحقق من قواعد Firebase Storage وإعدادات CORS.':'حدث خطأ أثناء التحقق من الاشتراك. تأكد من اتصال الإنترنت وإعدادات Firebase، ثم حاول مرة أخرى.');
  }
}
checkAccess();
