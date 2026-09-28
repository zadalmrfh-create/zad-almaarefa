import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged, updatePassword } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { arrayUnion, doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let uid = '';
let profile = {};
let attendance = [];
let notes = [];
let bookings = [];
let notifications = [];
let libraryCount = 0;
const statusBox = $('profileSaveStatus');

function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toDate(value){if(!value)return null;if(typeof value.toDate==='function')return value.toDate();const d=new Date(value);return Number.isNaN(d.getTime())?null:d;}
function fmt(value,withTime=false){const d=toDate(value);if(!d)return '-';try{return new Intl.DateTimeFormat('ar-EG',withTime?{dateStyle:'medium',timeStyle:'short'}:{dateStyle:'medium'}).format(d);}catch{return d.toLocaleDateString('ar-EG');}}
function dateKey(value){const d=toDate(value);return d?d.getTime():0;}
function percent(part,total){return total?Math.round((part/total)*100):0;}
function setStatus(message, ok=false){if(!statusBox)return;statusBox.textContent=message;statusBox.className=ok?'notice success':'notice';statusBox.style.display='block';}

function initTabs(){
  document.querySelectorAll('.student-tab').forEach(btn=>btn.addEventListener('click',()=>openTab(btn.dataset.studentTab)));
}
function openTab(name){
  document.querySelectorAll('.student-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.studentTab===name));
  document.querySelectorAll('.student-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.studentPanel===name));
  window.scrollTo({top:0,behavior:'smooth'});
}

function fill(p={}){
  profile=p;
  const values={profileName:p.fullName||p.name||'',profilePhone:p.phone||'',profileCountry:p.country||'',profileCity:p.city||'',profileGrade:p.grade||p.studyGrade||p.className||''};
  Object.entries(values).forEach(([id,value])=>{const el=$(id);if(el)el.value=value;});
  if($('profileLocationSummary'))$('profileLocationSummary').textContent=[p.country,p.city].filter(Boolean).join(' — ')||'لم يتم تحديد البلد والمدينة';
}

async function loadDashboardData(){
  if(!uid)return;
  const results=await Promise.allSettled([
    getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',uid))),
    getDocs(query(collection(db,'teacherStudentNotes'),where('studentUid','==',uid),where('visibleToStudent','==',true))),
    getDocs(query(collection(db,'bookings'),where('studentUid','==',uid))),
    getDocs(query(collection(db,'notifications'),where('audience','==','user'),where('targetUid','==',uid))),
    getDocs(query(collection(db,'notifications'),where('audience','==','all'))),
    getDocs(collection(db,'users',uid,'library'))
  ]);
  const [attR,notesR,bookR,personalR,allR,libR]=results;
  attendance=attR.status==='fulfilled'?attR.value.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt||b.date||b.openedAt)-dateKey(a.createdAt||a.date||a.openedAt)):[];
  notes=notesR.status==='fulfilled'?notesR.value.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt)):[];
  bookings=bookR.status==='fulfilled'?bookR.value.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt)):[];
  const merged=new Map();
  if(personalR.status==='fulfilled')personalR.value.docs.forEach(d=>merged.set(d.id,{id:d.id,...d.data()}));
  if(allR.status==='fulfilled')allR.value.docs.forEach(d=>merged.set(d.id,{id:d.id,...d.data()}));
  notifications=[...merged.values()].sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt)).slice(0,50);
  libraryCount=libR.status==='fulfilled'?libR.value.size:0;
  results.filter(x=>x.status==='rejected').forEach(x=>console.warn('تعذر تحميل جزء من لوحة الطالب:',x.reason));
  renderDashboard();
}

