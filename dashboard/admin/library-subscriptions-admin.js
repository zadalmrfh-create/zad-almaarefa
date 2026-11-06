import {sharedAdminGetDocs,clearAdminReadCache} from './firestore-read-cache.js';
const getDocs=(ref)=>sharedAdminGetDocs(ref,rawGetDocs,auth);
import {auth,db,ADMIN_EMAIL} from '../../firebase-config.js';
import {DEFAULT_LIBRARY_PRICE_PIASTRES} from '../../assets/library-subscription.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs as rawGetDocs,serverTimestamp,setDoc,writeBatch} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let requests=[],users=[],grants=new Map(),adminUid='',working=false;
const msg=(s,err=false)=>{$('libraryMembershipAdminMessage').textContent=s;$('libraryMembershipAdminMessage').style.color=err?'#fca5a5':'#e8c96d';};
function name(u){return u.fullName||u.name||u.displayName||u.email||'طالب';}
function render(){
  const list=[...requests].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  $('libraryMembershipRequests').innerHTML=list.length?list.map(r=>{
    const u=users.find(u=>u.id===r.studentUid),active=grants.get(r.studentUid)?.status==='active';
    return `<article class="zad-pay-request" data-lib-request="${esc(r.id)}" style="padding:14px;margin:10px 0;border:1px solid #526480;border-radius:12px;background:#101d31">
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between"><b>${esc(u?name(u):r.studentEmail||r.studentUid)}</b><b>${(r.amountPiastres/100).toLocaleString('ar-EG')} جنيه</b><strong>${esc(r.status)}</strong></div>
      <div style="margin:7px 0">البريد: ${esc(r.studentEmail||u?.email||'—')} · رقم التحويل: <b>${esc(r.senderPhone)}</b> · المرجع: <b>${esc(r.reference)}</b></div>
      ${r.note?`<p>ملاحظات: ${esc(r.note)}</p>`:''}${r.adminNote?`<p>رد الإدارة: ${esc(r.adminNote)}</p>`:''}
      <small>حالة الاشتراك حاليًا: ${active?'✅ مفعّل':'🔒 غير مفعّل'}</small>
      ${r.status==='pending'?`<div class="actions" style="margin-top:10px"><button type="button" class="btn gold" data-lib-action="approve">✅ اعتماد التحويل وتفعيل الاشتراك</button><button type="button" class="btn" data-lib-action="reject">❌ رفض</button></div>`:''}
    </article>`;
  }).join(''):'لا توجد طلبات اشتراك حتى الآن.';
  const term=$('libraryMembershipSearch').value.trim().toLowerCase();
  const matching=users.filter(u=>[name(u),u.email,u.phone,u.id].some(x=>window.ZadNameSearch.matches(x,term))).slice(0,100);
  $('libraryMembershipUsers').innerHTML=matching.length?matching.map(u=>{
    const grant=grants.get(u.id),active=grant?.status==='active';
    return `<div data-lib-user="${esc(u.id)}" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;padding:12px;margin:7px 0;background:#0f1e33;border:1px solid #4c5d73;border-radius:10px"><div><b>${esc(name(u))}</b><small style="display:block">${esc(u.email||u.phone||u.id)}</small><small>${active?'✅ مشترك':'🔒 غير مشترك'}</small></div><button type="button" class="btn ${active?'':'gold'}" data-lib-user-action="${active?'disable':'enable'}">${active?'إلغاء الاشتراك':'تفعيل بعد الدفع'}</button></div>`;
  }).join(''):'لا توجد حسابات مطابقة.';
}
async function load(){
  if(!adminUid)return;
  try{
    msg('جارٍ تحميل بيانات اشتراكات المكتبة...');
    const [ps,us,ss,settings]=await Promise.all([getDocs(collection(db,'libraryPaymentRequests')),getDocs(collection(db,'users')),getDocs(collection(db,'librarySubscriptions')),getDoc(doc(db,'librarySettings','main'))]);
    requests=ps.docs.map(d=>({id:d.id,...d.data()}));users=us.docs.map(d=>({id:d.id,...d.data()}));
    grants=new Map(ss.docs.map(d=>[d.id,d.data()]));
    const value=settings.data()?.pricePiastres;
    $('libraryMembershipPrice').value=((Number.isSafeInteger(value)&&value>=100?value:DEFAULT_LIBRARY_PRICE_PIASTRES)/100).toFixed(2);
    render();msg('تم تحميل '+requests.filter(r=>r.status==='pending').length+' طلب بانتظار المراجعة. تحقق من وصول التحويل إلى محفظتك قبل التفعيل.');
  }catch(e){console.error(e);msg('تعذر تحميل البيانات: '+(e.code||e.message)+' — تأكد من نشر قواعد Firestore الجديدة.',true);}
}
async function setActive(uid,active,requestId=null){
  const user=users.find(u=>u.id===uid);
  if(!user)throw new Error('الحساب غير موجود؛ لا يمكن تفعيل الاشتراك.');
  const batch=writeBatch(db);
  batch.set(doc(db,'librarySubscriptions',uid),{
    status:active?'active':'revoked', updatedAt:serverTimestamp(),updatedBy:adminUid,
    studentEmail:String(user.email||'').slice(0,200),
    ...(active?{approvedAt:serverTimestamp()}:{}),
    ...(requestId?{paymentRequestId:requestId}:{})
  },{merge:true});
  if(requestId)batch.update(doc(db,'libraryPaymentRequests',requestId),{status:'approved',reviewedAt:serverTimestamp(),reviewedBy:adminUid});
  await batch.commit();
}
$('libraryMembershipReload')?.addEventListener('click',load);
$('libraryMembershipSearch')?.addEventListener('input',render);
$('libraryMembershipSavePrice')?.addEventListener('click',async()=>{
  if(working||!adminUid)return;
  const number=Number($('libraryMembershipPrice').value),p=Math.round(number*100);
  if(!Number.isSafeInteger(p)||p<100||p>100000000){msg('اكتب سعر الاشتراك من 1 إلى مليون جنيه.',true);return;}
  working=true;try{await setDoc(doc(db,'librarySettings','main'),{pricePiastres:p,updatedAt:serverTimestamp(),updatedBy:adminUid},{merge:true});msg('✅ تم تحديث سعر الاشتراك الظاهر للطلاب.');}
  catch(e){msg('فشل حفظ السعر: '+e.message,true);}finally{working=false;}
});
$('libraryMembershipUsers')?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-lib-user-action]');if(!button||working)return;
  const uid=button.closest('[data-lib-user]')?.dataset.libUser,active=button.dataset.libUserAction==='enable';
  if(!uid)return;
  if(!confirm(active?'هل تأكدت من دفع الطالب وتريد فتح المكتبتين له؟':'إلغاء اشتراك هذا الطالب ومنع فتح وتحميل الكتب؟'))return;
  working=true;button.disabled=true;
  try{await setActive(uid,active);await load();}catch(e){console.error(e);msg('تعذر تعديل الاشتراك: '+e.message,true);}finally{working=false;button.disabled=false;}
});
$('libraryMembershipRequests')?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-lib-action]');if(!button||working)return;
  const request=requests.find(r=>r.id===button.closest('[data-lib-request]')?.dataset.libRequest);
  if(!request||request.status!=='pending')return;
  working=true;button.disabled=true;
  try{
    if(button.dataset.libAction==='approve'){
      if(!confirm('تأكد بنفسك من وصول '+(request.amountPiastres/100)+' جنيه إلى المحفظة 01042239704 ومن صحة رقم العملية قبل الموافقة. هل تؤكد؟'))return;
      const latest=await getDoc(doc(db,'libraryPaymentRequests',request.id));
      if(latest.data()?.status!=='pending')throw new Error('سبق التعامل مع هذا الطلب؛ حدّث الصفحة.');
      await setActive(request.studentUid,true,request.id);
    }else{
      const note=prompt('سبب رفض الدفع (سيظهر للطالب):','لم نتمكن من تأكيد وصول التحويل.');
      if(note===null)return;
      const batch=writeBatch(db);
      batch.update(doc(db,'libraryPaymentRequests',request.id),{status:'rejected',adminNote:note.trim().slice(0,300),reviewedAt:serverTimestamp(),reviewedBy:adminUid});
      await batch.commit();
    }
    await load();
  }catch(e){console.error(e);msg('تعذر مراجعة الطلب: '+e.message,true);}finally{working=false;button.disabled=false;}
});
onAuthStateChanged(auth,async user=>{
  if(!user)return;
  try{
    const isEmail=user.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase() && user.emailVerified;
    const [admin,profile]=await Promise.all([getDoc(doc(db,'admins',user.uid)),getDoc(doc(db,'users',user.uid))]);
    if(!isEmail&&!admin.exists()&&profile.data()?.role!=='admin')return;
    adminUid=user.uid;await load();
  }catch(e){console.error(e);msg('تعذر التحقق من حساب الإدارة.',true);}
});
