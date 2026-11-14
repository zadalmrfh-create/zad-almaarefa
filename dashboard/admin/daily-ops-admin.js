/* Zad — read-only, on-demand admin operations center (phase 3). */
import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,query,where,orderBy,limit} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {codeExamProgress} from './exam-result-verification.js';
import {cairoDay,followingDay,LIMITS,BOOKING_REVIEW,row,timeText,csvReport,groupSpecs} from './daily-ops-core.js';

const $=id=>document.getElementById(id);
const button=$('zadOpsRefresh'), status=$('zadOpsStatus'), dateInput=$('zadOpsDate');
const exportBtn=$('zadOpsCSV'),printBtn=$('zadOpsPrint'),summary=$('zadOpsSummary');
const kinds=['bookings','payments','essays','lessons'];
let authorized=false,working=false,loaded=false,records={},failures={},currentDay='';
const say=t=>{if(status)status.textContent=t};
const pause=(p,t=16000)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error('انتهت مهلة تحميل البيانات')),t))]);
function stamp(){return new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'full',timeStyle:'short'}).format(new Date())}
function make(tag,cls,content){const x=document.createElement(tag);if(cls)x.className=cls;if(content!=null)x.textContent=String(content);return x}
async function isAdmin(user){
 if(!user)return false;
 const [a,b]=await Promise.allSettled([getDoc(doc(db,'admins',user.uid)),getDoc(doc(db,'users',user.uid))]);
 return (a.status==='fulfilled'&&a.value.exists())||(b.status==='fulfilled'&&b.value.data()?.role==='admin')||(user.email?.toLowerCase()==='maleksameh121@gmail.com'&&user.emailVerified===true);
}
function entries(snapshot,kind){return snapshot.docs.map(d=>row(kind,d.id,d.data()))}
async function collect(day){
 const tasks=[
  getDocs(query(collection(db,'bookings'),where('status','in',['جديد','قيد المراجعة','تم التواصل','pending']),limit(LIMITS.bookings))),
  getDocs(query(collection(db,'vodafonePayments'),where('status','==','pending'),limit(LIMITS.payments))),
  getDocs(query(collection(db,'codeExamResults'),orderBy('createdAt','desc'),limit(LIMITS.essays))),
  getDocs(query(collection(db,'lessons'),where('date','>=',day),where('date','<',followingDay(day)),limit(LIMITS.lessons)))
 ];
 const settled=await Promise.allSettled(tasks.map(x=>pause(x)));
 const next={},errors={};
 for(let i=0;i<kinds.length;i++){
   const key=kinds[i],r=settled[i];
   if(r.status==='rejected') {errors[key]=String(r.reason?.code||r.reason?.message||r.reason);continue}
   let docs=r.value.docs;
   if(key==='essays')docs=docs.filter(x=>{try{return codeExamProgress(x.data()).pendingEssay===true}catch{return false}});
   next[key]=docs.map(d=>row(key,d.id,d.data()));
 }
 return {records:next,errors};
}
function openTab(key){
 const spec=groupSpecs[key];if(!spec)return;
 window.dispatchEvent(new CustomEvent('zad:open-admin-tab',{detail:{tab:spec.tab,sectionId:spec.sectionId,financeMode:spec.financeMode}}));
}
function render(){
 if(!summary)return;summary.replaceChildren();
 const totals=make('div','zad-ops-counters');
 for(const key of kinds){
   const item=make('button','zad-ops-counter');item.type='button';item.dataset.openGroup=key;
   item.append(make('strong','',groupSpecs[key].title));
   const error=failures[key];const count=records[key]?.length||0;
   const atLimit= key==='essays'?false:count>=LIMITS[key];
   item.append(make('b','',error?'تعذر التحميل':`${atLimit?'على الأقل ':''}${count.toLocaleString('ar-EG')}`));
   item.append(make('small','',error?'راجع رسالة الخطأ':key==='essays'?'من أحدث 150 تسليمًا':atLimit?'العدد جزئي بسبب حد القراءة':'اضغط لفتح القسم'));
   totals.append(item);
 }
 summary.append(totals);
 if(Object.keys(failures).length){
   const warn=make('p','zad-ops-warning','بعض الأقسام لم تُحمّل: '+Object.entries(failures).map(([k,v])=>`${groupSpecs[k].title}: ${v}`).join(' | '));summary.append(warn);
 }
 for(const key of kinds){
   const sect=make('section','zad-ops-group');const head=make('div','zad-ops-group-head');
   const title=make('h3','',groupSpecs[key].title); const jump=make('button','btn','فتح القسم');
   jump.type='button';jump.dataset.openGroup=key;head.append(title,jump);sect.append(head);
   const list=make('div','zad-ops-list');
   if(failures[key])list.append(make('p','zad-ops-empty','تعذر تحميل هذا القسم. يمكنك فتحه من الزر أعلاه.'));
   else if(!(records[key]?.length))list.append(make('p','zad-ops-empty','لا توجد عناصر مطابقة في نطاق القراءة الحالي.'));
   else {
     for(const x of records[key].slice(0,8)){
       const item=make('div','zad-ops-item');
       const info=make('div','zad-ops-item-content');info.append(make('strong','',x.title));
       info.append(make('span','',x.detail));info.append(make('small','',timeText(x.when)));
       const open=make('button','btn','فتح');open.type='button';open.dataset.openGroup=key;
       item.append(info,open);list.append(item);
     }
     if(records[key].length>8)list.append(make('p','zad-ops-empty',`+ ${records[key].length-8} عناصر أخرى في نطاق القراءة الحالي. افتح القسم للاطلاع عليها.`));
   }
   sect.append(list);summary.append(sect);
 }
}
async function load(){
 if(working)return;
 if(!authorized){say('هذه المتابعة متاحة للأدمن فقط.');return}
 const day=dateInput?.value||cairoDay();
 try{followingDay(day)}catch(e){say('اختَر تاريخًا صحيحًا.');return}
 working=true;button.disabled=true;exportBtn.disabled=true;printBtn.disabled=true;
 say('جارٍ تحميل ملخص المهام من Firebase...');
 try{
  const result=await collect(day);
  records=result.records;failures=result.errors;currentDay=day;loaded=true;
  render();
  const loadedCount=kinds.filter(k=>!failures[k]).length;
  say(`آخر تحميل: ${stamp()} — ${loadedCount} من 4 أقسام. حصص ${day}، وبقية المهام غير المنجزة حاليًا. الأعداد محدودة بنطاق القراءة الموضح.`);
  exportBtn.disabled=loadedCount===0;printBtn.disabled=loadedCount===0;
 }catch(error){say('تعذّر إعداد الملخص: '+(error.code||error.message))}
 finally{working=false;button.disabled=false}
}
function downloadCsv(){
 if(!loaded)return;
 const csv=csvReport(records), blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=`zad-operations-${currentDay}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[ch]));
function printSummary(){
 if(!loaded)return;
 const popup=window.open('','_blank');if(!popup){say('اسمح بالنوافذ المنبثقة لطباعة التقرير.');return}
 const blocks=kinds.map(key=>{
   const items=records[key]||[];
   const rows=items.map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.detail)}</td><td>${esc(timeText(x.when))}</td></tr>`).join('');
   return `<h2>${esc(groupSpecs[key].title)} — ${items.length}</h2>${failures[key]?`<p>${esc('غير متاح: '+failures[key])}</p>`:`<table><thead><tr><th>العنوان</th><th>التفاصيل</th><th>التاريخ</th></tr></thead><tbody>${rows||'<tr><td colspan="3">لا توجد مهام في النطاق</td></tr>'}</tbody></table>`}`;
 }).join('');
 popup.document.open();popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير المتابعة اليومية | زاد المعرفة</title><style>body{font:14px/1.7 Tahoma,Arial,sans-serif;padding:24px;color:#14243d}h1{color:#122749}h2{break-after:avoid;color:#1b3f69}table{width:100%;border-collapse:collapse;margin-bottom:22px}th,td{border:1px solid #bdc6d0;padding:8px;text-align:right;vertical-align:top}th{background:#eef1f6}@page{size:A4;margin:14mm}</style></head><body><h1>منصة زاد المعرفة — تقرير متابعة الإدارة</h1><p>حصص يوم ${esc(currentDay)}؛ باقي المهام الحالية — تاريخ استخراج التقرير: ${esc(stamp())}</p><p>الأرقام قد تكون جزئية لأنها مبنية على حدود قراءة لتقليل تكلفة Firebase.</p>${blocks}<p>نسخة تشغيلية للمتابعة فقط؛ ليست مستندًا ماليًا معتمدًا.</p></body></html>`);popup.document.close();popup.focus();
}
if(dateInput)dateInput.value=cairoDay();
button?.addEventListener('click',load);
exportBtn?.addEventListener('click',downloadCsv);
printBtn?.addEventListener('click',printSummary);
summary?.addEventListener('click',e=>{const b=e.target.closest('[data-open-group]');if(b)openTab(b.dataset.openGroup)});
document.getElementById('zadDailyOpsSection')?.addEventListener('click',e=>{
 const b=e.target.closest('[data-zad-ops-shortcut]');if(!b)return;
 const targets={student:{tab:'users',sectionId:'usersManagement'},teachers:{tab:'users',sectionId:'teacherExamAccessAdmin'},attendance:{tab:'lessons',sectionId:'attendanceManagement',attendanceMode:'reports'}};
 if(targets[b.dataset.zadOpsShortcut])window.dispatchEvent(new CustomEvent('zad:open-admin-tab',{detail:targets[b.dataset.zadOpsShortcut]}));
});
onAuthStateChanged(auth,async user=>{
 authorized=false;loaded=false;records={};failures={};summary?.replaceChildren();exportBtn.disabled=true;printBtn.disabled=true;
 if(!user){say('سجّل الدخول كمسؤول أولًا.');return}
 try{authorized=await isAdmin(user);say(authorized?'اضغط «تحميل متابعة اليوم» لاستعراض المهام دون مراقبة مستمرة.':'هذا القسم متاح للإدارة فقط.');}
 catch(e){say('تعذر التحقق من صلاحيات الإدارة: '+(e.code||e.message))}
});
