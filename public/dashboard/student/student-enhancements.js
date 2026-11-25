import {getPreviewContext} from '../admin-preview-core.js';
import {studentErrorMessage} from './student-navigation-core.js';
import {amountPaid,amountRemaining,money} from '../payment-utils.js';
import {advanceSnapshot} from '../advance-credit.js';
import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged, updatePassword } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { arrayUnion, doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let uid = '';
let profile = {};
let attendance = [];
let studentPayments = [];
let paymentsLoaded = false;
let bookingState = 'loading';
let attendanceLoadError = '';
let paymentsLoadError = '';
let dashboardGeneration = 0;
function describeLoadError(error, label) {
  console.warn('Student data load failed:', label, error);
  return studentErrorMessage(error, label);
}
async function studentDataRequest(fn) {
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {timer=setTimeout(()=>reject(new Error('انتهت مهلة الاتصال بقاعدة البيانات')),18000);})
    ]);
  } finally {clearTimeout(timer);}
}
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

// Navigation is initialized independently in student-navigation.js, including deep links.

function fill(p={}){
  profile=p;
  const values={profileName:p.fullName||p.name||'',profilePhone:p.phone||'',profileCountry:p.country||'',profileCity:p.city||'',profileGrade:p.grade||p.studyGrade||p.className||''};
  Object.entries(values).forEach(([id,value])=>{const el=$(id);if(el)el.value=value;});
  if($('profileLocationSummary'))$('profileLocationSummary').textContent=[p.country,p.city].filter(Boolean).join(' — ')||'لم يتم تحديد البلد والمدينة';
}

async function loadDashboardData(){
  if(!uid)return;
  const generation=++dashboardGeneration;
  const loadStatus=$('studentFinanceLoadStatus');
  if(loadStatus)loadStatus.textContent='جارٍ تحديث بيانات الحضور والمدفوعات المسجلة من الإدارة...';
  const queries=[
    () => getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',uid))),
    () => getDocs(query(collection(db,'teacherStudentNotes'),where('studentUid','==',uid),where('visibleToStudent','==',true))),
    () => getDocs(query(collection(db,'bookings'),where('studentUid','==',uid))),
    () => getDocs(query(collection(db,'notifications'),where('audience','==','user'),where('targetUid','==',uid))),
    () => getDocs(query(collection(db,'notifications'),where('audience','==','all'))),
    () => getDocs(collection(db,'users',uid,'library')),
    () => getDocs(query(collection(db,'vodafonePayments'),where('studentUid','==',uid)))
  ];
  // تحميل كل قسم بصورة مستقلة: تأخر الإشعارات مثلًا لا يخفي حضور الطالب ومدفوعاته.
  const results=await Promise.allSettled(queries.map(fn=>studentDataRequest(fn)));
  if(generation!==dashboardGeneration)return;
  const [attR,notesR,bookR,personalR,allR,libR,payR]=results;
  attendanceLoadError=attR.status==='rejected'?describeLoadError(attR.reason,'سجلات الحضور'):'';
  paymentsLoadError=payR.status==='rejected'?describeLoadError(payR.reason,'المدفوعات'):'';
  attendance=attR.status==='fulfilled'?attR.value.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt||b.date||b.openedAt)-dateKey(a.createdAt||a.date||a.openedAt)):[];
  paymentsLoaded=payR.status==='fulfilled';
  bookingState=bookR.status==='fulfilled'?'ready':'error';
  studentPayments=paymentsLoaded?payR.value.docs.map(d=>({id:d.id,...d.data()})):[];
  notes=notesR.status==='fulfilled'?notesR.value.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt)):[];
  bookings=bookR.status==='fulfilled'?bookR.value.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt)):[];
  const merged=new Map();
  if(personalR.status==='fulfilled')personalR.value.docs.forEach(d=>merged.set(d.id,{id:d.id,...d.data()}));
  if(allR.status==='fulfilled')allR.value.docs.forEach(d=>merged.set(d.id,{id:d.id,...d.data()}));
  notifications=[...merged.values()].sort((a,b)=>dateKey(b.createdAt)-dateKey(a.createdAt)).slice(0,50);
  libraryCount=libR.status==='fulfilled'?libR.value.size:0;
  results.filter(x=>x.status==='rejected').forEach(x=>console.warn('تعذر تحميل جزء من لوحة الطالب:',x.reason));
  renderDashboard();
  if($('studentLinkedAccount'))$('studentLinkedAccount').textContent='السجلات الخاصة بـ '+(profile.fullName||profile.name||'طالب')+' · '+(profile.email||auth.currentUser?.email||'');
  if(loadStatus){
    loadStatus.textContent=[attendanceLoadError,paymentsLoadError].filter(Boolean).join(' | ')
      || (attendance.length||studentPayments.length
        ? '✅ تم تحديث سجلاتك المسجلة بواسطة الإدارة.'
        : 'لا توجد سجلات حصص على حسابك حتى الآن. لو كنت حضرت حصة بالفعل، تواصل مع الإدارة لمراجعة تسجيلها.');
  }
}

