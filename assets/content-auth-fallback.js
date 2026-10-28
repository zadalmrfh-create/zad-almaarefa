// إذا فشل تحميل مكتبات Firebase أو انقطع الاتصال، لا تترك المستخدم في "جارٍ التحميل" إلى الأبد.
(function () {
  'use strict';
  const scriptUrl = document.currentScript?.src || location.href;
  const loginHref = new URL('../login/index.html?required=1', scriptUrl).href;
  const homeHref = new URL('../index.html', scriptUrl).href;
  window.setTimeout(function () {
    const html = document.documentElement;
    if (html.classList.contains('zad-content-auth-ok') || html.classList.contains('zad-content-auth-blocked')) return;
    html.classList.add('zad-content-auth-blocked');
    const screen = document.createElement('section');
    screen.id = 'zad-content-auth-screen';
    screen.setAttribute('role', 'alert');
    const card = document.createElement('div');
    card.className = 'zad-auth-card';
    const h = document.createElement('h1');
    h.id = 'zad-content-auth-heading';
    h.textContent = 'تعذر التحقق من تسجيل الدخول';
    const p = document.createElement('p');
    p.id = 'zad-content-auth-description';
    p.textContent = 'تعذر الاتصال بخدمة تسجيل الدخول. افحص اتصال الإنترنت وأعد تحميل الصفحة، أو افتح صفحة تسجيل الدخول.';
    const links = document.createElement('div');
    links.className = 'zad-auth-actions';
    const login = document.createElement('a');
    login.className = 'zad-auth-primary';
    login.href = loginHref;
    login.textContent = 'تسجيل الدخول';
    const home = document.createElement('a');
    home.className = 'zad-auth-secondary';
    home.href = homeHref;
    home.textContent = 'الصفحة الرئيسية';
    links.append(login, home);
    card.append(h, p, links);
    screen.appendChild(card);
    document.body.appendChild(screen);
  }, 12000);
}());
