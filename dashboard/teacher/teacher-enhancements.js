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
  homework: [],
  notes: [],
  notifications: []
};

const ADMIN_WHATSAPP = '201515474939';

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
  try{
    return new Intl.DateTimeFormat('ar-EG', withTime ? {dateStyle:'medium',timeStyle:'short'} : {dateStyle:'medium'}).format(d);
  }catch{ return d.toLocaleDateString('ar-EG'); }
}
function dateKey(value){
  const d = toDate(value);
  return d ? d.getTime() : 0;
}
function setStatus(id, message, ok=true){
  const el=$(id); if(!el) return;
  el.textContent=message;
  el.className='teacher-form-status ' + (ok?'ok-text':'error-text');
  if(message) setTimeout(()=>{ if(el.textContent===message) el.textContent=''; },3500);
}
function percent(part,total){ return total ? Math.round((part/total)*100) : 0; }
function studentName(uid, fallback='-'){ return state.studentMap.get(uid)?.fullName || state.studentMap.get(uid)?.name || fallback; }

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
  const bookingsSnap = await getDocs(query(collection(db,'bookings'),where('teacherUid','==',uid)));
  const ids = [...new Set(bookingsSnap.docs.map(d=>d.data().studentUid).filter(Boolean))];
  const students=[];
  for(const id of ids){
    try{
      const snap=await getDoc(doc(db,'users',id));
      if(snap.exists()) students.push({id:snap.id,...snap.data()});
    }catch(err){ console.warn('تعذر تحميل الطالب',id,err); }
  }
  students.sort((a,b)=>text(a.fullName||a.name).localeCompare(text(b.fullName||b.name),'ar'));
  state.students=students;
  state.studentMap=new Map(students.map(s=>[s.id,s]));
}

async function loadAttendance(uid){
  try{
    const snap=await getDocs(query(collection(db,'lessonAttendance'),where('teacherUid','==',uid)));
    state.attendance=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt||b.date)-dateKey(a.createdAt||a.date));
  }catch(err){ console.warn('تعذر تحميل الحضور',err); state.attendance=[]; }
}
async function loadHomework(uid){
  try{
    const snap=await getDocs(query(collection(db,'teacherHomeworks'),where('teacherUid','==',uid)));
    state.homework=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt));
  }catch(err){ console.warn('تعذر تحميل الواجبات',err); state.homework=[]; }
}
async function loadNotes(uid){
  try{
    const snap=await getDocs(query(collection(db,'teacherStudentNotes'),where('teacherUid','==',uid)));
    state.notes=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt));
  }catch(err){ console.warn('تعذر تحميل الملاحظات',err); state.notes=[]; }
}
async function loadTeacherNotifications(uid){
  try{
    const [personalSnap, publicSnap]=await Promise.all([
      getDocs(query(collection(db,'notifications'),where('audience','==','user'),where('targetUid','==',uid))),
      getDocs(query(collection(db,'notifications'),where('audience','==','all')))
    ]);
    const merged=new Map();
    [...personalSnap.docs,...publicSnap.docs].forEach(d=>merged.set(d.id,{id:d.id,...d.data()}));
    state.notifications=[...merged.values()].sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt)).slice(0,40);
  }catch(err){ console.warn('تعذر تحميل التنبيهات',err); state.notifications=[]; }
}

function fillStudentSelects(){
  const options = state.students.length
    ? state.students.map(s=>`<option value="${esc(s.id)}">${esc(s.fullName||s.name||s.email||'طالب')}</option>`).join('')
    : '<option value="">لا يوجد طلاب مرتبطون بك</option>';
  ['attendanceStudent','homeworkStudent','noteStudent'].forEach(id=>{ if($(id)) $(id).innerHTML=options; });
  const filterOptions='<option value="">كل الطلاب</option>'+state.students.map(s=>`<option value="${esc(s.id)}">${esc(s.fullName||s.name||s.email||'طالب')}</option>`).join('');
  ['attendanceFilterStudent','homeworkFilterStudent','notesFilterStudent'].forEach(id=>{ if($(id)) $(id).innerHTML=filterOptions; });
}