function realAttendance(){return attendance.filter(x=>x.deleted!==true&&(x.status==='حاضر'||x.status==='غائب'||x.status==='اعتذر'));}
function renderDashboard(){
  const rows=realAttendance();
  const credits=advanceSnapshot(rows,studentPayments);
  const present=rows.filter(x=>x.status==='حاضر').length;
  const absent=rows.filter(x=>x.status==='غائب').length;
  const excused=rows.filter(x=>x.status==='اعتذر').length;
  const relevant=present+absent;
  const unread=notifications.filter(n=>!(Array.isArray(n.readBy)&&n.readBy.includes(uid))).length;
  const confirmed=bookings.filter(b=>['تم الحجز','مكتمل','مؤكد'].includes(b.status)).length;
  window.dispatchEvent(new CustomEvent('zad:stage4-dashboard-data',{detail:{
    uid, bookingState,
    financeState:paymentsLoaded&&!attendanceLoadError?'ready':'error',
    due:paymentsLoaded&&!attendanceLoadError?credits.unpaidAfterPiastres:null,
    attendance:rows.map(x=>({status:x.status,date:x.date||'',deleted:x.deleted===true})),
    bookings:bookings.map(x=>({status:x.status,subject:x.subject||'',preferredDay1:x.preferredDay1||'',preferredDay2:x.preferredDay2||''})),
    unreadNotifications:unread,teacherNotes:notes.length,
    dataError:attendanceLoadError||''
  }}));

  if($('studentAttendanceCount'))$('studentAttendanceCount').textContent=attendanceLoadError?'—':rows.length;
  if($('studentNotesCount'))$('studentNotesCount').textContent=notes.length;
  if($('studentBookingCount'))$('studentBookingCount').textContent=bookings.length;
  if($('studentUnreadCount'))$('studentUnreadCount').textContent=unread;
  if($('studentNotificationBadge'))$('studentNotificationBadge').textContent=unread?`(${unread})`:'';

  if($('studentPresentCount'))$('studentPresentCount').textContent=present;
  if($('studentAbsentCount'))$('studentAbsentCount').textContent=absent;
  if($('studentExcusedCount'))$('studentExcusedCount').textContent=excused;
  if($('studentAttendanceRate'))$('studentAttendanceRate').textContent=percent(present,relevant)+'%';
  if($('studentPaidTotal'))$('studentPaidTotal').textContent=attendanceLoadError?'—':money(rows.reduce((sum,x)=>sum+amountPaid(x),0)+(paymentsLoaded?credits.usedAdvancePiastres:0));
  if($('studentAdvanceSummary'))$('studentAdvanceSummary').textContent=attendanceLoadError?attendanceLoadError:paymentsLoaded?
    (credits.availableAdvancePiastres>0?'✅ لك رصيد مقدم: '+money(credits.availableAdvancePiastres):credits.unpaidAfterPiastres>0?'❌ عليك مستحقات: '+money(credits.unpaidAfterPiastres):'✔️ حسابك متوازن')+
    ' · من المقدم تم احتساب '+money(credits.usedAdvancePiastres)+' على الحصص':
    'تعذر تحميل الرصيد المقدم؛ حدّث الصفحة.';
  if($('studentAttendanceRows'))$('studentAttendanceRows').innerHTML=attendanceLoadError?`<tr><td colspan="7">${esc(attendanceLoadError)}</td></tr>`:rows.length?rows.map(x=>`<tr><td>${esc(x.date||fmt(x.createdAt||x.openedAt))}</td><td>${esc(x.subject||x.lessonTitle||'-')}</td><td>${esc(x.teacherName||'-')}</td><td>${esc(x.status||'-')}</td><td>${Number(x.price||0).toLocaleString('ar-EG')} ج.م</td><td>${!paymentsLoaded?'⚠️ تعذر التحقق من رصيد المقدم':credits.byLesson.get(x.id)?.afterPiastres===0?'✅ مدفوعة / مغطاة بالمقدم':credits.byLesson.get(x.id)?.advanceAppliedPiastres>0?'🟡 جزء مغطى بالمقدم · المتبقي '+money(credits.byLesson.get(x.id).afterPiastres):amountRemaining(x)===0?'✅ مدفوعة':amountPaid(x)>0?'🟡 مدفوع جزئيًا '+money(amountPaid(x)):'⏳ غير مدفوعة'}</td><td>${esc(x.note||'-')}</td></tr>`).join(''):'<tr><td colspan="7">لم تُسجل حصص مرتبطة بحسابك الحالي. تأكد من أن الأدمن اختار حسابك الصحيح عند تسجيل الحضور.</td></tr>';

  // كل الحصص التي أثبتتها الإدارة تُعرض في المدفوعات أيضًا، حتى لو لم يُنشأ تحويل فودافون جديد.
  const registered=$('studentAdminRecordedPayments');
  if(registered){
    registered.innerHTML=attendanceLoadError?`<tr><td colspan="6">${esc(attendanceLoadError)}</td></tr>`:
      !rows.length?'<tr><td colspan="6">لا توجد حصص مالية مرتبطة بحسابك حتى الآن.</td></tr>':rows.map(x=>{
        const due=Math.max(0,Math.round(Number(x.price||0)*100));
        const paid=amountPaid(x);
        const covered=paymentsLoaded?(credits.byLesson.get(x.id)?.advanceAppliedPiastres||0):0;
        const remaining=paymentsLoaded?(credits.byLesson.get(x.id)?.afterPiastres??Math.max(0,due-paid)):Math.max(0,due-paid);
        const label=!due?'حصة مجانية':remaining===0?'✅ مدفوعة بالكامل':paid+covered>0?'🟡 مسددة جزئيًا':'⏳ لم تُسدد';
        return `<tr><td>${esc(x.date||fmt(x.createdAt))}</td><td>${esc(x.subject||'حصة')}</td><td>${money(due)}</td><td>${money(paid)}${covered?' + مقدم '+money(covered):''}</td><td>${paymentsLoaded?money(remaining):'—'}</td><td>${label}${!paymentsLoaded?' (لم يُحمّل رصيد المقدم)':''}</td></tr>`;
      }).join('');
  }
  const registeredTotal=$('studentAdminRecordedPaymentsSummary');
  if(registeredTotal) registeredTotal.textContent=attendanceLoadError?attendanceLoadError:
    `سجلات حصص الإدارة: ${rows.length} · المدفوع المسجل: ${money(rows.reduce((n,x)=>n+amountPaid(x),0))}`+
    (paymentsLoaded?` · المستخدم من المقدم: ${money(credits.usedAdvancePiastres)} · المتبقي عليك: ${money(credits.unpaidAfterPiastres)} · رصيد لك: ${money(credits.availableAdvancePiastres)}`:' · رصيد المقدم غير متاح الآن');

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
  list.querySelectorAll('[data-notification-id]').forEach(card=>card.querySelector('[data-read-notification]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    const status=$('studentNotificationStatus');if(status)status.textContent='';
    try{await markRead(card.dataset.notificationId);}
    catch(error){console.warn('Unable to mark notification read:',error);if(status)status.textContent=studentErrorMessage(error,'تحديث التنبيه');}
    finally{if(button.isConnected)button.disabled=false;}
  }));
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
  }catch(error){console.error('PROFILE_SAVE_ERROR:',error);setStatus(studentErrorMessage(error,'حفظ الملف الشخصي'));}
  finally{if(saveButton){saveButton.disabled=false;saveButton.textContent='💾 حفظ البيانات';}}
});

