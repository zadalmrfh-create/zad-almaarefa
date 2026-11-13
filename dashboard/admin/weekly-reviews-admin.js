import {sharedAdminGetDocs,clearAdminReadCache} from './firestore-read-cache.js';
const getDocs=(ref)=>sharedAdminGetDocs(ref,rawGetDocs,auth);
import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs as rawGetDocs,query,where,setDoc,deleteDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {TEACHER_QUESTIONS,PLATFORM_QUESTIONS,ADMIN_QUESTIONS,scoreAverage,htmlEscape} from '../../reviews/weekly-shared.js';
const $=id=>document.getElementById(id),kindName={teacher:'المعلم',platform:'المنصة',administration:'الإدارة'};
let all=[],published=new Map(),users=new Map(),isReady=false;
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
function render(){if(!isReady)return;const items=visible();const mean=items.length?items.reduce((s,x)=>s+scoreAverage(x.scores),0)/items.length:0;
 $('zwrAdminStats').textContent=`${items.length} تقييم — المتوسط ${items.length?mean.toFixed(2)+' / 5':'—'} — المعلمون: ${new Set(items.filter(x=>x.kind==='teacher').map(x=>x.teacherUid)).size}`;
 $('zwrAdminMetrics').innerHTML=['teacher','platform','administration'].map(kind=>{const list=items.filter(x=>x.kind===kind);if(!list.length)return '';return `<div class="zwr-metric"><b>${kindName[kind]} (${list.length})</b>${questions(kind).map((q,i)=>{const nums=list.map(x=>x.scores[i]).filter(v=>v>0);const avg=nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:0;return `<p><span>${htmlEscape(q)}</span><strong>${nums.length?avg.toFixed(1)+'/5':'—'}</strong></p>`}).join('')}</div>`}).join('');
 $('zwrAdminResults').innerHTML=items.length?items.map(x=>{
  return `<article class="zwr-item"><header><strong>${htmlEscape(kindName[x.kind])} | ${periodName(x)} ${htmlEscape(x.weekStart)}</strong><span>👤 ${htmlEscape(x.studentName)}${x.kind==='teacher'?' — '+htmlEscape(x.teacherName):''}</span></header><div class="zwr-grid">${questions(x.kind).map((q,i)=>`<div><small>${htmlEscape(q)}</small><b>${x.scores[i]===0?'لا ينطبق':x.scores[i]+'/5'}</b></div>`).join('')}</div><p>💬 ${htmlEscape(x.comment||'بدون ملاحظة')}</p></article>`;
 }).join(''):'<p>لا توجد تقييمات لهذه الفلاتر.</p>';
 $('zwrAdminCSV').onclick=()=>downloadCSV(items);
 $('zwrAdminPrint').onclick=()=>{
  const printable=$('zwrAdminResults').cloneNode(true);printable.querySelectorAll('.zwr-actions').forEach(x=>x.remove());
  const sheet=document.createElement('div');sheet.id='zwrAdminPrintable';sheet.innerHTML=`<div style="text-align:center"><img src="../../images/logo.png" style="width:85px"><h1>أكاديمية زاد المعرفة — تقرير تقييمات المعلمين الأسبوعية والتقييمات العامة الشهرية</h1><p>${htmlEscape($('zwrAdminStats').textContent)}</p></div>`;sheet.append(printable);document.body.append(sheet);document.body.classList.add('zwr-admin-printing');window.print();setTimeout(()=>{sheet.remove();document.body.classList.remove('zwr-admin-printing')},1500)
 };
}
async function load(){
 isReady=false;
 $('zwrAdminStats').textContent='جارٍ تحميل التقييمات...';
 try{
  const priv=await getDocs(collection(db,'weeklyReviewPrivate'));
  all=await Promise.all(priv.docs.map(async d=>{
   const row={...d.data(),id:d.id,hash:await hash(d.id)};
   row.studentName=await nameFor(row.studentUid);row.teacherName=row.kind==='teacher'?await nameFor(row.teacherUid):'—';return row;
  }));
  all.sort((a,b)=>b.weekStart.localeCompare(a.weekStart));isReady=true;
  const weeks=[...new Set(all.map(x=>x.weekStart))].sort().reverse();
  const teachers=[...new Map(all.filter(x=>x.kind==='teacher').map(x=>[x.teacherUid,x.teacherName])).entries()];
  const v=$('zwrAdminWeek').value,t=$('zwrAdminTeacher').value;
  $('zwrAdminWeek').innerHTML='<option value="">كل الفترات</option>'+weeks.map(w=>`<option value="${htmlEscape(w)}">${htmlEscape(w)}</option>`).join('');
  $('zwrAdminTeacher').innerHTML='<option value="">كل المعلمين</option>'+teachers.map(([uid,name])=>`<option value="${htmlEscape(uid)}">${htmlEscape(name)}</option>`).join('');
  $('zwrAdminWeek').value=weeks.includes(v)?v:'';$('zwrAdminTeacher').value=teachers.some(x=>x[0]===t)?t:'';render();
 }catch(err){console.error(err);$('zwrAdminStats').textContent='تعذر تحميل التقييمات: '+(err.code||err.message)+' — راجع Firebase والصلاحيات';$('zwrAdminSyncStatus').textContent='فشل تحميل التقييمات: '+(err.code||err.message);}
}
['zwrAdminWeek','zwrAdminKind','zwrAdminTeacher'].forEach(id=>$(id)?.addEventListener('change',render));$('zwrAdminStudent')?.addEventListener('input',render);
$('zwrAdminRefresh')?.addEventListener('click',load);

