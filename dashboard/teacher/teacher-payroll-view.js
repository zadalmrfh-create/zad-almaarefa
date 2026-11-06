/**
 * مستحقات المعلم: قراءة نسخة مخصصة لمعرف المعلم فقط.
 * تُنشئها لوحة الإدارة من سجلات الحضور + التعديلات المالية، ولا تُقرأ سجلات
 * teacherPayrollAdjustments الإدارية من المتصفح الخاص بالمعلم.
 */
import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,getDocs,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {getPreviewContext} from '../admin-preview-core.js';

const $ = id => document.getElementById(id);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value = v => Number.isSafeInteger(v)&&v>=0?v:0;
const money = v => (value(v)/100).toLocaleString('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2})+' ج.م';
const safeCsv = v => {
 let str=String(v??'');
 if(/^[\s\x00-\x1F]*[=+\-@]/.test(str))str="'"+str;
 return '"'+str.replace(/"/g,'""')+'"';
};
const dateTodayCairo=()=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const pick=k=>parts.find(x=>x.type===k).value;
 return `${pick('year')}-${pick('month')}-${pick('day')}`;
};
function weekRange(previous=false){
 const day=new Date(dateTodayCairo()+'T12:00:00Z');
 const before=(day.getUTCDay()+1)%7;
 day.setUTCDate(day.getUTCDate()-before-(previous?7:0));
 const end=new Date(day);end.setUTCDate(end.getUTCDate()+6);
 return [day.toISOString().slice(0,10),end.toISOString().slice(0,10)];
}
const state={uid:null,teacher:'',entries:[],filtered:[],ready:false,failed:false,unsubscribe:null};
const select=(id,options,defaultLabel)=>{
 const el=$(id);if(!el)return;
 const before=el.value||'all';
 el.replaceChildren(new Option(defaultLabel,'all'),...options.map(([id,label])=>new Option(label,id)));
 el.value=options.some(([id])=>id===before)?before:'all';
};
function filterOptions(){
 const students=new Map(),subjects=new Set();
 for(const r of state.entries){
  students.set(r.studentUid||'name:'+r.studentName,r.studentName||'طالب');
  const sub=String(r.subject||'').trim();if(sub)subjects.add(sub);
 }
 select('teacherSalaryStudent',[...students.entries()].sort((a,b)=>a[1].localeCompare(b[1],'ar')),'جميع الطلاب');
 select('teacherSalarySubject',[...subjects].sort((a,b)=>a.localeCompare(b,'ar')).map(x=>[x,x]),'جميع المواد');
}
function currentRows(){
 const from=$('teacherSalaryFrom')?.value||'',to=$('teacherSalaryTo')?.value||'';
 const student=$('teacherSalaryStudent')?.value||'all',subject=$('teacherSalarySubject')?.value||'all';
 return state.entries.filter(r=>(!from||r.date>=from)&&(!to||r.date<=to)&&
  (student==='all'||(r.studentUid||'name:'+r.studentName)===student)&&
  (subject==='all'||r.subject===subject));
}
function render(){
 const status=$('teacherSalaryStatus');if(!status)return;
 const from=$('teacherSalaryFrom')?.value||'',to=$('teacherSalaryTo')?.value||'';
 if(from&&to&&from>to){status.textContent='⚠️ تاريخ البداية بعد تاريخ النهاية.';return;}
 if(state.failed){status.textContent='❌ تعذر تحميل مستحقاتك. تأكد من نشر قواعد Firestore المحدثة، وتحديث صفحة الأدمن لمزامنة المرتبات.';}
 else if(!state.ready){status.textContent='جارٍ تحميل مستحقات المعلم...';}
 else status.textContent='هذا الكشف يعرض أجر الحصص والإضافي المعتمد من الإدارة فقط. لا يغيّر مبالغ الطلاب ولا يُعد إثباتًا للصرف.';
 const quick=$('teacherBonusQuick');
 if(quick){
  const [weekFrom,weekTo]=weekRange(false);
  const weekBonus=state.entries.filter(r=>r.date>=weekFrom&&r.date<=weekTo).reduce((n,r)=>n+value(r.bonusPiastres),0);
  quick.textContent=state.failed||!state.ready?'—':money(weekBonus);
 }
 const rows=state.failed?[]:currentRows();state.filtered=rows;
 const base=rows.reduce((a,r)=>a+value(r.basePayPiastres),0);
 const bonus=rows.reduce((a,r)=>a+value(r.bonusPiastres),0);
 for(const [id,v] of [['teacherSalaryCount',rows.length],['teacherSalaryBase',money(base)],['teacherSalaryBonus',money(bonus)],['teacherSalaryTotal',money(base+bonus)]]){
  if($(id))$(id).textContent=state.failed?'—':v;
 }
 const body=$('teacherSalaryRows');if(!body)return;
 body.innerHTML=state.failed?'<tr><td colspan="7">تعذر تحميل البيانات. حدّث الصفحة بعد نشر قواعد Firebase.</td></tr>':
 rows.length?rows.map(r=>`<tr><td>${esc(r.date||'—')}</td><td>${esc(r.studentName||'—')}</td><td>${esc(r.subject||'—')}</td><td>${esc(money(r.basePayPiastres))}</td><td class="teacher-salary-bonus">${esc(money(r.bonusPiastres))}</td><td><strong>${esc(money(value(r.basePayPiastres)+value(r.bonusPiastres)))}</strong></td><td>${esc(r.note||'—')}</td></tr>`).join(''):
 `<tr><td colspan="7">${state.ready?'لا توجد حصص في الفترة المحددة. لو في إضافي قديم، افتح لوحة الأدمن مرة لمزامنة مستحقات المعلمين.':'جارٍ تحميل المستحقات...'}</td></tr>`;
}
function setPeriod(mode){
 const period=$('teacherSalaryPeriod');if(period)period.value=mode;
 const from=$('teacherSalaryFrom'),to=$('teacherSalaryTo');
 if(mode==='all'){from.value='';to.value='';}
 else if(mode==='week'||mode==='last'){
  const [a,b]=weekRange(mode==='last');from.value=a;to.value=b;
 }
 render();
}
function exportRows(){
 const data=[['التاريخ','الطالب','المادة','أجر الحصة (جنيه)','إضافي المنصة (جنيه)','إجمالي المستحق (جنيه)','ملاحظات الإدارة']];
 for(const r of state.filtered){const base=value(r.basePayPiastres),bonus=value(r.bonusPiastres);
  data.push([r.date,r.studentName,r.subject,(base/100).toFixed(2),(bonus/100).toFixed(2),((base+bonus)/100).toFixed(2),r.note||'']);
 }
 const base=state.filtered.reduce((v,r)=>v+value(r.basePayPiastres),0);
 const bonus=state.filtered.reduce((v,r)=>v+value(r.bonusPiastres),0);
 data.push(['الإجمالي','','',(base/100).toFixed(2),(bonus/100).toFixed(2),((base+bonus)/100).toFixed(2),'']);
 return data;
}
function downloadCsv(){
 if(!state.ready||state.failed){alert('بيانات المستحقات غير مكتملة، لا يمكن التصدير.');return;}
 const content='\uFEFF'+exportRows().map(r=>r.map(safeCsv).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=`zad-teacher-salary-${dateTodayCairo()}.csv`;
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),15000);
 const target=$('teacherSalaryExportStatus');if(target)target.textContent='✅ تم تجهيز ملف مرتبات المعلم.';
}
function print(){
 if(!state.ready||state.failed){alert('تعذر تحميل المستحقات بالكامل؛ لا يمكن الطباعة.');return;}
 const base=state.filtered.reduce((v,r)=>v+value(r.basePayPiastres),0);
 const bonus=state.filtered.reduce((v,r)=>v+value(r.bonusPiastres),0);
 const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مستحقات المعلم | زاد المعرفة</title>
 <style>body{font:14px/1.8 Tahoma,Arial,sans-serif;color:#162941;margin:24px}header{text-align:center;border-bottom:3px solid #c5a14e;padding-bottom:12px}img{width:72px;height:72px;object-fit:contain}h1{font-size:22px;margin:3px}h2{font-size:18px;margin:0 0 5px}.summary{display:flex;justify-content:space-around;border:1px solid #c7d4e4;padding:12px;margin:18px 0;background:#f4f7fc;gap:10px}.summary b{color:#153156}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #b8c5d6;padding:8px;text-align:right}th{background:#102c4b;color:white}tr{break-inside:avoid}tfoot{font-weight:bold;background:#f5edd5}.note{font-size:11px;color:#607087;margin-top:15px}@page{size:A4 landscape;margin:12mm}</style></head><body>
 <header><img src="../../images/logo.png" alt="شعار المنصة"><h1>أكاديمية زاد المعرفة التعليمية</h1><h2>كشف مستحقات المعلم والإضافي</h2><p>المعلم: ${esc(state.teacher||'—')} | من ${esc($('teacherSalaryFrom').value||'بداية السجلات')} إلى ${esc($('teacherSalaryTo').value||'آخر السجلات')}</p></header>
 <div class="summary"><span>عدد الحصص: <b>${state.filtered.length}</b></span><span>أجر الحصص: <b>${esc(money(base))}</b></span><span>إضافي المنصة: <b>${esc(money(bonus))}</b></span><span>إجمالي المستحق: <b>${esc(money(base+bonus))}</b></span></div>
 <table><thead><tr>${exportRows()[0].map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${exportRows().slice(1,-1).map(row=>`<tr>${row.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr>${exportRows().at(-1).map(x=>`<td>${esc(x)}</td>`).join('')}</tr></tfoot></table>
 <p class="note">هذا كشف مستحقات، وليس إثبات صرف. الإضافي تتحمله المنصة ولا يُضاف إلى مبلغ الطالب. الحصص الغائبة والملغاة لا تدخل في التقرير.</p></body></html>`;
 const frame=document.createElement('iframe');frame.style.cssText='position:fixed;bottom:0;right:0;width:0;height:0;border:0';document.body.append(frame);
 frame.onload=()=>{setTimeout(()=>{try{frame.contentWindow.focus();frame.contentWindow.print();}finally{setTimeout(()=>frame.remove(),3000);}},300);};
 frame.srcdoc=html;
}
function wire(){
 $('teacherSalaryPeriod')?.addEventListener('change',e=>setPeriod(e.target.value));
 for(const id of ['teacherSalaryFrom','teacherSalaryTo'])$(id)?.addEventListener('change',()=>{$('teacherSalaryPeriod').value='custom';render();});
 for(const id of ['teacherSalaryStudent','teacherSalarySubject'])$(id)?.addEventListener('change',render);
 $('teacherSalaryCSV')?.addEventListener('click',downloadCsv);
 $('teacherSalaryPrint')?.addEventListener('click',print);
 $('teacherSalaryRefresh')?.addEventListener('click',async()=>{
  if(!state.uid)return;
  try{const snap=await getDocs(collection(db,'teacherPayrollViews',state.uid,'lessons'));
   state.entries=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.status==='حاضر'&&r.deleted!==true);
   state.ready=true;state.failed=false;filterOptions();render();
  }catch(e){console.error('[teacher-salary]',e);state.failed=true;render();}
 });
 setPeriod('week');
}
let unsubscribeAuth;
wire();
const authHandler=async user=>{
 if(state.unsubscribe){state.unsubscribe();state.unsubscribe=null;}
 if(!user)return;
 try{
  const preview=await getPreviewContext(user,'teacher');if(preview.denied)return;
  const uid=preview.active?preview.uid:user.uid;
  state.uid=uid;
  state.teacher=preview.active?(preview.profile?.fullName||preview.profile?.name||user.email):user.displayName||user.email;
  state.ready=false;state.failed=false;render();
  state.unsubscribe=onSnapshot(collection(db,'teacherPayrollViews',uid,'lessons'),snap=>{
   state.entries=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.status==='حاضر'&&r.deleted!==true);
   state.ready=true;state.failed=false;filterOptions();render();
  },error=>{console.error('[teacher-salary]',error);state.failed=true;state.ready=false;render();});
 }catch(error){console.error('[teacher-salary]',error);state.failed=true;render();}
};
unsubscribeAuth=onAuthStateChanged(auth,authHandler);
