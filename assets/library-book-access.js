import { libraryAccessState } from './library-subscription.js';
import { trackBookDownload } from '../sections/book-download-tracker.js';
window.zadBookGateReady = true;
const params = new URLSearchParams(window.location.search);
const title = String(params.get('title') || 'الكتاب');
const rawUrl = String(params.get('url') || '').trim();
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
function rememberReturn() {
  try {sessionStorage.setItem('redirectAfterLogin', location.pathname+location.search+location.hash);} catch (_) {}
}
async function checkAccess() {
  const bookUrl = getSafeBookUrl(rawUrl);
  if (!bookUrl) {updateStatus('رابط الملف غير صالح. ارجع إلى المكتبة واختر ملفًا آخر.');return;}
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
      updateStatus('✅ الاشتراك مفعّل. جارٍ فتح الملف...');
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
    updateStatus('حدث خطأ أثناء التحقق من الاشتراك. تأكد من اتصال الإنترنت وإعدادات Firebase، ثم حاول مرة أخرى.');
  }
}
checkAccess();
