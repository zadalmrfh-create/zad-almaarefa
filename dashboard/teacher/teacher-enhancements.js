import {isAdminAccount,getPreviewContext} from '../admin-preview-core.js';
import {amountDue,amountPaid,money} from '../payment-utils.js';
import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  arrayUnion,
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const financeValue = r => {
  const due=amountDue(r),cash=amountPaid(r);
  const credit=Math.min(Math.max(0,due-cash),Math.max(0,Math.round(Number(r.teacherAdvanceAppliedPiastres)||0)));
  return {due,cash,credit,total:cash+credit,remaining:Math.max(0,due-cash-credit)};
};
const isActiveAttendance = x => x.deleted!==true && x.archived!==true;
function addIssue(source,error){
 const msg=source+': '+(error?.code||error?.message||error||'خطأ غير معروف');
 state.errors.push(msg);state.failedSources.add(source);
 console.error('[teacher-readonly]',msg,error);
}
function showIssues(){
 const el=$('teacherDataNotice');if(!el)return;
 if(state.errors.length){el.hidden=false;el.textContent='⚠️ تعذر تحميل بعض البيانات: '+state.errors.join(' | ')+' — راجع صلاحيات Firebase وربط السجلات بالمعلم.';return;}
 if(!state.attendance.length&&!state.students.length){el.hidden=false;el.textContent='لا توجد سجلات مربوطة بمعرّف المعلم في الحجوزات أو الحضور. راجع «ربط بيانات المعلمين» في لوحة الأدمن لتوصيل السجلات القديمة.';return;}
 if(state.attendance.some(x=>!Object.hasOwn(x,'teacherAdvanceAppliedPiastres'))){el.hidden=false;el.textContent='ℹ️ بعض سجلات الحصص لم تكتمل تسويتها المالية؛ راجع لوحة الأدمن لتحديث الأرصدة قبل اعتماد الإجمالي.';return;}
 el.hidden=true;el.textContent='';
}
function upsertStudent(entry){
 const uid=text(entry.studentUid);
 if(!uid)return;
 const prev=state.studentMap.get(uid)||{id:uid};
 const name=text(entry.fullName||entry.studentName||entry.name);
 state.studentMap.set(uid,{...prev,
  fullName:prev.fullName||name,name:prev.name||name,
  email:prev.email||text(entry.email||entry.studentEmail),
  phone:prev.phone||text(entry.phone||entry.studentPhone),
  grade:prev.grade||text(entry.grade||entry.studyGrade),
 });
}

const state = {
  user: null,
  profile: {},
  students: [],
  studentMap: new Map(),
  attendance: [],
  notes: [],
  notifications: [],
  errors: [],
  preview: false,
  failedSources: new Set()
};

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function text(value){ return String(value ?? '').trim(); }
function phoneDigits(value){
  const digits = text(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20')) return digits;
  if (digits.startsWith('0')) return '20' + digits.slice(1);
  return digits;
}
function toDate(value){
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function formatDate(value, withTime=false){
  const d = toDate(value);
  if (!d) return '-';
  try { return new Intl.DateTimeFormat('ar-EG', withTime ? {dateStyle:'medium',timeStyle:'short'} : {dateStyle:'medium'}).format(d); }
  catch { return d.toLocaleDateString('ar-EG'); }
}
function dateKey(value){ const d=toDate(value); return d ? d.getTime() : 0; }
function percent(part,total){ return total ? Math.round((part/total)*100) : 0; }
function studentName(uid, fallback='-'){ return state.studentMap.get(uid)?.fullName || state.studentMap.get(uid)?.name || fallback; }
function setStatus(id,message,ok=true){
  const el=$(id); if(!el) return;
  el.textContent=message;
  el.className='teacher-form-status '+(ok?'ok-text':'error-text');
  if(message) setTimeout(()=>{if(el.textContent===message)el.textContent='';},3500);
}
function setToday(){
  const el=$('teacherToday'); if(!el) return;
  try{ el.textContent=new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()); }
  catch{ el.textContent=new Date().toLocaleDateString('ar-EG'); }
}

function initTabs(){
  document.querySelectorAll('.teacher-tab').forEach(btn=>btn.addEventListener('click',()=>openTab(btn.dataset.tab)));
  document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>openTab(btn.dataset.go)));
}
function openTab(name){
  document.querySelectorAll('.teacher-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  document.querySelectorAll('.teacher-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===name));
  window.scrollTo({top:0,behavior:'smooth'});
}

async function loadTeacherStudents(uid){
 try{
  const snap=await getDocs(query(collection(db,'bookings'),where('teacherUid','==',uid)));
  for(const d of snap.docs)upsertStudent(d.data());
 }catch(err){addIssue('الحجوزات',err);}
}
async function loadAttendance(uid){
 try{
  const snap=await getDocs(query(collection(db,'lessonAttendance'),where('teacherUid','==',uid)));
  state.attendance=snap.docs.map(d=>({id:d.id,...d.data()})).filter(isActiveAttendance)
   .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  for(const x of state.attendance)upsertStudent(x);
 }catch(err){addIssue('الحضور والمدفوعات',err);state.attendance=[];}
}
function finalizeStudents(){
 state.students=[...state.studentMap.values()].sort((a,b)=>text(a.fullName||a.name).localeCompare(text(b.fullName||b.name),'ar'));
}
async function loadNotes(uid){
  try{
    const snap=await getDocs(query(collection(db,'teacherStudentNotes'),where('teacherUid','==',uid)));
    state.notes=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt));
  }catch(err){addIssue('الملاحظات',err);state.notes=[];}
}
async function loadTeacherNotifications(uid){
  try{
    const [personalSnap,publicSnap]=await Promise.all([
      getDocs(query(collection(db,'notifications'),where('audience','==','user'),where('targetUid','==',uid))),
      getDocs(query(collection(db,'notifications'),where('audience','==','all')))
    ]);
    const merged=new Map();
    [...personalSnap.docs,...publicSnap.docs].forEach(d=>merged.set(d.id,{id:d.id,...d.data()}));
    state.notifications=[...merged.values()].sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt)).slice(0,50);
  }catch(err){addIssue('التنبيهات',err);state.notifications=[];}
}

