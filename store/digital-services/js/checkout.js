import { $,renderShell,DEFAULT_SETTINGS,calculate,format,egp,clamp,bindPreview,shareText,showToast,setAlert,clearAlert,randomCode } from './shared.js';
import {configured} from './firebase-config.js';
renderShell('checkout');let settings={...DEFAULT_SETTINGS},couponCode='',couponPercent=0,service=null,submitted=null;
const qs=new URLSearchParams(location.search);$('chapters').value=clamp(qs.get('ch')??10,0,39);$('retries').value=clamp(qs.get('ret')??0,0,20);
if(['الترم الأول','الترم الثاني'].includes(qs.get('term')))$('term').value=qs.get('term');if(['chapters','retries','both','finance'].includes(qs.get('service'))){$('serviceType').value=qs.get('service');if(qs.get('service')==='chapters')$('retries').value='0';if(qs.get('service')==='retries')$('chapters').value='0';}if(qs.get('coupon'))$('coupon').value=qs.get('coupon');
const isFinance=()=>$('serviceType').value==='finance';
let wasFinance=false,previousStandard={chapters:Number($('chapters').value)||10,retries:Number($('retries').value)||0};
function syncServiceMode(){
 const finance=isFinance();
 if(finance){
  if(!wasFinance)previousStandard={chapters:Number($('chapters').value)||10,retries:Number($('retries').value)||0};
  $('chapters').value='0';$('retries').value='0';
  couponCode='';couponPercent=0;$('coupon').value='';$('couponFeedback').textContent='';
 }else if(wasFinance){
  $('chapters').value=String(previousStandard.chapters);$('retries').value=String(previousStandard.retries);
 }
 document.querySelectorAll('[data-finance-hide]').forEach(el=>{el.hidden=finance});
 $('financeQuoteSummary').hidden=!finance;
 $('financeCheckoutPrice').textContent=egp(settings.financePricePiasters??DEFAULT_SETTINGS.financePricePiasters);
 $('financeDetailsTip').hidden=!finance;
 $('notes').required=finance;
 $('notes').minLength=finance?10:0;
 $('notes').placeholder=finance?'اكتب تفاصيل الأنشطة أو الوحدات المطلوبة في الثقافة المالية، بدون أي كلمات مرور أو معلومات دخول.':'اكتب تفاصيل عامة عن الطلب فقط. لا تضع أي كلمات مرور أو رموز تحقق أو بيانات دخول.';
 $('notesLabel').textContent=finance?'تفاصيل طلب الثقافة المالية *':'ملاحظات (اختياري)';
 $('submitOrder').textContent=finance?'إرسال طلب الثقافة المالية':'تأكيد وحفظ الطلب';
 wasFinance=finance;
 update();
}
function update(){if(isFinance()){$('chapters').value='0';$('retries').value='0';}if($('serviceType').value==='chapters')$('retries').value='0';if($('serviceType').value==='retries')$('chapters').value='0';let d=calculate($('chapters').value,$('retries').value,settings,couponPercent);if(isFinance()){const p=settings.financePricePiasters??DEFAULT_SETTINGS.financePricePiasters;d={chapters:0,retries:0,beforePiasters:p,discountPiasters:0,couponDiscountPiasters:0,totalPiasters:p};$('financeCheckoutPrice').textContent=egp(p);}$('chapters').value=d.chapters;$('retries').value=d.retries;$('chCost').textContent=egp(d.chapters*settings.chapterPricePiasters);$('retryCost').textContent=egp(d.retries*settings.retryPricePiasters);$('beforeCost').textContent=egp(d.beforePiasters);$('discountCost').textContent='−'+egp(d.discountPiasters);$('couponLine').hidden=couponPercent===0;$('couponCost').textContent='−'+egp(d.couponDiscountPiasters);$('totalPrice').textContent=format(d.totalPiasters/100);return d}
bindPreview(update);$('serviceType').addEventListener('change',()=>{const s=$('serviceType').value;if(s==='chapters')$('retries').value='0';if(s==='retries')$('chapters').value='0';syncServiceMode();if(s==='chapters'&&!Number($('chapters').value))$('chapters').value='1';if(s==='retries'&&!Number($('retries').value))$('retries').value='1';update()});
$('coupon').addEventListener('input',()=>{if(couponCode&&$('coupon').value.trim().toUpperCase()!==couponCode){couponCode='';couponPercent=0;update()}});
$('applyCoupon').addEventListener('click',async()=>{const code=$('coupon').value.trim().toUpperCase();if(!/^[A-Z0-9_-]{3,20}$/.test(code)){$('couponFeedback').textContent='الكود غير صالح.';return}if(!configured){$('couponFeedback').textContent='اربط Firebase أولًا.';return}try{service ||= await import('./firebase-service.js');const c=await service.getCoupon(code);if(!c){couponCode='';couponPercent=0;$('couponFeedback').textContent='الكوبون غير متاح.';}else{couponCode=code;couponPercent=clamp(c.percent,1,90);$('couponFeedback').textContent=`خصم إضافي ${couponPercent}% مطبق ✓`;}update()}catch(e){$('couponFeedback').textContent='تعذر التحقق من الكود.'}});
$('whatsappQuote').addEventListener('click',()=>{const d=update();const name=$('customerName').value.trim()||'لم يحدد';
 if(isFinance())shareText(`السلام عليكم، استفسار عن الثقافة المالية على SPRIX Learning.\nالاسم: ${name}\nالفترة: ${$('term').value}\nالتفاصيل: ${$('notes').value.trim()||'سأوضح المطلوب'}\nالسعر المعلن للمادة كاملة: ${egp(d.totalPiasters)}.\nبرجاء تأكيد التفاصيل قبل الدفع.`);
 else shareText(`السلام عليكم، استفسار عن حل منصة كيرو.\nالاسم: ${name}\nالفترة: ${$('term').value}\nالشابترات: ${d.chapters}\nالإعادات: ${d.retries}\nالإجمالي التقديري: ${egp(d.totalPiasters)}\nالرجاء تأكيد نطاق الخدمة والسعر قبل الدفع.`);
});
$('copyPayment').addEventListener('click',()=>{navigator.clipboard?.writeText('01042231211').then(()=>showToast('تم نسخ رقم الدفع')).catch(()=>showToast('رقم الدفع 01042231211'))});
function friendlyError(e){if(e?.code==='permission-denied')return'تعذر حفظ الطلب. تحقق من نشر Firestore Rules وإنشاء settings/public.';if(e?.code==='auth/operation-not-allowed')return'فعّل طريقة تسجيل الدخول Anonymous من Firebase Authentication.';if(e?.code==='unavailable')return'لا يوجد اتصال متاح بقاعدة البيانات حاليًا.';return'تعذر تسجيل الطلب حاليًا. تحقق من اتصال Firebase والإعدادات.'}
$('orderForm').addEventListener('submit',async e=>{e.preventDefault();clearAlert('formAlert');let d=update();const name=$('customerName').value.trim(),phone=$('customerPhone').value.trim();if(name.length<3||name.length>70||!/^(01)[0-9]{9}$/.test(phone)){setAlert('formAlert','تحقق من الاسم ورقم واتساب المصري المكون من 11 رقمًا.');return}if(!isFinance()&&d.chapters+d.retries===0){setAlert('formAlert','اختر شابترًا واحدًا أو إعادة واحدة على الأقل.');return}if(!configured){setAlert('formAlert','قاعدة البيانات لم تُربط بعد. اتبع خطوات README.md، أو أرسل استفسار واتساب الآن.');return}const notes=$('notes').value.trim();if(isFinance()&&notes.length<10){setAlert('formAlert','اكتب تفاصيل الثقافة المالية في 10 أحرف على الأقل.');return}if(/(?:password|passcode|otp|كلمة\s*المرور|رمز\s*(?:التحقق|الدخول))/i.test(notes)){setAlert('formAlert','احذف أي كلمات مرور أو رموز تحقق من الملاحظات.');return}
 const button=$('submitOrder');button.disabled=true;button.textContent='جارٍ تسجيل الطلب…';try{
 service ||= await import('./firebase-service.js');let s=await service.getSettings();if(!s)throw Object.assign(new Error('missing public settings'),{code:'permission-denied'});
 settings={...DEFAULT_SETTINGS,...s};if(couponCode){const fresh=await service.getCoupon(couponCode);if(!fresh)throw new Error('coupon-invalid');couponPercent=clamp(fresh.percent,1,90)}d=update();
 const user=await service.anonymousUser();const orderId='QM-'+randomCode(10);const trackingCode=randomCode(22);
 const now=service.serverTimestamp();const data={uid:user.uid,trackingCode,name,phone,term:$('term').value,serviceType:$('serviceType').value,chapters:d.chapters,retries:d.retries,notes,couponCode,couponPercent,beforePiasters:d.beforePiasters,discountPiasters:d.discountPiasters,couponDiscountPiasters:d.couponDiscountPiasters,totalPiasters:d.totalPiasters,status:'received',createdAt:now,updatedAt:now};
 const batch=service.writeBatch(service.db);batch.set(service.doc(service.db,'orders',orderId),data);batch.set(service.doc(service.db,'orderTracking',trackingCode),{orderId,status:'received',updatedAt:service.serverTimestamp()});await batch.commit();
 submitted={orderId,trackingCode,name,phone,term:data.term,serviceType:data.serviceType,notes,d};localStorage.setItem('malek-latest-tracking',trackingCode);
 $('orderForm').classList.add('hide');$('orderSuccess').classList.remove('hide');$('financeSuccessNote').hidden=!isFinance();$('successOrderId').textContent=orderId;$('successTrackingCode').textContent=trackingCode;$('trackOrderLink').href='./track.html?code='+encodeURIComponent(trackingCode);showToast('تم تسجيل الطلب بنجاح');window.scrollTo({top:260,behavior:'smooth'});
 }catch(err){console.error(err);setAlert('formAlert',err.message==='coupon-invalid'?'الكوبون لم يعد صالحًا. احذفه أو أعد تطبيقه.':friendlyError(err))}finally{button.disabled=false;button.textContent=isFinance()?'إرسال طلب الثقافة المالية':'تأكيد وحفظ الطلب'}});
