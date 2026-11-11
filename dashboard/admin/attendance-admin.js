import {sharedAdminGetDocs,clearAdminReadCache} from './firestore-read-cache.js';
const getDocs=(ref)=>sharedAdminGetDocs(ref,rawGetDocs,auth);
import {amountDue,amountPaid,amountRemaining,money as cashMoney} from '../payment-utils.js';
import {advanceSnapshot} from '../advance-credit.js';
import {archiveAttendance,restoreAttendance} from './attendance-archive.js';
import { db, auth } from '../../firebase-config.js';
import { collection, query, where, getDocs as rawGetDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { SUBJECTS, teacherForSubject, ENGLISH_TEACHERS, isEnglishSubject, availableScienceTeachers } from '../attendance-subjects.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let students = [], records = [], cancelledRecords = [];
let teacherProfiles = [];
const teacherKey = name => String(name||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/^(الأستاذ|أستاذ|مستر|ميس|أ\/)\s*/i,'').replace(/\s+/g,' ').trim().toLowerCase();
function teacherUidForName(name) {
  const key=teacherKey(name);
  if(!key||key.includes('،'))return null;
  const names=p=>[p.fullName,p.name,p.displayName,...(Array.isArray(p.attendanceAliases)?p.attendanceAliases:[])].map(teacherKey).filter(Boolean);
  let matches=teacherProfiles.filter(p=>names(p).includes(key));
  // السماح بمطابقة الاسم الثلاثي مع الاسم الرباعي إذا كان الحساب فريدًا.
  if(!matches.length && (key.split(' ').length>=3 || key==='سعد علاء'))
    matches=teacherProfiles.filter(p=>names(p).some(n=>n.startsWith(key+' ')));
  return matches.length===1?matches[0].id:null;
}

let ambiguousEmailAccounts = new Map();
let creditsByStudent = new Map();
let activeFinancialStudentIds = new Set();
const creditFor = row => creditsByStudent.get(row.studentUid)?.byLesson.get(row.id)||null;
const summary = $('attendanceStudentSummary');
const form = $('manualAttendanceForm'), studentSelect = $('attendanceStudent'), search = $('attendanceStudentSearch'), rows = $('attendanceRows'), message = $('attendanceMessage');
const subjectSelect = $('attendanceSubject');

const optionsBox = $('attendanceSubjectOptions');
const pickerSummary = $('attendanceSubjectSummary');
if (subjectSelect && optionsBox) {
  subjectSelect.innerHTML = SUBJECTS.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
  subjectSelect.multiple = true;
  optionsBox.innerHTML = SUBJECTS.map((x,i) => `<label><input type="checkbox" data-subject-index="${i}"><span>${esc(x)}</span></label>`).join('');
  optionsBox.addEventListener('change', event => {
    if (!event.target.matches('input[type="checkbox"]')) return;
    const i = Number(event.target.dataset.subjectIndex);
    if (subjectSelect.options[i]) subjectSelect.options[i].selected = event.target.checked;
    const values = getSelectedSubjects();
    pickerSummary.textContent = values.length ? values.join('، ') : 'اختر مادة أو أكثر';
    syncAttendanceTeacher();
  });
}

function getSelectedSubjects() {
  return Array.from(subjectSelect?.selectedOptions || []).map(opt => opt.value.trim()).filter(Boolean);
}

function syncAttendanceTeacher() {
  const field = $('attendanceTeacherName');
  if (!field) return;
  const selected=getSelectedSubjects();
  const previous=field.value;
  const english=selected.some(isEnglishSubject);
  const science=availableScienceTeachers(selected);
  const choices=!selected.length
    ? [{value:'',label:'اختر المادة أولًا'}]
    : science.length
      ? science.map(name=>({value:name,label:'أ/ '+name}))
      : english
        ? [{value:teacherForSubject(selected),label:'يحدد معلم مناهج الإنجليزي من الإدارة'}]
        : [{value:teacherForSubject(selected)||'غير محدد',label:teacherForSubject(selected)||'غير محدد'}];
  field.replaceChildren(...choices.map(x=>new Option(x.label,x.value)));
  if(choices.some(x=>x.value===previous))field.value=previous;
  const selectable=choices.length>1;
  field.disabled=!selectable;
  field.style.cursor=selectable?'pointer':'not-allowed';
  field.setAttribute('aria-label',selectable?'اختر معلم الحصة':'المعلم المحدد تلقائيًا');
}

subjectSelect?.addEventListener('change', syncAttendanceTeacher);
syncAttendanceTeacher();

if ($('attendanceDate')) $('attendanceDate').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function filterStudents() {
  const q = (search.value || '').trim().toLowerCase();
  const prev = studentSelect.value;
  const list = students.filter(x => window.ZadNameSearch.matches([x.fullName, x.name, x.email],q));
  studentSelect.innerHTML = '<option value="">اختر الطالب</option>' + list.map(x => `<option value="${esc(x.id)}">${esc(x.fullName || x.name || x.email || 'طالب')} — ${esc(x.email || '')} — UID: ${esc(x.id)}</option>`).join('');
  if (list.some(x => x.id === prev)) studentSelect.value = prev;
  else if (q && list.length === 1) studentSelect.value = list[0].id;
  // اختيار الطالب الوحيد المطابق تلقائيًا لتجنب خطأ HTML required
}

function money(v) {
  return Number(v || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
}

// واجهة البحث والتصفية لسجل الحضور: عرض فقط، ولا تغير أو تحذف أي بيانات.
const logFilterIds = ['attendanceLogSearch','attendanceLogSubject','attendanceLogTeacher','attendanceLogStatus','attendanceLogPayment','attendanceLogFrom','attendanceLogTo'];
const logFilterValue = (id, fallback = '') => $(id)?.value || fallback;
const asSearchText = v => String(v ?? '').trim().toLocaleLowerCase('ar');
function subjectsOfAttendance(record) {
  const parts = Array.isArray(record.subjects) && record.subjects.length
    ? record.subjects
    : String(record.subject ?? '').split(/[،,]/);
  return parts.map(v => String(v).trim()).filter(Boolean);
}
function syncAttendanceLogOptions(id, names, defaultLabel) {
  const select = $(id);
  if (!select) return;
  const current = select.value;
  const options = [{value:'all', label:defaultLabel}, ...names.map(name=>({value:name,label:name}))];
  // لا تستبدل الخيارات إذا لم تتغير حتى يظل التركيز والقائمة المنسدلة مستقرين.
  if (select.options.length !== options.length || options.some((opt,i)=>select.options[i]?.value!==opt.value)) {
    select.replaceChildren(...options.map(opt=>new Option(opt.label,opt.value)));
  }
  select.value = options.some(opt=>opt.value===current) ? current : 'all';
}
function attendanceLogRemaining(record) {
  const applied = creditFor(record);
  return applied ? applied.afterPiastres : amountRemaining(record);
}
function matchesAttendancePayment(record, mode) {
  if (mode === 'all') return true;
  const due = amountDue(record);
  const remaining = attendanceLogRemaining(record);
  if (mode === 'free') return due === 0;
  if (mode === 'paid') return due > 0 && remaining === 0;
  if (mode === 'partial') return due > 0 && remaining > 0 && remaining < due;
  if (mode === 'unpaid') return due > 0 && remaining === due;
  if (mode === 'owed') return due > 0 && remaining > 0;
  return true;
}
function filteredAttendanceRecords() {
  const search = asSearchText(logFilterValue('attendanceLogSearch'));
  const subject = logFilterValue('attendanceLogSubject','all');
  const teacher = logFilterValue('attendanceLogTeacher','all');
  const status = logFilterValue('attendanceLogStatus','all');
  const payment = logFilterValue('attendanceLogPayment','all');
  const dateFrom = logFilterValue('attendanceLogFrom');
  const dateTo = logFilterValue('attendanceLogTo');
  const studentsById = new Map(students.map(student=>[student.id,student]));
  return records.filter(record=>{
    if (search) {
      const student = studentsById.get(record.studentUid);
      const haystack = [record.studentName,student?.fullName,student?.name,student?.email]
        .map(asSearchText).join(' ');
      if (!window.ZadNameSearch.matches(haystack,search)) return false;
    }
    if (subject !== 'all' && !subjectsOfAttendance(record).includes(subject)) return false;
    if (teacher !== 'all' && (record.teacherName || 'الإدارة') !== teacher) return false;
    if (status !== 'all' && record.status !== status) return false;
    if (!matchesAttendancePayment(record,payment)) return false;
    const date = String(record.date || '').slice(0,10);
    if (dateFrom && (!date || date < dateFrom)) return false;
    if (dateTo && (!date || date > dateTo)) return false;
    return true;
  });
}
function renderAttendanceLog(){
  if (!rows) return;
  const subjects=[...new Set(records.flatMap(subjectsOfAttendance))].sort((a,b)=>a.localeCompare(b,'ar'));
  const teachers=[...new Set(records.map(record=>record.teacherName || 'الإدارة'))].sort((a,b)=>a.localeCompare(b,'ar'));
  syncAttendanceLogOptions('attendanceLogSubject',subjects,'جميع المواد');
  syncAttendanceLogOptions('attendanceLogTeacher',teachers,'جميع المعلمين');
  const matches=filteredAttendanceRecords();
  const counter=$('attendanceLogCount');
  if(counter) counter.textContent = `عرض ${matches.length.toLocaleString('ar-EG')} من إجمالي ${records.length.toLocaleString('ar-EG')} سجل حضور وغياب`;
  rows.innerHTML = matches.length ? matches.map(x=>`<tr>
    <td>${esc(x.studentName || '-')}</td><td>${esc(x.date || '-')}</td><td>${esc(x.subject || '-')}</td>
    <td>${esc(x.status || '-')}</td><td>${money(x.price)}</td>
    <td><button type="button" class="btn ${attendanceLogRemaining(x)===0 ? 'gold' : (amountPaid(x)>0 || (creditFor(x)?.advanceAppliedPiastres||0)>0) ? 'attendance-partial-payment' : 'attendance-unpaid-payment'}" data-paid="${esc(x.id)}" aria-label="تغيير حالة الدفع">${creditFor(x)?.afterPiastres===0?'✅ مغطاة / مدفوعة':creditFor(x)?.advanceAppliedPiastres>0?'🟡 جزء مغطى بالمقدم، المتبقي '+cashMoney(creditFor(x).afterPiastres):amountRemaining(x)===0?'✅ مدفوعة':amountPaid(x)>0?'🟡 مدفوع جزئيًا '+cashMoney(amountPaid(x)):'⏳ غير مدفوعة'}</button></td>
    <td>${esc(x.teacherName || 'الإدارة')}</td><td>${x.status==='حاضر'?`<button type="button" class="btn" data-payroll-extra="${esc(x.id)}">➕ إضافي المرتب</button>`:'—'}</td><td><button type="button" class="btn" data-edit="${esc(x.id)}">✏️ تعديل الحصة</button> <button type="button" class="btn danger" data-del="${esc(x.id)}">حذف</button></td></tr>`).join('') : `<tr><td colspan="9">${records.length?'لا توجد حصص مطابقة للبحث والتصفية. جرّب مسح الفلاتر.':'لا توجد سجلات حضور بعد.'}</td></tr>`;
}

function render() {
  const history=$('zadArchivedAttendanceList');
  if(history){
    history.innerHTML=cancelledRecords.length?cancelledRecords.map(x=>`<article class="zad-pay-archived-row"><span><b>${esc(x.studentName||'طالب')}</b> · ${esc(x.date||'—')} · ${esc(x.subject||'حصة')}<small>السعر: ${money(x.price)} · المدفوع المسجل: ${cashMoney(amountPaid(x))}${Number(x.cashPaidPiastres||0)>0?' · ⚠️ يحتاج مراجعة مالية':''}</small></span><button type="button" class="btn" data-restore-attendance="${esc(x.id)}">↩ استرجاع الحصة</button></article>`).join(''):'<p>لا توجد حصص ملغاة.</p>';
  }
  renderAttendanceLog();

  const summarySearch = String($('attendanceSummarySearch')?.value || '').trim().toLocaleLowerCase('ar');
  const subjectFilter = $('attendanceSummarySubject')?.value || 'all';
  const sortOrder = $('attendanceSummarySort')?.value || 'name';

  const relevant = records.filter(x => x.studentUid && (x.status === 'حاضر' || x.status === 'غائب'));
  const summarySubjectSelect = $('attendanceSummarySubject');
  if (summarySubjectSelect) {
    const current = summarySubjectSelect.value;
    const subjects = [...new Set(relevant.map(x => x.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
    summarySubjectSelect.innerHTML = '<option value="all">كل المواد</option>' + subjects.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    summarySubjectSelect.value = subjects.includes(current) ? current : 'all';
  }
  const selectedSubject = summarySubjectSelect?.value || subjectFilter;
  const stats = new Map();
  // المقدم قد يوجد لطالب لم يحضر أول حصة بعد.
  // يظهر في الملخص العام فقط، ولا يُدرج في فلاتر مادة أخرى بدون حصص منها.
  if (selectedSubject === 'all') for (const uid of activeFinancialStudentIds) {
    const student=students.find(s=>s.id===uid);
    stats.set(uid,{uid,name:student?.fullName||student?.name||student?.email||'طالب',present:0,absent:0,paid:0});
  }
  for (const x of relevant) {
    if (selectedSubject !== 'all' && x.subject !== selectedSubject) continue;
    const id = x.studentUid;
    if (!stats.has(id)) stats.set(id, {uid:id,name: x.studentName || 'طالب', present: 0, absent: 0, paid: 0});
    const st = stats.get(id);
    if (x.status === 'حاضر') st.present++;
    if (x.status === 'غائب') st.absent++;
    st.paid += (amountPaid(x)+(creditFor(x)?.advanceAppliedPiastres||0)) / 100;
  }
  const cards = [...stats.values()].filter(st => window.ZadNameSearch.matches(st.name,summarySearch));
  cards.sort((a, b) => sortOrder === 'most-present' ? (b.present - a.present || a.name.localeCompare(b.name, 'ar')) : sortOrder === 'most-paid' ? (b.paid - a.paid || a.name.localeCompare(b.name, 'ar')) : a.name.localeCompare(b.name, 'ar'));
  const count = $('attendanceSummaryCount'); if (count) count.textContent = `${cards.length.toLocaleString('ar-EG')} طالب`;
  const list = $('attendanceSummaryCards');
  if (list) list.innerHTML = cards.length ? cards.map(st => {
    const account=creditsByStudent.get(st.uid);
    const advance=account?.availableAdvancePiastres||0;
    const owed=account?.unpaidAfterPiastres||0;
    const state=advance>0?`✅ له رصيد مقدم: ${cashMoney(advance)}`:owed>0?`❌ عليه غير مسدد: ${cashMoney(owed)}`:'✔️ حسابه متوازن: 0 ج.م';
    return `<article class="attendance-summary-card"><strong>${esc(st.name)}</strong><span>✅ حضر ${st.present} حصة</span><span>❌ غاب ${st.absent} حصة</span><span>💰 مدفوع أو مغطى بالمقدم لهذه المادة: ${money(st.paid)}</span><b>${state}</b><span>مقدم استُخدم على حصصه: ${cashMoney(account?.usedAdvancePiastres||0)}</span><span class="zad-summary-finance-note">الرصيد المالي لجميع المواد، وليس المادة المحددة فقط</span></article>`;
  }).join('') : '<div class="user-mobile-empty">لا توجد سجلات حضور أو غياب مطابقة للبحث أو المادة المختارة.</div>';
}

async function load() {
  try {
    message.textContent = 'جارٍ تحميل بيانات الحضور والطلاب والمدفوعات...';
    const [us, att, pay] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'lessonAttendance')), getDocs(collection(db, 'vodafonePayments'))]);
    teacherProfiles=us.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.role==='teacher' && x.status==='active');
    const allStudentProfiles=us.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.role==='student');
    const candidateStudents=allStudentProfiles.filter(x=>!x.linkedToUid);
    const emailGroups=new Map();
    for(const st of candidateStudents){
      const email=String(st.email||'').trim().toLowerCase();
      if(!email)continue;
      const list=emailGroups.get(email)||[];
      list.push(st);emailGroups.set(email,list);
    }
    // Never guess the real account when the same email has multiple active
    // student profiles; require an admin migration to mark the legacy ones.
    ambiguousEmailAccounts=new Map([...emailGroups].filter(([,group])=>group.length>1));
    students=candidateStudents.filter(st=>{
      const email=String(st.email||'').trim().toLowerCase();
      return !email || !ambiguousEmailAccounts.has(email);
    });
    const ambiguityBox=$('attendanceIdentityWarning');
    if(ambiguityBox){
      ambiguityBox.textContent=ambiguousEmailAccounts.size
        ? '⚠️ توجد '+ambiguousEmailAccounts.size+' مجموعة حسابات طلاب مكررة البريد. لن تظهر حساباتها في تسجيل الحضور حتى تراجع ربطها عبر «تصحيح ربط الحصص القديمة» أدناه، حتى لا تتكرر مشكلة ظهور الصفر عند الطالب.'
        : '✅ قائمة تسجيل الحضور تعرض الحسابات غير المرتبطة بحساب قديم. راجع UID الطالب عند التسجيل.';
    }
    const allStudentsLessons=att.docs.map(d=>({id:d.id,...d.data()}));
    const groups=new Map();
    for(const a of allStudentsLessons){if(!a.studentUid)continue;const g=groups.get(a.studentUid)||{lessons:[],payments:[]};g.lessons.push(a);groups.set(a.studentUid,g);}
    for(const d of pay.docs){const a=d.data();if(!a.studentUid)continue;const g=groups.get(a.studentUid)||{lessons:[],payments:[]};g.payments.push(a);groups.set(a.studentUid,g);}
    creditsByStudent=new Map([...groups].map(([uid,g])=>[uid,advanceSnapshot(g.lessons,g.payments)]));
    activeFinancialStudentIds=new Set([...groups].filter(([uid,g])=>g.lessons.some(x=>x.deleted!==true)||g.payments.some(x=>x.status==='approved')).map(([uid])=>uid));
    const allRecords=allStudentsLessons
      .filter(x=>x.source==='manual-attendance'||x.source==='teacher-dashboard');
    records=allRecords.filter(x=>x.deleted!==true).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    cancelledRecords=allRecords.filter(x=>x.deleted===true).sort((a,b)=>String(b.deletedAt?.seconds||'').localeCompare(String(a.deletedAt?.seconds||'')));
    filterStudents();
    render();
    message.textContent = '';
  } catch (e) {
    console.error(e);
    message.textContent = 'تعذر تحميل البيانات: ' + (e.code || e.message);
  }
}


