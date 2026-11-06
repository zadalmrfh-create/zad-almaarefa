/** إدارة مرتبات المعلمين — بيانات مستقلة عن ذمم الطلاب، للإدارة فقط. */
import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDocs,setDoc,serverTimestamp,writeBatch} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/^(الأستاذ|استاذ|أستاذ|مستر|ميس|أ\/)\s*/i,'').replace(/\s+/g,' ').trim().toLowerCase();
const pt=v=>Math.round(Number(v||0)*100);
const egp=v=>(Number(v||0)/100).toLocaleString('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2})+' ج';
const sepSubjects=r=>Array.isArray(r.subjects)&&r.subjects.length?r.subjects.map(String):String(r.subject||'').split('،').map(x=>x.trim()).filter(Boolean);
const nToIso=n=>n.toISOString().slice(0,10);
const cairoToday=()=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const pick=k=>parts.find(x=>x.type===k).value;
 return `${pick('year')}-${pick('month')}-${pick('day')}`;
};
function weekRange(previous=false){
  const today=new Date(cairoToday()+'T12:00:00Z');
  const before=(today.getUTCDay()+1)%7;
  today.setUTCDate(today.getUTCDate()-before-(previous?7:0));
  const end=new Date(today);end.setUTCDate(end.getUTCDate()+6);
  return [nToIso(today),nToIso(end)];
}
let attendance=[],teachers=[],adjustments=new Map(),filtered=[],missing=0;
let ready=false,loading=false;
const status=$('salaryStatus');
const toStudentKey=r=>r.studentUid?`uid:${r.studentUid}`:`name:${r.studentName||'—'}`;
const teacherName=t=>t.fullName||t.name||t.displayName||t.email||'معلم';
function teacherFor(r,adj){
  if(adj?.teacherUid){ const t=teachers.find(x=>x.id===adj.teacherUid);return {key:`uid:${adj.teacherUid}`,name:t?teacherName(t):adj.teacherName||r.teacherName||'معلم'}; }
  if(adj?.teacherName && !adj.teacherUid)return {key:`name:${adj.teacherName}`,name:adj.teacherName};
  if(r.teacherUid){const t=teachers.find(x=>x.id===r.teacherUid);return {key:`uid:${r.teacherUid}`,name:t?teacherName(t):r.teacherName||'معلم'};}
  const raw=String(r.teacherName||'').trim();
  if(!raw||raw==='غير محدد'||raw==='الإدارة'||raw.includes('،'))return null;
  const matches=teachers.filter(t=>[t.name,t.fullName,t.displayName,...(Array.isArray(t.attendanceAliases)?t.attendanceAliases:[])].some(a=>norm(a)===norm(raw)));
  if(matches.length===1)return {key:`uid:${matches[0].id}`,name:teacherName(matches[0])};
  return {key:`name:${raw}`,name:raw}; // Legacy record without a linked teacher account.
}
function salaryRow(r){
 const adj=adjustments.get(r.id)||{};
 return {...r,_teacher:teacherFor(r,adj),_subjects:sepSubjects(r),_base:Number.isSafeInteger(adj.basePayPiastres)&&adj.basePayPiastres>=0?adj.basePayPiastres:Math.max(0,pt(r.price)),_bonus:Number.isSafeInteger(adj.bonusPiastres)&&adj.bonusPiastres>=0?adj.bonusPiastres:0,_note:String(adj.note||''),_adjustment:adj};
}
function fillSelect(id,opts,first){
 const el=$(id);if(!el)return;
 const previous=el.value;
 el.replaceChildren(new Option(first,'all'),...opts.map(o=>new Option(o.label,o.value)));
 el.value=opts.some(x=>x.value===previous)?previous:'all';
}
function populateOptions(){
 const relevant=attendance.filter(r=>r.deleted!==true&&r.status==='حاضر');
 const ids=new Map(teachers.map(t=>[`uid:${t.id}`,teacherName(t)]));
 const students=new Map();const subjects=new Set();
 for(const r of relevant){
  const t=teacherFor(r,adjustments.get(r.id));if(t)ids.set(t.key,t.name);
  students.set(toStudentKey(r),r.studentName||'طالب');
  sepSubjects(r).forEach(s=>subjects.add(s));
 }
 fillSelect('salaryTeacher',[...ids].sort((a,b)=>a[1].localeCompare(b[1],'ar')).map(([value,label])=>({value,label})),'جميع المعلمين');
 fillSelect('salaryStudent',[...students].sort((a,b)=>a[1].localeCompare(b[1],'ar')).map(([value,label])=>({value,label})),'جميع الطلاب');
 fillSelect('salarySubject',[...subjects].sort((a,b)=>a.localeCompare(b,'ar')).map(value=>({value,label:value})),'جميع المواد');
}
function getFiltered(){
 const teacher=$('salaryTeacher').value,student=$('salaryStudent').value,subject=$('salarySubject').value;
 const from=$('salaryFrom').value,to=$('salaryTo').value;
 return attendance.filter(r=>r.deleted!==true&&r.status==='حاضر').map(salaryRow).filter(r=>{
  const day=String(r.date||'').slice(0,10);
  if(from && (!day||day<from))return false;
  if(to && (!day||day>to))return false;
  if(teacher!=='all'&&r._teacher?.key!==teacher)return false;
  if(student!=='all'&&toStudentKey(r)!==student)return false;
  if(subject!=='all'&&!r._subjects.includes(subject))return false;
  return true;
 }).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.studentName||'').localeCompare(String(b.studentName||''),'ar'));
}
function render(){
 if(!ready)return;
 const from=$('salaryFrom').value,to=$('salaryTo').value;
 if(from&&to&&from>to){status.textContent='⚠️ تاريخ البداية بعد تاريخ النهاية. عدّل الفترة.';return;}
 filtered=getFiltered();
 const matched=filtered.filter(r=>r._teacher);
 const notLinked=matched.filter(r=>!r._teacher.key.startsWith('uid:')).length;
 missing=filtered.length-matched.length;
 const totals={count:matched.length,base:matched.reduce((a,r)=>a+r._base,0),bonus:matched.reduce((a,r)=>a+r._bonus,0)};
 const stat=[['عدد الحصص المحتسبة',String(totals.count)],['إجمالي أجر الحصص',egp(totals.base)],['إجمالي إضافي المنصة',egp(totals.bonus)],['إجمالي مستحقات المعلمين',egp(totals.base+totals.bonus)]];
 $('salaryTotals').innerHTML=stat.map(([label,value],i)=>`<article class="salary-metric ${i===3?'salary-grand':''}"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join('');
 const sums=new Map();
 for(const t of teachers){
  if($('salaryTeacher').value!=='all'&&$('salaryTeacher').value!==`uid:${t.id}`)continue;
  sums.set(`uid:${t.id}`,{name:teacherName(t),base:0,bonus:0,count:0});
 }
 for(const r of matched){const t=r._teacher;const item=sums.get(t.key)||{name:t.name,base:0,bonus:0,count:0};item.count++;item.base+=r._base;item.bonus+=r._bonus;sums.set(t.key,item);}
 const groups=[...sums].sort((a,b)=>(b[1].base+b[1].bonus)-(a[1].base+a[1].bonus));
 $('salaryTeacherCards').innerHTML=groups.length?groups.map(([key,g])=>`<article class="salary-teacher-card"><strong>👨‍🏫 ${esc(g.name)}</strong><span>${g.count} حصة × حسب أجر كل حصة</span><div class="salary-subtotals"><span>الحصص: <b>${egp(g.base)}</b></span><span>الإضافي: <b>${egp(g.bonus)}</b></span></div><b class="salary-card-grand">المستحق: ${egp(g.base+g.bonus)}</b></article>`).join(''):'<p class="salary-empty">لا توجد مستحقات للمعلمين خلال الفترة المحددة.</p>';
 $('salaryRows').innerHTML=filtered.length?filtered.map(r=>`<tr><td>${esc(r.date||'—')}</td><td>${esc(r._teacher?.name||'⚠️ يحتاج تحديد معلم')}</td><td>${esc(r.studentName||'—')}</td><td>${esc(r._subjects.join('، ')||'—')}</td><td>${egp(r._base)}</td><td>${egp(r._bonus)}</td><td><b>${r._teacher?egp(r._base+r._bonus):'—'}</b></td><td>${esc(r._note||'—')}</td><td><button type="button" class="btn" data-salary-edit="${esc(r.id)}">✏️ تعديل الأجر</button></td></tr>`).join(''):'<tr><td colspan="9">لا توجد حصص حاضرة مطابقة لهذه الفلاتر.</td></tr>';
 status.textContent=`عرض ${filtered.length} حصة حاضرة، منها ${matched.length} محسوبة في المرتبات.`+(missing?` ⚠️ توجد ${missing} حصة لم يتحدد لها المعلم؛ اضغط «تعديل الأجر» لربطها قبل احتسابها.`:'')+(notLinked?` ⚠️ توجد ${notLinked} حصة مرتبطة باسم المعلم فقط؛ اربط حسابه من زر تعديل الأجر حتى تظهر في لوحة المعلم.`:'');
 annotateAttendanceButtons();
}
function annotateAttendanceButtons(){
 document.querySelectorAll('#attendanceRows [data-payroll-extra]').forEach(btn=>{
  const value=Number(adjustments.get(btn.dataset.payrollExtra)?.bonusPiastres||0);
  const label=value>0?'➕ إضافي '+egp(value):'➕ إضافي المرتب';
  if(btn.textContent!==label)btn.textContent=label;
 });
}
/**
 * مزامنة بيانات الحصص المالية للمعلم في مجموعة آمنة مخصصة له.
 * لا يتاح له الوصول إلى teacherPayrollAdjustments، ولا إلى بيانات غيره.
 * الفهرس الإداري يتفادى إعادة الكتابة لكل الحصص عند كل فتح للوحة.
 * تُزامَن الحصص الأقدم تلقائيًا فور زيارة الأدمن للوحة بعد نشر القواعد.
 */
async function syncTeacherSalaryViews(){
 const snapshot=await getDocs(collection(db,'teacherPayrollViewIndex'));
 const oldIndex=new Map(snapshot.docs.map(x=>[x.id,x.data()]));
 const desired=new Map();
 for(const row of attendance){
  if(row.deleted===true||row.status!=='حاضر')continue;
  const adjusted=salaryRow(row);
  if(!adjusted._teacher?.key?.startsWith('uid:'))continue;
  const teacherUid=adjusted._teacher.key.slice(4);
  if(!teacherUid)continue;
  const data={
   attendanceId:row.id,teacherUid,studentUid:String(row.studentUid||''),
   studentName:String(row.studentName||'—'),date:String(row.date||'').slice(0,10),
   subject:adjusted._subjects.join('، '),status:'حاضر',
   basePayPiastres:adjusted._base,bonusPiastres:adjusted._bonus,
   note:adjusted._note
  };
  desired.set(row.id,{teacherUid,data,signature:JSON.stringify(data)});
 }
 const groups=[];
 for(const [id,next] of desired){
  const old=oldIndex.get(id);
  if(old&&old.teacherUid===next.teacherUid&&old.signature===next.signature)continue;
  const ops=[];
  if(old?.teacherUid&&old.teacherUid!==next.teacherUid){
   ops.push({action:'delete',ref:doc(db,'teacherPayrollViews',old.teacherUid,'lessons',id)});
  }
  ops.push({action:'set',ref:doc(db,'teacherPayrollViews',next.teacherUid,'lessons',id),data:next.data});
  ops.push({action:'set',ref:doc(db,'teacherPayrollViewIndex',id),data:{teacherUid:next.teacherUid,signature:next.signature,syncedAt:serverTimestamp()}});
  groups.push(ops);
 }
 for(const [id,old] of oldIndex){
  if(desired.has(id))continue;
  const ops=[];
  if(old?.teacherUid)ops.push({action:'delete',ref:doc(db,'teacherPayrollViews',old.teacherUid,'lessons',id)});
  ops.push({action:'delete',ref:doc(db,'teacherPayrollViewIndex',id)});
  groups.push(ops);
 }
 if(!groups.length)return 0;
 let batch=writeBatch(db),opsCount=0,count=0;
 for(const group of groups){
  if(opsCount+group.length>350){await batch.commit();batch=writeBatch(db);opsCount=0;}
  for(const op of group){
   if(op.action==='delete')batch.delete(op.ref);
   else batch.set(op.ref,op.data);
   opsCount++;
  }
  count++;
 }
 if(opsCount)await batch.commit();
 return count;
}
async function refresh(){
 if(loading)return;
 loading=true;status.textContent='جارٍ تحميل سجل الحضور وبيانات المرتبات...';
 try{
  const [att,profiles,extra]=await Promise.all([getDocs(collection(db,'lessonAttendance')),getDocs(collection(db,'users')),getDocs(collection(db,'teacherPayrollAdjustments'))]);
  attendance=att.docs.map(d=>({id:d.id,...d.data()}));
  teachers=profiles.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.role==='teacher'&&x.status!=='banned');
  adjustments=new Map(extra.docs.map(d=>[d.id,d.data()]));
  let syncWarning='';
  try{
   const synced=await syncTeacherSalaryViews();
   if(synced)console.info(`[salary] تمت مزامنة ${synced} حصة مع كشوف المعلمين.`);
  }catch(err){
   console.error('[salary-view-sync]',err);
   syncWarning=' ⚠️ لم تُزامن مستحقات المعلمين للعرض في لوحاتهم: '+(err.code||err.message)+'. انشر قواعد Firestore المحدثة ثم حدّث لوحة الأدمن.';
  }
  ready=true;populateOptions();render();
  if(syncWarning)status.textContent+=syncWarning;
 }catch(e){console.error('[salary]',e);status.textContent='❌ تعذر تحميل المرتبات: '+(e.code||e.message)+'. تأكد من نشر قواعد Firestore الجديدة وصلاحية حساب الأدمن.';}
 finally{loading=false;}
}

const editDialog=document.createElement('dialog');
editDialog.id='salaryEditDialog';editDialog.dir='rtl';editDialog.className='salary-dialog';
editDialog.innerHTML=`<form id="salaryEditForm"><h3>💼 تعديل أجر الحصة والإضافي</h3><p id="salaryEditLesson"></p><label>المعلم المستحق<select name="teacherUid"><option value="">المعلم المسجل في الحضور تلقائيًا</option></select></label><label>أجر الحصة الأساسي (بالجنيه)<input name="base" type="number" min="0" max="200000" step="0.01" required></label><label>إضافي تتحمله المنصة (بالجنيه)<input name="bonus" type="number" min="0" max="200000" step="0.01" required></label><label>سبب الإضافي / ملاحظات<input name="note" maxlength="350" placeholder="مثال: مكافأة شرح إضافي"></label><p class="salary-dialog-note">مبلغ الطالب لا يتغير. لا تُحتسب الحصص الغائبة ضمن المرتبات. بعد الحفظ تتم مزامنة الإضافي مباشرة مع لوحة المعلم.</p><p id="salaryEditError" role="alert"></p><div class="salary-actions"><button class="btn gold" type="submit">💾 حفظ الأجر والإضافي</button><button class="btn" type="button" data-salary-cancel>إلغاء</button></div></form>`;
document.body.append(editDialog);
let editing=null;
editDialog.querySelector('[data-salary-cancel]').addEventListener('click',()=>editDialog.close());
function openEditor(id){
 const r=attendance.find(item=>item.id===id);if(!r){alert('السجل غير محمّل، اضغط تحديث أولًا.');return;}
 if(r.deleted===true||r.status!=='حاضر'){alert('الإضافي والمرتبات تُحسب على الحصص الحاضرة غير الملغاة فقط.');return;}
 const adj=adjustments.get(id)||{};editing=id;
 const form=$('salaryEditForm');
 form.elements.teacherUid.replaceChildren(new Option('المعلم المسجل في الحضور تلقائيًا',''),...teachers.map(t=>new Option(teacherName(t),t.id)));
 form.elements.teacherUid.value=adj.teacherUid||'';
 form.elements.base.value=((Number.isSafeInteger(adj.basePayPiastres)?adj.basePayPiastres:Math.max(0,pt(r.price)))/100).toFixed(2);
 form.elements.bonus.value=(Number(adj.bonusPiastres||0)/100).toFixed(2);
 form.elements.note.value=adj.note||'';
 $('salaryEditLesson').textContent=`الطالب: ${r.studentName||'—'} | التاريخ: ${r.date||'—'} | المادة: ${r.subject||'—'} | المعلم في الحضور: ${r.teacherName||'غير محدد'}`;
 $('salaryEditError').textContent='';
 editDialog.showModal();
}
$('salaryEditForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!editing)return;
 const form=e.currentTarget;const base=Number(form.elements.base.value),bonus=Number(form.elements.bonus.value);
 const error=$('salaryEditError');
 if(![base,bonus].every(n=>Number.isFinite(n)&&n>=0&&n<=200000)){error.textContent='أدخل قيمة صحيحة من صفر إلى 200,000 جنيه.';return;}
 const row=attendance.find(r=>r.id===editing);const selected=form.elements.teacherUid.value;
 const teacher=selected?teachers.find(t=>t.id===selected):teacherFor(row,{teacherUid:null,teacherName:null});
 if(!teacher){error.textContent='الحصة مرتبطة بأكثر من معلم أو باسم غير محدد؛ اختر المعلم المستحق من القائمة أولًا.';return;}
 if(!selected&&!String(teacher.key||'').startsWith('uid:')){error.textContent='اختر حساب المعلم المسجل في المنصة حتى يظهر الإضافي داخل لوحة المعلم.';return;}
 const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
 try{
  await setDoc(doc(db,'teacherPayrollAdjustments',editing),{
   attendanceId:editing,basePayPiastres:pt(base),bonusPiastres:pt(bonus),note:String(form.elements.note.value||'').trim(),
   teacherUid:selected||null,teacherName:selected?teacherName(teachers.find(t=>t.id===selected)):null,
   updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.uid||null
  },{merge:true});
  editDialog.close();await refresh();
 }catch(ex){console.error(ex);error.textContent='تعذر حفظ الأجر: '+(ex.code||ex.message);}
 finally{btn.disabled=false;}
});
$('salaryRows')?.addEventListener('click',e=>{const btn=e.target.closest('[data-salary-edit]');if(btn)openEditor(btn.dataset.salaryEdit);});
document.addEventListener('zad:payroll-edit',e=>openEditor(e.detail?.lessonId));

for(const id of ['salaryTeacher','salaryStudent','salarySubject','salaryFrom','salaryTo'])$(id)?.addEventListener('change',render);
$('salaryRefresh')?.addEventListener('click',refresh);
function setWeek(previous){const [a,b]=weekRange(previous);$('salaryFrom').value=a;$('salaryTo').value=b;render();}
$('salaryThisWeek')?.addEventListener('click',()=>setWeek(false));
$('salaryLastWeek')?.addEventListener('click',()=>setWeek(true));
$('salaryAllDates')?.addEventListener('click',()=>{$('salaryFrom').value='';$('salaryTo').value='';render();});

function csvCell(v){let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function payrollTable(){
 const head=['التاريخ','المعلم','الطالب','المادة','أجر الحصة','إضافي من المنصة','إجمالي الحصة','ملاحظات'];
 const data=filtered.map(r=>[r.date||'',r._teacher?.name||'يحتاج تحديد معلم',r.studentName||'',r._subjects.join('، '),(r._base/100).toFixed(2),(r._bonus/100).toFixed(2),r._teacher?((r._base+r._bonus)/100).toFixed(2):'',r._note]);
 const valid=filtered.filter(r=>r._teacher);
 const total=[valid.reduce((s,r)=>s+r._base,0),valid.reduce((s,r)=>s+r._bonus,0)];
 data.push(['الإجمالي','','','',...(total.map(n=>(n/100).toFixed(2))),((total[0]+total[1])/100).toFixed(2),'']);
 return {head,data};
}
$('salaryCSV')?.addEventListener('click',()=>{
 if(!ready)return;
 const {head,data}=payrollTable();const csv='\uFEFF'+[head,...data].map(row=>row.map(csvCell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=`زاد-المعرفة-مرتبات-المعلمين-${$('salaryFrom').value||'all'}-${$('salaryTo').value||'all'}.csv`;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
});
$('salaryPrint')?.addEventListener('click',()=>{
 if(!ready)return;
 const {head,data}=payrollTable();
 const rows=[head,...data].map((row,i)=>`<tr>${row.map(cell=>i===0?`<th>${esc(cell)}</th>`:`<td>${esc(cell)}</td>`).join('')}</tr>`).join('');
 const logo=new URL('../../images/logo.png',import.meta.url).href;
 const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مرتبات المعلمين | زاد المعرفة</title><style>body{font:14px Tahoma,Arial,sans-serif;color:#13233d;padding:22px}header{text-align:center;border-bottom:3px solid #c09a30;padding-bottom:14px}img{max-width:80px;max-height:80px}h1{margin:6px 0}small{color:#526277}table{width:100%;border-collapse:collapse;margin-top:20px;table-layout:auto}th,td{border:1px solid #a4afbd;padding:8px 6px;text-align:right;font-size:12px}th{background:#e4ecf7}tr:last-child{font-weight:bold;background:#f2e7ca}p.note{margin-top:20px;color:#536479}@page{size:A4 landscape;margin:12mm}</style></head><body><header><img src="${esc(logo)}"><h1>أكاديمية زاد المعرفة التعليمية</h1><h2>تقرير مرتبات المعلمين</h2><small>الفترة من ${esc($('salaryFrom').value||'بداية السجل')} إلى ${esc($('salaryTo').value||'نهاية السجل')} — تقرير مستحقات وليس إيصال صرف</small></header><table>${rows}</table><p class="note">أجر الحصة والإضافي تتحملهما المنصة حسب التقرير، ولا يتغير بهما حساب الطالب. الحصص الغائبة والملغاة غير محتسبة.</p></body></html>`;
 const frame=document.createElement('iframe');frame.style.cssText='position:fixed;width:0;height:0;border:0;right:0;bottom:0';document.body.append(frame);
 frame.addEventListener('load',()=>{setTimeout(()=>{try{frame.contentWindow.focus();frame.contentWindow.print();}catch(e){alert('تعذرت الطباعة: '+e.message);}setTimeout(()=>frame.remove(),3000);},350);},{once:true});
 frame.srcdoc=html;
});

const attendanceRows=$('attendanceRows');
if(attendanceRows)new MutationObserver(annotateAttendanceButtons).observe(attendanceRows,{childList:true,subtree:true});
const [from,to]=weekRange(false);$('salaryFrom').value=from;$('salaryTo').value=to;
onAuthStateChanged(auth,user=>{if(user)refresh();});
window.addEventListener('zad:attendance-changed',refresh);
window.addEventListener('zad:attendance-archived',refresh);
