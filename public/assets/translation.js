/* Zad Al-Maarefa — site-wide Arabic/English translation */
(function () {
  'use strict';
  var KEY='zad_language';
  var READY=false;
  function ensureUI(){
    if(!document.body) return;
    if(!document.getElementById('google_translate_element')){
      var box=document.createElement('div'); box.id='google_translate_element'; box.setAttribute('aria-hidden','true'); document.body.appendChild(box);
    }
    if(!document.getElementById('zad-translate-toggle')){
      var b=document.createElement('button'); b.id='zad-translate-toggle'; b.type='button';
      b.innerHTML='<span>🌐</span><span class="zad-translate-label">English</span>';
      b.addEventListener('click',toggleLanguage); document.body.appendChild(b);
    }
  }
  window.googleTranslateElementInit=function(){
    try{
      ensureUI();
      if(window.google && google.translate && document.getElementById('google_translate_element')){
        new google.translate.TranslateElement({pageLanguage:'ar',includedLanguages:'ar,en',autoDisplay:false,layout:google.translate.TranslateElement.InlineLayout.SIMPLE},'google_translate_element');
        READY=true;
        setTimeout(applySavedLanguage,150);
      }
    }catch(e){ console.warn('Translation init failed',e); }
  };
  function setCookie(lang){
    var v='/ar/'+lang;
    document.cookie='googtrans='+v+';path=/';
    document.cookie='googtrans='+v+';path=/;SameSite=Lax';
  }
  function clearCookie(){
    document.cookie='googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  }
  function updateUI(lang){
    var b=document.getElementById('zad-translate-toggle');
    var l=b&&b.querySelector('.zad-translate-label');
    if(l) l.textContent=lang==='ar'?'English':'العربية';
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  }
  function selectGoogle(lang){
    var s=document.querySelector('.goog-te-combo');
    if(!s) return false;
    s.value=lang;
    s.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  function applySavedLanguage(){
    ensureUI();
    var lang=localStorage.getItem(KEY)||'ar'; updateUI(lang);
    if(lang==='ar'){ clearCookie(); return; }
    setCookie(lang);
    if(selectGoogle(lang)) return;
    var tries=0;
    var t=setInterval(function(){
      tries++;
      if(selectGoogle(lang)||tries>40) clearInterval(t);
    },250);
  }
  function toggleLanguage(){
    var current=localStorage.getItem(KEY)||'ar'; var next=current==='ar'?'en':'ar';
    localStorage.setItem(KEY,next); updateUI(next); setCookie(next);
    if(next==='ar') clearCookie();
    if(!selectGoogle(next)){
      /* Reload lets Google read the cookie even if its widget has not initialized yet. */
      location.reload();
    }
  }
  function boot(){ ensureUI(); applySavedLanguage(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
