import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,addDoc,getDocs,query,where,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {toPiastres,amountDue,amountPaid,amountRemaining,money,html,isCharge} from '../payment-utils.js';
const $=id=>document.getElementById(id);
let uid='',lessons=[],requests=[],profile={},busy=false;
const statusText={pending:'⏳ قيد مراجعة الإدارة',approved:'✅ معتمد',rejected:'❌ مرفوض'};
const form=$('zadVodafonePaymentForm'),msg=$('zadVodafoneMessage');
function feedback(text,error=false){msg.textContent=text;msg.className=error?'zad-pay-error':'zad-pay-ok';}
function draw(){
 const dueLessons=lessons.filter(isCharge).filter(x=>amountRemaining(x)>0);
 const total=lessons.filter(isCharge).reduce((s,x)=>s+amountDue(x),0);
 const paid=lessons.filter(isCharge).reduce((s,x)=>s+amountPaid(x),0);
 $('zadVodafoneDue').textContent=money(total);$('zadVodafonePaid').textContent=money(paid);$('zadVodafoneRemaining').textContent=money(total-paid);
 const chosen=new Set([...document.querySelectorAll('[name="zadVodafoneLesson"]:checked')].map(c=>c.value));
 $('zadVodafoneLessons').innerHTML=dueLessons.length?dueLessons.map(x=>`<label class="zad-pay-lesson"><input type="checkbox" name="zadVodafoneLesson" value="${html(x.id)}" ${chosen.has(x.id)?'checked':''}><span><b>${html(x.subject||'حصة')}</b> — ${html(x.date||'بلا تاريخ')}<small>المتبقي ${money(amountRemaining(x))} من ${money(amountDue(x))}</small></span></label>`).join(''):'<p>لا توجد حصص مستحقة حاليًا.</p>';
 $('zadVodafoneHistory').innerHTML=requests.length?requests.map(x=>`<tr><td>${money(x.amountPiastres)}</td><td>${x.targetType==='lessons'?'حصص محددة':'من المستحقات'}</td><td>${html(x.reference||'—')}</td><td>${statusText[x.status]||'—'}</td><td>${html(x.adminNote||'—')}</td></tr>`).join(''):'<tr><td colspan="5">لا توجد طلبات تحويل بعد.</td></tr>';
 const canPay=dueLessons.length>0;$('zadVodafoneSend').disabled=!canPay||busy;
 $('zadVodafoneNoDue').hidden=canPay;
}
async function load(){
 if(!uid)return;
 try{
  feedback('جارٍ تحميل مستحقاتك وطلبات الدفع...');
  const [as,ps]=await Promise.all([
   getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',uid))),
   getDocs(query(collection(db,'vodafonePayments'),where('studentUid','==',uid)))
  ]);
  lessons=as.docs.map(d=>({id:d.id,...d.data()}));
  requests=ps.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  draw();feedback('راجع رقم المحفظة وتأكد من إتمام التحويل قبل إرسال الطلب.');
  window.dispatchEvent(new Event('zad:payments-updated'));
 }catch(e){console.error('Vodafone payment student load:',e);feedback('تعذر تحميل البيانات: '+(e.code||e.message),true);}
}
$('zadVodafoneCopy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('01042239704');feedback('تم نسخ رقم المحفظة.');}catch{feedback('رقم المحفظة: 01042239704');}});
$('zadVodafoneRefresh')?.addEventListener('click',load);
$('zadVodafoneMode')?.addEventListener('change',()=>{$('zadVodafoneChooseLessons').hidden=$('zadVodafoneMode').value!=='lessons';});
form?.addEventListener('submit',async e=>{
 e.preventDefault();if(busy||!uid)return;
 const amt=toPiastres($('zadVodafoneAmount').value);
 const mode=$('zadVodafoneMode').value;
 const selected=[...form.querySelectorAll('[name="zadVodafoneLesson"]:checked')].map(x=>x.value);
 const sender=$('zadVodafoneSender').value.trim();
 const candidates=lessons.filter(isCharge).filter(r=>amountRemaining(r)>0 && (mode==='balance'||selected.includes(r.id)));
 const cap=candidates.reduce((s,x)=>s+amountRemaining(x),0);
 if(!['lessons','balance'].includes(mode)){feedback('اختر طريقة السداد.',true);return;}
 if(mode==='lessons'&&!selected.length){feedback('اختر حصة واحدة على الأقل.',true);return;}
 if(!/^01\d{9}$/.test(sender)){feedback('أدخل رقم هاتف مصري صحيح مكوّن من 11 رقمًا.',true);return;}
 if(!Number.isSafeInteger(amt)||amt<100||amt>100000000){feedback('المبلغ يجب أن يكون من جنيه واحد إلى مليون جنيه.',true);return;}
 if(amt>cap){feedback('المبلغ أكبر من المستحق في '+(mode==='lessons'?'الحصص المختارة.':'حسابك.')+' المتبقي '+money(cap),true);return;}
 if(!window.confirm('هل حوّلت '+money(amt)+' بالفعل إلى 01042239704؟ تقديم الطلب لا يؤكد وصول المبلغ.'))return;
 busy=true;draw();feedback('جارٍ إرسال طلب المراجعة...');
 try{
  await addDoc(collection(db,'vodafonePayments'),{
   studentUid:uid,studentName:String(profile.fullName||profile.name||auth.currentUser?.displayName||'طالب').slice(0,120),
   amountPiastres:amt,targetType:mode,lessonIds:mode==='lessons'?selected:[],
   senderPhone:sender,reference:$('zadVodafoneReference').value.trim().slice(0,100),
   note:$('zadVodafoneNote').value.trim().slice(0,350),
   method:'vodafone-cash',status:'pending',createdAt:serverTimestamp()
  });
  form.reset();$('zadVodafoneChooseLessons').hidden=true;
  await load();feedback('✅ أُرسل طلب التحويل للإدارة. لن يُحسب مدفوعًا إلا بعد اعتماد الإدارة.');
 }catch(err){console.error(err);feedback('تعذر إرسال الطلب: '+(err.code||err.message),true);}
 finally{busy=false;draw();}
});
onAuthStateChanged(auth,async user=>{if(!user){feedback('سجّل الدخول بحساب الطالب أولًا.',true);return;}uid=user.uid;try{const p=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');const s=await p.getDoc(p.doc(db,'users',uid));profile=s.data()||{};}catch(e){console.warn(e);}await load();});