// Only publish archived ratings for which an explicit consent flag is stored.
// No UID, email, name, or private review ID is included in published documents.
async function syncHistoricalPublic(){
 const button=$('zwrAdminSyncPublic'),status=$('zwrAdminSyncStatus');
 if(!button)return;
 if(!isReady){status.textContent='التقييمات لم تُحمّل بعد. جارٍ إعادة التحميل...';await load();if(!isReady){status.textContent='تعذر تحميل التقييمات. راجع رسالة الخطأ أعلى القسم وصلاحيات Firebase.';return;}}
 button.disabled=true;status.textContent='جارٍ مراجعة الموافقات والتقييمات المنشورة...';
 try{
  const current=await getDocs(collection(db,'publicTestimonials'));
  const existing=new Set(current.docs.map(d=>d.id));
  const legacyComments=new Set(current.docs.map(d=>{
   const v=d.data();return v.text?.trim()?[v.kind,v.weekStart,String(v.text).trim(),Number(v.rating)].join('::'):''
  }).filter(Boolean));
  let added=0,skipped=0;
  for(const item of all){
   if(!['teacher','platform'].includes(item.kind)||item.publishConsent!==true){skipped++;continue;}
   const rating=Number(item.kind==='teacher'?item.scores?.[5]:item.scores?.[3]);
   if(!Number.isInteger(rating)||rating<1||rating>5){skipped++;continue;}
   const id='weekly_'+await hash(item.id);
   const signature=[item.kind,item.weekStart,String(item.comment||'').trim(),rating].join('::');
   if(existing.has(id)||(String(item.comment||'').trim()&&legacyComments.has(signature))){skipped++;continue;}
   // Identity remains in weeklyReviewPrivate only; public copy is anonymous.
   await setDoc(doc(db,'publicTestimonials',id),{
    status:'published',kind:item.kind,text:String(item.comment||''),rating,
    teacherUid:item.kind==='teacher'?item.teacherUid||'':'',
    teacherName:item.kind==='teacher'?item.teacherName||'من معلمي المنصة':'',
    weekStart:item.weekStart,createdAt:serverTimestamp()
   });
   existing.add(id);if(item.comment?.trim())legacyComments.add(signature);added++;
  }
  status.textContent=`تم نشر ${added} تقييم مؤهل، وتجاوز ${skipped} تقييم غير مؤهل أو سبق نشره. تقييمات الإدارة لم تُنشر.`;
 }catch(error){console.error('historical-reviews-sync',error);status.textContent='تعذرت المزامنة: '+(error.code||error.message||'خطأ غير معروف')+(error.code==='permission-denied'?' — قواعد Firebase المنشورة تمنع إنشاء الرأي بواسطة الأدمن؛ انشر firestore.rules من هذه النسخة.':'');}
 finally{button.disabled=false}
}
$('zwrAdminSyncPublic')?.addEventListener('click',syncHistoricalPublic);

onAuthStateChanged(auth,async user=>{
 if(!user){$('zwrAdminSyncStatus').textContent='سجّل الدخول بحساب الأدمن أولًا.';return;}
 try{const [a,u]=await Promise.all([getDoc(doc(db,'admins',user.uid)),getDoc(doc(db,'users',user.uid))]);if(a.exists()||u.data()?.role==='admin'||(user.email==='maleksameh121@gmail.com'&&user.emailVerified))await load();else $('zwrAdminSyncStatus').textContent='الحساب الحالي ليس له صلاحية الإدارة.'}
 catch(err){$('zwrAdminStats').textContent='تعذر التحقق من صلاحيات الإدارة: '+(err.code||err.message)}
});
