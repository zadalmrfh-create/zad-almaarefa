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
const state = {
  user: null,
  profile: {},
  students: [],
  studentMap: new Map(),
  attendance: [],
  notes: [],
  notifications: []
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
  const bookingsSnap=await getDocs(query(collection(db,'bookings'),where('teacherUid','==',uid)));
  const ids=[...new Set(bookingsSnap.docs.map(d=>d.data().studentUid).filter(Boolean))];
  const students=[];
  for(const id of ids){
    try{ const snap=await getDoc(doc(db,'users',id)); if(snap.exists()) students.push({id:snap.id,...snap.data()}); }
    catch(err){ console.warn('تعذر تحميل الطالب',id,err); }
  }
  students.sort((a,b)=>text(a.fullName||a.name).localeCompare(text(b.fullName||b.name),'ar'));
  state.students=students;
  state.studentMap=new Map(students.map(s=>[s.id,s]));
}
async function loadAttendance(uid){
  try{
    const snap=await getDocs(query(collection(db,'lessonAttendance'),where('teacherUid','==',uid)));
    state.attendance=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt||b.date)-dateKey(a.createdAt||a.date));
  }catch(err){console.warn('تعذر تحميل الحضور',err);state.attendance=[];}
}
async function loadNotes(uid){
  try{
    const snap=await getDocs(query(collection(db,'teacherStudentNotes'),where('teacherUid','==',uid)));
    state.notes=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt));
  }catch(err){console.warn('تعذر تحميل الملاحظات',err);state.notes=[];}
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
  }catch(err){console.warn('تعذر تحميل التنبيهات',err);state.notifications=[];}
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
  if($('teacherStudentsCount'))$('teacherStudentsCount').textContent=state.students.length;
  if($('teacherAttendanceCount'))$('teacherAttendanceCount').textContent=state.attendance.length;
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
  const filtered=state.students.filter(s=>[s.fullName,s.name,s.email,s.phone,s.phoneNumber,s.grade,s.studyGrade].some(v=>text(v).toLowerCase().includes(q)));
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
    <div class="teacher-row-actions" style="margin-top:14px">${phoneDigits(phone)?`<a class="btn gold" target="_blank" rel="noopener" href="https://wa.me/${phoneDigits(phone)}">💬 واتساب الطالب</a>`:''}<button class="btn" data-open-attendance>✅ تسجيل حضور</button><button class="btn" data-open-note>🗒️ إضافة ملاحظة</button></div>`;
  $('studentDetailsBody')?.querySelector('[data-open-attendance]')?.addEventListener('click',()=>{closeStudentModal();openTab('attendance');if($('attendanceStudent'))$('attendanceStudent').value=uid;});
  $('studentDetailsBody')?.querySelector('[data-open-note]')?.addEventListener('click',()=>{closeStudentModal();openTab('notes');if($('noteStudent'))$('noteStudent').value=uid;});
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
  $('attendanceRows').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(studentName(x.studentUid,x.studentName))}</td><td>${esc(x.date||formatDate(x.createdAt))}</td><td>${esc(x.subject||'-')}</td><td><span class="teacher-status ${x.status==='حاضر'?'present':x.status==='غائب'?'absent':'excused'}">${esc(x.status||'-')}</span></td><td>${esc(x.note||'-')}</td><td><button class="btn danger compact-btn" data-attendance-delete="${esc(x.id)}">حذف</button></td></tr>`).join(''):'<tr><td colspan="6">لا توجد سجلات.</td></tr>';
  $('attendanceRows').querySelectorAll('[data-attendance-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteAttendance(btn.dataset.attendanceDelete)));
}
async function deleteAttendance(id){
  if(!confirm('حذف سجل الحضور؟'))return;
  await deleteDoc(doc(db,'lessonAttendance',id));
  state.attendance=state.attendance.filter(x=>x.id!==id);renderAll();
}

