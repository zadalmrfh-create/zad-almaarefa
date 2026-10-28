/**
 * بوابة موحّدة للمحتوى التعليمي في زاد المعرفة.
 * تحمي واجهة صفحات HTML وتعتمد على Firebase Auth فقط، وليس localStorage.
 * لا يمكن لهذا السكربت حماية الملفات العامة المستضافة في GitHub Pages أو لدى طرف ثالث.
 */
import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const loginUrl = new URL('../login/index.html?required=1', import.meta.url).href;
const registerUrl = new URL('../login/register.html', import.meta.url).href;
const homeUrl = new URL('../index.html', import.meta.url).href;
const requestedPath = location.pathname + location.search + location.hash;
let hasResolved = false;
let acceptUser;

// Consumers that load Firestore content should await this promise.
// It intentionally does not resolve for visitors, so no protected query runs.
export const protectedContentReady = new Promise(resolve => { acceptUser = resolve; });

function rememberDestination() {
  try { sessionStorage.setItem('redirectAfterLogin', requestedPath); }
  catch (error) { console.warn('تعذر حفظ الصفحة المطلوبة بعد الدخول:', error); }
}

function showGate(isError = false) {
  document.documentElement.classList.remove('zad-content-auth-ok', 'zad-exam-auth-ok');
  document.documentElement.classList.add('zad-content-auth-blocked');
  rememberDestination();
  let screen = document.getElementById('zad-content-auth-screen');
  if (!screen) {
    screen = document.createElement('section');
    screen.id = 'zad-content-auth-screen';
    screen.setAttribute('role', 'alertdialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-labelledby', 'zad-content-auth-heading');
    screen.innerHTML = `
      <div class="zad-auth-card">
        <div class="zad-auth-icon" aria-hidden="true">🔐</div>
        <h1 id="zad-content-auth-heading">تسجيل الدخول مطلوب</h1>
        <p id="zad-content-auth-description">المكتبة والكتب والملخصات والأسئلة والامتحانات متاحة للمستخدمين المسجلين فقط.</p>
        <div class="zad-auth-actions">
          <a id="zad-content-auth-login" class="zad-auth-primary">تسجيل الدخول</a>
          <a id="zad-content-auth-register" class="zad-auth-secondary">إنشاء حساب</a>
        </div>
        <a id="zad-content-auth-home" class="zad-auth-home">← الرجوع إلى الرئيسية</a>
      </div>`;
    screen.querySelector('#zad-content-auth-login').href = loginUrl;
    screen.querySelector('#zad-content-auth-register').href = registerUrl;
    screen.querySelector('#zad-content-auth-home').href = homeUrl;
    document.body.appendChild(screen);
  }
  screen.querySelector('#zad-content-auth-heading').textContent = isError ? 'تعذر التحقق من تسجيل الدخول' : 'تسجيل الدخول مطلوب';
  screen.querySelector('#zad-content-auth-description').textContent = isError
    ? 'تأكد من اتصال الإنترنت، ثم أعد فتح الصفحة أو سجل دخولك من جديد.'
    : 'سجّل دخولك أولًا لفتح المكتبة والكتب والملخصات والأسئلة والامتحانات والمحتوى الدراسي.';
  screen.hidden = false;
}

function showContent(user) {
  document.documentElement.classList.remove('zad-content-auth-blocked', 'zad-content-auth-error');
  document.documentElement.classList.add('zad-content-auth-ok', 'zad-exam-auth-ok');
  document.getElementById('zad-content-auth-screen')?.remove();
  if (!hasResolved) {
    hasResolved = true;
    acceptUser(user);
  }
}

// منع بقاء صفحة التحميل ظاهرة بلا نهاية إذا تعذّر تحميل Firebase.
window.setTimeout(() => {
  if (!hasResolved && !document.documentElement.classList.contains('zad-content-auth-blocked')) {
    showGate(true);
  }
}, 12000);

onAuthStateChanged(auth, user => {
  if (user) showContent(user);
  else showGate();
}, error => {
  console.error('فشل التحقق من جلسة المستخدم:', error);
  showGate(true);
});