function realAttendance(){return attendance.filter(x=>x.status==='حاضر'||x.status==='غائب'||x.status==='اعتذر');}
function renderDashboard(){
  const rows=realAttendance();
  const present=rows.filter(x=>x.status==='حاضر').length;
  const absent=rows.filter(x=>x.status==='غائب').length;
  const excused=rows.filter(x=>x.status==='اعتذر').length;
  const relevant=present+absent;
  const unread=notifications.filter(n=>!(Array.isArray(n.readBy)&&n.readBy.includes(uid))).length;
  const confirmed=bookings.filter(b=>['تم الحجز','مكتمل','مؤكد'].includes(b.status)).length;

  if($('studentAttendanceCount'))$('studentAttendanceCount').textContent=rows.length;
  if($('studentNotesCount'))$('studentNotesCount').textContent=notes.length;
  if($('studentBookingCount'))$('studentBookingCount').textContent=bookings.length;
  if($('studentUnreadCount'))$('studentUnreadCount').textContent=unread;
  if($('studentNotificationBadge'))$('studentNotificationBadge').textContent=unread?`(${unread})`:'';

  if($('studentPresentCount'))$('studentPresentCount').textContent=present;
  if($('studentAbsentCount'))$('studentAbsentCount').textContent=absent;
  if($('studentExcusedCount'))$('studentExcusedCount').textContent=excused;
  if($('studentAttendanceRate'))$('studentAttendanceRate').textContent=percent(present,relevant)+'%';
  if($('studentAttendanceRows'))$('studentAttendanceRows').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.date||fmt(x.createdAt||x.openedAt))}</td><td>${esc(x.subject||x.lessonTitle||'-')}</td><td>${esc(x.teacherName||'-')}</td><td>${esc(x.status||'-')}</td><td>${esc(x.note||'-')}</td></tr>`).join(''):'<tr><td colspan="5">لا توجد سجلات حضور حتى الآن.</td></tr>';

  if($('studentNotesList'))$('studentNotesList').innerHTML=notes.length?notes.map(n=>`<article class="student-note"><strong>${esc(n.teacherName||'المعلم')} — ${esc(n.category||'متابعة')}</strong><p>${esc(n.text||'')}</p><small>${fmt(n.createdAt,true)}</small></article>`).join(''):'<div class="notice">لا توجد ملاحظات ظاهرة لك حتى الآن.</div>';

  if($('progressAttendanceRate'))$('progressAttendanceRate').textContent=percent(present,relevant)+'%';
  if($('progressCompletedBookings'))$('progressCompletedBookings').textContent=confirmed;
  if($('progressTeacherNotes'))$('progressTeacherNotes').textContent=notes.length;
  if($('progressLibraryCount'))$('progressLibraryCount').textContent=libraryCount;
  if($('studentProgressMessage')){
    let msg='استمر في متابعة حضورك والمحاضرات من لوحة الطالب.';
    if(relevant>=3 && percent(present,relevant)>=80)msg='ممتاز 👏 نسبة حضورك مرتفعة. حافظ على انتظامك.';
    else if(relevant>=3 && percent(present,relevant)<60)msg='حاول تحسين انتظام الحضور ومراجعة ملاحظات المعلم باستمرار.';
    $('studentProgressMessage').textContent=msg;
  }

  if($('profileAttendanceCount'))$('profileAttendanceCount').textContent=rows.length;
  if($('profileNotesCount'))$('profileNotesCount').textContent=notes.length;
  if($('profileBookingCount'))$('profileBookingCount').textContent=bookings.length;
  if($('profileLibraryCount'))$('profileLibraryCount').textContent=libraryCount;

  renderNotifications();
}

function renderNotifications(){
  const list=$('studentNotificationsList');if(!list)return;
  list.innerHTML=notifications.length?notifications.map(n=>{
    const unread=!(Array.isArray(n.readBy)&&n.readBy.includes(uid));
    return `<article class="student-notification ${unread?'unread':''}" data-notification-id="${esc(n.id)}"><strong>${esc(n.title||'تنبيه')}</strong><p>${esc(n.message||'')}</p><small>${fmt(n.createdAt,true)}</small>${unread?'<div style="margin-top:9px"><button class="btn" data-read-notification type="button">تمت القراءة</button></div>':''}</article>`;
  }).join(''):'<div class="notice">لا توجد تنبيهات.</div>';
  list.querySelectorAll('[data-notification-id]').forEach(card=>card.querySelector('[data-read-notification]')?.addEventListener('click',()=>markRead(card.dataset.notificationId)));
}
async function markRead(id){
  await updateDoc(doc(db,'notifications',id),{readBy:arrayUnion(uid)});
  const n=notifications.find(x=>x.id===id);if(n)n.readBy=[...(n.readBy||[]),uid];renderDashboard();
}
async function markAllRead(){
  const unread=notifications.filter(n=>!(Array.isArray(n.readBy)&&n.readBy.includes(uid)));
  await Promise.all(unread.map(n=>updateDoc(doc(db,'notifications',n.id),{readBy:arrayUnion(uid)})));
  unread.forEach(n=>n.readBy=[...(n.readBy||[]),uid]);renderDashboard();
}

$('profileForm')?.addEventListener('submit',async event=>{
  event.preventDefault();event.stopPropagation();
  if(!uid){setStatus('لم يتم التعرف على حسابك بعد. أعد تحميل الصفحة ثم حاول مرة أخرى.');return;}
  const saveButton=$('profileSaveBtn');
  const data={fullName:$('profileName')?.value.trim()||'',name:$('profileName')?.value.trim()||'',phone:$('profilePhone')?.value.trim()||'',country:$('profileCountry')?.value.trim()||'',city:$('profileCity')?.value.trim()||'',grade:$('profileGrade')?.value.trim()||'',updatedAt:serverTimestamp(),profileCompletedAt:serverTimestamp()};
  if(!data.fullName){setStatus('اكتب الاسم الكامل أولًا.');$('profileName')?.focus();return;}
  if(!data.country){setStatus('اكتب البلد أولًا.');$('profileCountry')?.focus();return;}
  if(!data.city){setStatus('اكتب المدينة أولًا.');$('profileCity')?.focus();return;}
  if(!data.grade){setStatus('اكتب الصف الدراسي أولًا.');$('profileGrade')?.focus();return;}
  try{
    if(saveButton){saveButton.disabled=true;saveButton.textContent='⏳ جارٍ الحفظ...';}setStatus('جارٍ حفظ البيانات...');
    await updateDoc(doc(db,'users',uid),data);profile={...profile,...data};setStatus('تم حفظ بيانات الملف الشخصي بنجاح ✅',true);
    const nameElement=document.querySelector('[data-name]');if(nameElement)nameElement.textContent=data.fullName;
    if($('profileLocationSummary'))$('profileLocationSummary').textContent=`${data.country} — ${data.city}`;
  }catch(error){console.error('PROFILE_SAVE_ERROR:',error);let message=error?.message||'تعذر حفظ البيانات.';if(error?.code==='permission-denied')message='تم رفض حفظ البيانات من Firebase Rules.';setStatus(message);}
  finally{if(saveButton){saveButton.disabled=false;saveButton.textContent='💾 حفظ البيانات';}}
});

$('passwordForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const password=$('newPassword')?.value||'',confirmation=$('confirmPassword')?.value||'',box=$('passwordStatus');
  if(password.length<6||password!==confirmation){if(box){box.textContent=password.length<6?'كلمة المرور يجب ألا تقل عن 6 أحرف.':'كلمتا المرور غير متطابقتين.';box.style.display='block';}return;}
  try{await updatePassword(auth.currentUser,password);if(box){box.textContent='تم تغيير كلمة المرور بنجاح.';box.className='notice success';box.style.display='block';}event.target.reset();}
  catch(error){if(box){box.textContent=error.code==='auth/requires-recent-login'?'لأسباب أمنية، سجّل الدخول مرة أخرى ثم غيّر كلمة المرور.':(error.message||'تعذر تغيير كلمة المرور.');box.style.display='block';}}
});

$('markAllStudentNotifications')?.addEventListener('click',()=>markAllRead().catch(console.error));
initTabs();
onAuthStateChanged(auth,async user=>{
  if(!user)return;uid=user.uid;
  try{const snap=await getDoc(doc(db,'users',uid));if(snap.exists())fill(snap.data());else setStatus('لم يتم العثور على بيانات حسابك في قاعدة البيانات.');await loadDashboardData();}
  catch(error){console.error('Student enhancements:',error);setStatus('تعذر تحميل بيانات الحساب.');}
});