function renderNotes(){
  const filter=$('notesFilterStudent')?.value||'';
  const notes=state.notes.filter(x=>!filter||x.studentUid===filter);
  if(!$('notesList'))return;
  $('notesList').innerHTML=notes.length?notes.map(n=>`<article class="teacher-note-card"><div><span class="teacher-note-category">${esc(n.category||'عام')}</span><strong>${esc(studentName(n.studentUid,n.studentName))}</strong> <span class="teacher-note-category">${n.visibleToStudent===true?'👁️ تظهر للطالب':'🔒 خاصة'}</span><p>${esc(n.text||'')}</p><small>${formatDate(n.createdAt,true)}</small></div><button class="btn danger compact-btn" data-note-delete="${esc(n.id)}">حذف</button></article>`).join(''):'<div class="teacher-empty">لا توجد ملاحظات.</div>';
  $('notesList').querySelectorAll('[data-note-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteNote(btn.dataset.noteDelete)));
}
async function deleteNote(id){
  if(!confirm('حذف الملاحظة؟'))return;
  await deleteDoc(doc(db,'teacherStudentNotes',id));state.notes=state.notes.filter(x=>x.id!==id);renderAll();
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

function renderNotifications(){
  const list=$('teacherNotificationsList');if(!list)return;
  list.innerHTML=state.notifications.length?state.notifications.map(n=>{
    const unread=!(Array.isArray(n.readBy)&&n.readBy.includes(state.user.uid));
    return `<article class="teacher-notification ${unread?'unread':''}" data-notification-id="${esc(n.id)}"><div><strong>${esc(n.title||'تنبيه')}</strong><p>${esc(n.message||'')}</p><small>${formatDate(n.createdAt,true)}</small></div>${unread?'<button class="btn compact-btn" data-notification-read>تمت القراءة</button>':''}</article>`;
  }).join(''):'<div class="teacher-empty">لا توجد تنبيهات.</div>';
  list.querySelectorAll('[data-notification-id]').forEach(card=>card.querySelector('[data-notification-read]')?.addEventListener('click',()=>markNotificationRead(card.dataset.notificationId)));
}
async function markNotificationRead(id){
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
function renderAll(){renderOverview();renderStudents();renderAttendance();renderNotes();renderReports();renderNotifications();renderContact();}

function bindForms(){
  $('studentSearch')?.addEventListener('input',renderStudents);
  $('attendanceFilterStudent')?.addEventListener('change',renderAttendance);
  $('notesFilterStudent')?.addEventListener('change',renderNotes);
  $('closeStudentDetails')?.addEventListener('click',closeStudentModal);
  $('studentDetailsModal')?.addEventListener('click',e=>{if(e.target.id==='studentDetailsModal')closeStudentModal();});
  $('logout')?.addEventListener('click',()=>signOut(auth).then(()=>location.replace('../../login/index.html')));
  $('markAllTeacherNotifications')?.addEventListener('click',markAllNotifications);

  $('attendanceForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const studentUid=$('attendanceStudent').value,student=state.studentMap.get(studentUid);
    if(!student){setStatus('attendanceFormStatus','اختر طالبًا أولًا.',false);return;}
    try{
      const data={teacherUid:state.user.uid,teacherName:state.profile.fullName||state.profile.name||state.user.email,studentUid,studentName:student.fullName||student.name||student.email,date:$('attendanceDate').value,status:$('attendanceStatus').value,subject:text($('attendanceSubject').value),note:text($('attendanceNote').value),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),source:'teacher-dashboard'};
      const ref=await addDoc(collection(db,'lessonAttendance'),data);
      state.attendance.unshift({id:ref.id,...data,createdAt:new Date()});
      $('attendanceNote').value='';setStatus('attendanceFormStatus','تم حفظ الحضور بنجاح.');renderAll();
    }catch(err){console.error(err);setStatus('attendanceFormStatus','تعذر حفظ الحضور: '+(err.code||err.message),false);}
  });

  $('noteForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const studentUid=$('noteStudent').value,student=state.studentMap.get(studentUid);
    if(!student){setStatus('noteFormStatus','اختر طالبًا أولًا.',false);return;}
    try{
      const data={teacherUid:state.user.uid,teacherName:state.profile.fullName||state.profile.name||state.user.email,studentUid,studentName:student.fullName||student.name||student.email,category:$('noteCategory').value,text:text($('noteText').value),visibleToStudent:Boolean($('noteVisibleToStudent')?.checked),createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      const ref=await addDoc(collection(db,'teacherStudentNotes'),data);
      state.notes.unshift({id:ref.id,...data,createdAt:new Date()});
      $('noteText').value='';if($('noteVisibleToStudent'))$('noteVisibleToStudent').checked=false;
      setStatus('noteFormStatus','تم حفظ الملاحظة.');renderAll();
    }catch(err){console.error(err);setStatus('noteFormStatus','تعذر حفظ الملاحظة: '+(err.code||err.message),false);}
  });

  $('teacherProfileForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    try{
      const updates={fullName:text($('profileName').value),phone:text($('profilePhone').value),whatsapp:text($('profileWhatsapp').value),subject:text($('profileSubject').value),country:text($('profileCountry').value),city:text($('profileCity').value),bio:text($('profileBio').value),teachingGrades:csvList($('profileGrades').value),availableDays:csvList($('profileDays').value),availablePeriods:csvList($('profilePeriods').value),lessonModes:csvList($('profileModes').value),updatedAt:serverTimestamp()};
      await updateDoc(doc(db,'users',state.user.uid),updates);state.profile={...state.profile,...updates};
      document.querySelector('[data-name]').textContent=updates.fullName||state.user.email;setStatus('profileFormStatus','تم حفظ بياناتك بنجاح.');
    }catch(err){console.error(err);setStatus('profileFormStatus','تعذر حفظ البيانات: '+(err.code||err.message),false);}
  });
  $('printTeacherReport')?.addEventListener('click',()=>window.print());
  $('exportTeacherReport')?.addEventListener('click',exportReportCsv);
}
function exportReportCsv(){
  const rows=[['الطالب','حاضر','غائب/اعتذر','نسبة الحضور','الملاحظات','الظاهرة للطالب']];
  state.students.forEach(s=>{
    const att=getStudentAttendance(s.id),p=att.filter(x=>x.status==='حاضر').length,a=att.filter(x=>x.status==='غائب'||x.status==='اعتذر').length,relevant=att.filter(x=>x.status==='حاضر'||x.status==='غائب').length,notes=getStudentNotes(s.id);
    rows.push([s.fullName||s.name||'',p,a,percent(p,relevant)+'%',notes.length,notes.filter(x=>x.visibleToStudent===true).length]);
  });
  const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`teacher-report-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
}

async function boot(user){
  state.user=user;
  const me=await getDoc(doc(db,'users',user.uid));
  const p=me.exists()?me.data():{};
  if(p.role!=='teacher'||p.status!=='active'){location.replace('../../dashboard/student/index.html');return;}
  state.profile=p;
  document.querySelector('[data-name]').textContent=p.fullName||p.name||user.email;
  document.querySelector('[data-email]').textContent=user.email||p.email||'';
  setToday();initTabs();bindForms();
  if($('attendanceDate'))$('attendanceDate').value=new Date().toISOString().slice(0,10);
  await loadTeacherStudents(user.uid);fillStudentSelects();
  await Promise.all([loadAttendance(user.uid),loadNotes(user.uid),loadTeacherNotifications(user.uid)]);
  renderProfile();renderAll();$('loading')?.remove();
}
onAuthStateChanged(auth,user=>{if(!user){location.replace('../../login/index.html');return;}boot(user).catch(err=>{console.error(err);if($('loading'))$('loading').textContent='تعذر تحميل لوحة المعلم: '+(err.code||err.message);});});