function renderOverview(){
  const present=state.attendance.filter(x=>x.status==='حاضر').length;
  const attendanceRelevant=state.attendance.filter(x=>x.status==='حاضر'||x.status==='غائب').length;
  const done=state.homework.filter(x=>x.status==='تم التسليم').length;
  const unread=state.notifications.filter(n=>!(Array.isArray(n.readBy)&&n.readBy.includes(state.user?.uid))).length;
  $('teacherStudentsCount').textContent=state.students.length;
  $('teacherAttendanceCount').textContent=state.attendance.length;
  $('teacherHomeworkCount').textContent=state.homework.length;
  $('teacherUnreadCount').textContent=unread;
  $('teacherNotificationBadge').textContent=unread;
  $('teacherNotificationBadge').style.display=unread?'inline-flex':'none';
  $('overviewAttendanceRate').textContent=percent(present,attendanceRelevant)+'%';
  $('overviewHomeworkRate').textContent=percent(done,state.homework.length)+'%';
  $('overviewNotesCount').textContent=state.notes.length;

  const activities=[
    ...state.attendance.slice(0,5).map(x=>({t:dateKey(x.createdAt||x.date),icon:'✅',title:`${studentName(x.studentUid,x.studentName)} — ${x.status||'حضور'}`,meta:`${x.subject||'بدون مادة'} • ${x.date||formatDate(x.createdAt)}`})),
    ...state.homework.slice(0,5).map(x=>({t:dateKey(x.createdAt),icon:'📝',title:`واجب: ${x.title||'-'}`,meta:`${studentName(x.studentUid,x.studentName)} • ${x.status||'مطلوب'}`})),
    ...state.notes.slice(0,5).map(x=>({t:dateKey(x.createdAt),icon:'🗒️',title:`ملاحظة على ${studentName(x.studentUid,x.studentName)}`,meta:x.category||'عام'}))
  ].sort((a,b)=>b.t-a.t).slice(0,8);
  $('teacherRecentActivity').innerHTML=activities.length?activities.map(a=>`<div class="teacher-activity-item"><span>${a.icon}</span><div><strong>${esc(a.title)}</strong><small>${esc(a.meta)}</small></div></div>`).join(''):'<div class="teacher-empty">لا توجد نشاطات حتى الآن.</div>';
}

function getStudentAttendance(uid){ return state.attendance.filter(x=>x.studentUid===uid); }
function getStudentHomework(uid){ return state.homework.filter(x=>x.studentUid===uid); }
function getStudentNotes(uid){ return state.notes.filter(x=>x.studentUid===uid); }

function renderStudents(){
  const q=text($('studentSearch')?.value).toLowerCase();
  const filtered=state.students.filter(s=>[s.fullName,s.name,s.email,s.phone,s.phoneNumber,s.grade,s.studyGrade].some(v=>text(v).toLowerCase().includes(q)));
  const body=$('teacherStudentsRows');
  if(!body) return;
  if(!filtered.length){body.innerHTML='<tr><td colspan="6">لا يوجد طلاب مطابقون.</td></tr>';return;}
  body.innerHTML=filtered.map(s=>{
    const att=getStudentAttendance(s.id), present=att.filter(x=>x.status==='حاضر').length;
    const hw=getStudentHomework(s.id), done=hw.filter(x=>x.status==='تم التسليم').length;
    const phone=s.phone||s.phoneNumber||'';
    return `<tr>
      <td><strong>${esc(s.fullName||s.name||'-')}</strong><br><small>${esc(s.email||'')}</small></td>
      <td>${esc(s.grade||s.studyGrade||s.className||'-')}</td>
      <td dir="ltr">${esc(phone||'-')}</td>
      <td>${present}/${att.length}</td>
      <td>${done}/${hw.length}</td>
      <td><div class="teacher-row-actions"><button class="btn compact-btn" data-student-view="${esc(s.id)}">👁️ الملف</button>${phoneDigits(phone)?`<a class="btn gold compact-btn" target="_blank" rel="noopener" href="https://wa.me/${phoneDigits(phone)}">واتساب</a>`:''}</div></td>
    </tr>`;
  }).join('');
  body.querySelectorAll('[data-student-view]').forEach(btn=>btn.addEventListener('click',()=>openStudentDetails(btn.dataset.studentView)));
}