function fillStudentSelects(){
  const options=state.students.length?state.students.map(s=>`<option value="${esc(s.id)}">${esc(s.fullName||s.name||s.email||'طالب')}</option>`).join(''):'<option value="">لا يوجد طلاب مرتبطون بك</option>';
  ['attendanceStudent','noteStudent'].forEach(id=>{if($(id))$(id).innerHTML=options;});
  const filters='<option value="">كل الطلاب</option>'+state.students.map(s=>`<option value="${esc(s.id)}">${esc(s.fullName||s.name||s.email||'طالب')}</option>`).join('');
  ['attendanceFilterStudent','notesFilterStudent'].forEach(id=>{if($(id))$(id).innerHTML=filters;});
}
function getStudentAttendance(uid){return state.attendance.filter(x=>x.studentUid===uid);}
function getStudentNotes(uid){return state.notes.filter(x=>x.studentUid===uid);}

function renderOverview(){
  const present=state.attendance.filter(x=>x.status==='حاضر').length;
  const relevant=state.attendance.filter(x=>x.status==='حاضر'||x.status==='غائب').length;
  const activeStudents=new Set(state.attendance.map(x=>x.studentUid).filter(Boolean)).size;
  const visibleNotes=state.notes.filter(x=>x.visibleToStudent===true).length;
  const unread=state.notifications.filter(n=>!(Array.isArray(n.readBy)&&n.readBy.includes(state.user?.uid))).length;
  if($('teacherStudentsCount'))$('teacherStudentsCount').textContent=state.failedSources.has('الحجوزات')&&state.failedSources.has('الحضور والمدفوعات')?'—':state.students.length;
  if($('teacherAttendanceCount'))$('teacherAttendanceCount').textContent=state.failedSources.has('الحضور والمدفوعات')?'—':state.attendance.length;
  if($('teacherNotesCount'))$('teacherNotesCount').textContent=state.notes.length;
  if($('teacherUnreadCount'))$('teacherUnreadCount').textContent=unread;
  if($('teacherNotificationBadge')){
    $('teacherNotificationBadge').textContent=unread;
    $('teacherNotificationBadge').style.display=unread?'inline-flex':'none';
  }
  if($('overviewAttendanceRate'))$('overviewAttendanceRate').textContent=percent(present,relevant)+'%';
  if($('overviewActiveStudents'))$('overviewActiveStudents').textContent=activeStudents;
  if($('overviewVisibleNotesCount'))$('overviewVisibleNotesCount').textContent=visibleNotes;

  const activities=[
    ...state.attendance.slice(0,6).map(x=>({t:dateKey(x.createdAt||x.date),icon:'✅',title:`${studentName(x.studentUid,x.studentName)} — ${x.status||'حضور'}`,meta:`${x.subject||'بدون مادة'} • ${x.date||formatDate(x.createdAt)}`})),
    ...state.notes.slice(0,6).map(x=>({t:dateKey(x.createdAt),icon:'🗒️',title:`ملاحظة على ${studentName(x.studentUid,x.studentName)}`,meta:`${x.category||'عام'} • ${x.visibleToStudent===true?'تظهر للطالب':'خاصة'}`}))
  ].sort((a,b)=>b.t-a.t).slice(0,8);
  if($('teacherRecentActivity'))$('teacherRecentActivity').innerHTML=activities.length?activities.map(a=>`<div class="teacher-activity-item"><span>${a.icon}</span><div><strong>${esc(a.title)}</strong><small>${esc(a.meta)}</small></div></div>`).join(''):'<div class="teacher-empty">لا توجد نشاطات حتى الآن.</div>';
}