// قرار صريح بشأن المقدم: الاحتفاظ بالرصيد لا يستهلكه تلقائياً.
function askAdvanceDecision({studentName,available,price}){
 return new Promise(resolve=>{
  const dlg=document.createElement('dialog');dlg.setAttribute('dir','rtl');
  dlg.style.cssText='max-width:min(94vw,540px);width:100%;border:1px solid #d6ae44;border-radius:18px;background:#132239;color:#fff;padding:24px;box-shadow:0 20px 80px #0008';
  const applied=Math.min(available,price);
  dlg.innerHTML=`<h3 style="color:#f2c94c">💳 هل تريد الخصم من رصيد الطالب؟</h3><p>${esc(studentName)}</p><p>الرصيد المتاح: <strong>${cashMoney(available)}</strong> — سعر الحصة: <strong>${cashMoney(price)}</strong></p><p>عند الخصم تُغطّى ${cashMoney(applied)} ويتبقى على الحصة ${cashMoney(price-applied)}.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" data-answer="deduct" style="background:#f2c94c;color:#101b2b;padding:12px;border:0;border-radius:9px">خصم من الرصيد</button><button type="button" data-answer="keep" style="background:#243b58;color:white;padding:12px;border:1px solid #6480a0;border-radius:9px">الاحتفاظ بالرصيد — غير مدفوعة</button><button type="button" data-answer="cancel" style="background:transparent;color:white;padding:12px;border:1px solid #6480a0;border-radius:9px">إلغاء</button></div>`;
  const finish=answer=>{dlg.close();dlg.remove();resolve(answer)};
  dlg.addEventListener('click',e=>{const b=e.target.closest('[data-answer]');if(b)finish(b.dataset.answer)});
  dlg.addEventListener('cancel',e=>{e.preventDefault();finish('cancel')});
  document.body.append(dlg);dlg.showModal();
 });
}


