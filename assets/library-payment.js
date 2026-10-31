import {auth,db} from '../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {addDoc,collection,doc,getDoc,getDocs,query,where,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {libraryAccessState,MONEY_RECEIVER,DEFAULT_LIBRARY_PRICE_PIASTRES} from './library-subscription.js';
const $=id=>document.getElementById(id);
let loggedUser=null;
let requiredPricePiastres=DEFAULT_LIBRARY_PRICE_PIASTRES;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={pending:'⏳ بانتظار مراجعة الإدارة',approved:'✅ تم اعتماد الدفع',rejected:'❌ لم يُعتمد الدفع'};
function inform(message,cl='warning'){ $('payAccessStatus').className=cl; $('payAccessStatus').textContent=message; }
$('copyNumber').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(MONEY_RECEIVER);inform('تم نسخ رقم المحفظة.');}catch{inform('رقم المحفظة: '+MONEY_RECEIVER);}});
async function load(){
  const access=await libraryAccessState();
  if(access.status==='login'){
    try{sessionStorage.setItem('redirectAfterLogin',location.pathname)}catch{}
    location.replace('../login/index.html?required=1');return;
  }
  if(access.status==='error'){inform('تعذر الاتصال بقاعدة البيانات. لا يمكن تأكيد الاشتراك الآن.','error');return;}
  loggedUser=access.user;
  if(access.status==='active'){
    inform('✅ اشتراكك مفعّل! تقدر تفتح وتحمّل من المكتبتين الآن.','ok');
    $('libPayFormPanel').hidden=true;
  }else{
    inform('🔒 حسابك مسجّل، لكن اشتراك المكتبة لم يُعتمد بعد. راجع قيمة الاشتراك ثم أرسل بيانات التحويل.');
    $('libPayFormPanel').hidden=false;
  }
  try{
    const settings=await getDoc(doc(db,'librarySettings','main'));
    const saved=settings.data()?.pricePiastres;
    if(Number.isSafeInteger(saved)&&saved>=100)requiredPricePiastres=saved;
  }catch(e){console.warn('تعذر تحميل إعدادات السعر؛ سيتم عرض السعر الافتراضي 200 جنيه.',e);}
  $('libPrice').textContent='قيمة اشتراك المكتبتين: '+(requiredPricePiastres/100).toLocaleString('ar-EG')+' جنيه مصري';
  $('libPaymentForm').elements.amount.value=(requiredPricePiastres/100).toFixed(2);
  try{
    const snap=await getDocs(query(collection(db,'libraryPaymentRequests'),where('studentUid','==',loggedUser.uid)));
    const records=snap.docs.map(d=>d.data()).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    $('libPaymentHistory').innerHTML=records.length?records.map(r=>`<div class="history-row"><b>${safe(labels[r.status]||r.status)}</b> · ${Number(r.amountPiastres||0)/100} ج.م<small>مرجع العملية: ${safe(r.reference||'—')}</small><small>${safe(r.adminNote||'')}</small></div>`).join(''):'لم ترسل أي طلب اشتراك حتى الآن.';
  }catch(error){console.error(error);$('libPaymentHistory').textContent='تعذر تحميل طلبات الاشتراك. تأكد من تحديث قواعد Firestore.';}
}
$('libPaymentForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!loggedUser)return;
  const form=e.currentTarget,btn=$('libPaySubmit');
  const amount=Number(form.elements.amount.value),amountPiastres=Math.round(amount*100);
  const phone=form.elements.phone.value.trim(),reference=form.elements.reference.value.trim(),note=form.elements.note.value.trim();
  if(!Number.isSafeInteger(amountPiastres)||amountPiastres!==requiredPricePiastres||!/^01\d{9}$/.test(phone)||reference.length<4){inform('المبلغ المطلوب هو '+(requiredPricePiastres/100)+' جنيه. راجع بيانات التحويل.','error');return;}
  if(!confirm('هل تحققت أنك حوّلت '+amount.toFixed(2)+' جنيه بالفعل إلى '+MONEY_RECEIVER+'؟'))return;
  btn.disabled=true;inform('جارٍ تسجيل الطلب للمراجعة...');
  try{
    await addDoc(collection(db,'libraryPaymentRequests'),{studentUid:loggedUser.uid,studentEmail:loggedUser.email||'',amountPiastres,senderPhone:phone,reference:reference.slice(0,100),note:note.slice(0,350),status:'pending',createdAt:serverTimestamp()});
    form.reset();inform('✅ تم إرسال طلبك. راجع حالة الاشتراك هنا بعد موافقة الإدارة.','ok');await load();
  }catch(error){console.error(error);inform('تعذر إرسال الطلب: '+(error.code||error.message),'error');}
  finally{btn.disabled=false;}
});
onAuthStateChanged(auth,()=>load());
