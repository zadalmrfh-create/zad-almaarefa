import {amountDue,amountPaid,amountRemaining,money as cashMoney} from '../payment-utils.js';
import {advanceSnapshot} from '../advance-credit.js';
import {archiveAttendance,restoreAttendance} from './attendance-archive.js';
import { db, auth } from '../../firebase-config.js';
import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { SUBJECTS, teacherForSubject, ENGLISH_TEACHERS, isEnglishSubject } from '../attendance-subjects.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let students = [], records = [], cancelledRecords = [];
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
  const selected = getSelectedSubjects();
  const previous = field.value;
  const english = selected.some(isEnglishSubject);
  const choices = !selected.length
    ? [{ value: '', label: 'اختر المادة أولًا' }]
    : english
      ? ENGLISH_TEACHERS.map((name, i) => ({
          value: teacherForSubject(selected, name),
          label: (i === 0 ? 'مستر ' : 'ميس ') + name + (selected.length > 1 ? ' (مع معلمي باقي المواد)' : '')
        }))
      : [{ value: teacherForSubject(selected) || 'غير محدد', label: teacherForSubject(selected) || 'غير محدد' }];
  field.replaceChildren(...choices.map(choice => new Option(choice.label, choice.value)));
  if (choices.some(choice => choice.value === previous)) field.value = previous;
  else if (english && previous.includes('فاطمة ضياء')) field.value = choices[1].value;
  field.disabled = !english;
  field.style.cursor = english ? 'pointer' : 'not-allowed';
  field.setAttribute('aria-label', english ? 'اختر مدرس اللغة الإنجليزية: مستر علي عبد الحميد أو ميس فاطمة ضياء' : 'المعلم المحدد تلقائيًا');
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
    <td><button type="button" class="btn ${x.paid === true ? 'gold' : ''}" data-paid="${esc(x.id)}" aria-label="تغيير حالة الدفع">${creditFor(x)?.afterPiastres===0?'✅ مغطاة / مدفوعة':creditFor(x)?.advanceAppliedPiastres>0?'🟡 جزء مغطى بالمقدم، المتبقي '+cashMoney(creditFor(x).afterPiastres):amountRemaining(x)===0?'✅ مدفوعة':amountPaid(x)>0?'🟡 مدفوع جزئيًا '+cashMoney(amountPaid(x)):'⏳ غير مدفوعة'}</button></td>
    <td>${esc(x.teacherName || 'الإدارة')}</td><td><button type="button" class="btn" data-edit="${esc(x.id)}">✏️ تعديل الحصة</button> <button type="button" class="btn danger" data-del="${esc(x.id)}">حذف</button></td></tr>`).join('') : `<tr><td colspan="8">${records.length?'لا توجد حصص مطابقة للبحث والتصفية. جرّب مسح الفلاتر.':'لا توجد سجلات حضور بعد.'}</td></tr>`;
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
    message.textContent = 'جارٍ التحميل...';
    const [us, att, pay] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'lessonAttendance')), getDocs(collection(db, 'vodafonePayments'))]);
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
    const commonData = {
      studentUid: student.id,
      studentName: student.fullName || student.name || student.email,
      teacherUid: null,
      recordedByUid: auth.currentUser?.uid || null,
      date: $('attendanceDate').value,
      status: $('attendanceStatus').value,
      price,
      paid: false,
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
<label data-edit-english-teacher style="display:none">مدرس اللغة الإنجليزية<select name="englishTeacher" style="width:100%;padding:10px"><option value="علي عبد الحميد">مستر علي عبد الحميد</option><option value="فاطمة ضياء">ميس فاطمة ضياء</option></select></label>
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
  const selected = [...attendanceEditForm.querySelectorAll('input[name="subjectItem"]:checked')].map(input => input.value);
  attendanceEditForm.querySelector('[data-edit-english-teacher]').style.display = selected.some(isEnglishSubject) ? '' : 'none';
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
  attendanceEditForm.elements.englishTeacher.value=String(record.teacherName||'').includes('فاطمة ضياء')?'فاطمة ضياء':'علي عبد الحميد';
  syncEditEnglishTeacher();
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
  const paid=attendanceEditForm.elements.paid.value==='true';
  if (Number(original.cashPaidPiastres||0)>0 && (student.id!==original.studentUid||Math.round(price*100)!==amountDue(original)||paid!==(original.paid===true))){error.textContent='هذه الحصة مرتبطة بتحويل معتمد. لا يمكن تغيير الطالب أو السعر أو حالة الدفع حتى لا تختل الحسابات. يمكنك تغيير التاريخ والمادة والملاحظات.';return;}
  const submit=attendanceEditForm.querySelector('button[type="submit"]');submit.disabled=true;
  try{
    await updateDoc(doc(db,'lessonAttendance',attendanceEditingId),{
      studentUid:student.id,studentName:student.fullName||student.name||student.email||'',
      date:attendanceEditForm.elements.date.value,
      subjects:selected,subject:selected.join('، '),
      teacherName:teacherForSubject(selected,attendanceEditForm.elements.englishTeacher.value)||'غير محدد',
      status:attendanceEditForm.elements.status.value,
      price,paid,paidAt:paid?(original.paidAt||serverTimestamp()):null,
      note:attendanceEditForm.elements.note.value.trim(),updatedAt:serverTimestamp()
    });
    attendanceEditDialog.close();await load();
    window.dispatchEvent(new Event('zad:attendance-changed'));
    message.textContent='✅ تم تعديل الحصة بنجاح؛ المواد المتعددة تظل حصة واحدة.';
  }catch(e){console.error(e);error.textContent='تعذر حفظ التعديل: '+(e.code||e.message);}
  finally{submit.disabled=false;}
});

rows?.addEventListener('click', async e => {
  const edit = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]'), paid = e.target.closest('[data-paid]');
  const x = records.find(r => r.id === (edit?.dataset.edit || del?.dataset.del || paid?.dataset.paid));
  if (!x) return;
  try {
    if (paid) {
      if(Number(x.cashPaidPiastres||0)>0 || (creditFor(x)?.advanceAppliedPiastres||0)>0){ alert('هذه الحصة مدفوعة أو مغطاة بمبلغ مقدم؛ لا تغيّرها يدويًا حتى لا تُحسب الدفعة مرتين.'); return; }
      const newPaid = x.paid !== true;
      if (!confirm(`هل تريد تغيير حالة الحصة إلى ${newPaid ? 'مدفوعة' : 'غير مدفوعة'}؟`)) return;
      await updateDoc(doc(db, 'lessonAttendance', x.id), { paid: newPaid, paidAt: newPaid ? serverTimestamp() : null, updatedAt: serverTimestamp() });
    } else if (del) {
      const linked=Number(x.cashPaidPiastres||0)>0;
      const text=linked
        ? `هل تريد إلغاء حصة ${x.subject||''} للطالب ${x.studentName||''}؟\n\nتم سداد ${cashMoney(amountPaid(x))}. سيختفي سجل الحصة من الحضور والمستحقات، لكن سيبقى تحويل فودافون كاش محفوظًا في سجل المدفوعات بملاحظة «يحتاج تسوية/رد مبلغ». لن يُرَد المبلغ أو يُنقَل لحصة أخرى تلقائيًا.`
        : `هل تريد إلغاء حصة ${x.subject||''} للطالب ${x.studentName||''}؟\nسنبقي نسخة مؤرشفة يمكن للإدارة استرجاعها.`;
      if(!confirm(text))return;
      await archiveAttendance(x.id);
      window.dispatchEvent(new Event('zad:attendance-archived'));
    } else if (edit) {
      openAttendanceEditor(x);
      return;

    }
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
$('refreshAttendance')?.addEventListener('click', load);
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
