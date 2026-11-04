import { $,renderShell,DEFAULT_SETTINGS,calculate,egp,format,clamp,bindPreview,shareText,showToast,esc } from './shared.js';
import {configured} from './firebase-config.js';
renderShell('home');let settings={...DEFAULT_SETTINGS},couponPercent=0,couponCode='';
const ch=$('chapters'),ret=$('retries');
const hasHomeCalculator = !!(ch && ret && $('checkoutLink'));
function update(){
 const d = hasHomeCalculator ? calculate(ch.value,ret.value,settings,couponPercent) : calculate(10,0,settings,0);
 if(hasHomeCalculator){
  ch.value=d.chapters;ret.value=d.retries;
  $('chapterPriceNote').textContent=`(${egp(settings.chapterPricePiasters)} للوحدة)`;$('retryPriceNote').textContent=`(${egp(settings.retryPricePiasters)} للوحدة)`;
  $('chCost').textContent=egp(d.chapters*settings.chapterPricePiasters);$('retryCost').textContent=egp(d.retries*settings.retryPricePiasters);
  $('beforeCost').textContent=egp(d.beforePiasters);$('discountCost').textContent='−'+egp(d.discountPiasters);
  $('couponCost').textContent='−'+egp(d.couponDiscountPiasters);$('couponLine').hidden=couponPercent===0;
  $('totalPrice').textContent=format(d.totalPiasters/100);
  const q=new URLSearchParams({ch:String(d.chapters),ret:String(d.retries),term:$('term').value});if(couponCode)q.set('coupon',couponCode);
  $('checkoutLink').href='./checkout.html?'+q.toString();
 }
 if($('financeCardPrice')) $('financeCardPrice').textContent=egp(settings.financePricePiasters??DEFAULT_SETTINGS.financePricePiasters);
 if($('heroDiscount')) $('heroDiscount').textContent=settings.discountPercent+'%';
 if($('promoTag')) $('promoTag').textContent=`خصم ${settings.discountPercent}%`;
 return d;
}
bindPreview(update);$('term').addEventListener('change',update);$('coupon').addEventListener('input',()=>{if(couponCode&&$('coupon').value.trim().toUpperCase()!==couponCode){couponCode='';couponPercent=0;update()}});
$('whatsappQuote').addEventListener('click',()=>{const d=update();shareText(`السلام عليكم، استفسار عن حل منصة كيرو.\nالفترة: ${$('term').value}\nالشابترات: ${d.chapters}\nالإعادات: ${d.retries}\nالإجمالي التقديري: ${egp(d.totalPiasters)}\nأرجو توضيح التفاصيل والسعر النهائي قبل الدفع.`)});
$('applyCoupon').addEventListener('click',async()=>{const code=$('coupon').value.trim().toUpperCase();if(!/^[A-Z0-9_-]{3,20}$/.test(code)){$('couponFeedback').textContent='الكود غير صالح. استخدم أحرفًا إنجليزية وأرقامًا.';return}if(!configured){$('couponFeedback').textContent='يجب ربط Firebase للتحقق من الكوبونات.';return}try{const {getCoupon}=await import('./firebase-service.js');const c=await getCoupon(code);if(!c){couponCode='';couponPercent=0;$('couponFeedback').textContent='الكوبون غير متاح أو غير مفعل.';}else{couponCode=code;couponPercent=clamp(c.percent,1,90);$('couponFeedback').textContent=`تم تطبيق خصم إضافي ${couponPercent}% ✓`;}update()}catch(e){$('couponFeedback').textContent='تعذر التحقق من الكوبون حاليًا.'}});
async function loadBackend(){if(!configured){$('couponFeedback').textContent='لتفعيل الكوبونات والطلبات، اربط Firebase حسب ملف README.md.';return}try{const {db,doc,collection,getSettings,getDocs,query,where,limit}=await import('./firebase-service.js');const s=await getSettings();if(s){settings={...DEFAULT_SETTINGS,...s};update()}else showToast('أنشئ مستند settings/public في Firebase لتفعيل الطلبات.');const snap=await getDocs(query(collection(db,'reviews'),where('approved','==',true),limit(12)));const reviews=snap.docs.map(d=>d.data());$('reviewsList').innerHTML=reviews.length?reviews.map(r=>`<article class="glass review-item"><div class="stars" aria-label="${r.stars} من 5">${'★'.repeat(clamp(r.stars,1,5))}</div><p>“${esc(r.text)}”</p><strong>${esc(r.name)}</strong></article>`).join(''):'<div class="empty" style="grid-column:1/-1">لا توجد تقييمات منشورة حتى الآن.</div>';}catch(e){console.warn('Public Firebase data not available:',e)}}
update();loadBackend();