function renderStudents(){
  const q=text($('studentSearch')?.value).toLowerCase();
  const filtered=state.students.filter(s=>[s.fullName,s.name,s.email,s.phone,s.phoneNumber,s.grade,s.studyGrade].some(v=>window.ZadNameSearch.matches(v,q)));
  const body=$('teacherStudentsRows'); if(!body)return;
  if(!filtered.length){body.innerHTML='<tr><td colspan="6">لا يوجد طلاب مطابقون.</td></tr>';return;}
  body.innerHTML=filtered.map(s=>{
    const att=getStudentAttendance(s.id),present=att.filter(x=>x.status==='حاضر').length;
    const notes=getStudentNotes(s.id),visible=notes.filter(x=>x.visibleToStudent===true).length;
    const phone=s.phone||s.phoneNumber||'';
    return `<tr>
      <td><strong>${esc(s.fullName||s.name||'-')}</strong><br><small>${esc(s.email||'')}</small></td>
      <td>${esc(s.grade||s.studyGrade||s.className||'-')}</td>
      <td dir="ltr">${esc(phone||'-')}</td>
      <td>${present}/${att.length}</td>
      <td>${notes.length}${visible?` <small>(${visible} ظاهرة)</small>`:''}</td>
      <td><div class="teacher-row-actions"><button class="btn compact-btn" data-student-view="${esc(s.id)}">👁️ الملف</button>${phoneDigits(phone)?`<a class="btn gold compact-btn" target="_blank" rel="noopener" href="https://wa.me/${phoneDigits(phone)}">واتساب</a>`:''}</div></td>
    </tr>`;
  }).join('');
  body.querySelectorAll('[data-student-view]').forEach(btn=>btn.addEventListener('click',()=>openStudentDetails(btn.dataset.studentView)));
}
function openStudentDetails(uid){
  const s=state.studentMap.get(uid);if(!s)return;
  const att=getStudentAttendance(uid),notes=getStudentNotes(uid);
  const present=att.filter(x=>x.status==='حاضر').length;
  const relevant=att.filter(x=>x.status==='حاضر'||x.status==='غائب').length;
  const visible=notes.filter(x=>x.visibleToStudent===true).length;
  const phone=s.phone||s.phoneNumber||'';
  if($('studentDetailsTitle'))$('studentDetailsTitle').textContent=`ملف الطالب — ${s.fullName||s.name||'طالب'}`;
  if($('studentDetailsBody'))$('studentDetailsBody').innerHTML=`
    <div class="student-detail-grid">
      <div><span>الاسم</span><strong>${esc(s.fullName||s.name||'-')}</strong></div>
      <div><span>البريد</span><strong>${esc(s.email||'-')}</strong></div>
      <div><span>الهاتف</span><strong dir="ltr">${esc(phone||'-')}</strong></div>
      <div><span>الصف</span><strong>${esc(s.grade||s.studyGrade||s.className||'-')}</strong></div>
      <div><span>الحضور</span><strong>${present}/${att.length} — ${percent(present,relevant)}%</strong></div>
      <div><span>الملاحظات</span><strong>${notes.length} (${visible} ظاهرة للطالب)</strong></div>
    </div>
    <div class="teacher-section-head" style="margin-top:14px"><div><h3>آخر الملاحظات</h3><p>أحدث ملاحظاتك على الطالب.</p></div></div>
    <div class="teacher-notes-list">${notes.slice(0,5).map(n=>`<article class="teacher-note-card"><div><span class="teacher-note-category">${esc(n.category||'عام')}</span><strong>${n.visibleToStudent===true?'👁️ تظهر للطالب':'🔒 خاصة'}</strong><p>${esc(n.text||'')}</p><small>${formatDate(n.createdAt,true)}</small></div></article>`).join('')||'<div class="teacher-empty">لا توجد ملاحظات.</div>'}</div>
    <div class="teacher-row-actions" style="margin-top:14px">${phoneDigits(phone)?`<a class="btn gold" target="_blank" rel="noopener" href="https://wa.me/${phoneDigits(phone)}">💬 واتساب الطالب</a>`:''}<button class="btn" data-open-attendance>📊 عرض سجل الحضور</button></div>`;
  $('studentDetailsBody')?.querySelector('[data-open-attendance]')?.addEventListener('click',()=>{closeStudentModal();openTab('attendance');if($('attendanceFilterStudent'))$('attendanceFilterStudent').value=uid;renderAttendance();});
  $('studentDetailsModal')?.classList.add('show');
  $('studentDetailsModal')?.setAttribute('aria-hidden','false');
}
function closeStudentModal(){$('studentDetailsModal')?.classList.remove('show');$('studentDetailsModal')?.setAttribute('aria-hidden','true');}