// A payment marked as "paid" can mean external payment or use of existing student credit.
// Credit coverage is represented ONLY by advanceUseMode='deduct' with paid=false,
// so advance-credit.js never counts the same charge as both cash and credit.
function askExistingLessonBalance({studentName,available,due,covered}) {
  return new Promise(resolve => {
    const dialog=document.createElement('dialog');
    dialog.dir='rtl';
    dialog.style.cssText='width:min(96vw,550px);max-width:550px;padding:22px;border-radius:17px;border:1px solid #d6ae44;background:#132239;color:#fff;box-shadow:0 20px 85px #0009';
    const remaining=Math.max(0,due-covered);
    dialog.innerHTML=`<h3 style="margin-top:0;color:#f2c94c">💳 هل تريد الخصم من رصيد الطالب؟</h3>
      <p><strong>${esc(studentName||'الطالب')}</strong></p>
      <p>الرصيد المقدم المتاح: <strong>${cashMoney(available)}</strong><br>قيمة الحصة: <strong>${cashMoney(due)}</strong></p>
      <p>${covered>0?`يمكن خصم ${cashMoney(covered)}، ويتبقى ${cashMoney(remaining)} على الحصة.`:'لا يوجد رصيد مقدم متاح حاليًا للخصم.'}</p>
      <div style="display:flex;gap:9px;flex-wrap:wrap">
      <button type="button" data-payment-choice="deduct" ${covered<=0?'disabled':''} style="padding:11px;border:0;border-radius:8px;background:#f2c94c;color:#14233a;font-weight:700;cursor:pointer">${covered>=due?'نعم، خصم من الرصيد':'نعم، خصم المتاح (تبقى الحصة مدفوعة جزئيًا)'}</button>
      <button type="button" data-payment-choice="direct" style="padding:11px;border:1px solid #7392b8;border-radius:8px;background:#284364;color:#fff;cursor:pointer">لا، مدفوعة مباشرة دون خصم الرصيد</button>
      <button type="button" data-payment-choice="cancel" style="padding:11px;border:1px solid #7392b8;border-radius:8px;background:transparent;color:#fff;cursor:pointer">إلغاء</button>
      </div>`;
    const finish=choice=>{dialog.close();dialog.remove();resolve(choice)};
    dialog.addEventListener('click',e=>{const button=e.target.closest('[data-payment-choice]');if(button&&!button.disabled)finish(button.dataset.paymentChoice)});
    dialog.addEventListener('cancel',e=>{e.preventDefault();finish('cancel')});
    document.body.append(dialog);dialog.showModal();
  });
}
async function chooseExistingLessonPayment(lesson,{studentUid=lesson.studentUid,price=lesson.price,status=lesson.status,studentName=lesson.studentName}={}) {
  // Fresh reads avoid using the balance captured when the admin originally opened the page.
  const [fresh,lessonsResponse,paymentsResponse]=await Promise.all([
    getDoc(doc(db,'lessonAttendance',lesson.id)),
    rawGetDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',studentUid))),
    rawGetDocs(query(collection(db,'vodafonePayments'),where('studentUid','==',studentUid)))
  ]);
  if(!fresh.exists()||fresh.data().deleted===true)throw new Error('لم تعد الحصة متاحة. حدّث سجلات الحضور.');
  if(Number(fresh.data().cashPaidPiastres||0)>0)throw new Error('الحصة مرتبطة بدفعة معتمدة. لا يمكن تغيير طريقة سدادها يدويًا.');
  const others=lessonsResponse.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.id!==lesson.id);
  const payments=paymentsResponse.docs.map(d=>({id:d.id,...d.data()}));
  const candidate={...fresh.data(),id:lesson.id,studentUid,price,status,paid:false,advanceUseMode:'deduct',deleted:false};
  const coverage=advanceSnapshot([...others,candidate],payments);
  const covered=coverage.byLesson.get(lesson.id)?.advanceAppliedPiastres||0;
  const available=advanceSnapshot(others,payments).availableAdvancePiastres;
  const choice=await askExistingLessonBalance({studentName,available,due:amountDue(candidate),covered});
  if(choice==='cancel')return null;
  return choice==='deduct'
    ? {paid:false,paidAt:null,advanceUseMode:'deduct'}
    : {paid:true,paidAt:fresh.data().paidAt||serverTimestamp(),advanceUseMode:'keep'};
}

