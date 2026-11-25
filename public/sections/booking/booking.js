/** Zad Al-Maarefa booking flow -- compatible with booking/index.html Step 4 (2026-11-24).
 * Keeps data ownership restricted to auth.uid. No Firestore rules changes needed.
 */
import { ENGLISH_SUBJECT, ENGLISH_TEACHER_NAME, findEnglishTeacherAccount, isRetiredTeacherProfile } from '../../assets/english-teacher.js';
import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, doc, getDoc, getDocs, setDoc, addDoc, query, where, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { asBookingPrice, bookingPrice, bookingProfile, bookingStatusLabel, cairoNowSlot, formatBookingPrice, formatBookingSlot, normalizeArabic, validBookingSlot } from './booking-core.js?v=20261124-fixed';

const $ = id => document.getElementById(id);
const form = $('bookingForm');
const account = $('bookingAccountStatus');
const login = $('bookingLogin');
const next = $('bookingNext');
const back = $('bookingBack');
const progress = $('bookingProgress');
const status = $('bookingStatus');
const tracker = $('bookingTrackResults');
const trackerStatus = $('bookingTrackStatus');
const summary = $('bookingSummary');
const subject = form.elements.subject;
const section = $('bookingSection');
const teacherSelect = $('bookingTeacher');
const teacherHint = $('teacherAutoHint');
const priceLabel = $('bookingPrice');
const steps = Array.from(form.querySelectorAll('.booking-step'));
// Step-specific validation: browser native form validation cannot focus hidden required fields.
form.noValidate = true;
const params = new URLSearchParams(location.search);
const initialTeacher = params.get('teacher') || '';
let user = null, profile = {}, activeTeachers = [], step = 0, submitting = false, generation = 0;
let activeTeacher = {uid:null,name:'ضياء الدين نبيل',category:'default'};
let stopTracking = null;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const field = name => form.elements.namedItem(name);
const canonicalValues = Object.freeze({
  section:['','القرآن الكريم','التزكية والتربية','اللغة العربية','العلوم الشرعية','التعليم الأزهري',ENGLISH_SUBJECT,'العلوم','الرياضيات','البرمجة وتكنولوجيا المعلومات'],
  educationType:['','غير مرتبط بنظام تعليمي','أزهري','عام','لغات'],
  lessonType:['حصة فردية','مراجعة','حل تدريبات / امتحانات','تأسيس','متابعة','تحفيظ'],
  preferredDay1:['','السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'],
  preferredDay2:['','السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'],
  preferredPeriod:['صباحًا','ظهرًا','مساءً'],lessonMode:['أونلاين','حضوري']
});
function canonical(name) {
  const el = field(name), values = canonicalValues[name];
  return el && values && el.selectedIndex >= 0 ? values[el.selectedIndex] || '' : '';
}
function chooseSection(value) { if (canonicalValues.section.includes(value)) section.selectedIndex=canonicalValues.section.indexOf(value); }
function chooseEducation(value) { if(canonicalValues.educationType.includes(value))field('educationType').selectedIndex=canonicalValues.educationType.indexOf(value); }
function selectedData() {
  const data=Object.fromEntries(new FormData(form));
  for (const name of Object.keys(canonicalValues)) data[name]=canonical(name);
  data.grade=String(field('grade').value||'').trim();
  data.stage=String(field('stage').value||'').trim();
  data.subject=String(field('subject').value||'').trim();
  data.requestedSlot=String(field('requestedSlot').value||'').trim();
  data.fullName=String(field('fullName').value||'').trim();
  data.phone=String(field('phone').value||'').trim();
  data.email=String(field('email').value||'').trim();
  data.notes=String(field('notes').value||'').trim();
  return data;
}
function setMessage(message, kind='') {status.textContent=message;status.className='booking-status'+(kind?' '+kind:'');}
function accountError(err) {
  console.error('[Zad booking] Auth error:',err);
  account.textContent='تعذر التحقق من الحساب. حدّث الصفحة أو سجّل دخولك مرة أخرى.';
  trackerStatus.textContent='تعذر تحميل حجوزاتك: '+(err?.code||err?.message||'خطأ اتصال');
  login.hidden=false;next.disabled=true;
}
function showStep(index, focus=false) {
  step=Math.max(0,Math.min(steps.length-1,index));
  steps.forEach((el,i)=>{el.hidden=i!==step;});
  back.hidden=step===0;
  next.textContent=step===steps.length-1?'تأكيد وإرسال الحجز':'التالي';
  next.disabled=!user||submitting;
  progress.textContent=`الخطوة ${step+1} من ${steps.length}`;
  if(focus) steps[step].querySelector('legend')?.focus();
}
function teacherCandidates(category) {
  if(category==='english')return [{name:ENGLISH_TEACHER_NAME,label:'مستر '+ENGLISH_TEACHER_NAME}];
  if(category==='science'||category==='chemistry')return [{name:'محمد خالد محمود',label:'أ/ محمد خالد محمود'},{name:'سعد علاء',label:'أ/ سعد علاء'}];
  const name=({math:'سعد علاء',programming:'مالك سامح'})[category]||'ضياء الدين نبيل';
  return [{name,label:'أ/ '+name}];
}
function categoryFor() {
  const chosen=canonical('section'), value=normalizeArabic(chosen+' '+subject.value);
  if(value.includes('برمج')||value.includes('تكنولوجيا المعلومات'))return 'programming';
  if(value.includes('انجليز')||value.includes('english'))return 'english';
  if(value.includes('رياضيات')||value.includes('رياضه')||value.includes('math'))return 'math';
  if(value.includes('كيمياء')||value.includes('chemistry'))return 'chemistry';
  if(value.includes('علوم')||value.includes('science'))return 'science';
  return 'default';
}
function resolvedTeacher(name) {
  if(normalizeArabic(name)===normalizeArabic(ENGLISH_TEACHER_NAME)){
    const t=findEnglishTeacherAccount(activeTeachers); return t ? {uid:t.uid,name} : {uid:null,name};
  }
  const key=normalizeArabic(name).replace(/^(الاستاذ|استاذ|مستر|ا) /,'');
  const matches=activeTeachers.filter(t=>[t.fullName,t.name,t.displayName,...(Array.isArray(t.attendanceAliases)?t.attendanceAliases:[])].some(x=>{
    const y=normalizeArabic(x).replace(/^(الاستاذ|استاذ|مستر|ا) /,'');
    return y===key || (key.split(' ').length>=2 && y.startsWith(key+' '));
  }));
  return {uid:matches.length===1?matches[0].uid:null,name};
}
function updateTeacher(){
  const category=categoryFor(), options=teacherCandidates(category);
  const previous=activeTeacher.category===category?activeTeacher.name:'';
  const requested=options.find(x=>normalizeArabic(initialTeacher).includes(normalizeArabic(x.name)))?.name;
  const selected=options.find(x=>x.name===previous)||options.find(x=>x.name===requested)||options[0];
  teacherSelect.replaceChildren(...options.map(t=>{const o=new Option(t.label,t.name);o.dataset.teacherName=t.name;return o;}));
  teacherSelect.value=selected.name;
  teacherSelect.disabled=options.length===1;
  activeTeacher={...resolvedTeacher(selected.name),category};
  teacherHint.textContent=options.length>1?'اختر المعلم المناسب للحصة.':`تم اختيار ${selected.label} تلقائيًا.`;
  renderPrice();
}
function renderPrice() {
  const amount=bookingPrice({section:canonical('section'),subject:subject.value,lessonType:canonical('lessonType')},activeTeacher.category);
  priceLabel.textContent=amount===null?'السعر: تحدده الإدارة عند تأكيد الحجز.':'السعر المقترح للحصة: '+formatBookingPrice(amount);
}
function renderSubjects() {
  const items={
    'اللغة العربية':['اللغة العربية','النحو','الصرف','البلاغة','الأدب والنصوص','العروض والقافية'],
    'العلوم الشرعية':['الفقه','التفسير','الحديث','التوحيد'],
    'التعليم الأزهري':['النحو','الصرف','البلاغة','الفقه','التفسير','الحديث','التوحيد'],
    'العلوم':['العلوم','الكيمياء'],'الرياضيات':['الرياضيات'],
    'اللغة الإنجليزية':[ENGLISH_SUBJECT], 'القرآن الكريم':['القرآن الكريم','التجويد','التحفيظ'],
    'التزكية والتربية':['التزكية والتربية'], 'البرمجة وتكنولوجيا المعلومات':['البرمجة','تكنولوجيا المعلومات']
  };
  const choices=items[canonical('section')]||[];
  $('zadBookingSubjects')?.replaceChildren(...choices.map(value=>{const x=document.createElement('option');x.value=value;return x;}));
}
function validation(index,data){
  for(const input of steps[index].querySelectorAll('input, select, textarea')){
    if(!input.disabled && !input.checkValidity())return {control:input,message:'أكمل البيانات المطلوبة في الخطوة دي.'};
  }
  if(index===0 && !data.educationType)return {control:field('educationType'),message:'اختر نظام التعليم.'};
  if(index===1 && (!data.section || !data.subject))return {control:field('section'),message:'اختر القسم والمادة.'};
  if(index===2){
    if(!data.requestedSlot && !(data.preferredDay1 && data.preferredDay2))return {control:field('preferredDay1'),message:'حدد تاريخ وساعة، أو اختار يومين مناسبين.'};
    if(data.preferredDay1 && data.preferredDay2 && data.preferredDay1===data.preferredDay2)return {control:field('preferredDay2'),message:'اختار يومين مختلفين.'};
    if(data.requestedSlot && (!validBookingSlot(data.requestedSlot)||data.requestedSlot<=cairoNowSlot()))return {control:field('requestedSlot'),message:'اختار موعدًا في المستقبل بتوقيت القاهرة.'};
  }
  return null;
}
function renderSummary(data){
  const price=asBookingPrice(bookingPrice(data,activeTeacher.category));
  const fields=[['الاسم',data.fullName],['الصف',data.grade],['نظام التعليم',data.educationType],['القسم',data.section],['المادة',data.subject],['المعلم',activeTeacher.name],['نوع الحصة',data.lessonType],['الوقت المقترح',data.requestedSlot?formatBookingSlot(data.requestedSlot):[data.preferredDay1,data.preferredDay2,data.preferredPeriod].filter(Boolean).join('، ')],['طريقة الحصة',data.lessonMode],['السعر المقترح',price===null?'تحدده الإدارة':formatBookingPrice(price)],['رقم الهاتف',data.phone]];
  summary.innerHTML=fields.map(([label,value])=>`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value||'—')}</dd></div>`).join('');
}
function safeDate(value){if(!value)return '—';if(typeof value?.toDate==='function')return value.toDate().toLocaleDateString('ar-EG');return String(value).slice(0,16)}
function renderBookings(docs){
  tracker.replaceChildren();
  if(!docs.length){trackerStatus.textContent='مفيش حجوزات سابقة على الحساب ده.';return;}
  trackerStatus.textContent=`عندك ${docs.length} طلب حجز.`;
  docs.sort((a,b)=>Number(b.createdAt?.seconds||0)-Number(a.createdAt?.seconds||0));
  for(const data of docs){
    const card=document.createElement('article');card.className='booking-tracker-item';
    const confirmed=data.confirmedSlot||data.finalSlot||data.scheduledSlot||'';
    const finalSlot=typeof confirmed==='string' && validBookingSlot(confirmed)?formatBookingSlot(confirmed):'';
    const confirmedPrice=asBookingPrice(data.confirmedPrice??data.agreedPrice??data.finalPrice);
    card.innerHTML=`<strong>${escapeHtml(data.subject||data.section||'حجز حصة')}</strong><p>المعلم: ${escapeHtml(data.teacherName||'تحدده الإدارة')}</p><p>الحالة: <b>${escapeHtml(bookingStatusLabel(data.status))}</b></p>${finalSlot?`<p>الموعد: ${escapeHtml(finalSlot)}</p>`:''}${confirmedPrice!==null?`<p>السعر: ${escapeHtml(formatBookingPrice(confirmedPrice))}</p>`:''}<small>${escapeHtml(safeDate(data.createdAt))}</small>`;
    tracker.append(card);
  }
}
function trackBookings(current,token){
  if(stopTracking){stopTracking();stopTracking=null;}
  trackerStatus.textContent='جارٍ تحميل حجوزاتك…';
  const q=query(collection(db,'bookings'),where('studentUid','==',current.uid));
  stopTracking=onSnapshot(q,snap=>{
    if(token!==generation)return;
    renderBookings(snap.docs.map(x=>({id:x.id,...x.data()})));
  },error=>{
    if(token!==generation)return;
    console.error('[Zad booking] Tracking error:',error);
    trackerStatus.textContent='تعذر عرض الحجوزات: '+(error.code||error.message);
  });
}
function fillProfile(current,record={}){
  const p=bookingProfile(current,record);
  for(const name of ['fullName','phone','email','grade','stage']){
    const el=field(name);
    if(el && !el.value.trim() && p[name])el.value=p[name];
  }
  if(!canonical('educationType') && p.educationType)chooseEducation(p.educationType);
}
async function loadProfile(current,token){
  try{
    const snap=await getDoc(doc(db,'users',current.uid));
    if(token!==generation)return;
    if(snap.exists()){
      profile=snap.data(); fillProfile(current,profile);
    }
  }catch(e){console.warn('[Zad booking] Profile read:',e);}
}
async function loadTeachers(current,token){
  try{
    const snap=await getDocs(query(collection(db,'users'),where('role','==','teacher'),where('status','==','active')));
    if(token!==generation)return;
    activeTeachers=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(t=>!isRetiredTeacherProfile(t));
    updateTeacher();
  }catch(e){console.warn('[Zad booking] Teacher lookup:',e);}
}
function signedOut(){
  user=null;profile={};activeTeachers=[];login.hidden=false;
  account.textContent='سجّل دخولك علشان تكمل الحجز.';
  trackerStatus.textContent='سجّل دخولك علشان تشوف حجوزاتك.';
  tracker.replaceChildren();
  showStep(0);
}
onAuthStateChanged(auth, current=>{
  const token=++generation;
  if(stopTracking){stopTracking();stopTracking=null;}
  if(!current){signedOut();return;}
  user=current;
  login.hidden=true;
  account.textContent='تم التحقق من حسابك. تقدر تكمل الحجز.';
  next.disabled=false;
  fillProfile(current);
  showStep(step);
  loadProfile(current,token);
  loadTeachers(current,token);
  trackBookings(current,token);
},accountError);