function renderAttendance(){
  const filter=$('attendanceFilterStudent')?.value||'';
  const rows=state.attendance.filter(x=>!filter||x.studentUid===filter);
  const present=state.attendance.filter(x=>x.status==='حاضر').length;
  const absent=state.attendance.filter(x=>x.status==='غائب').length;
  const excused=state.attendance.filter(x=>x.status==='اعتذر').length;
  if($('attendancePresent'))$('attendancePresent').textContent=present;
  if($('attendanceAbsent'))$('attendanceAbsent').textContent=absent;
  if($('attendanceExcused'))$('attendanceExcused').textContent=excused;
  if($('attendanceRate'))$('attendanceRate').textContent=percent(present,present+absent)+'%';
  if(!$('attendanceRows'))return;
  if(state.failedSources.has('الحضور والمدفوعات')){$('attendanceRows').innerHTML='<tr><td colspan="6">تعذر قراءة الحضور بسبب صلاحيات Firebase أو الاتصال.</td></tr>';return;}
  $('attendanceRows').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(studentName(x.studentUid,x.studentName))}</td><td>${esc(x.date||formatDate(x.createdAt))}</td><td>${esc(x.subject||'-')}</td><td><span class="teacher-status ${x.status==='حاضر'?'present':x.status==='غائب'?'absent':'excused'}">${esc(x.status||'-')}</span></td><td>${Number(x.price||0).toLocaleString('ar-EG')} ج.م</td><td>${esc(x.note||'-')}</td></tr>`).join(''):'<tr><td colspan="6">لا توجد سجلات.</td></tr>';
}

function renderNotes(){
  const filter=$('notesFilterStudent')?.value||'';
  const notes=state.notes.filter(x=>!filter||x.studentUid===filter);
  if(!$('notesList'))return;
  $('notesList').innerHTML=notes.length?notes.map(n=>`<article class="teacher-note-card"><div><span class="teacher-note-category">${esc(n.category||'عام')}</span><strong>${esc(studentName(n.studentUid,n.studentName))}</strong> <span class="teacher-note-category">${n.visibleToStudent===true?'👁️ تظهر للطالب':'🔒 خاصة'}</span><p>${esc(n.text||'')}</p><small>${formatDate(n.createdAt,true)}</small></div></article>`).join(''):'<div class="teacher-empty">لا توجد ملاحظات.</div>';
}
function renderReports(){
  const present=state.attendance.filter(x=>x.status==='حاضر').length;
  const absent=state.attendance.filter(x=>x.status==='غائب').length;
  if($('reportStudents'))$('reportStudents').textContent=state.students.length;
  if($('reportAttendanceRate'))$('reportAttendanceRate').textContent=percent(present,present+absent)+'%';
  if($('reportAttendanceTotal'))$('reportAttendanceTotal').textContent=state.attendance.length;
  if($('reportNotes'))$('reportNotes').textContent=state.notes.length;
  const body=$('teacherReportRows');if(!body)return;
  body.innerHTML=state.students.length?state.students.map(s=>{
    const att=getStudentAttendance(s.id),p=att.filter(x=>x.status==='حاضر').length,a=att.filter(x=>x.status==='غائب'||x.status==='اعتذر').length;
    const relevant=att.filter(x=>x.status==='حاضر'||x.status==='غائب').length;
    const notes=getStudentNotes(s.id),visible=notes.filter(x=>x.visibleToStudent===true).length;
    return `<tr><td>${esc(s.fullName||s.name||'-')}</td><td>${p}</td><td>${a}</td><td>${percent(p,relevant)}%</td><td>${notes.length}</td><td>${visible}</td></tr>`;
  }).join(''):'<tr><td colspan="6">لا توجد بيانات.</td></tr>';
}

function filteredPaymentRows(){
 const uid=$('teacherPaymentsStudent')?.value||'';
 const from=$('teacherPaymentsFrom')?.value||'',to=$('teacherPaymentsTo')?.value||'';
 return state.attendance.filter(x=>(!uid||x.studentUid===uid)&&(!from||String(x.date||'')>=from)&&(!to||String(x.date||'')<=to));
}
function paymentRowsHtml(rows){
 return rows.map(x=>{const f=financeValue(x);return `<tr><td>${esc(x.date||'-')}</td><td>${esc(studentName(x.studentUid,x.studentName))}</td><td>${esc(x.subject||'-')}</td><td>${esc(x.status||'-')}</td><td>${money(f.due)}</td><td>${money(f.total)}</td><td>${money(f.remaining)}</td></tr>`}).join('');
}
function paymentSummary(rows){return rows.reduce((a,x)=>{const f=financeValue(x);a.due+=f.due;a.cash+=f.cash;a.credit+=f.credit;a.remaining+=f.remaining;return a;},{due:0,cash:0,credit:0,remaining:0});}
function renderPayments(){
 const filter=$('teacherPaymentsStudent'),prior=filter?.value||'';
 if(filter){filter.innerHTML='<option value="">كل الطلاب</option>'+state.students.map(x=>`<option value="${esc(x.id)}">${esc(x.fullName||x.name||x.id)}</option>`).join('');filter.value=state.students.some(s=>s.id===prior)?prior:'';}
 const rows=filteredPaymentRows(),s=paymentSummary(rows);
 const ids=['teacherPaymentsDue','teacherPaymentsCash','teacherPaymentsCollected','teacherPaymentsRemaining'];
 [s.due,s.cash,s.cash+s.credit,s.remaining].forEach((v,i)=>{if($(ids[i]))$(ids[i]).textContent=state.failedSources.has('الحضور والمدفوعات')?'—':money(v);});
 if($('teacherPaymentsRows'))$('teacherPaymentsRows').innerHTML=state.failedSources.has('الحضور والمدفوعات')?'<tr><td colspan="7">تعذر تحميل بيانات المدفوعات. راجع التنبيه أعلى اللوحة.</td></tr>':rows.length?paymentRowsHtml(rows):'<tr><td colspan="7">لا توجد حصص مطابقة.</td></tr>';
 const grouped=new Map();
 for(const r of rows){const uid=r.studentUid||r.studentName||r.id;const val=grouped.get(uid)||{name:studentName(r.studentUid,r.studentName),count:0,due:0,cash:0,credit:0,remaining:0};const v=financeValue(r);val.count++;val.due+=v.due;val.cash+=v.cash;val.credit+=v.credit;val.remaining+=v.remaining;grouped.set(uid,val)}
 if($('teacherPaymentsStudentRows'))$('teacherPaymentsStudentRows').innerHTML=[...grouped.values()].map(v=>`<tr><td>${esc(v.name)}</td><td>${v.count}</td><td>${money(v.due)}</td><td>${money(v.cash+v.credit)}</td><td>${money(v.remaining)}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد سجلات.</td></tr>';
 if($('teacherPaymentsSyncNote')){
  const latest=rows.map(x=>toDate(x.teacherFinanceSyncedAt)).filter(Boolean).sort((a,b)=>b-a)[0];
  $('teacherPaymentsSyncNote').textContent=state.failedSources.has('الحضور والمدفوعات')?'❌ تعذر تحميل السجلات؛ لا تعتمد أرقام الدفع.':rows.some(r=>!Object.hasOwn(r,'teacherAdvanceAppliedPiastres'))?'⚠️ بعض الحصص لم تكتمل مراجعة تسويتها المالية من الإدارة؛ إجمالي المحصل مبدئي.':`✅ آخر تحديث للتسوية المالية: ${latest?formatDate(latest,true):'غير محدد'} — هذه دفعات الطلاب وليست مرتبات المعلمين.`;
 }

}
// تقارير الطباعة: تعتمد حصريًا على البيانات المحمّلة للمعلم وصلاحيات القراءة الحالية.
const printedMoney = value => `<span class="print-number" dir="ltr">${esc(money(value))}</span>`;
const numericCell = value => `<td class="print-num" dir="ltr">${esc(value)}</td>`;
function reportHeader(title, subheading=''){
 const teacher=esc(state.profile.fullName||state.profile.name||state.user?.email||'غير محدد');
 const issued=new Intl.DateTimeFormat('ar-EG',{dateStyle:'long',timeStyle:'short'}).format(new Date());
 return `<header class="print-brand">
  <div class="print-brand-identity"><img class="print-logo" src="../../images/logo.png" alt="شعار أكاديمية زاد المعرفة التعليمية"><div><div class="print-brand-name">أكاديمية زاد المعرفة التعليمية</div><div class="print-brand-tagline">نظام التقارير الأكاديمية والإدارية</div></div></div>
  <div class="print-brand-badge">نسخة للعرض والطباعة</div>
 </header>
 <section class="print-title-block"><h1>${esc(title)}</h1>${subheading?`<p class="print-subtitle">${esc(subheading)}</p>`:''}</section>
 <div class="print-meta"><div><span>اسم المعلم</span><strong>${teacher}</strong></div><div><span>تاريخ الإصدار</span><strong>${esc(issued)}</strong></div></div>`;
}
function reportStats(items){
 return `<section class="print-stat-grid ${items.length===6?'print-stat-six':''}">${items.map(i=>`<div class="print-stat"><span>${esc(i.label)}</span><strong>${i.value}</strong></div>`).join('')}</section>`;
}
function reportFooter(note){
 return `<footer class="print-footer"><span>زاد المعرفة التعليمية | تقرير صادر من لوحة المعلم</span><span>${esc(note)}</span></footer>`;
}
function paymentsDocument(){
 const rows=filteredPaymentRows(),totals=paymentSummary(rows);
 const byStudent=new Map();
 for(const row of rows){
  const key=row.studentUid||row.studentName||row.id;
  const value=financeValue(row);
  const old=byStudent.get(key)||{name:studentName(row.studentUid,row.studentName),count:0,due:0,cash:0,credit:0,remaining:0};
  old.count++;old.due+=value.due;old.cash+=value.cash;old.credit+=value.credit;old.remaining+=value.remaining;
  byStudent.set(key,old);
 }
 const picked=$('teacherPaymentsStudent')?.selectedOptions[0]?.textContent||'كل الطلاب';
 const from=$('teacherPaymentsFrom')?.value||'بداية السجلات';
 const to=$('teacherPaymentsTo')?.value||'آخر السجلات';
 const studentRows=[...byStudent.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(v=>`<tr><td>${esc(v.name)}</td>${numericCell(v.count)}${numericCell(money(v.due))}${numericCell(money(v.cash))}${numericCell(money(v.cash+v.credit))}${numericCell(money(v.remaining))}</tr>`).join('');
 const details=rows.map(x=>{const f=financeValue(x);return `<tr><td>${esc(x.date||'-')}</td><td>${esc(studentName(x.studentUid,x.studentName))}</td><td>${esc(x.subject||'-')}</td><td>${esc(x.status||'-')}</td>${numericCell(money(f.due))}${numericCell(money(f.total))}${numericCell(money(f.remaining))}</tr>`;}).join('');
 const warn=rows.some(r=>!Object.hasOwn(r,'teacherAdvanceAppliedPiastres'));
 const filterLine=`الطالب: ${picked} | الفترة: ${from} إلى ${to}`;
 return reportHeader('كشف الحضور والمدفوعات',filterLine)
 +reportStats([{label:'عدد الطلاب',value:`${byStudent.size}`},{label:'عدد الحصص',value:`${rows.length}`},{label:'إجمالي قيمة الحصص',value:printedMoney(totals.due)},{label:'إجمالي المحصل',value:printedMoney(totals.cash+totals.credit)},{label:'المبلغ غير المسدد',value:printedMoney(totals.remaining)}])
 +`<section class="print-section"><h2>01 <span>ملخص الحسابات حسب الطالب</span></h2><table class="print-table"><thead><tr><th>الطالب</th><th>الحصص</th><th>قيمة الحصص</th><th>مدفوع مباشر</th><th>إجمالي المحصل</th><th>المتبقي</th></tr></thead><tbody>${studentRows}</tbody><tfoot><tr><th>الإجمالي</th><th class="print-num">${rows.length}</th><th class="print-num">${esc(money(totals.due))}</th><th class="print-num">${esc(money(totals.cash))}</th><th class="print-num">${esc(money(totals.cash+totals.credit))}</th><th class="print-num">${esc(money(totals.remaining))}</th></tr></tfoot></table></section>`
 +`<section class="print-section"><h2>02 <span>تفاصيل الحصص والمدفوعات</span></h2><table class="print-table"><thead><tr><th>التاريخ</th><th>الطالب</th><th>المادة</th><th>الحالة</th><th>قيمة الحصة</th><th>إجمالي المحصل</th><th>المتبقي</th></tr></thead><tbody>${details}</tbody><tfoot><tr><th colspan="4">الإجمالي النهائي</th><th class="print-num">${esc(money(totals.due))}</th><th class="print-num">${esc(money(totals.cash+totals.credit))}</th><th class="print-num">${esc(money(totals.remaining))}</th></tr></tfoot></table></section>`
 +(warn?`<p class="print-warning">تنبيه: هناك حصص لم تكتمل مراجعة تسويتها المالية من الإدارة؛ تُعدّ الأرقام مبدئية إلى أن تتم المزامنة.</p>`:'')
 +`<p class="print-disclaimer">يعرض التقرير المبالغ المرتبطة بحصص المعلم فقط، ولا يشمل الدفعات غير المخصصة لحصص محددة. هذا الكشف لا يُعد إذنًا بصرف مستحقات المعلم.</p>`
 +reportFooter('عرض فقط — لا يتيح تعديل السجلات أو المدفوعات');
}
// تقرير قابل للمعاينة والطباعة في نفس صفحة لوحة المعلم.
// بقاء زر «طباعة الآن» يتيح إعادة المحاولة إذا منع المتصفح نافذة الطباعة.
function closeTeacherPrint(){
 document.body.classList.remove('teacher-print-active','teacher-print-preview');
 const sheet=$('teacherPrintDocument'); if(sheet)sheet.replaceChildren();
}
function requestTeacherPrint(){
 try { window.print(); }
 catch(error){console.error('[teacher-print]',error);alert('تعذر فتح نافذة الطباعة تلقائيًا؛ يمكنك الضغط على «طباعة الآن» داخل المعاينة.');}
}
function printTeacherContent(content){
 const sheet=$('teacherPrintDocument');
 if(!sheet){alert('تعذر تجهيز التقرير. حدّث الصفحة وحاول مجددًا.');return;}
 sheet.innerHTML=`<div class="teacher-print-toolbar" role="toolbar" aria-label="أدوات طباعة التقرير"><strong>تقرير زاد المعرفة جاهز</strong><span>لو نافذة الطباعة ما ظهرتش، اضغط طباعة الآن</span><button type="button" data-retry-teacher-print>🖨️ طباعة الآن</button><button type="button" data-close-teacher-print>إغلاق المعاينة</button></div><article class="teacher-print-paper">${content}</article>`;
 sheet.querySelector('[data-retry-teacher-print]')?.addEventListener('click',requestTeacherPrint);
 sheet.querySelector('[data-close-teacher-print]')?.addEventListener('click',closeTeacherPrint);
 document.body.classList.add('teacher-print-preview','teacher-print-active');
 requestTeacherPrint();
}
function printPayments(){
 if(state.failedSources.has('الحضور والمدفوعات')){
  alert('تعذر تحميل بيانات الحضور والمدفوعات. لا يمكن طباعة كشف مالي غير مكتمل.');return;
 }
 const rows=filteredPaymentRows();
 if(!rows.length){alert('لا توجد حصص مطابقة للفلاتر الحالية للطباعة.');return;}
 printTeacherContent(paymentsDocument());
}
function reportsDocument(){
 const present=state.attendance.filter(x=>x.status==='حاضر').length;
 const absent=state.attendance.filter(x=>x.status==='غائب').length;
 const excused=state.attendance.filter(x=>x.status==='اعتذر').length;
 const attendanceRate=percent(present,present+absent);
 let notesTotal=0,visibleTotal=0;
 const rows=state.students.map(student=>{
  const attendance=getStudentAttendance(student.id);
  const p=attendance.filter(x=>x.status==='حاضر').length;
  const a=attendance.filter(x=>x.status==='غائب').length;
  const e=attendance.filter(x=>x.status==='اعتذر').length;
  const relevant=p+a;
  const notes=getStudentNotes(student.id);
  const visible=notes.filter(x=>x.visibleToStudent===true).length;
  notesTotal+=notes.length;visibleTotal+=visible;
  return `<tr><td>${esc(student.fullName||student.name||'-')}</td>${numericCell(p)}${numericCell(a)}${numericCell(e)}${numericCell(percent(p,relevant)+'%')}${numericCell(notes.length)}${numericCell(visible)}</tr>`;
 }).join('');
 const summary=reportStats([{label:'إجمالي الطلاب',value:`${state.students.length}`},{label:'إجمالي الحصص',value:`${state.attendance.length}`},{label:'عدد مرات الحضور',value:`${present}`},{label:'عدد الغياب',value:`${absent}`},{label:'نسبة الحضور',value:`${attendanceRate}%`},{label:'إجمالي الملاحظات',value:`${state.notes.length}`}]);
 return reportHeader('تقرير متابعة الطلاب والحضور','ملخص شامل لجميع طلاب المعلم المرتبطين بحسابه')+summary
 +`<section class="print-section"><h2>01 <span>تفاصيل متابعة الطلاب</span></h2><table class="print-table"><thead><tr><th>اسم الطالب</th><th>حاضر</th><th>غائب</th><th>اعتذار</th><th>نسبة الحضور</th><th>الملاحظات</th><th>الظاهرة للطالب</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th>الإجمالي (${state.students.length} طلاب)</th><th class="print-num">${present}</th><th class="print-num">${absent}</th><th class="print-num">${excused}</th><th class="print-num">${attendanceRate}%</th><th class="print-num">${notesTotal}</th><th class="print-num">${visibleTotal}</th></tr></tfoot></table></section>`
 +`<p class="print-disclaimer">نسبة الحضور محسوبة من سجلات الحضور والغياب، ولا تدخل الاعتذارات ضمن مقام النسبة. الملاحظات غير المنسوبة إلى طالب لا تدخل ضمن إجمالي تفاصيل الطلاب.</p>`
 +reportFooter('تقرير للمتابعة والقراءة فقط — لا يتيح تعديل الحضور أو الملاحظات');
}
function printReport(){
 if(state.failedSources.has('الحضور والمدفوعات')||state.failedSources.has('الحجوزات')||state.failedSources.has('الملاحظات')){
  alert('تعذر تحميل بعض بيانات التقرير. لا يمكن طباعة تقرير غير مكتمل.');return;
 }
 if(!state.students.length){alert('لا يوجد طلاب مرتبطون بهذا المعلم للطباعة.');return;}
 printTeacherContent(reportsDocument());
}
// لا نمسح التقرير فور إغلاق نافذة الطباعة: تظل المعاينة متاحة لإعادة المحاولة.
window.addEventListener('keydown',event=>{
 if(event.key==='Escape' && document.body.classList.contains('teacher-print-preview'))closeTeacherPrint();
});

// Export robustly: attach the anchor to DOM and keep a manual fallback link.
// No financial data is written to Firebase, and the CSV contains only currently loaded records.
const exportUrls = new Map();
function csvSafe(value){
 const v=String(value??'');
 // Escape spreadsheet formula prefixes (including whitespace + =,+,-,@).
 const sanitized=/^[\s\u0000-\u001f]*[=+\-@]/.test(v)?"'"+v:v;
 return '"'+sanitized.replace(/"/g,'""')+'"';
}
function exportCsv(rows,fileName,statusId){
 const feedback=$(statusId);
 if(feedback)feedback.replaceChildren();
 try{
  const csv='\uFEFF'+rows.map(r=>r.map(csvSafe).join(',')).join('\r\n')+'\r\n';
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const previous=exportUrls.get(statusId);
  if(previous)URL.revokeObjectURL(previous);
  const url=URL.createObjectURL(blob); exportUrls.set(statusId,url);
  const link=document.createElement('a');link.href=url;link.download=fileName;
  link.textContent='اضغط هنا لتحميل ملف CSV يدويًا';
  if(feedback){
   feedback.append('✅ تم تجهيز الملف ('+(rows.length-1)+' سطرًا). إذا لم يبدأ التحميل تلقائيًا: ');
   feedback.append(link);
  }else{document.body.appendChild(link);}
  link.click();
  if(!feedback)link.remove();
  // Keep blob URL live for the manual fallback link until a new export / page close.
 }catch(error){
  console.error('[teacher-export]',error);
  if(feedback)feedback.textContent='❌ تعذر تجهيز CSV: '+(error.message||error);
  else alert('تعذر تجهيز ملف CSV');
 }
}
function exportPayments(){
 if(state.failedSources.has('الحضور والمدفوعات')){alert('بيانات المدفوعات لم تُحمّل بالكامل، لذلك لا يمكن تصدير تقرير مالي.');return;}
 const entries=filteredPaymentRows();
 if(!entries.length){alert('لا توجد حصص مطابقة للفلاتر الحالية للتصدير.');return;}
 const rows=[['التاريخ','الطالب','المادة','الحالة','قيمة الحصة (جنيه)','مدفوع مباشر (جنيه)','إجمالي المحصل (جنيه)','المتبقي (جنيه)']];
 for(const x of entries){const f=financeValue(x);rows.push([x.date,studentName(x.studentUid,x.studentName),x.subject,x.status,f.due/100,f.cash/100,f.total/100,f.remaining/100]);}
 const sums=paymentSummary(entries);
 rows.push(['الإجمالي','', '', '',sums.due/100,sums.cash/100,(sums.cash+sums.credit)/100,sums.remaining/100]);
 exportCsv(rows,'zad-teacher-payments-'+new Date().toISOString().slice(0,10)+'.csv','teacherPaymentsExportStatus');
}

function renderNotifications(){
  const list=$('teacherNotificationsList');if(!list)return;
  list.innerHTML=state.notifications.length?state.notifications.map(n=>{
    const unread=!(Array.isArray(n.readBy)&&n.readBy.includes(state.user.uid));
    return `<article class="teacher-notification ${unread?'unread':''}" data-notification-id="${esc(n.id)}"><div><strong>${esc(n.title||'تنبيه')}</strong><p>${esc(n.message||'')}</p><small>${formatDate(n.createdAt,true)}</small></div>${unread?'<button class="btn compact-btn" data-notification-read>تمت القراءة</button>':''}</article>`;
  }).join(''):'<div class="teacher-empty">لا توجد تنبيهات.</div>';
  list.querySelectorAll('[data-notification-id]').forEach(card=>card.querySelector('[data-notification-read]')?.addEventListener('click',()=>markNotificationRead(card.dataset.notificationId)));
}
async function markNotificationRead(id){
  if(state.preview)return;
  await updateDoc(doc(db,'notifications',id),{readBy:arrayUnion(state.user.uid)});
  const n=state.notifications.find(x=>x.id===id);if(n)n.readBy=[...(n.readBy||[]),state.user.uid];renderAll();
}
async function markAllNotifications(){
  const unread=state.notifications.filter(n=>!(Array.isArray(n.readBy)&&n.readBy.includes(state.user.uid)));
  await Promise.all(unread.map(n=>updateDoc(doc(db,'notifications',n.id),{readBy:arrayUnion(state.user.uid)})));
  unread.forEach(n=>n.readBy=[...(n.readBy||[]),state.user.uid]);renderAll();
}

function renderProfile(){
  const p=state.profile||{};
  if($('profileName'))$('profileName').value=p.fullName||p.name||'';
  if($('profilePhone'))$('profilePhone').value=p.phone||p.phoneNumber||'';
  if($('profileWhatsapp'))$('profileWhatsapp').value=p.whatsapp||p.phone||'';
  if($('profileSubject'))$('profileSubject').value=p.subject||'';
  if($('profileCountry'))$('profileCountry').value=p.country||'';
  if($('profileCity'))$('profileCity').value=p.city||'';
  if($('profileBio'))$('profileBio').value=p.bio||'';
  if($('profileGrades'))$('profileGrades').value=Array.isArray(p.teachingGrades)?p.teachingGrades.join('، '):text(p.teachingGrades);
  if($('profileDays'))$('profileDays').value=Array.isArray(p.availableDays)?p.availableDays.join('، '):text(p.availableDays);
  if($('profilePeriods'))$('profilePeriods').value=Array.isArray(p.availablePeriods)?p.availablePeriods.join('، '):text(p.availablePeriods);
  if($('profileModes'))$('profileModes').value=Array.isArray(p.lessonModes)?p.lessonModes.join('، '):text(p.lessonModes);
}
function csvList(value){return text(value).split(/[،,]/).map(x=>x.trim()).filter(Boolean);}
function renderContact(){
  if(!$('teacherContactStudents'))return;
  $('teacherContactStudents').innerHTML=state.students.length?state.students.map(s=>{
    const phone=s.phone||s.phoneNumber||'',digits=phoneDigits(phone);
    return `<div class="teacher-contact-card"><div class="teacher-avatar">${esc((s.fullName||s.name||'ط').trim().charAt(0)||'ط')}</div><div><strong>${esc(s.fullName||s.name||'-')}</strong><span>${esc(s.grade||s.studyGrade||'-')}</span></div>${digits?`<a class="btn gold compact-btn" target="_blank" rel="noopener" href="https://wa.me/${digits}">واتساب</a>`:'<span class="teacher-muted">لا يوجد رقم</span>'}</div>`;
  }).join(''):'<div class="teacher-empty">لا يوجد طلاب مرتبطون بك.</div>';
}
function renderAll(){renderOverview();renderStudents();renderAttendance();renderNotes();renderReports();renderNotifications();renderContact();renderPayments();showIssues();}

function bindForms(){
  $('studentSearch')?.addEventListener('input',renderStudents);
  $('attendanceFilterStudent')?.addEventListener('change',renderAttendance);
  $('notesFilterStudent')?.addEventListener('change',renderNotes);
  $('teacherPaymentsStudent')?.addEventListener('change',renderPayments);
  $('teacherPaymentsFrom')?.addEventListener('change',renderPayments);
  $('teacherPaymentsTo')?.addEventListener('change',renderPayments);
  $('printTeacherPayments')?.addEventListener('click',printPayments);
  $('exportTeacherPayments')?.addEventListener('click',exportPayments);
  $('refreshTeacherData')?.addEventListener('click',()=>location.reload());
  $('closeStudentDetails')?.addEventListener('click',closeStudentModal);
  $('studentDetailsModal')?.addEventListener('click',e=>{if(e.target.id==='studentDetailsModal')closeStudentModal();});
  $('logout')?.addEventListener('click',()=>signOut(auth).then(()=>location.replace('../../login/index.html')));
  $('markAllTeacherNotifications')?.addEventListener('click',()=>{if(!state.preview)markAllNotifications();});

  $('teacherProfileForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(state.preview){setStatus('profileFormStatus','المعاينة الإدارية للقراءة فقط.',false);return;}
    try{
      const updates={fullName:text($('profileName').value),phone:text($('profilePhone').value),whatsapp:text($('profileWhatsapp').value),subject:text($('profileSubject').value),country:text($('profileCountry').value),city:text($('profileCity').value),bio:text($('profileBio').value),teachingGrades:csvList($('profileGrades').value),availableDays:csvList($('profileDays').value),availablePeriods:csvList($('profilePeriods').value),lessonModes:csvList($('profileModes').value),updatedAt:serverTimestamp()};
      await updateDoc(doc(db,'users',state.user.uid),updates);state.profile={...state.profile,...updates};
      document.querySelector('[data-name]').textContent=updates.fullName||state.user.email;setStatus('profileFormStatus','تم حفظ بياناتك بنجاح.');
    }catch(err){console.error(err);setStatus('profileFormStatus','تعذر حفظ البيانات: '+(err.code||err.message),false);}
  });
  $('printTeacherReport')?.addEventListener('click',printReport);
  $('exportTeacherReport')?.addEventListener('click',exportReportCsv);
}
function exportReportCsv(){
 if(state.failedSources.has('الحضور والمدفوعات')||state.failedSources.has('الملاحظات')||state.failedSources.has('الحجوزات')){
  alert('تعذر تحميل جميع مصادر التقرير. لا يمكن تصدير ملف ناقص.');return;
 }
 if(!state.students.length){alert('لا يوجد طلاب لتصدير تقريرهم.');return;}
 const rows=[['الطالب','حاضر','غائب/اعتذر','نسبة الحضور','الملاحظات','الظاهرة للطالب']];
 let pTotal=0,aTotal=0,notesTotal=0,visibleTotal=0;
 state.students.forEach(s=>{
  const att=getStudentAttendance(s.id),p=att.filter(x=>x.status==='حاضر').length,a=att.filter(x=>x.status==='غائب'||x.status==='اعتذر').length,relevant=att.filter(x=>x.status==='حاضر'||x.status==='غائب').length,notes=getStudentNotes(s.id),v=notes.filter(x=>x.visibleToStudent===true).length;
  pTotal+=p;aTotal+=a;notesTotal+=notes.length;visibleTotal+=v;
  rows.push([s.fullName||s.name||'',p,a,percent(p,relevant)+'%',notes.length,v]);
 });
 const relevant=state.attendance.filter(x=>x.status==='حاضر'||x.status==='غائب').length;
 rows.push(['الإجمالي',pTotal,aTotal,percent(pTotal,relevant)+'%',notesTotal,visibleTotal]);
 exportCsv(rows,'zad-teacher-attendance-'+new Date().toISOString().slice(0,10)+'.csv','teacherReportExportStatus');
}
async function boot(user){
  const preview=await getPreviewContext(user,'teacher');
  if(preview.denied){location.replace('../../dashboard/admin/index.html');return;}
  const admin=await isAdminAccount(user);
  const effectiveUid=preview.active?preview.uid:user.uid;
  const me=preview.active ? null : await getDoc(doc(db,'users',user.uid));
  const p=preview.active?preview.profile:(me.exists()?me.data():{});
  if(!preview.active && (p.role!=='teacher'||p.status!=='active')){
    location.replace(admin?'../../dashboard/admin/index.html':'../../dashboard/student/index.html');return;
  }
  state.user=preview.active?{...user,uid:effectiveUid}:user;
  state.profile=p;
  state.preview=preview.active;
  document.querySelector('[data-name]').textContent=p.fullName||p.name||user.email;
  document.querySelector('[data-email]').textContent=preview.active?(p.email||''): (user.email||p.email||'');
  setToday();initTabs();bindForms();
  if($('attendanceDate'))$('attendanceDate').value=new Date().toISOString().slice(0,10);
  // Each independent query reports errors instead of turning permission failures into silent zeroes.
  await Promise.all([loadTeacherStudents(effectiveUid),loadAttendance(effectiveUid),loadNotes(effectiveUid),loadTeacherNotifications(effectiveUid)]);
  finalizeStudents();fillStudentSelects();
  if(preview.active){
    if($('markAllTeacherNotifications'))$('markAllTeacherNotifications').disabled=true;
    $('teacherProfileForm')?.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);
  }
  renderProfile();renderAll();$('loading')?.remove();
}
onAuthStateChanged(auth,user=>{if(!user){location.replace('../../login/index.html');return;}boot(user).catch(err=>{console.error(err);if($('loading'))$('loading').textContent='تعذر تحميل لوحة المعلم: '+(err.code||err.message);});});