search?.addEventListener('input', filterStudents);
form?.addEventListener('submit', async e => {
  e.preventDefault();
  let student = students.find(x => x.id === studentSelect.value);
  if (!student) {
    const matches = students.filter(x => window.ZadNameSearch.matches([x.fullName, x.name, x.email],(search.value || '').trim()));
    if (matches.length === 1) { studentSelect.value = matches[0].id; student = matches[0]; }
    else { message.textContent = matches.length > 1 ? 'ظهر أكثر من طالب، اختر الطالب الصحيح من القائمة.' : 'اختر الطالب أولًا أو ابحث بالاسم الصحيح.'; return; }
  }

  const selectedSubjects = getSelectedSubjects();
  if (!selectedSubjects.length) { message.textContent = 'اختر مادة واحدة على الأقل.'; return; }

  const price = Number($('attendancePrice').value);
  if (!Number.isFinite(price) || price < 0 || price > 100000) { message.textContent = 'أدخل سعر حصة صحيحًا.'; return; }

  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    // A fresh check prevents writing a new attendance entry to an obsolete UID
    // if the admin repaired the account while this form was still open.
    const currentProfile=await getDoc(doc(db,'users',student.id));
    if(!currentProfile.exists() || currentProfile.data().role!=='student' || currentProfile.data().linkedToUid){
      message.textContent='تم ربط هذا الحساب بحساب آخر أو لم يعد متاحًا. اضغط تحديث السجلات واختر UID الحقيقي للطالب.';
      await load();return;
    }
    const currentEmail=String(currentProfile.data().email||'').trim();
    if(currentEmail){
      const sameEmail=await getDocs(query(collection(db,'users'),where('email','==',currentEmail)));
      const active=sameEmail.docs.filter(d=>d.data().role==='student' && !d.data().linkedToUid);
      if(active.length>1){
        message.textContent='يوجد أكثر من حساب طالب بنفس البريد؛ استخدم أداة تصحيح الربط أولًا لتحديد UID الحقيقي، ثم سجل الحصة.';
        return;
      }
    }
    // اقرأ رصيد الطالب مجددًا قبل التسجيل لتفادي الاعتماد على بيانات قديمة.
    const [freshLessons,freshPayments]=await Promise.all([
      getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',student.id))),
      getDocs(query(collection(db,'vodafonePayments'),where('studentUid','==',student.id)))
    ]);
    const financial=advanceSnapshot(freshLessons.docs.map(d=>({id:d.id,...d.data()})),freshPayments.docs.map(d=>({id:d.id,...d.data()})));
    const available=financial.availableAdvancePiastres;
    const chargePiastres=Math.round(price*100);
    let advanceUseMode='keep';
    if(available>0 && chargePiastres>0 && $('attendanceStatus').value==='حاضر'){
      advanceUseMode=await askAdvanceDecision({studentName:student.fullName||student.name||student.email||'الطالب',available,price:chargePiastres});
      if(advanceUseMode==='cancel'){message.textContent='تم إلغاء تسجيل الحصة دون تغيير الرصيد.';return;}
    }
    const commonData = {
      studentUid: student.id,
      studentName: student.fullName || student.name || student.email,
      teacherUid: teacherUidForName($('attendanceTeacherName')?.value),
      recordedByUid: auth.currentUser?.uid || null,
      date: $('attendanceDate').value,
      status: $('attendanceStatus').value,
      price,
      paid: false,
      advanceUseMode,
      currency: 'EGP',
      note: $('attendanceNote').value.trim(),
      source: 'manual-attendance',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // حصة واحدة بس مهما كان عدد المواد المختارة؛ السعر والدفع والحضور يحسبون مرة واحدة.
    await addDoc(collection(db, 'lessonAttendance'), {
      ...commonData,
      subjects: selectedSubjects,
      subject: selectedSubjects.join('، '),
      teacherName: $('attendanceTeacherName')?.value || teacherForSubject(selectedSubjects) || 'غير محدد'
    });

    message.textContent = `✅ تم حفظ حصة واحدة (${selectedSubjects.join('، ')}) بنجاح`;
    clearAdminReadCache();
    await load();
    window.dispatchEvent(new Event('zad:attendance-changed'));
  } catch (err) {
    console.error(err);
    message.textContent = 'تعذر الحفظ: ' + (err.code || err.message);
  } finally {
    button.disabled = false;
  }
});