$('copyTracking').addEventListener('click',()=>navigator.clipboard?.writeText(submitted?.trackingCode||'').then(()=>showToast('تم نسخ كود التتبع')).catch(()=>showToast('انسخ الكود الظاهر يدويًا')));
$('sendToWhatsapp').addEventListener('click',()=>{if(!submitted)return;const {orderId,trackingCode,d,name,phone,term,serviceType,notes}=submitted;
 if(serviceType==='finance')shareText(`السلام عليكم، تم تسجيل طلب الثقافة المالية — SPRIX Learning على موقع MALEK.\nرقم الطلب: ${orderId}\nالاسم: ${name}\nرقم التواصل: ${phone}\nالفترة: ${term}\nالتفاصيل: ${notes}\nالسعر للمادة كاملة: ${egp(d.totalPiasters)} (بدون خصم).\nالرابط: https://egy.app.spx-learning-square.com/subjects/7/curriculum\nبرجاء تأكيد تفاصيل الطلب قبل الدفع.`);
 else shareText(`السلام عليكم، السلام عليكم، تم تسجيل طلب حل منصة كيرو على موقع MALEK.\nرقم الطلب: ${orderId}\nالاسم: ${name}\nرقم التواصل: ${phone}\nالفترة: ${term}\nالشابترات: ${d.chapters}\nالإعادات: ${d.retries}\nالمبلغ التقديري: ${egp(d.totalPiasters)}\nأرجو تأكيد التفاصيل قبل الدفع.`)});