// A failed CDN/auth initialization should never leave the screen as endless 'checking'.
setTimeout(()=>{if(!user && account.textContent.includes('جارٍ التحقق')){
  account.textContent='التحقق بياخد وقت أطول من المتوقع؛ افحص اتصالك أو أعد تحميل الصفحة.';
  login.hidden=false;
}},12000);

section.addEventListener('change',()=>{
  const s=canonical('section');
  if(s===ENGLISH_SUBJECT)subject.value=ENGLISH_SUBJECT;
  else if(subject.value===ENGLISH_SUBJECT)subject.value='';
  else if(s==='الرياضيات'&&!subject.value)subject.value='الرياضيات';
  renderSubjects();updateTeacher();
});
subject.addEventListener('input',updateTeacher);
field('lessonType').addEventListener('change',renderPrice);
teacherSelect.addEventListener('change',()=>{activeTeacher={...resolvedTeacher(teacherSelect.value),category:categoryFor()};renderPrice();});
back.addEventListener('click',()=>{if(submitting)return;setMessage('');showStep(step-1,true);});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(submitting)return;
  if(!user){setMessage('سجّل الدخول أولًا علشان تكمل الحجز.','error');login.hidden=false;return;}
  const data=selectedData();
  const error=validation(step,data);
  if(error){setMessage(error.message,'error');error.control?.focus();error.control?.reportValidity?.();return;}
  if(step<steps.length-1){
    if(step===steps.length-2)renderSummary(data);
    setMessage('');showStep(step+1,true);return;
  }
  // Final validation includes all previous steps, not just the review panel.
  for(let i=0;i<steps.length-1;i++){
    const problem=validation(i,data);
    if(problem){showStep(i);setMessage(problem.message,'error');problem.control?.focus();return;}
  }
  submitting=true;next.disabled=true;back.disabled=true;
  setMessage('جارٍ إرسال طلب الحجز…');
  const current=user,token=generation;
  const quotedPrice=asBookingPrice(bookingPrice(data,activeTeacher.category));
  const record={...data,teacherUid:activeTeacher.uid||null,teacherName:activeTeacher.name,
    studentUid:current.uid,status:'جديد',source:'booking',bookingVersion:4,
    autoAssignedTeacher:teacherSelect.disabled,quotedPrice,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  try{
    const ref=doc(collection(db,'bookings'));
    if(token!==generation)throw new Error('تغيّر الحساب قبل إرسال الطلب.');
    await setDoc(ref,record);
    setMessage('✅ تم إرسال الحجز بنجاح. تقدر تتابع حالته من «حجوزاتي».','success');
    // Notification must never cause a successfully saved booking to be treated as a failure.
    addDoc(collection(db,'notifications'),{audience:'admin',targetRole:'admin',type:'booking',
      title:'📅 طلب حجز جديد',message:`الطالب ${data.fullName} حجز ${data.subject} مع ${activeTeacher.name}.`,
      bookingId:ref.id,studentUid:current.uid,createdBy:current.uid,createdAt:serverTimestamp(),readBy:[]
    }).catch(error=>console.warn('[Zad booking] Notification failed:',error));
    form.reset();
    const initialSection=params.get('section');if(initialSection)chooseSection(initialSection);
    const initialSubject=params.get('subject');if(initialSubject)subject.value=initialSubject;
    updateTeacher();fillProfile(current,profile);renderSubjects();showStep(0);
  }catch(error){console.error('[Zad booking] Save failed:',error);setMessage('تعذر إرسال الحجز: '+(error.code||error.message),'error');}
  finally{submitting=false;back.disabled=false;next.disabled=!user;}
});

// Preserve incoming booking links from the teacher directory.
const initialSection=params.get('section');
if(initialSection)chooseSection(initialSection);
if(params.get('subject'))subject.value=params.get('subject').slice(0,150);
renderSubjects();updateTeacher();showStep(0);