// تعديل سجل الحضور نفسه: الطالب والتاريخ والمواد والحضور والدفع والسعر.
const attendanceEditDialog = document.createElement('dialog');
attendanceEditDialog.id='zadAttendanceEditDialog';
attendanceEditDialog.dir='rtl';
attendanceEditDialog.style.cssText='background:#111e34;color:#f7f7fc;border:1px solid #c9a84c;border-radius:16px;padding:22px;width:min(650px,95vw);max-height:90vh;overflow:auto;box-shadow:0 20px 90px #0009';
attendanceEditDialog.innerHTML=`<form id="zadAttendanceEditForm" style="display:grid;gap:12px">
<h3 style="margin:0;color:#e8c96d">✏️ تعديل بيانات الحصة</h3>
<label>الطالب<select name="studentUid" required style="width:100%;padding:10px"></select></label>
<label>تاريخ الحصة<input name="date" type="date" required style="width:100%;padding:10px"></label>
<fieldset style="border:1px solid #64748b;border-radius:8px"><legend>المواد (يمكن اختيار أكثر من مادة، وتحسب حصة واحدة)</legend><div data-edit-subjects style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"></div></fieldset>
<label data-edit-english-teacher style="display:none">مدرس اللغة الإنجليزية<select name="englishTeacher" style="width:100%;padding:10px"><option value="">يحدد من الإدارة</option></select></label>
<label data-edit-science-teacher style="display:none">مدرس العلوم / الكيمياء / الرياضيات<select name="scienceTeacher" style="width:100%;padding:10px"></select></label>
<label>حالة الحضور<select name="status" style="width:100%;padding:10px"><option>حاضر</option><option>غائب</option></select></label>
<label>سعر الحصة بالجنيه<input name="price" type="number" min="0" max="100000" step="0.01" required style="width:100%;padding:10px"></label>
<label>حالة الدفع<select name="paid" style="width:100%;padding:10px"><option value="false">غير مدفوعة</option><option value="true">مدفوعة</option></select></label>
<label>ملاحظات<textarea name="note" rows="3" style="width:100%;padding:10px"></textarea></label>
<p data-edit-error role="alert" style="color:#ffb4a2;margin:0"></p>
<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn gold" type="submit">💾 حفظ التعديلات</button><button class="btn" type="button" data-cancel>إلغاء</button></div>
</form>`;
document.body.append(attendanceEditDialog);
const attendanceEditForm=attendanceEditDialog.querySelector('form');
let attendanceEditingId=null;
attendanceEditDialog.querySelector('[data-cancel]').addEventListener('click',()=>attendanceEditDialog.close());
function syncEditEnglishTeacher() {
  const selected=[...attendanceEditForm.querySelectorAll('input[name="subjectItem"]:checked')].map(input=>input.value);
  const scientists=availableScienceTeachers(selected);
  attendanceEditForm.querySelector('[data-edit-english-teacher]').style.display=scientists.length===0&&selected.some(isEnglishSubject)?'':'none';
  const wrapper=attendanceEditForm.querySelector('[data-edit-science-teacher]');
  const field=attendanceEditForm.elements.scienceTeacher;
  const previous=field.value;
  if(scientists.length){
    field.replaceChildren(...scientists.map(name=>new Option('أ/ '+name,name)));
    if(scientists.includes(previous))field.value=previous;
    wrapper.style.display='';
  }else wrapper.style.display='none';
}
attendanceEditForm.querySelector('[data-edit-subjects]').addEventListener('change', syncEditEnglishTeacher);