function openStudentDetails(uid){
  const s=state.studentMap.get(uid); if(!s) return;
  const att=getStudentAttendance(uid), hw=getStudentHomework(uid), notes=getStudentNotes(uid);
  const present=att.filter(x=>x.status==='حاضر').length;
  const done=hw.filter(x=>x.status==='تم التسليم').length;
  const phone=s.phone||s.phoneNumber||'';
  $('studentDetailsTitle').textContent=`ملف الطالب — ${s.fullName||s.name||'طالب'}`;
  $('studentDetailsBody').innerHTML=`
    <div class="student-detail-grid">
      <div><span>الاسم</span><strong>${esc(s.fullName||s.name||'-')}</strong></div>
      <div><span>الإيميل</span><strong>${esc(s.email||'-')}</strong></div>
      <div><span>الهاتف</span><strong dir="ltr">${esc(phone||'-')}</strong></div>
      <div><span>الصف</span><strong>${esc(s.grade||s.studyGrade||s.className||'-')}</strong></div>
      <div><span>البلد</span><strong>${esc(s.country||'-')}</strong></div>
      <div><span>المدينة</span><strong>${esc(s.city||'-')}</strong></div>
    </div>
    <div class="profile-mini-grid">
      <div class="profile-mini"><b>${present}/${att.length}</b><span>الحضور</span></div>
      <div class="profile-mini"><b>${done}/${hw.length}</b><span>الواجبات</span></div>
      <div class="profile-mini"><b>${notes.length}</b><span>الملاحظات</span></div>
      <div class="profile-mini"><b>${percent(present,att.filter(x=>x.status==='حاضر'||x.status==='غائب').length)}%</b><span>نسبة الحضور</span></div>
    </div>
    <div class="teacher-row-actions">${phoneDigits(phone)?`<a class="btn gold" target="_blank" rel="noopener" href="https://wa.me/${phoneDigits(phone)}">💬 واتساب الطالب</a>`:''}<button class="btn" data-open-attendance>✅ تسجيل حضور</button><button class="btn" data-open-homework>📝 إضافة واجب</button><button class="btn" data-open-note>🗒️ إضافة ملاحظة</button></div>`;
  $('studentDetailsModal').classList.add('show');
  $('studentDetailsModal').setAttribute('aria-hidden','false');
  $('studentDetailsBody').querySelector('[data-open-attendance]')?.addEventListener('click',()=>{closeStudentModal();openTab('attendance');$('attendanceStudent').value=uid;});
  $('studentDetailsBody').querySelector('[data-open-homework]')?.addEventListener('click',()=>{closeStudentModal();openTab('homework');$('homeworkStudent').value=uid;});
  $('studentDetailsBody').querySelector('[data-open-note]')?.addEventListener('click',()=>{closeStudentModal();openTab('notes');$('noteStudent').value=uid;});
}
function closeStudentModal(){ $('studentDetailsModal').classList.remove('show'); $('studentDetailsModal').setAttribute('aria-hidden','true'); }

