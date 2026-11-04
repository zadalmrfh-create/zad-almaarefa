export const PHONE='201042231211';
export const DEFAULT_SETTINGS={chapterPricePiasters:800,retryPricePiasters:800,discountPercent:50,financePricePiasters:10000};
export const $=(id)=>document.getElementById(id);
export const format=(n)=>new Intl.NumberFormat('ar-EG-u-nu-latn',{maximumFractionDigits:2}).format(n);
export const egp=(piasters)=>format(piasters/100)+' جنيه';
export const esc=(str)=>String(str??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Math.trunc(Number(v)):min));
export function calculate(chapters,retries,settings=DEFAULT_SETTINGS,couponPercent=0){
 const ch=clamp(chapters,0,39),ret=clamp(retries,0,20);
 const base=ch*settings.chapterPricePiasters+ret*settings.retryPricePiasters;
 const discount=Math.round(base*settings.discountPercent/100);
 const after=base-discount;
 const extra=Math.round(after*clamp(couponPercent,0,90)/100);
 return {chapters:ch,retries:ret,beforePiasters:base,discountPiasters:discount,couponDiscountPiasters:extra,totalPiasters:after-extra};
}
export function showToast(message){let el=$('toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';el.setAttribute('role','status');document.body.append(el)}el.textContent=message;el.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove('show'),3800)}
export function setAlert(id,message,type='error'){const el=$(id);if(!el)return;el.textContent=message;el.className='alert '+(type==='success'?'alert-success':'alert-error');el.hidden=false}
export function clearAlert(id){if($(id))$(id).hidden=true}
export function shareText(s){const url='https://wa.me/'+PHONE+'?text='+encodeURIComponent(s);window.open(url,'_blank','noopener,noreferrer')}
export function randomCode(len=20){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=new Uint8Array(len);crypto.getRandomValues(bytes);return [...bytes].map(b=>chars[b%chars.length]).join('')}
export function registerPwa(){if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('./service-worker.js').catch(()=>{})}}
export function initTheme(){const saved=localStorage.getItem('malek-theme');document.documentElement.dataset.theme=saved==='light'?'light':'dark';const t=$('themeToggle');if(t){t.textContent=saved==='light'?'☾':'☀';t.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;localStorage.setItem('malek-theme',next);t.textContent=next==='light'?'☾':'☀'})}}
export function renderShell(active='home'){
 const links=[['الرئيسية','index.html','home'],['الخدمات','index.html#services','services'],['الأسعار','index.html#calculator','calculator'],['تتبع الطلب','track.html','track'],['حسابي','account.html','account'],['المساعدة','index.html#faq','faq']];
 const nav=links.map(([t,h])=>`<a href="./${h}">${t}</a>`).join('') + `<a class="admin-link" href="./admin.html" data-admin-link hidden>⚙ لوحة الإدارة</a>`;
 const h=$('siteHeader');if(h)h.innerHTML=`<a class="skip-link" href="#main">تخطي إلى المحتوى</a><header class="header"><div class="container nav-row"><a class="brand" href="./index.html" aria-label="الصفحة الرئيسية"><span class="brand-icon">M</span><span><strong>MALEK</strong><span>DIGITAL SERVICES</span></span></a><nav class="nav-links" aria-label="القائمة الرئيسية">${nav}</nav><div class="nav-controls"><button class="icon-btn" id="themeToggle" type="button" aria-label="تغيير الوضع الداكن أو الفاتح">☀</button><a class="btn btn-primary desktop-cta" href="./checkout.html">اطلب الآن ↗</a><button class="icon-btn menu-toggle" id="menuToggle" aria-expanded="false" aria-controls="mobileLinks" aria-label="فتح القائمة">☰</button></div></div><nav id="mobileLinks" class="mobile-links container" aria-label="قائمة الهاتف">${nav}<a class="btn btn-primary" href="./checkout.html">اطلب الآن</a></nav></header>`;
 const f=$('siteFooter');if(f)f.innerHTML=`<footer class="footer"><div class="container"><div class="footer-grid"><div><a class="brand" href="./index.html"><span class="brand-icon">M</span><span><strong>MALEK</strong><span>DIGITAL SERVICES</span></span></a><p style="margin-top:17px">خدمات تعليمية رقمية مستقلة مرتبطة بـ QUREO وSPRIX Learning. لا نمثل أيًا من المنصتين رسميًا.</p></div><div><h3>روابط سريعة</h3><a href="./checkout.html">طلب جديد</a><a href="./track.html">تتبع الطلب</a><a href="./account.html">حساب العميل</a><a href="./privacy.html">سياسة الخصوصية</a><a href="./terms.html">الشروط والأحكام</a><a href="./admin.html" class="admin-link" data-admin-link hidden>⚙ لوحة الإدارة</a></div><div><h3>تواصل معنا</h3><a href="https://wa.me/${PHONE}" target="_blank" rel="noopener noreferrer">واتساب: 01042231211</a><a href="https://www.instagram.com/maleksameh011/" target="_blank" rel="noopener noreferrer">إنستجرام</a><a href="https://www.facebook.com/maleksameh011" target="_blank" rel="noopener noreferrer">فيسبوك</a><p>لا ترسل كلمة مرور QUREO أو رمز تحقق عبر الموقع أو المحادثة.</p></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} مالك سامح. جميع الحقوق محفوظة.</span><span>خدمات مستقلة، وليست مواقع QUREO أو SPRIX Learning الرسمية.</span></div></div></footer><a class="wa-floating" href="https://wa.me/${PHONE}" target="_blank" rel="noopener noreferrer" aria-label="واتساب">◉ <span>تواصل واتساب</span></a>`;
 const btn=$('menuToggle'),menu=$('mobileLinks');if(btn&&menu){btn.addEventListener('click',()=>{const open=menu.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'×':'☰'});menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('open');btn.setAttribute('aria-expanded','false');btn.textContent='☰'}))}
 initTheme();registerPwa();
 // رابط الإدارة لا يظهر إلا بعد التحقق من الحساب والبريد وصلاحية Firestore.
 import('./admin-access.js').then(module => module.startAdminLinks()).catch(console.warn);
}
export const statuses={received:'تم استلام الطلب',reviewing:'قيد المراجعة',working:'جارٍ التنفيذ',completed:'مكتمل',cancelled:'ملغي'};
export function showTimeline(el,status){if(!el)return;const arr=['received','reviewing','working','completed'];const current=arr.indexOf(status);el.innerHTML=arr.map((s,i)=>`<div class="track-stage ${current>=i?'active':''}"><div class="circle">${current>=i?'✓':i+1}</div><div>${statuses[s]}</div></div>`).join('')+(status==='cancelled'?'<div class="alert alert-error" style="grid-column:1/-1">تم إلغاء الطلب. للتفاصيل تواصل معنا.</div>':'')}
export function syncStepper(id,max,onUpdate){const input=$(id);if(!input)return;input.addEventListener('input',()=>{input.value=String(clamp(input.value,0,max));onUpdate()});document.querySelectorAll(`[data-step-for="${id}"]`).forEach(btn=>btn.addEventListener('click',()=>{input.value=String(clamp(Number(input.value)+Number(btn.dataset.delta),0,max));onUpdate()}))}
export function bindPreview(onUpdate){syncStepper('chapters',39,onUpdate);syncStepper('retries',20,onUpdate)}