function openAttendanceEditor(record){
  attendanceEditingId=record.id;
  attendanceEditForm.elements.studentUid.innerHTML=students.map(st=>`<option value="${esc(st.id)}">${esc(st.fullName||st.name||st.email||st.id)}</option>`).join('');
  attendanceEditForm.elements.studentUid.value=record.studentUid||'';
  attendanceEditForm.elements.date.value=record.date||'';
  attendanceEditForm.elements.status.value=record.status||'حاضر';
  attendanceEditForm.elements.price.value=Number(record.price)||0;
  attendanceEditForm.elements.paid.value=record.paid===true?'true':'false';
  attendanceEditForm.elements.note.value=record.note||'';
  const selected=Array.isArray(record.subjects)?record.subjects:String(record.subject||'').split('،').map(v=>v.trim());
  attendanceEditForm.querySelector('[data-edit-subjects]').innerHTML=[...new Set([...SUBJECTS,...selected.filter(Boolean)])].map(v=>`<label style="display:flex;align-items:center;gap:7px"><input type="checkbox" name="subjectItem" value="${esc(v)}" ${selected.includes(v)?'checked':''}>${esc(v)}</label>`).join('');
  // لا تعرض المدرسين غير المتاحين في الخيارات الجديدة، مع حفظ الإسناد التاريخي للسجلات القديمة.
  attendanceEditForm.elements.englishTeacher.replaceChildren(new Option('يحدد من الإدارة',''));
  attendanceEditForm.elements.englishTeacher.value='';
  syncEditEnglishTeacher();
  if(availableScienceTeachers(selected).includes(record.teacherName))attendanceEditForm.elements.scienceTeacher.value=record.teacherName;
  attendanceEditForm.querySelector('[data-edit-error]').textContent='';
  attendanceEditDialog.showModal();
}
attendanceEditForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const error=attendanceEditForm.querySelector('[data-edit-error]');
  const student=students.find(st=>st.id===attendanceEditForm.elements.studentUid.value);
  const selected=[...attendanceEditForm.querySelectorAll('input[name="subjectItem"]:checked')].map(input=>input.value);
  const price=Number(attendanceEditForm.elements.price.value);
  if(!student){error.textContent='اختر طالبًا صحيحًا.';return;}
  if(!selected.length){error.textContent='اختر مادة واحدة على الأقل.';return;}
  if(!Number.isFinite(price)||price<0||price>100000){error.textContent='سعر الحصة غير صحيح.';return;}
  const original=records.find(r=>r.id===attendanceEditingId);
  if(!original){error.textContent='السجل غير موجود؛ حدّث الصفحة.';return;}
  // الإسناد التاريخي لا يتغير عند تعديل الحضور أو الدفع فقط.
  const oldEnglishAssignment=selected.some(isEnglishSubject) &&
    /^(?:مستر\s*|أ\/\s*)?(?:علي\s+عبد\s+الحميد|(?:ميس\s*)?فاطمة\s+ضياء)/.test(String(original.teacherName||''));
  const selectedTeacherName=oldEnglishAssignment?original.teacherName:(availableScienceTeachers(selected).length ? attendanceEditForm.elements.scienceTeacher.value : teacherForSubject(selected));
  const paid=attendanceEditForm.elements.paid.value==='true';
  if (Number(original.cashPaidPiastres||0)>0 && (student.id!==original.studentUid||Math.round(price*100)!==amountDue(original)||paid!==(original.paid===true))){error.textContent='هذه الحصة مرتبطة بتحويل معتمد. لا يمكن تغيير الطالب أو السعر أو حالة الدفع حتى لا تختل الحسابات. يمكنك تغيير التاريخ والمادة والملاحظات.';return;}
  const submit=attendanceEditForm.querySelector('button[type="submit"]');submit.disabled=true;
  try{
    let paymentChange={paid,paidAt:paid?(original.paidAt||serverTimestamp()):null,advanceUseMode:paid?'keep':(original.advanceUseMode||'keep')};
    if(paid && original.paid!==true && attendanceLogRemaining(original)>0){
      paymentChange=await chooseExistingLessonPayment(original,{studentUid:student.id,price,status:attendanceEditForm.elements.status.value,studentName:student.fullName||student.name||student.email});
      if(!paymentChange)return;
    }
    await updateDoc(doc(db,'lessonAttendance',attendanceEditingId),{
      studentUid:student.id,studentName:student.fullName||student.name||student.email||'',
      date:attendanceEditForm.elements.date.value,
      subjects:selected,subject:selected.join('، '),
      teacherName:selectedTeacherName||'غير محدد',
      teacherUid:teacherUidForName(selectedTeacherName),
      status:attendanceEditForm.elements.status.value,
      price,...paymentChange,
      note:attendanceEditForm.elements.note.value.trim(),updatedAt:serverTimestamp()
    });
    attendanceEditDialog.close();await load();
    window.dispatchEvent(new Event('zad:attendance-changed'));
    message.textContent='✅ تم تعديل الحصة بنجاح؛ المواد المتعددة تظل حصة واحدة.';
  }catch(e){console.error(e);error.textContent='تعذر حفظ التعديل: '+(e.code||e.message);}
  finally{submit.disabled=false;}
});

rows?.addEventListener('click', async e => {
  const bonusButton=e.target.closest('[data-payroll-extra]');
  if(bonusButton){ document.dispatchEvent(new CustomEvent('zad:payroll-edit',{detail:{lessonId:bonusButton.dataset.payrollExtra}}));return; }
  const edit = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]'), paid = e.target.closest('[data-paid]');
  const x = records.find(r => r.id === (edit?.dataset.edit || del?.dataset.del || paid?.dataset.paid));
  if (!x) return;
  try {
    if (paid) {
      if(Number(x.cashPaidPiastres||0)>0){ alert('هذه الحصة مرتبطة بتحويل معتمد؛ لا يمكن تغيير طريقة سدادها يدويًا حتى لا تُحسب الدفعة مرتين.'); return; }
      if(attendanceLogRemaining(x)>0){
        const paymentChange=await chooseExistingLessonPayment(x);
        if(!paymentChange)return;
        await updateDoc(doc(db,'lessonAttendance',x.id),{...paymentChange,updatedAt:serverTimestamp()});
      }else{
        if(x.paid!==true){alert('هذه الحصة مغطاة من الرصيد المقدم بالفعل، ولا يوجد دفع مباشر لإلغائه.');return;}
        if(!confirm('هل تريد تغيير حالة الحصة إلى غير مدفوعة؟'))return;
        await updateDoc(doc(db,'lessonAttendance',x.id),{paid:false,paidAt:null,advanceUseMode:'keep',updatedAt:serverTimestamp()});
      }
    } else if (del) {
      const linked=Number(x.cashPaidPiastres||0)>0;
      const text=linked
        ? `هل تريد إلغاء حصة ${x.subject||''} للطالب ${x.studentName||''}؟\n\nتم سداد ${cashMoney(amountPaid(x))}. سيختفي سجل الحصة من الحضور والمستحقات، لكن سيبقى تحويل فودافون كاش محفوظًا في سجل المدفوعات بملاحظة «يحتاج تسوية/رد مبلغ». لن يُرَد المبلغ أو يُنقَل لحصة أخرى تلقائيًا.`
        : `هل تريد إلغاء حصة ${x.subject||''} للطالب ${x.studentName||''}؟\nسنبقي نسخة مؤرشفة يمكن للإدارة استرجاعها.`;
      if(!confirm(text))return;
      await archiveAttendance(x.id);
      clearAdminReadCache();
    } else if (edit) {
      openAttendanceEditor(x);
      return;

    }
    clearAdminReadCache();
    await load();
    window.dispatchEvent(new Event('zad:attendance-changed'));
  } catch (err) {
    alert('تعذر تنفيذ العملية: ' + (err.code || err.message));
  }
});

for (const id of logFilterIds) {
  const control = $(id);
  control?.addEventListener(['attendanceLogSearch'].includes(id) ? 'input' : 'change',renderAttendanceLog);
}
$('attendanceLogClear')?.addEventListener('click',()=>{
  for (const id of logFilterIds) {
    const control=$(id);
    if (control) control.value = control.tagName === 'SELECT' ? 'all' : '';
  }
  renderAttendanceLog();
});
$('refreshAttendance')?.addEventListener('click', ()=>{clearAdminReadCache();load();});
window.addEventListener('zad:payment-approved', load);
window.addEventListener('zad:attendance-changed', load);
$('attendanceSummarySearch')?.addEventListener('input', render);
$('attendanceSummarySubject')?.addEventListener('change', render);
$('attendanceSummarySort')?.addEventListener('change', render);
load();

$('zadArchivedAttendanceList')?.addEventListener('click',async e=>{
  const button=e.target.closest('[data-restore-attendance]');if(!button)return;
  if(!confirm('استرجاع الحصة سيعيد إدراجها في الحضور والمستحقات بنفس قيم الدفع السابقة. هل تريد المتابعة؟'))return;
  button.disabled=true;
  try{await restoreAttendance(button.dataset.restoreAttendance);await load();message.textContent='✅ تم استرجاع الحصة.';window.dispatchEvent(new Event('zad:attendance-archived'));}
  catch(err){alert('تعذر الاسترجاع: '+(err.code||err.message));button.disabled=false;}
});


