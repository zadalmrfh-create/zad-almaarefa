/* Zad Al-Maarefa — four-language site selector (Google Translate). */
(function () {
  'use strict';
  const KEY = 'zad_language';
  const choices = { ar: 'العربية', en: 'English', ru: 'Русский', fr: 'Français' };
  const available = Object.keys(choices);
  const getSaved = () => { try { const v = localStorage.getItem(KEY); return available.includes(v) ? v : 'ar'; } catch (_) { return 'ar'; } };
  const save = v => { try { localStorage.setItem(KEY, v); } catch (_) {} };
  let current = getSaved();

  function cookieFor(lang) {
    const v = '/ar/' + lang;
    document.cookie = 'googtrans=' + encodeURIComponent(v) + ';path=/;SameSite=Lax';
  }
  function clearCookie() {
    document.cookie = 'googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  }
  // Set the cookie before Google's translation script reads it.
  if (current === 'ar') clearCookie(); else cookieFor(current);

  function updateDocument(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
  function ensureUI() {
    if (!document.body) return;
    if (!document.getElementById('google_translate_element')) {
      const hidden = document.createElement('div');
      hidden.id = 'google_translate_element';
      hidden.setAttribute('aria-hidden','true');
      document.body.appendChild(hidden);
    }
    if (!document.getElementById('zad-language-widget')) {
      const widget = document.createElement('div');
      widget.id = 'zad-language-widget';
      widget.className = 'notranslate';
      widget.setAttribute('translate','no');
      widget.innerHTML = '<button type="button" id="zad-language-trigger" class="zad-language-trigger" aria-label="اختيار لغة المنصة" title="اختيار اللغة" aria-expanded="false" aria-controls="zad-language-panel">' +
        '<svg class="zad-language-trigger__icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
        '</button>' +
        '<div id="zad-language-panel" class="zad-language-panel" hidden>' +
        available.map(code => '<button type="button" class="zad-language-option" data-language="'+code+'" lang="'+code+'" aria-pressed="'+(code === current ? 'true' : 'false')+'">'+choices[code]+'</button>').join('') +
        '</div>';
      const trigger = widget.querySelector('#zad-language-trigger');
      const panel = widget.querySelector('#zad-language-panel');
      const closePanel = () => { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
      const openPanel = () => { panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); };
      trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        if (panel.hidden) openPanel(); else closePanel();
      });
      widget.addEventListener('click', (event) => event.stopPropagation());
      document.addEventListener('click', closePanel);
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePanel(); });
      widget.querySelectorAll('[data-language]').forEach(button => {
        button.addEventListener('click', () => {
          const value = button.dataset.language;
          if (!available.includes(value)) return;
          closePanel();
          if (value === current) return;
          save(value);
          if (value === 'ar') clearCookie(); else cookieFor(value);
          window.location.reload();
        });
      });
      // في الرئيسية يظهر زر اللغة في مكان زر الوضع الليلي القديم.
      const homeNav = document.querySelector('#navbar .nav-inner');
      const searchButton = homeNav?.querySelector('#globalSearchBtn');
      if (homeNav && searchButton) {
        searchButton.insertAdjacentElement('afterend', widget);
        widget.classList.add('zad-language-in-nav');
      } else {
        document.body.appendChild(widget);
      }
    }
    document.querySelectorAll('#zad-language-panel [data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === current)));
  }
  function googleSelect(lang) {
    const combo = document.querySelector('.goog-te-combo');
    if (!combo) return false;
    if (combo.value !== lang) {
      combo.value = lang;
      combo.dispatchEvent(new Event('change', { bubbles:true }));
    }
    return true;
  }
  window.googleTranslateElementInit = function () {
    ensureUI();
    try {
      if (window.google?.translate?.TranslateElement) {
        new google.translate.TranslateElement({
          pageLanguage:'ar', includedLanguages:'ar,en,ru,fr', autoDisplay:false,
          layout: google.translate.TranslateElement.InlineLayout.SIMPLE
        }, 'google_translate_element');
        if (current !== 'ar') {
          let count = 0;
          const timer = setInterval(() => {
            count += 1;
            if (googleSelect(current) || count >= 35) clearInterval(timer);
          }, 200);
        }
      }
    } catch (error) { console.warn('Zad translation unavailable:', error); }
  };
  function boot() { updateDocument(current); ensureUI(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
