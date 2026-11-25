import {clearAdminReadCache} from './firestore-read-cache.js';
import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDoc,getDocsFromServer,query,where,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {TEACHER_QUESTIONS,PLATFORM_QUESTIONS,ADMIN_QUESTIONS,scoreAverage,htmlEscape} from '../../reviews/weekly-shared.js';
import {sameReview,publicCopiesForReview} from './weekly-review-delete-core.js';
const $=id=>document.getElementById(id),kindName={teacher:'المعلم',platform:'المنصة',administration:'الإدارة'};
let all=[],users=new Map(),isReady=false,adminUid='',authVersion=0,loading=0,action=null;
const session=()=>!!adminUid&&auth.currentUser?.uid===adminUid;
const current=(uid,version)=>session()&&adminUid===uid&&authVersion===version;
const status=()=> $('zwrAdminSyncStatus');
function updateControls(){
 for(const id of ['zwrAdminRefresh','zwrAdminSyncPublic','zwrAdminCSV','zwrAdminPrint'])$(id).disabled=!session()||!!action||(id!=='zwrAdminRefresh'&&!isReady);
 $('zwrAdminResults').querySelectorAll('[data-zwr-delete]').forEach(b=>b.disabled=!session()||!!action||!isReady);
}
const questions=kind=>kind==='teacher'?TEACHER_QUESTIONS:kind==='platform'?PLATFORM_QUESTIONS:ADMIN_QUESTIONS;
const periodName=row=>row.periodType==='monthly'?'الشهر':'الأسبوع';
async function nameFor(uid){if(!uid)return 'غير معروف';if(users.has(uid))return users.get(uid);try{const snap=await getDoc(doc(db,'users',uid));const name=snap.data()?.fullName||snap.data()?.name||snap.data()?.email||uid;users.set(uid,name);return name}catch(e){users.set(uid,uid);return uid}}
async function hash(s){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function visible(){let k=$('zwrAdminKind').value,w=$('zwrAdminWeek').value,t=$('zwrAdminTeacher').value,student=($('zwrAdminStudent').value||'').trim().toLowerCase();return all.filter(x=>(!k||x.kind===k)&&(!w||x.weekStart===w)&&(!t||x.teacherUid===t)&&(!student||String(x.studentName).toLowerCase().includes(student)))}
function downloadCSV(items){
 const rows=[['النوع','الفترة','بداية الفترة','الطالب','المعلم','السؤال','الدرجة','الملاحظة']];
 items.forEach(x=>x.scores.forEach((n,i)=>rows.push([kindName[x.kind],periodName(x),x.weekStart,x.studentName,x.teacherName,questions(x.kind)[i],n===0?'لا ينطبق':n,x.comment||''])));
 const output='\ufeff'+rows.map(row=>row.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([output],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='zad-all-reviews.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function render(){if(!isReady||!session())return;const items=visible();const mean=items.length?items.reduce((s,x)=>s+scoreAverage(x.scores),0)/items.length:0;
 $('zwrAdminStats').textContent=`${items.length} تقييم — المتوسط ${items.length?mean.toFixed(2)+' / 5':'—'} — المعلمون: ${new Set(items.filter(x=>x.kind==='teacher').map(x=>x.teacherUid)).size}`;
 $('zwrAdminMetrics').innerHTML=['teacher','platform','administration'].map(kind=>{const list=items.filter(x=>x.kind===kind);if(!list.length)return '';return `<div class="zwr-metric"><b>${kindName[kind]} (${list.length})</b>${questions(kind).map((q,i)=>{const nums=list.map(x=>x.scores[i]).filter(v=>v>0);const avg=nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:0;return `<p><span>${htmlEscape(q)}</span><strong>${nums.length?avg.toFixed(1)+'/5':'—'}</strong></p>`}).join('')}</div>`}).join('');
 $('zwrAdminResults').innerHTML=items.length?items.map(x=>{
  return `<article class="zwr-item"><header><strong>${htmlEscape(kindName[x.kind])} | ${periodName(x)} ${htmlEscape(x.weekStart)}</strong><span>👤 ${htmlEscape(x.studentName)}${x.kind==='teacher'?' — '+htmlEscape(x.teacherName):''}</span></header><div class="zwr-grid">${questions(x.kind).map((q,i)=>`<div><small>${htmlEscape(q)}</small><b>${x.scores[i]===0?'لا ينطبق':x.scores[i]+'/5'}</b></div>`).join('')}</div><p>💬 ${htmlEscape(x.comment||'بدون ملاحظة')}</p><div class="zwr-actions"><button type="button" class="zwr-delete" data-zwr-delete="${htmlEscape(x.id)}"${action?' disabled':''}>🗑 حذف التقييم</button></div></article>`;
 }).join(''):'<p>لا توجد تقييمات لهذه الفلاتر.</p>';
 $('zwrAdminCSV').onclick=()=>downloadCSV(items);
 $('zwrAdminPrint').onclick=()=>{
  const printable=$('zwrAdminResults').cloneNode(true);printable.querySelectorAll('.zwr-actions').forEach(x=>x.remove());
  const sheet=document.createElement('div');sheet.id='zwrAdminPrintable';sheet.innerHTML=`<div style="text-align:center"><img src="../../images/logo.png" style="width:85px"><h1>أكاديمية زاد المعرفة — تقرير تقييمات المعلمين الأسبوعية والتقييمات العامة الشهرية</h1><p>${htmlEscape($('zwrAdminStats').textContent)}</p></div>`;sheet.append(printable);document.body.append(sheet);document.body.classList.add('zwr-admin-printing');window.print();setTimeout(()=>{sheet.remove();document.body.classList.remove('zwr-admin-printing')},1500)
 };
}
function rebuildFilters(){
 const weeks=[...new Set(all.map(x=>x.weekStart))].sort().reverse();
 const teachers=[...new Map(all.filter(x=>x.kind==='teacher').map(x=>[x.teacherUid,x.teacherName])).entries()];
 const v=$('zwrAdminWeek').value,t=$('zwrAdminTeacher').value;
 $('zwrAdminWeek').innerHTML='<option value="">كل الفترات</option>'+weeks.map(w=>`<option value="${htmlEscape(w)}">${htmlEscape(w)}</option>`).join('');
 $('zwrAdminTeacher').innerHTML='<option value="">كل المعلمين</option>'+teachers.map(([uid,name])=>`<option value="${htmlEscape(uid)}">${htmlEscape(name)}</option>`).join('');
 // Keep a selected filter, even if the last matching review was deleted.
 if(v&&!weeks.includes(v))$('zwrAdminWeek').add(new Option(v,v));
 if(t&&!teachers.some(x=>x[0]===t))$('zwrAdminTeacher').add(new Option(users.get(t)||t,t));
 $('zwrAdminWeek').value=v;$('zwrAdminTeacher').value=t;
}
async function load(){
 if(!session()||action)return;
 const uid=adminUid,version=authVersion,request=++loading;
 const valid=()=>current(uid,version)&&request===loading;
 isReady=false;updateControls();
 $('zwrAdminStats').textContent='جارٍ تحميل التقييمات...';
 try{
  const priv=await getDocsFromServer(collection(db,'weeklyReviewPrivate'));
  if(!valid())return;
  const rows=await Promise.all(priv.docs.map(async d=>{
   const row={...d.data(),id:d.id,hash:await hash(d.id)};
   row.studentName=await nameFor(row.studentUid);row.teacherName=row.kind==='teacher'?await nameFor(row.teacherUid):'—';return row;
  }));
  if(!valid())return;
  all=rows.sort((a,b)=>b.weekStart.localeCompare(a.weekStart));isReady=true;
  rebuildFilters();render();updateControls();
 }catch(err){if(!valid())return;console.error(err);$('zwrAdminStats').textContent='تعذر تحميل التقييمات. أعد المحاولة.';status().textContent='فشل تحميل التقييمات. تحقق من الاتصال وصلاحيات الإدارة.';updateControls();}
}
['zwrAdminWeek','zwrAdminKind','zwrAdminTeacher'].forEach(id=>$(id)?.addEventListener('change',render));$('zwrAdminStudent')?.addEventListener('input',render);
$('zwrAdminRefresh')?.addEventListener('click',load);

// Remove only the selected review and positively identified linked copies.
// A transaction checks the selected record has not changed before deleting it.
async function deleteReview(id){
 if(!isReady||!session()||action)return;
 const item=all.find(x=>x.id===id);
 if(!item)return;
 const who=item.kind==='teacher'?' / '+item.teacherName:'';
 if(!window.confirm(`هل تريد حذف تقييم ${kindName[item.kind]} للطالب ${item.studentName}${who} (${item.weekStart}) نهائيًا؟\nسيُحذف من الإحصاءات، وقد يُطلب من الطالب تقييم الفترة مرة أخرى إن كانت لا تزال مطلوبة. لا يمكن التراجع عن الحذف.`))return;
 const uid=adminUid,version=authVersion;
 const op={type:'delete'};action=op;updateControls();status().textContent='جارٍ حذف التقييم...';
 try{
  const reviewRef=doc(db,'weeklyReviewPrivate',id);
  const publicKind=['teacher','platform'].includes(item.kind);
  const publicDocs=publicKind?(await getDocsFromServer(query(collection(db,'publicTestimonials'),where('weekStart','==',item.weekStart)))).docs:[];
  const plan=publicCopiesForReview(item,publicDocs.map(d=>({...d.data(),id:d.id})));
  if(plan.ambiguous)throw Object.assign(new Error('ambiguous-public'),{code:'ambiguous-public'});
  if(!current(uid,version))return;
  await runTransaction(db,async tx=>{
   if(!current(uid,version))throw new Error('account-changed');
   const saved=await tx.get(reviewRef);
   if(!saved.exists()||!sameReview(item,saved.data()))throw Object.assign(new Error('stale-review'),{code:'stale-review'});
   // Read every candidate before any write. The known historical ID is derived from this exact review ID.
   const targets=[];
   if(publicKind){
    const historical=doc(db,'publicTestimonials','weekly_'+item.hash);
    const historicalSnap=await tx.get(historical);
    if(historicalSnap.exists())targets.push(historical);
    if(plan.randomId){
     const ref=doc(db,'publicTestimonials',plan.randomId),snap=await tx.get(ref);
     if(snap.exists()){
      const latest=publicCopiesForReview(item,[{...snap.data(),id:snap.id}]);
      if(latest.randomId!==plan.randomId)throw Object.assign(new Error('stale-public'),{code:'stale-review'});
      targets.push(ref);
     }
    }
   }
   if(item.kind==='teacher'&&item.feedbackId){
    const feedback=doc(db,'weeklyTeacherFeedback',item.feedbackId);
    const snap=await tx.get(feedback);
    if(snap.exists()){
     const f=snap.data();
     if(f.kind!=='teacher'||f.teacherUid!==item.teacherUid||f.weekStart!==item.weekStart)throw Object.assign(new Error('stale-feedback'),{code:'stale-review'});
     targets.push(feedback);
    }
   }
   if(!current(uid,version))throw new Error('account-changed');
   targets.forEach(ref=>tx.delete(ref));tx.delete(reviewRef);
  });
  clearAdminReadCache();
  if(!current(uid,version))return;
  all=all.filter(x=>x.id!==id);rebuildFilters();render();
  status().textContent=plan.unresolved?'تم حذف التقييم والنسخ المؤكدة. توجد آراء قديمة متشابهة لا يمكن ربطها يقينًا؛ لم نحذفها. راجع آراء الطلاب المنشورة.':'✅ تم حذف التقييم وتحديث الإحصاءات.';
  if(plan.unresolved)window.alert(status().textContent);
 }catch(error){
  if(!current(uid,version))return;
  console.error('weekly-review-delete',error);
  status().textContent=error.code==='permission-denied'?'تعذر الحذف. تأكد من نشر قواعد Firestore الجديدة بحساب الإدارة.':error.code==='ambiguous-public'?'لم يُحذف التقييم: توجد أكثر من نسخة عامة محتملة. راجع الآراء المنشورة أولًا.':error.code==='stale-review'?'لم يُحذف التقييم لأن البيانات تغيّرت. حدّث القائمة وأعد المحاولة.':'تعذر حذف التقييم. تحقق من الاتصال وأعد المحاولة.';
  window.alert(status().textContent);
 }finally{
  if(action===op){action=null;updateControls();}
 }
}
$('zwrAdminResults')?.addEventListener('click',e=>{
 const button=e.target.closest('[data-zwr-delete]');
 if(button&&!button.disabled)void deleteReview(button.dataset.zwrDelete);
});

// Only publish archived ratings for which an explicit consent flag is stored.
// No UID, email, name, or private review ID is included in published documents.
async function syncHistoricalPublic(){
 const button=$('zwrAdminSyncPublic'),status=$('zwrAdminSyncStatus');
 if(!button||!session()||!isReady||action)return;
 const uid=adminUid,version=authVersion,op={type:'sync'};action=op;updateControls();status.textContent='جارٍ مراجعة الموافقات والتقييمات المنشورة...';
 try{
  const publicSnapshot=await getDocsFromServer(collection(db,'publicTestimonials'));
  if(!current(uid,version))return;
  const existing=new Set(publicSnapshot.docs.map(d=>d.id));
  const legacyComments=new Set(publicSnapshot.docs.map(d=>{
   const v=d.data();return v.text?.trim()?[v.kind,v.weekStart,String(v.text).trim(),Number(v.rating)].join('::'):''
  }).filter(Boolean));
  let added=0,skipped=0;
  for(const item of all){
   if(!current(uid,version))return;
   if(!['teacher','platform'].includes(item.kind)||item.publishConsent!==true){skipped++;continue;}
   const rating=Number(item.kind==='teacher'?item.scores?.[5]:item.scores?.[3]);
   if(!Number.isInteger(rating)||rating<1||rating>5){skipped++;continue;}
   const id='weekly_'+await hash(item.id);
   const signature=[item.kind,item.weekStart,String(item.comment||'').trim(),rating].join('::');
   if(existing.has(id)||(String(item.comment||'').trim()&&legacyComments.has(signature))){skipped++;continue;}
   // Identity remains in weeklyReviewPrivate only; public copy is anonymous.
   const saved=await runTransaction(db,async tx=>{
    if(!current(uid,version))throw new Error('account-changed');
    const privateSnap=await tx.get(doc(db,'weeklyReviewPrivate',item.id));
    const ref=doc(db,'publicTestimonials',id),publicSnap=await tx.get(ref);
    if(!privateSnap.exists()||!sameReview(item,privateSnap.data())||privateSnap.data().publishConsent!==true||publicSnap.exists())return false;
    tx.set(ref,{status:'published',kind:item.kind,text:String(item.comment||''),rating,teacherUid:item.kind==='teacher'?item.teacherUid||'':'',teacherName:item.kind==='teacher'?item.teacherName||'من معلمي المنصة':'',weekStart:item.weekStart,createdAt:serverTimestamp()});return true;
   });
   if(!current(uid,version))return;
   if(!saved){skipped++;continue;}
   existing.add(id);if(item.comment?.trim())legacyComments.add(signature);added++;
  }
  status.textContent=`تم نشر ${added} تقييم مؤهل، وتجاوز ${skipped} تقييم غير مؤهل أو سبق نشره. تقييمات الإدارة لم تُنشر.`;
 }catch(error){if(!current(uid,version))return;console.error('historical-reviews-sync',error);status.textContent='تعذرت المزامنة: '+(error.code||error.message||'خطأ غير معروف')+(error.code==='permission-denied'?' — قواعد Firebase المنشورة تمنع إنشاء الرأي بواسطة الأدمن؛ انشر firestore.rules من هذه النسخة.':'');}
 finally{if(action===op){action=null;updateControls();}}
}
$('zwrAdminSyncPublic')?.addEventListener('click',syncHistoricalPublic);

onAuthStateChanged(auth,async user=>{
 const version=++authVersion;loading++;adminUid='';all=[];users=new Map();isReady=false;action=null;
 $('zwrAdminResults').replaceChildren();$('zwrAdminMetrics').replaceChildren();$('zwrAdminStats').textContent='جارٍ التحقق من صلاحيات الإدارة...';
 $('zwrAdminWeek').innerHTML='<option value="">كل الفترات</option>';$('zwrAdminTeacher').innerHTML='<option value="">كل المعلمين</option>';$('zwrAdminStudent').value='';$('zwrAdminKind').value='';
 $('zwrAdminCSV').onclick=null;$('zwrAdminPrint').onclick=null;updateControls();
 if(!user){status().textContent='سجّل الدخول بحساب الأدمن أولًا.';$('zwrAdminStats').textContent='';return;}
 try{
  const [a,u]=await Promise.all([getDoc(doc(db,'admins',user.uid)),getDoc(doc(db,'users',user.uid))]);
  if(version!==authVersion||auth.currentUser?.uid!==user.uid)return;
  if(a.exists()||u.data()?.role==='admin'||(user.email==='maleksameh121@gmail.com'&&user.emailVerified)){
   adminUid=user.uid;status().textContent='';await load();
  }else{status().textContent='الحساب الحالي ليس له صلاحية الإدارة.';$('zwrAdminStats').textContent='';}
 }catch(err){if(version===authVersion){console.error(err);$('zwrAdminStats').textContent='تعذر التحقق من صلاحيات الإدارة.';}}
});
