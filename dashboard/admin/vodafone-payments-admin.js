/* إدارة تحويلات فودافون كاش: إظهار مصدر التحويل، توقيته والحصص المرتبطة به؛ دون حذف سجلات مالية معتمدة. */
import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDocs,query,where,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {amountDue,amountPaid,amountRemaining,money,html,isCharge} from '../payment-utils.js';
import {isCurrentPayment,ledgerStartedAt} from '../payment-ledger-period.js';
const $=id=>document.getElementById(id);
let list=[],lessonMap=new Map(),busy=false;
const formatWhen=value=>{
  if(!value)return 'غير مسجل';
  try{
    const d=typeof value.toDate==='function'?value.toDate():value.seconds?new Date(value.seconds*1000):new Date(value);
    return Number.isNaN(d.getTime())?'غير مسجل':new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short'}).format(d);
  }catch{return 'غير مسجل';}
};
const statusName={approved:'✅ معتمد',pending:'⏳ بانتظار المراجعة',rejected:'❌ مرفوض'};
const msgEl=$('zadVodafoneAdminMessage');
function message(s,err=false){if(!msgEl)return;msgEl.textContent=s;msgEl.className=err?'zad-pay-error':'zad-pay-ok';}
function lessonLabel(id){
  const x=lessonMap.get(id);
  if(!x)return `<span class="zad-pay-missing">سجل الحصة غير متاح (${html(id)}) — راجع بيانات الحضور</span>`;
  const subjects=Array.isArray(x.subjects)&&x.subjects.length?x.subjects.join('، '):x.subject||'مادة غير محددة';
  return `<span><b>${html(subjects)}</b> · ${html(x.date||'تاريخ غير مسجل')} · ${html(x.teacherName||'معلم غير محدد')} ${x.deleted===true?'<strong class="zad-pay-cancelled">⚠️ حصة ملغاة</strong>':''}</span>`;
}
function details(p){
  const allocations=Array.isArray(p.allocations)?p.allocations:[];
  const planned=Array.isArray(p.lessonIds)?p.lessonIds:[];
  if(allocations.length){
    return `<div class="zad-pay-allocations"><b>الحصص التي وُزّع عليها المبلغ المعتمد</b>
      ${allocations.map(a=>{
        const id=String(a.attendanceId||'');
        const x=lessonMap.get(id);
        return `<div class="zad-pay-allocation">${lessonLabel(id)}<strong>${money(a.amountPiastres)}</strong>${!x||x.deleted===true?'<small class="zad-pay-cancelled">المبلغ محفوظ في سجل التحويل ويحتاج إلى تسوية إدارية (رد/تحويل لحصة أخرى). لا تتم التسوية تلقائيًا.</small>':''}</div>`;
      }).join('')}</div>`;
  }
  if(p.targetType==='lessons')return `<div class="zad-pay-allocations"><b>الحصص التي طلب الطالب سدادها</b>
    ${planned.length?planned.map(id=>`<div class="zad-pay-allocation">${lessonLabel(id)}</div>`).join(''):'<small>لم تُحدد حصص.</small>'}</div>`;
  return `<div class="zad-pay-allocations"><b>سداد مستحقات عامة</b><small>${p.status==='pending'?'سيحدد توزيع المبلغ على الحصص وقت اعتماد التحويل.':p.status==='rejected'?'لم يُعتمد أي مبلغ.':'لا تتوفر بيانات توزيع هذا التحويل القديم.'}</small></div>`;
}
function render(){
  const filter=$('zadVodafoneFilter')?.value||'all';
  const current=list.filter(isCurrentPayment);
  const found=filter==='archived' ? list.filter(p=>!isCurrentPayment(p)) : current.filter(p=>filter==='all'||p.status===filter);
  const htmlRows=found.map(p=>{
    const allocations=Array.isArray(p.allocations)?p.allocations:[];
    const cancelledValue=p.status==='approved'?allocations.reduce((n,a)=>{
      const lesson=lessonMap.get(String(a.attendanceId||''));
      return n+(!lesson||lesson.deleted===true?Number(a.amountPiastres||0):0);
    },0):0;
    return `<article class="zad-pay-request" data-id="${html(p.id)}">
      <div class="zad-pay-request-body">
        <div class="zad-pay-request-head"><b>${html(p.studentName||'طالب')}</b><strong>${money(p.amountPiastres)}</strong><span>${statusName[p.status]||html(p.status||'—')}</span></div>
        <div class="zad-pay-detail-grid">
          <div><small>الطالب صاحب الحساب</small><b>${html(p.studentName||'طالب')}</b></div>
          <div><small>رقم الهاتف الذي حُوِّل منه</small><b dir="ltr">${html(p.senderPhone||'—')}</b></div>
          <div><small>وقت إرسال طلب التحويل</small><b>${html(formatWhen(p.createdAt))}</b></div>
          <div><small>وقت مراجعة الإدارة</small><b>${html(formatWhen(p.reviewedAt))}</b></div>
          <div><small>مرجع عملية التحويل</small><b>${html(p.reference||'غير مذكور')}</b></div>
          <div><small>نوع السداد</small><b>${p.targetType==='lessons'?'حصص محددة':'سداد من مستحقات الطالب'}</b></div>
        </div>
        ${details(p)}
        ${cancelledValue>0?`<p class="zad-pay-alert">⚠️ ${money(cancelledValue)} من هذا التحويل مرتبط بحصة ملغاة؛ يحتاج إلى تسوية مالية مع الطالب. لم يُرد المبلغ أو يُنقل تلقائيًا.</p>`:''}
        ${p.note?`<small>ملاحظات الطالب: ${html(p.note)}</small>`:''}
        ${p.adminNote?`<small>رد الإدارة: ${html(p.adminNote)}</small>`:''}
      </div>
      ${p.status==='pending' && filter!=='archived'?`<div class="zad-pay-request-actions"><button class="btn gold" type="button" data-action="approve" ${busy?'disabled':''}>✅ اعتماد التحويل</button><button class="btn" type="button" data-action="reject" ${busy?'disabled':''}>❌ رفض</button></div>`:''}
    </article>`;
  });
  $('zadVodafoneRequests').innerHTML=htmlRows.length?htmlRows.join(''):(filter==='archived'?'<p>لا توجد تحويلات سابقة محفوظة.</p>':'<p>سجل المدفوعات الجديد فارغ حاليًا. ستظهر هنا طلبات التحويل الجديدة تلقائيًا.</p>');
  $('zadVodafonePendingCount').textContent=current.filter(x=>x.status==='pending').length;
  $('zadVodafoneApprovedAmount').textContent=money(current.filter(x=>x.status==='approved').reduce((s,x)=>s+Number(x.amountPiastres||0),0));
  const needsSettlement=current.filter(x=>x.status==='approved').reduce((sum,p)=>sum+(Array.isArray(p.allocations)?p.allocations.reduce((n,a)=>{
    const x=lessonMap.get(String(a.attendanceId||''));
    return n+(!x||x.deleted===true?Number(a.amountPiastres||0):0);
  },0):0),0);
  const box=$('zadVodafoneNeedSettlement');if(box)box.textContent=money(needsSettlement);
}
async function load(){
  try{
    message('جارٍ تحميل طلبات الدفع والحصص المرتبطة بها...');
    const [snap,lessons]=await Promise.all([
      getDocs(collection(db,'vodafonePayments')),
      getDocs(collection(db,'lessonAttendance'))
    ]);
    list=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    lessonMap=new Map(lessons.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
    render();message('سجل المدفوعات الجديد يبدأ من '+ledgerStartedAt+'؛ العمليات السابقة محفوظة في الأرشيف للمراجعة ولا تدخل في الإجماليات الجديدة.');
  }catch(e){console.error(e);message('تعذر تحميل تفاصيل المدفوعات: '+(e.code||e.message),true);}
}
async function approve(p){
  if(p.reference && list.some(x=>x.id!==p.id && x.status==='approved' && x.reference?.trim()===p.reference.trim() && x.senderPhone===p.senderPhone))throw new Error('المرجع مستخدم في تحويل معتمد من نفس الهاتف.');
  if(!window.confirm('هل تأكدت بنفسك من وصول '+money(p.amountPiastres)+' إلى المحفظة 01042239704 وأن رقم العملية لم يُعتمد من قبل؟'))return;
  const found=await getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',p.studentUid)));
  const candidates=found.docs.map(d=>({id:d.id,ref:d.ref,...d.data()})).filter(isCharge)
    .filter(x=>p.targetType==='lessons'?(Array.isArray(p.lessonIds)&&p.lessonIds.includes(x.id)):true)
    .filter(x=>amountRemaining(x)>0).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  if(!candidates.length)throw new Error('لا توجد حصص نشطة غير مسددة للطلب؛ قد تكون الحصص أُلغيت. ارفض الطلب بعد مراجعته.');
  if(candidates.length>150)throw new Error('أكثر من 150 حصة مستحقة؛ قسّم التسوية على عدة عمليات.');
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
    if(claimRef){const claim=await tx.get(claimRef);if(claim.exists())throw new Error('سبق اعتماد عملية بنفس رقم المرجع ورقم المرسل.');}
    const snaps=[];
    for(const item of candidates)snaps.push({id:item.id,ref:item.ref,snap:await tx.get(item.ref)});
    let rest=payment.amountPiastres,allocations=[];
    for(const item of snaps){
      if(rest<=0)break;
      if(!item.snap.exists())continue;
      const r=item.snap.data();
      if(r.studentUid!==payment.studentUid||!isCharge(r))continue;
      const remaining=amountRemaining(r);
      if(remaining<=0)continue;
      const use=Math.min(rest,remaining);
      if(use>0)allocations.push({id:item.id,ref:item.ref,record:r,piastres:use});
      rest-=use;
    }
    if(rest!==0)throw new Error('قيمة التحويل أكبر من المستحقات المتاحة الآن؛ راجع الحصص قبل الاعتماد.');
    for(const a of allocations){
      const newPaid=amountPaid(a.record)+a.piastres;
      tx.update(a.ref,{cashPaidPiastres:newPaid,paid:newPaid>=amountDue(a.record),paidAt:newPaid>=amountDue(a.record)?serverTimestamp():null,updatedAt:serverTimestamp()});
    }
    if(claimRef)tx.set(claimRef,{paymentId:p.id,studentUid:p.studentUid,reviewedBy:auth.currentUser.uid,createdAt:serverTimestamp()});
    tx.update(ref,{status:'approved',reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser.uid,
      allocations:allocations.map(a=>({attendanceId:a.id,amountPiastres:a.piastres})),approvedPiastres:payment.amountPiastres});
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
window.addEventListener('zad:attendance-archived',load);
onAuthStateChanged(auth,user=>{if(user)load();});
