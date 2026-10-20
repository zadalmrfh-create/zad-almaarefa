import { db, auth } from '../../firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { SUBJECTS, teacherForSubject } from '../attendance-subjects.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let students = [], records = [];
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
  if (!selected.length) {
    field.value = 'اختر مادة أو أكثر أولًا';
    return;
  }
  const teacher = teacherForSubject(selected);
  field.value = teacher || 'غير محدد';
}

subjectSelect?.addEventListener('change', syncAttendanceTeacher);
syncAttendanceTeacher();

if ($('attendanceDate')) $('attendanceDate').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function filterStudents() {
  const q = (search.value || '').trim().toLowerCase();
  const prev = studentSelect.value;
  const list = students.filter(x => [x.fullName, x.name, x.email].join(' ').toLowerCase().includes(q));
  studentSelect.innerHTML = '<option value="">اختر الطالب</option>' + list.map(x => `<option value="${esc(x.id)}">${esc(x.fullName || x.name || x.email || 'طالب')} — ${esc(x.email || '')}</option>`).join('');
  if (list.some(x => x.id === prev)) studentSelect.value = prev;
  else if (q && list.length === 1) studentSelect.value = list[0].id;
  // اختيار الطالب الوحيد المطابق تلقائيًا لتجنب خطأ HTML required
}

function money(v) {
  return Number(v || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
}

function render() {
  rows.innerHTML = records.length ? records.map(x => `<tr>
    <td>${esc(x.studentName || '-')}</td><td>${esc(x.date || '-')}</td><td>${esc(x.subject || '-')}</td>
    <td>${esc(x.status || '-')}</td><td>${money(x.price)}</td>
    <td><button type="button" class="btn ${x.paid === true ? 'gold' : ''}" data-paid="${esc(x.id)}" aria-label="تغيير حالة الدفع">${x.paid === true ? '✅ مدفوعة' : '⏳ غير مدفوعة'}</button></td>
    <td>${esc(x.teacherName || 'الإدارة')}</td><td><button type="button" class="btn" data-edit="${esc(x.id)}">✏️ تعديل الحصة</button> <button type="button" class="btn danger" data-del="${esc(x.id)}">حذف</button></td></tr>`).join('') : '<tr><td colspan="8">لا توجد سجلات حضور بعد.</td></tr>';

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
  for (const x of relevant) {
    if (selectedSubject !== 'all' && x.subject !== selectedSubject) continue;
    const id = x.studentUid;
    if (!stats.has(id)) stats.set(id, { name: x.studentName || 'طالب', present: 0, absent: 0, paid: 0, unpaid: 0 });
    const st = stats.get(id);
    if (x.status === 'حاضر') st.present++;
    if (x.status === 'غائب') st.absent++;
    if (x.paid === true) st.paid += Number(x.price) || 0;
    else st.unpaid += Number(x.price) || 0;
  }
  const cards = [...stats.values()].filter(st => st.name.toLocaleLowerCase('ar').includes(summarySearch));
  cards.sort((a, b) => sortOrder === 'most-present' ? (b.present - a.present || a.name.localeCompare(b.name, 'ar')) : sortOrder === 'most-paid' ? (b.paid - a.paid || a.name.localeCompare(b.name, 'ar')) : a.name.localeCompare(b.name, 'ar'));
  const count = $('attendanceSummaryCount'); if (count) count.textContent = `${cards.length.toLocaleString('ar-EG')} طالب`;
  const list = $('attendanceSummaryCards');
  if (list) list.innerHTML = cards.length ? cards.map(st => `<article class="attendance-summary-card"><strong>${esc(st.name)}</strong><span>✅ حضر ${st.present} حصة</span><span>❌ غاب ${st.absent} حصة</span><b>💰 المدفوع: ${money(st.paid)}</b><span>⏳ غير المدفوع: ${money(st.unpaid)}</span></article>`).join('') : '<div class="user-mobile-empty">لا توجد سجلات حضور أو غياب مطابقة للبحث أو المادة المختارة.</div>';
}

async function load() {
  try {
    message.textContent = 'جارٍ التحميل...';
    const [us, att] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'lessonAttendance'))]);
    students = us.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.role === 'student');
    records = att.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.source === 'manual-attendance' || x.source === 'teacher-dashboard').sort((a, b) => String(b.date).localeCompare(String(a.date)));
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
    const matches = students.filter(x => [x.fullName, x.name, x.email].join(' ').toLowerCase().includes((search.value || '').trim().toLowerCase()));
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
      teacherName: teacherForSubject(selectedSubjects) || 'غير محدد'
    });

    message.textContent = `✅ تم حفظ حصة واحدة (${selectedSubjects.join('، ')}) بنجاح`;
    await load();
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
  const submit=attendanceEditForm.querySelector('button[type="submit"]');submit.disabled=true;
  try{
    await updateDoc(doc(db,'lessonAttendance',attendanceEditingId),{
      studentUid:student.id,studentName:student.fullName||student.name||student.email||'',
      date:attendanceEditForm.elements.date.value,
      subjects:selected,subject:selected.join('، '),
      teacherName:teacherForSubject(selected)||'غير محدد',
      status:attendanceEditForm.elements.status.value,
      price,paid,paidAt:paid?(original.paidAt||serverTimestamp()):null,
      note:attendanceEditForm.elements.note.value.trim(),updatedAt:serverTimestamp()
    });
    attendanceEditDialog.close();await load();
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
      const newPaid = x.paid !== true;
      if (!confirm(`هل تريد تغيير حالة الحصة إلى ${newPaid ? 'مدفوعة' : 'غير مدفوعة'}؟`)) return;
      await updateDoc(doc(db, 'lessonAttendance', x.id), { paid: newPaid, paidAt: newPaid ? serverTimestamp() : null, updatedAt: serverTimestamp() });
    } else if (del) {
      if (!confirm('هل تريد حذف سجل الحضور هذا؟')) return;
      await deleteDoc(doc(db, 'lessonAttendance', x.id));
    } else if (edit) {
      openAttendanceEditor(x);
      return;

    }
    await load();
  } catch (err) {
    alert('تعذر تنفيذ العملية: ' + (err.code || err.message));
  }
});

$('refreshAttendance')?.addEventListener('click', load);
$('attendanceSummarySearch')?.addEventListener('input', render);
$('attendanceSummarySubject')?.addEventListener('change', render);
$('attendanceSummarySort')?.addEventListener('change', render);
load();