function renderAttendance(){
  const filter=$('attendanceFilterStudent')?.value||'';
  const rows=state.attendance.filter(x=>!filter||x.studentUid===filter);
  $('attendancePresent').textContent=state.attendance.filter(x=>x.status==='حاضر').length;
  $('attendanceAbsent').textContent=state.attendance.filter(x=>x.status==='غائب').length;
  $('attendanceExcused').textContent=state.attendance.filter(x=>x.status==='اعتذر').length;
  const relevant=state.attendance.filter(x=>x.status==='حاضر'||x.status==='غائب');
  $('attendanceRate').textContent=percent(relevant.filter(x=>x.status==='حاضر').length,relevant.length)+'%';
  $('attendanceRows').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(studentName(x.studentUid,x.studentName))}</td><td>${esc(x.date||formatDate(x.createdAt))}</td><td>${esc(x.subject||'-')}</td><td><span class="teacher-status ${x.status==='حاضر'?'present':x.status==='غائب'?'absent':'excused'}">${esc(x.status||'-')}</span></td><td>${esc(x.note||'-')}</td><td><button class="btn danger compact-btn" data-attendance-delete="${esc(x.id)}">حذف</button></td></tr>`).join(''):'<tr><td colspan="6">لا توجد سجلات.</td></tr>';
  $('attendanceRows').querySelectorAll('[data-attendance-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteAttendance(btn.dataset.attendanceDelete)));
}
async function deleteAttendance(id){
  if(!confirm('حذف سجل الحضور؟'))return;
  await deleteDoc(doc(db,'lessonAttendance',id));
  state.attendance=state.attendance.filter(x=>x.id!==id); renderAll();
}

function renderHomework(){
  const filter=$('homeworkFilterStudent')?.value||'';
  const rows=state.homework.filter(x=>!filter||x.studentUid===filter);
  $('homeworkTotal').textContent=state.homework.length;
  $('homeworkPending').textContent=state.homework.filter(x=>(x.status||'مطلوب')==='مطلوب').length;
  $('homeworkDone').textContent=state.homework.filter(x=>x.status==='تم التسليم').length;
  $('homeworkMissing').textContent=state.homework.filter(x=>x.status==='لم يُسلّم').length;
  $('homeworkRows').innerHTML=rows.length?rows.map(x=>`<tr>
    <td>${esc(studentName(x.studentUid,x.studentName))}</td>
    <td><strong>${esc(x.title||'-')}</strong><br><small>${esc(x.description||'')}</small></td>
    <td>${esc(x.dueDate||'-')}</td>
    <td><select class="teacher-input compact-select" data-homework-status="${esc(x.id)}"><option ${x.status==='مطلوب'||!x.status?'selected':''}>مطلوب</option><option ${x.status==='تم التسليم'?'selected':''}>تم التسليم</option><option ${x.status==='لم يُسلّم'?'selected':''}>لم يُسلّم</option></select></td>
    <td><input class="teacher-input homework-eval" data-homework-eval="${esc(x.id)}" value="${esc(x.evaluation||'')}" placeholder="تقييم أو ملاحظة"></td>
    <td><div class="teacher-row-actions"><button class="btn gold compact-btn" data-homework-save="${esc(x.id)}">حفظ</button><button class="btn danger compact-btn" data-homework-delete="${esc(x.id)}">حذف</button></div></td>
  </tr>`).join(''):'<tr><td colspan="6">لا توجد واجبات.</td></tr>';
  $('homeworkRows').querySelectorAll('[data-homework-save]').forEach(btn=>btn.addEventListener('click',()=>saveHomeworkRow(btn.dataset.homeworkSave)));
  $('homeworkRows').querySelectorAll('[data-homework-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteHomework(btn.dataset.homeworkDelete)));
}
async function saveHomeworkRow(id){
  const status=document.querySelector(`[data-homework-status="${CSS.escape(id)}"]`)?.value||'مطلوب';
  const evaluation=document.querySelector(`[data-homework-eval="${CSS.escape(id)}"]`)?.value||'';
  await updateDoc(doc(db,'teacherHomeworks',id),{status,evaluation,updatedAt:serverTimestamp()});
  const item=state.homework.find(x=>x.id===id); if(item){item.status=status;item.evaluation=evaluation;}
  renderAll();
}
async function deleteHomework(id){
  if(!confirm('حذف الواجب؟'))return;
  await deleteDoc(doc(db,'teacherHomeworks',id)); state.homework=state.homework.filter(x=>x.id!==id); renderAll();
}

function renderNotes(){
  const filter=$('notesFilterStudent')?.value||'';
  const notes=state.notes.filter(x=>!filter||x.studentUid===filter);
  $('notesList').innerHTML=notes.length?notes.map(n=>`<article class="teacher-note-card"><div><span class="teacher-note-category">${esc(n.category||'عام')}</span><strong>${esc(studentName(n.studentUid,n.studentName))}</strong><p>${esc(n.text||'')}</p><small>${formatDate(n.createdAt,true)}</small></div><button class="btn danger compact-btn" data-note-delete="${esc(n.id)}">حذف</button></article>`).join(''):'<div class="teacher-empty">لا توجد ملاحظات.</div>';
  $('notesList').querySelectorAll('[data-note-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteNote(btn.dataset.noteDelete)));
}
async function deleteNote(id){
  if(!confirm('حذف الملاحظة؟'))return;
  await deleteDoc(doc(db,'teacherStudentNotes',id)); state.notes=state.notes.filter(x=>x.id!==id); renderAll();
}

function renderReports(){
  const present=state.attendance.filter(x=>x.status==='حاضر').length;
  const relevant=state.attendance.filter(x=>x.status==='حاضر'||x.status==='غائب').length;
  const done=state.homework.filter(x=>x.status==='تم التسليم').length;
  $('reportStudents').textContent=state.students.length;
  $('reportAttendanceRate').textContent=percent(present,relevant)+'%';
  $('reportHomeworkRate').textContent=percent(done,state.homework.length)+'%';
  $('reportNotes').textContent=state.notes.length;
  $('teacherReportRows').innerHTML=state.students.length?state.students.map(s=>{
    const att=getStudentAttendance(s.id), hws=getStudentHomework(s.id), notes=getStudentNotes(s.id);
    return `<tr><td>${esc(s.fullName||s.name||'-')}</td><td>${att.filter(x=>x.status==='حاضر').length}</td><td>${att.filter(x=>x.status==='غائب'||x.status==='اعتذر').length}</td><td>${hws.length}</td><td>${hws.filter(x=>x.status==='تم التسليم').length}</td><td>${notes.length}</td></tr>`;
  }).join(''):'<tr><td colspan="6">لا توجد بيانات.</td></tr>';
}

function renderNotifications(){
  const uid=state.user?.uid;
  const unread=state.notifications.filter(n=>!(Array.isArray(n.readBy)&&n.readBy.includes(uid))).length;
  $('teacherNotificationBadge').textContent=unread;
  $('teacherUnreadCount').textContent=unread;
  $('teacherNotificationsList').innerHTML=state.notifications.length?state.notifications.map(n=>{
    const isUnread=!(Array.isArray(n.readBy)&&n.readBy.includes(uid));
    return `<article class="teacher-notification ${isUnread?'unread':''}" data-notification-id="${esc(n.id)}"><div><strong>${esc(n.title||'تنبيه')}</strong><p>${esc(n.message||'')}</p><small>${formatDate(n.createdAt,true)}</small></div>${isUnread?'<button class="btn compact-btn" data-notification-read>تمت القراءة</button>':''}</article>`;
  }).join(''):'<div class="teacher-empty">لا توجد تنبيهات.</div>';
  $('teacherNotificationsList').querySelectorAll('[data-notification-id]').forEach(card=>{
    card.querySelector('[data-notification-read]')?.addEventListener('click',()=>markNotificationRead(card.dataset.notificationId));
  });
}
async function markNotificationRead(id){
  await updateDoc(doc(db,'notifications',id),{readBy:arrayUnion(state.user.uid)});
  const n=state.notifications.find(x=>x.id===id); if(n){n.readBy=[...(n.readBy||[]),state.user.uid];}
  renderAll();
}
async function markAllNotifications(){
  const unread=state.notifications.filter(n=>!(Array.isArray(n.readBy)&&n.readBy.includes(state.user.uid)));
  await Promise.all(unread.map(n=>updateDoc(doc(db,'notifications',n.id),{readBy:arrayUnion(state.user.uid)})));
  unread.forEach(n=>n.readBy=[...(n.readBy||[]),state.user.uid]); renderAll();
}

function renderProfile(){
  const p=state.profile||{};
  $('profileName').value=p.fullName||p.name||'';
  $('profilePhone').value=p.phone||p.phoneNumber||'';
  $('profileWhatsapp').value=p.whatsapp||p.phone||'';
  $('profileSubject').value=p.subject||'';
  $('profileCountry').value=p.country||'';
  $('profileCity').value=p.city||'';
  $('profileBio').value=p.bio||'';
  $('profileGrades').value=Array.isArray(p.teachingGrades)?p.teachingGrades.join('، '):text(p.teachingGrades);
  $('profileDays').value=Array.isArray(p.availableDays)?p.availableDays.join('، '):text(p.availableDays);
  $('profilePeriods').value=Array.isArray(p.availablePeriods)?p.availablePeriods.join('، '):text(p.availablePeriods);
  $('profileModes').value=Array.isArray(p.lessonModes)?p.lessonModes.join('، '):text(p.lessonModes);
}
function csvList(value){ return text(value).split(/[،,]/).map(x=>x.trim()).filter(Boolean); }

function renderContact(){
  $('teacherContactStudents').innerHTML=state.students.length?state.students.map(s=>{
    const phone=s.phone||s.phoneNumber||''; const digits=phoneDigits(phone);
    return `<div class="teacher-contact-card"><div class="teacher-avatar">${esc((s.fullName||s.name||'ط').trim().charAt(0)||'ط')}</div><div><strong>${esc(s.fullName||s.name||'-')}</strong><span>${esc(s.grade||s.studyGrade||'-')}</span></div>${digits?`<a class="btn gold compact-btn" target="_blank" rel="noopener" href="https://wa.me/${digits}">واتساب</a>`:'<span class="teacher-muted">لا يوجد رقم</span>'}</div>`;
  }).join(''):'<div class="teacher-empty">لا يوجد طلاب مرتبطون بك.</div>';
}

function renderAll(){
  renderOverview(); renderStudents(); renderAttendance(); renderHomework(); renderNotes(); renderReports(); renderNotifications(); renderContact();
}

function bindForms(){
  $('studentSearch')?.addEventListener('input',renderStudents);
  $('attendanceFilterStudent')?.addEventListener('change',renderAttendance);
  $('homeworkFilterStudent')?.addEventListener('change',renderHomework);
  $('notesFilterStudent')?.addEventListener('change',renderNotes);
  $('closeStudentDetails')?.addEventListener('click',closeStudentModal);
  $('studentDetailsModal')?.addEventListener('click',e=>{if(e.target.id==='studentDetailsModal')closeStudentModal();});
  $('logout')?.addEventListener('click',()=>signOut(auth).then(()=>location.replace('../../login/index.html')));
  $('markAllTeacherNotifications')?.addEventListener('click',markAllNotifications);

  $('attendanceForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const studentUid=$('attendanceStudent').value; const student=state.studentMap.get(studentUid);
    if(!student){setStatus('attendanceFormStatus','اختر طالبًا أولًا.',false);return;}
    try{
      const ref=await addDoc(collection(db,'lessonAttendance'),{
        teacherUid:state.user.uid, teacherName:state.profile.fullName||state.profile.name||state.user.email,
        studentUid, studentName:student.fullName||student.name||student.email,
        date:$('attendanceDate').value, status:$('attendanceStatus').value,
        subject:text($('attendanceSubject').value), note:text($('attendanceNote').value),
        createdAt:serverTimestamp(), updatedAt:serverTimestamp(), source:'teacher-dashboard'
      });
      state.attendance.unshift({id:ref.id,teacherUid:state.user.uid,studentUid,studentName:student.fullName||student.name,date:$('attendanceDate').value,status:$('attendanceStatus').value,subject:text($('attendanceSubject').value),note:text($('attendanceNote').value),createdAt:new Date()});
      $('attendanceNote').value=''; setStatus('attendanceFormStatus','تم حفظ الحضور بنجاح.'); renderAll();
    }catch(err){console.error(err);setStatus('attendanceFormStatus','تعذر حفظ الحضور: '+(err.code||err.message),false);}
  });

  $('homeworkForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const studentUid=$('homeworkStudent').value; const student=state.studentMap.get(studentUid);
    if(!student){setStatus('homeworkFormStatus','اختر طالبًا أولًا.',false);return;}
    try{
      const data={teacherUid:state.user.uid,teacherName:state.profile.fullName||state.profile.name||state.user.email,studentUid,studentName:student.fullName||student.name||student.email,title:text($('homeworkTitle').value),description:text($('homeworkDescription').value),dueDate:$('homeworkDueDate').value||'',status:'مطلوب',evaluation:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      const ref=await addDoc(collection(db,'teacherHomeworks'),data);
      state.homework.unshift({id:ref.id,...data,createdAt:new Date()});
      $('homeworkTitle').value='';$('homeworkDescription').value=''; setStatus('homeworkFormStatus','تمت إضافة الواجب بنجاح.'); renderAll();
    }catch(err){console.error(err);setStatus('homeworkFormStatus','تعذر إضافة الواجب: '+(err.code||err.message),false);}
  });

  $('noteForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const studentUid=$('noteStudent').value; const student=state.studentMap.get(studentUid);
    if(!student){setStatus('noteFormStatus','اختر طالبًا أولًا.',false);return;}
    try{
      const data={teacherUid:state.user.uid,teacherName:state.profile.fullName||state.profile.name||state.user.email,studentUid,studentName:student.fullName||student.name||student.email,category:$('noteCategory').value,text:text($('noteText').value),createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      const ref=await addDoc(collection(db,'teacherStudentNotes'),data);
      state.notes.unshift({id:ref.id,...data,createdAt:new Date()}); $('noteText').value=''; setStatus('noteFormStatus','تم حفظ الملاحظة.'); renderAll();
    }catch(err){console.error(err);setStatus('noteFormStatus','تعذر حفظ الملاحظة: '+(err.code||err.message),false);}
  });

  $('teacherProfileForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    try{
      const updates={
        fullName:text($('profileName').value), phone:text($('profilePhone').value), whatsapp:text($('profileWhatsapp').value), subject:text($('profileSubject').value),
        country:text($('profileCountry').value), city:text($('profileCity').value), bio:text($('profileBio').value),
        teachingGrades:csvList($('profileGrades').value), availableDays:csvList($('profileDays').value), availablePeriods:csvList($('profilePeriods').value), lessonModes:csvList($('profileModes').value), updatedAt:serverTimestamp()
      };
      await updateDoc(doc(db,'users',state.user.uid),updates); state.profile={...state.profile,...updates};
      document.querySelector('[data-name]').textContent=updates.fullName||state.user.email; setStatus('profileFormStatus','تم حفظ بياناتك بنجاح.');
    }catch(err){console.error(err);setStatus('profileFormStatus','تعذر حفظ البيانات: '+(err.code||err.message),false);}
  });

  $('printTeacherReport')?.addEventListener('click',()=>window.print());
  $('exportTeacherReport')?.addEventListener('click',exportReportCsv);
}

function exportReportCsv(){
  const rows=[['الطالب','حاضر','غائب/اعتذر','إجمالي الواجبات','تم التسليم','الملاحظات']];
  state.students.forEach(s=>{
    const att=getStudentAttendance(s.id),hws=getStudentHomework(s.id),notes=getStudentNotes(s.id);
    rows.push([s.fullName||s.name||'',att.filter(x=>x.status==='حاضر').length,att.filter(x=>x.status==='غائب'||x.status==='اعتذر').length,hws.length,hws.filter(x=>x.status==='تم التسليم').length,notes.length]);
  });
  const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`teacher-report-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

async function boot(user){
  state.user=user;
  const me=await getDoc(doc(db,'users',user.uid));
  const p=me.exists()?me.data():{};
  if(p.role!=='teacher'||p.status!=='active'){ location.replace('../../dashboard/student/index.html'); return; }
  state.profile=p;
  document.querySelector('[data-name]').textContent=p.fullName||p.name||user.email;
  document.querySelector('[data-email]').textContent=user.email||p.email||'';
  setToday(); initTabs(); bindForms();
  $('attendanceDate').value=new Date().toISOString().slice(0,10);
  await loadTeacherStudents(user.uid);
  fillStudentSelects();
  await Promise.all([loadAttendance(user.uid),loadHomework(user.uid),loadNotes(user.uid),loadTeacherNotifications(user.uid)]);
  renderProfile(); renderAll();
  $('loading')?.remove();
}

onAuthStateChanged(auth,user=>{
  if(!user){location.replace('../../login/index.html');return;}
  boot(user).catch(err=>{console.error(err);if($('loading'))$('loading').textContent='تعذر تحميل لوحة المعلم: '+(err.code||err.message);});
});