// الطباعة تعتمد على سجلات الأدمن المحملة بالفعل، دون قراءة إضافية أو تغيير مالي.
function attendancePrintReport() {
  const matched = filteredAttendanceRecords();
  const teacher = logFilterValue('attendanceLogTeacher', 'all');
  const subject = logFilterValue('attendanceLogSubject', 'all');
  const status = logFilterValue('attendanceLogStatus', 'all');
  const payment = logFilterValue('attendanceLogPayment', 'all');
  const search = logFilterValue('attendanceLogSearch');
  const from = logFilterValue('attendanceLogFrom');
  const to = logFilterValue('attendanceLogTo');
  const total = matched.reduce((s, r) => {
    s.due += amountDue(r);
    s.cash += amountPaid(r);
    s.advance += creditFor(r)?.advanceAppliedPiastres || 0;
    s.remaining += attendanceLogRemaining(r);
    if (r.status === 'حاضر') s.present++;
    if (r.status === 'غائب') s.absent++;
    if (r.status === 'اعتذر') s.excused++;
    return s;
  }, {due:0, cash:0, advance:0, remaining:0, present:0, absent:0, excused:0});
  const groups = new Map();
  for (const r of matched) {
    const key = r.studentUid || 'name:' + String(r.studentName || '');
    const g = groups.get(key) || {name:r.studentName || 'غير محدد', count:0,present:0,absent:0,excused:0,due:0,cash:0,advance:0,remaining:0};
    g.count++;
    if (r.status === 'حاضر') g.present++;
    if (r.status === 'غائب') g.absent++;
    if (r.status === 'اعتذر') g.excused++;
    g.due += amountDue(r);
    g.cash += amountPaid(r);
    g.advance += creditFor(r)?.advanceAppliedPiastres || 0;
    g.remaining += attendanceLogRemaining(r);
    groups.set(key, g);
  }
  const format = value => cashMoney(value);
  const moneyCell = value => `<td class="money" dir="ltr">${esc(format(value))}</td>`;
  const numberCell = value => `<td class="number">${esc(value)}</td>`;
  const groupRows = [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(g=>`<tr>
    <td class="name">${esc(g.name)}</td>${numberCell(g.count)}${numberCell(g.present)}${numberCell(g.absent)}
    ${moneyCell(g.due)}${moneyCell(g.cash)}${moneyCell(g.advance)}${moneyCell(g.cash+g.advance)}${moneyCell(g.remaining)}
  </tr>`).join('');
  const detailRows = matched.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).map(r=>`<tr>
    <td class="date" dir="ltr">${esc(r.date||'—')}</td><td class="name">${esc(r.studentName||'—')}</td>
    <td>${esc(r.teacherName||'الإدارة')}</td><td>${esc(r.subject||'—')}</td>
    <td class="status">${esc(r.status||'—')}</td>${moneyCell(amountDue(r))}${moneyCell(amountPaid(r))}
    ${moneyCell(creditFor(r)?.advanceAppliedPiastres||0)}${moneyCell(attendanceLogRemaining(r))}
  </tr>`).join('');
  const issued = new Intl.DateTimeFormat('ar-EG',{dateStyle:'long',timeStyle:'short'}).format(new Date());
  const summary = (label, value, variant='')=>`<div class="kpi ${variant}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  const info = (label, value)=>`<div class="info"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  const classTotal = ' class="total"';
  const content = `
    <header class="report-head">
      <img class="report-logo" src="${esc(new URL('../../images/logo.png', window.location.href).href)}" alt="شعار أكاديمية زاد المعرفة التعليمية">
      <div class="brand"><div class="academy">أكاديمية زاد المعرفة التعليمية</div><div class="brand-small">نظام إدارة الحضور والحسابات المالية</div></div>
      <div class="report-mark">تقرير إداري رسمي<span>للاطلاع والمراجعة</span></div>
    </header>
    <section class="report-heading"><h1>تقرير الحضور والغياب والمدفوعات</h1><p>كشف مطابق للفلاتر المختارة من لوحة الإدارة</p></section>
    <div class="metadata">
      ${info('المعلم',teacher==='all'?'جميع المعلمين':teacher)}
      ${info('الطالب / البحث',search||'جميع الطلاب')}
      ${info('المادة',subject==='all'?'جميع المواد':subject)}
      ${info('الفترة',`${from||'من البداية'} — ${to||'آخر سجل'}`)}
      ${info('حالة الحضور',status==='all'?'جميع الحالات':status)}
      ${info('حالة الدفع',payment==='all'?'جميع الحالات':payment)}
    </div>
    <div class="report-date">تاريخ الإصدار: <strong>${esc(issued)}</strong></div>
    <section class="kpis">
      ${summary('عدد الطلاب',String(groups.size))}
      ${summary('عدد الحصص',String(matched.length))}
      ${summary('إجمالي قيمة الحصص',format(total.due))}
      ${summary('المدفوع مباشرة',format(total.cash))}
      ${summary('المقدم المستخدم',format(total.advance))}
      ${summary('إجمالي المحصّل',format(total.cash+total.advance),'received')}
      ${summary('المتبقي على الحصص',format(total.remaining),'remaining')}
    </section>
    <section class="report-section">
      <h2><b>01</b> ملخص الطلاب والحسابات <small>إجمالي كل طالب</small></h2>
      <table class="report-table summary-table"><thead><tr>
        <th>اسم الطالب</th><th>الحصص</th><th>حضور</th><th>غياب</th><th>قيمة الحصص</th>
        <th>مدفوع مباشر</th><th>مقدم مستخدم</th><th>إجمالي المحصل</th><th>المتبقي</th>
      </tr></thead><tbody>${groupRows||'<tr><td colspan="9" class="empty">لا توجد سجلات مطابقة للفلاتر</td></tr>'}</tbody>
      <tfoot><tr${classTotal}><th>الإجمالي (${groups.size} طلاب)</th><th>${matched.length}</th><th>${total.present}</th><th>${total.absent}</th>
        <th>${esc(format(total.due))}</th><th>${esc(format(total.cash))}</th><th>${esc(format(total.advance))}</th>
        <th>${esc(format(total.cash+total.advance))}</th><th>${esc(format(total.remaining))}</th></tr></tfoot></table>
    </section>
    <section class="report-section details">
      <h2><b>02</b> تفاصيل الحصص والحضور والمدفوعات <small>سجل كل حصة</small></h2>
      <table class="report-table detail-table"><thead><tr>
        <th>التاريخ</th><th>اسم الطالب</th><th>المعلم</th><th>المادة</th><th>الحالة</th>
        <th>قيمة الحصة</th><th>مدفوع مباشر</th><th>مقدم مستخدم</th><th>المتبقي</th>
      </tr></thead><tbody>${detailRows||'<tr><td colspan="9" class="empty">لا توجد حصص مطابقة</td></tr>'}</tbody>
      <tfoot><tr class="total"><th colspan="5">الإجمالي النهائي لجميع الحصص</th>
        <th>${esc(format(total.due))}</th><th>${esc(format(total.cash))}</th><th>${esc(format(total.advance))}</th><th>${esc(format(total.remaining))}</th></tr></tfoot></table>
    </section>
    <p class="accounting-note"><strong>تنبيه محاسبي:</strong> الأرقام تشمل فقط المدفوعات المباشرة والمقدم المستخدم المرتبطين بالحصص الظاهرة. الدفعات غير المخصصة لحصص معينة لا تُحسب هنا؛ وهذا التقرير ليس كشفًا بمستحقات المعلم ولا إثباتًا بصرفها.</p>
    <footer class="report-footer"><span>أكاديمية زاد المعرفة التعليمية | نظام التقارير</span><span>تقرير للاطلاع فقط — لا يغيّر أي بيانات أو مدفوعات</span></footer>`;

  // نافذة طباعة مستقلة داخل الصفحة. تجهيز HTML وألوان الطباعة داخل الإطار
  // يضمن عدم تأثر التقرير بخلفية لوحة الإدارة أو أنماطها الداكنة.
  const css = `
    @page{size:A4 landscape;margin:11mm 10mm 12mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff!important;color:#13263e;direction:rtl;font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.7;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{padding:8px 4px}
    .report-head{display:flex;align-items:center;gap:15px;border-bottom:3px solid #c9a343;padding:2px 0 12px;margin-bottom:13px;break-inside:avoid}
    .report-logo{width:90px;height:90px;object-fit:contain;flex-shrink:0}
    .brand{flex:1}.academy{font-size:23px;font-weight:900;color:#132c4c;line-height:1.4}.brand-small{font-size:13px;color:#52647c;margin-top:3px}
    .report-mark{font-size:12px;font-weight:800;color:#8c691e;border:1px solid #d4b65f;border-radius:9px;padding:8px 13px;text-align:center;min-width:132px}
    .report-mark span{display:block;font-size:10px;font-weight:500;color:#55647a}
    .report-heading{text-align:center;margin-bottom:13px;break-inside:avoid}.report-heading h1{font-size:22px;color:#122943;margin:0;font-weight:900}.report-heading p{margin:3px 0;color:#53647b;font-size:13.3px}
    .metadata{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 7px;break-inside:avoid}
    .info{border:1px solid #d9e0eb;background:#f8fafd;border-radius:7px;padding:6px 10px;min-width:0}.info span{display:block;color:#596a80;font-size:11.8px}.info strong{display:block;color:#182c49;font-size:13.2px;overflow-wrap:anywhere}
    .report-date{font-size:11.5px;color:#52647b;margin:0 0 10px}
    .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0 18px;break-inside:avoid}
    .kpi{min-width:0;border:1px solid #dce4ee;border-top:3px solid #c29b39;border-radius:7px;background:#f8fafd;padding:9px 11px}
    .kpi span{display:block;font-size:11.8px;color:#52647b}.kpi strong{display:block;font-weight:900;font-size:17px;color:#142f4e;overflow-wrap:anywhere;white-space:normal}
    .kpi.received{border-top-color:#267d6b;background:#eef8f4}.kpi.remaining{border-top-color:#b36b28;background:#fff8ed}
    .report-section{margin:16px 0 17px}.report-section h2{display:flex;align-items:center;gap:9px;color:#142b48;font-size:15.3px;margin:0 0 8px;border-bottom:2px solid #d6dfeb;padding-bottom:8px;break-after:avoid}
    .report-section h2 b{font-size:11px;color:#fff;background:#172f4e;border-radius:4px;padding:3px 7px;direction:ltr}.report-section h2 small{font-size:11px;color:#6a7b8d;font-weight:400;margin-right:auto}
    .report-table{table-layout:fixed;width:100%;border-collapse:collapse;direction:rtl;line-height:1.65;margin-bottom:13px;font-size:13.1px}
    .report-table th,.report-table td{border:1px solid #b9c5d4;padding:7px 6px;text-align:right;vertical-align:middle;overflow-wrap:anywhere;color:#14283f}
    .report-table thead th{background:#183657!important;color:#fff!important;font-size:12.4px;font-weight:900;vertical-align:middle}
    .report-table tbody tr:nth-child(even) td{background:#f1f5fa!important}
    .report-table .name{font-weight:800}.report-table .number,.report-table .money{text-align:center;direction:ltr;white-space:nowrap;font-size:12.1px;font-variant-numeric:tabular-nums}
    .report-table .status{text-align:center}.report-table tfoot th{background:#e9eff7!important;border-top:3px solid #bd9434!important;color:#102743!important;font-weight:900;font-size:12.3px}
    .report-table tfoot .total th{padding-top:10px;padding-bottom:10px}.report-table .empty{text-align:center;color:#637186}
    .summary-table th:first-child{width:17%}.detail-table th:nth-child(1){width:10%}.detail-table th:nth-child(2){width:15%}.detail-table th:nth-child(3){width:14%}.detail-table th:nth-child(4){width:17%}.detail-table th:nth-child(5){width:7%}
    .report-table thead{display:table-header-group}.report-table tfoot{display:table-row-group}.report-table tr{break-inside:avoid;page-break-inside:avoid}
    .accounting-note{border:1px solid #e0c681;border-right:4px solid #b88d28;border-radius:6px;padding:10px 12px;background:#fffaf0!important;color:#4e462c;font-size:11.4px;break-inside:avoid}
    .report-footer{border-top:1px solid #cbd5e0;display:flex;justify-content:space-between;gap:16px;padding:9px 0 0;color:#627086;font-size:10.4px;break-inside:avoid;margin-top:18px}
    @media print{html,body{width:auto!important}.report-section h2{break-after:avoid}}
  `;
  document.getElementById('zadAttendancePrintFrame')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'zadAttendancePrintFrame'; frame.title = 'تقرير الحضور والمدفوعات للطباعة';
  frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:1120px;height:780px;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(frame);
  const d = frame.contentDocument;
  d.open();
  d.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير الحضور والمدفوعات — زاد المعرفة</title><style>${css}</style></head><body>${content}</body></html>`);
  d.close();
  const notice = $('attendanceReportNotice');
  if (notice) notice.textContent = `تم تجهيز تقرير ${matched.length} حصة لـ ${groups.size} طالب؛ جارٍ فتح الطباعة.`;
  // الطباعة لا تبدأ قبل جاهزية اللوجو والخطوط حتى تظهر الترويسة والتنسيقات في المعاينة.
  let fired = false;
  const doPrint = () => {
    if (fired || !frame.isConnected) return;
    fired = true;
    try { frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch (e) {
      console.error('[attendance-report-print]',e);
      if (notice) notice.textContent = 'تعذرت الطباعة من المتصفح؛ جرّب السماح بالطباعة ثم اضغط الزر مرة أخرى.';
    }
  };
  const logo = d.querySelector('.report-logo');
  const printWhenReady = () => {
    if (!logo || logo.complete) { requestAnimationFrame(()=>requestAnimationFrame(doPrint)); return; }
    logo.addEventListener('load',()=>requestAnimationFrame(doPrint),{once:true});
    logo.addEventListener('error',()=>requestAnimationFrame(doPrint),{once:true});
    setTimeout(doPrint,2500);
  };
  if (d.readyState === 'complete') printWhenReady();
  else frame.addEventListener('load',printWhenReady,{once:true});
}
$('attendancePrintReport')?.addEventListener('click',attendancePrintReport);
