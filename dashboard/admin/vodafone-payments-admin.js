import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDocs,query,where,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {amountDue,amountPaid,amountRemaining,money,html,isCharge} from '../payment-utils.js';
const $=id=>document.getElementById(id);
let list=[],busy=false;
function message(s,err=false){$('zadVodafoneAdminMessage').textContent=s;$('zadVodafoneAdminMessage').className=err?'zad-pay-error':'zad-pay-ok';}
function render(){
 const filter=$('zadVodafoneFilter').value;
 const found=list.filter(r=>filter==='all'||r.status===filter);
 $('zadVodafoneRequests').innerHTML=found.length?found.map(p=>`<article class="zad-pay-request" data-id="${html(p.id)}"><div><b>${html(p.studentName||'طالب')}</b> — <strong>${money(p.amountPiastres)}</strong><small>${html(p.senderPhone)} · مرجع: ${html(p.reference||'غير مذكور')}</small><small>${p.targetType==='lessons'?'حصص معينة':'سداد المستحقات'} · ${p.status==='approved'?'✅ معتمد':p.status==='rejected'?'❌ مرفوض':'⏳ بانتظار المراجعة'}</small><small>ملاحظات الطالب: ${html(p.note||'—')}</small>${p.adminNote?`<small>رد الإدارة: ${html(p.adminNote)}</small>`:''}</div>${p.status==='pending'?`<div class="zad-pay-request-actions"><button class="btn gold" type="button" data-action="approve" ${busy?'disabled':''}>✅ اعتماد التحويل</button><button class="btn" type="button" data-action="reject" ${busy?'disabled':''}>❌ رفض</button></div>`:''}</article>`).join(''):'<p>لا توجد طلبات مطابقة.</p>';
 $('zadVodafonePendingCount').textContent=list.filter(x=>x.status==='pending').length;
 $('zadVodafoneApprovedAmount').textContent=money(list.filter(x=>x.status==='approved').reduce((s,x)=>s+Number(x.amountPiastres||0),0));
}
async function load(){try{message('جارٍ تحميل طلبات التحويل...');const snap=await getDocs(collection(db,'vodafonePayments'));list=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));render();message('تحقّق من وصول التحويل للمحفظة قبل الموافقة.');}catch(e){console.error(e);message('تعذر تحميل طلبات الدفع: '+(e.code||e.message),true);}}
async function approve(p){
 if(p.reference && list.some(x=>x.id!==p.id && x.status==='approved' && x.reference?.trim()===p.reference.trim() && x.senderPhone===p.senderPhone)) throw new Error('هذا الرقم المرجعي مستخدم بالفعل في تحويل معتمد من نفس الهاتف.');
 if(!window.confirm('هل تأكدت بنفسك من وصول '+money(p.amountPiastres)+' لمحفظة 01154015353، وأن رقم العملية لم يُعتمد من قبل؟'))return;
 // القراءة الأولية لترتيب سجلات الطالب؛ يعيد Firestore التحقق منها داخل المعاملة.
 const found=await getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',p.studentUid)));
 const candidates=found.docs.map(d=>({id:d.id,ref:d.ref,...d.data()})).filter(isCharge)
    .filter(x=>p.targetType==='lessons' ? (Array.isArray(p.lessonIds)&&p.lessonIds.includes(x.id)) : true)
    .filter(x=>amountRemaining(x)>0).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
 if(!candidates.length)throw new Error('لا توجد حصص غير مسددة لهذا الطلب.');
 if(candidates.length>150)throw new Error('لدى الطالب أكثر من 150 حصة مستحقة؛ يلزم تقسيم التسوية من لوحة الإدارة.');
 const referenceId=p.reference?.trim()
   ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p.senderPhone+'|'+p.reference.trim().toLowerCase())))).map(b=>b.toString(16).padStart(2,'0')).join('')
   : null;
 await runTransaction(db,async tx=>{
  const ref=doc(db,'vodafonePayments',p.id);
  const paymentSnap=await tx.get(ref);
  if(!paymentSnap.exists()||paymentSnap.data().status!=='pending')throw new Error('التحويل لم يعد قيد المراجعة. حدّث القائمة.');
  const payment=paymentSnap.data();
  if(payment.studentUid!==p.studentUid||payment.amountPiastres!==p.amountPiastres||payment.targetType!==p.targetType)throw new Error('تغيرت بيانات طلب التحويل.');
  const claimRef=referenceId?doc(db,'vodafoneReferenceClaims',referenceId):null;
  if(claimRef){const claim=await tx.get(claimRef);if(claim.exists())throw new Error('سبق اعتماد عملية تحمل نفس الرقم المرجعي ورقم المرسل.');}
  const snaps=[];
  for(const item of candidates) snaps.push({id:item.id,ref:item.ref,snap:await tx.get(item.ref)});
  let rest=payment.amountPiastres,allocations=[];
  for(const item of snaps){
   if(rest<=0)break;
   const r=item.snap.data();
   if(!item.snap.exists()||r.studentUid!==payment.studentUid||!isCharge(r))continue;
   const remaining=amountRemaining(r);
   if(remaining<=0)continue;
   const use=Math.min(rest,remaining);
   if(use>0)allocations.push({id:item.id,ref:item.ref,record:r,piastres:use});
   rest-=use;
  }
  if(rest!==0)throw new Error('المبلغ أكبر من مستحقات الطالب المتاحة الآن. راجع الحصص أو سجّل طلبًا بقيمة أقل.');
  for(const a of allocations){
   const newPaid=amountPaid(a.record)+a.piastres;
   tx.update(a.ref,{
    cashPaidPiastres:newPaid,
    paid:newPaid>=amountDue(a.record),
    paidAt:newPaid>=amountDue(a.record)?serverTimestamp():null,
    updatedAt:serverTimestamp()
   });
  }
  if(claimRef)tx.set(claimRef,{paymentId:p.id,studentUid:p.studentUid,reviewedBy:auth.currentUser.uid,createdAt:serverTimestamp()});
  tx.update(ref,{
   status:'approved',reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser.uid,
   allocations:allocations.map(a=>({attendanceId:a.id,amountPiastres:a.piastres})),
   approvedPiastres:payment.amountPiastres
  });
 });
}
async function reject(p){
 const note=window.prompt('سبب الرفض (يظهر للطالب):','تعذر تأكيد وصول التحويل إلى المحفظة.');
 if(note===null)return;
 await runTransaction(db,async tx=>{
  const ref=doc(db,'vodafonePayments',p.id),snap=await tx.get(ref);
  if(!snap.exists()||snap.data().status!=='pending')throw new Error('الطلب لم يعد بانتظار المراجعة.');
  tx.update(ref,{status:'rejected',adminNote:note.trim().slice(0,300),reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser.uid});
 });
}
$('zadVodafoneRequests')?.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-action]');if(!btn||busy)return;
 const id=btn.closest('[data-id]')?.dataset.id,p=list.find(x=>x.id===id);
 if(!p||p.status!=='pending')return;
 busy=true;render();message('جارٍ تنفيذ الإجراء...');
 try{if(btn.dataset.action==='approve'){await approve(p);window.dispatchEvent(new Event('zad:payment-approved'));}else await reject(p);await load();}
 catch(err){console.error(err);message('تعذر الإجراء: '+(err.code||err.message),true);}
 finally{busy=false;render();}
});
$('zadVodafoneRefreshAdmin')?.addEventListener('click',load);
$('zadVodafoneFilter')?.addEventListener('change',render);
onAuthStateChanged(auth,user=>{if(user)load();});