$('reviewForm').addEventListener('submit',async e=>{e.preventDefault();clearAlert('reviewAlert');if(!configured){setAlert('reviewAlert','اربط Firebase لإرسال التقييم للمراجعة.');return}try{service ||=await import('./firebase-service.js');const user=await service.anonymousUser();await service.addDoc(service.collection(service.db,'reviews'),{uid:user.uid,name:$('reviewName').value.trim(),stars:Number($('reviewStars').value),text:$('reviewText').value.trim(),approved:false,createdAt:service.serverTimestamp()});$('reviewForm').reset();setAlert('reviewAlert','تم إرسال رأيك للمراجعة. شكراً لك.','success')}catch(err){console.error(err);setAlert('reviewAlert','تعذر حفظ التقييم. تحقق من إعدادات Firebase.')}});
async function loadSettings(){if(!configured){setAlert('setupWarning','نسخة العرض جاهزة للتصفح. لتفعيل حفظ الطلبات والتقييمات، أضف إعدادات Firebase كما هو موضح في README.md.','error');$('setupWarning').hidden=false;return}try{service=await import('./firebase-service.js');const s=await service.getSettings();if(s){settings={...DEFAULT_SETTINGS,...s};update()}else setAlert('setupWarning','أنشئ settings/public داخل Firestore لإكمال التفعيل.','error');if(qs.get('coupon')&&!isFinance())$('applyCoupon').click()}catch(err){console.error(err);setAlert('setupWarning','فشل الاتصال بقاعدة البيانات. راجع إعدادات Firebase وFirestore Rules.')}}
syncServiceMode();loadSettings();
// تسجيل الدخول اختياري: عند وجود حساب نملأ بيانات التواصل المحفوظة دون استبدال ما كتبه الزائر.
if(configured){import('./firebase-service.js').then(s=>{
 s.onAuthStateChanged(s.auth,async u=>{
  const accountLink=$('successAccountLink');
  if(accountLink)accountLink.textContent=u && !u.isAnonymous?'عرض طلباتي':'أنشئ حسابًا لحفظ الطلبات';
  if(!u||u.isAnonymous)return;
  if(!$('customerName').value.trim() && u.displayName)$('customerName').value=u.displayName;
  try{const p=await s.getDoc(s.doc(s.db,'customers',u.uid));
   if(p.exists()){const d=p.data();if(!$('customerName').value.trim())$('customerName').value=d.name||'';
    if(!$('customerPhone').value.trim())$('customerPhone').value=d.phone||'';}}
  catch(err){console.warn('Profile unavailable',err)}
 });
}).catch(console.warn)}
