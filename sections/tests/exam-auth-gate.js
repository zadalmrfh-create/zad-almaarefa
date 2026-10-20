// شرط تسجيل الدخول لفتح امتحانات زاد المعرفة.
// يعتمد على حالة Firebase Authentication الحقيقية، وليس localStorage.
import { auth } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const examPaths = /\/sections\/tests\/(?:index|code-exams|code-exam|nahw|balagha|tawheed)\.html$/;
const loginHref = new URL('../../login/index.html', import.meta.url).href;
let settled = false;
let redirecting = false;

function sendToLogin() {
  if (redirecting) return;
  redirecting = true;
  const target = location.pathname + location.search;
  if (examPaths.test(location.pathname)) {
    try { sessionStorage.setItem('redirectAfterLogin', target); } catch (error) {
      console.warn('تعذر حفظ وجهة العودة إلى الامتحان:', error);
    }
  }
  location.replace(loginHref);
}

export const examAuthReady = new Promise(resolve => {
  onAuthStateChanged(auth, user => {
    if (user) {
      document.documentElement.classList.add('zad-exam-auth-ok');
      if (!settled) { settled = true; resolve(user); }
    } else {
      document.documentElement.classList.remove('zad-exam-auth-ok');
      if (!settled) { settled = true; resolve(null); }
      sendToLogin();
    }
  }, error => {
    console.error('تعذر التحقق من جلسة امتحان زاد المعرفة:', error);
    const indicator = document.getElementById('zad-exam-auth-warning');
    if (indicator) indicator.hidden = false;
    if (!settled) { settled = true; resolve(null); }
  });
});