$('passwordForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const password=$('newPassword')?.value||'',confirmation=$('confirmPassword')?.value||'',box=$('passwordStatus');
  if(password.length<6||password!==confirmation){if(box){box.textContent=password.length<6?'كلمة المرور يجب ألا تقل عن 6 أحرف.':'كلمتا المرور غير متطابقتين.';box.style.display='block';}return;}
  try{await updatePassword(auth.currentUser,password);if(box){box.textContent='تم تغيير كلمة المرور بنجاح.';box.className='notice success';box.style.display='block';}event.target.reset();}
  catch(error){console.warn('Unable to update student password:',error);if(box){box.textContent=studentErrorMessage(error,'تغيير كلمة المرور');box.style.display='block';}}
});

$('markAllStudentNotifications')?.addEventListener('click',async event=>{
  const button=event.currentTarget;button.disabled=true;
  const status=$('studentNotificationStatus');if(status)status.textContent='';
  try{await markAllRead();if(status)status.textContent='تم تحديد التنبيهات كمقروءة.';}
  catch(error){console.warn('Unable to mark all notifications read:',error);if(status)status.textContent='تعذر تحديث بعض التنبيهات. اضغط تحديث القائمة ثم أعد المحاولة.';}
  finally{button.disabled=false;}
});
$('studentFinanceRefresh')?.addEventListener('click',()=>{loadDashboardData().catch(console.error);window.dispatchEvent(new Event('zad:refresh-student-payment-section'));});
$('zadCopyStudentUid')?.addEventListener('click',async()=>{
  const button=$('zadCopyStudentUid');
  if(!uid){if($('studentFinanceLoadStatus'))$('studentFinanceLoadStatus').textContent='سجّل الدخول أولًا لنسخ رقم حسابك للدعم.';return;}
  try {
    await navigator.clipboard.writeText(uid);
    button.textContent='✅ تم نسخ رقم الحساب';
  } catch(e) {
    button.textContent='تعذر النسخ؛ جرّب مرة أخرى';
    console.warn('Unable to copy student account identifier:',e);
  }
});

window.addEventListener('zad:payments-updated',()=>{if(uid)loadDashboardData().catch(console.error);});
window.addEventListener('zad:stage4-refresh-student',()=>{if(uid)loadDashboardData().catch(error=>console.warn('تعذر تحديث لوحة الطالب',error));});
onAuthStateChanged(auth,async user=>{
  dashboardGeneration++;
  uid='';
  if(!user)return;
  const pv=await getPreviewContext(user,'student');
  if(pv.denied||auth.currentUser?.uid!==user.uid)return;
  uid=pv.uid;
  try{const snap=await getDoc(doc(db,'users',pv.uid));if(auth.currentUser?.uid!==user.uid)return;if(snap.exists())fill(snap.data());else setStatus('لم يتم العثور على بيانات حسابك في قاعدة البيانات.');}
  catch(error){console.error('Student enhancements:',error);setStatus('تعذر تحميل بيانات الحساب.');}
  if(auth.currentUser?.uid===user.uid&&uid===pv.uid)await loadDashboardData();
});
