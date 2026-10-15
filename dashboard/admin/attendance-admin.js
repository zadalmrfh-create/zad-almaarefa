import { db, auth } from '../../firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { SUBJECTS, teacherForSubject } from '../attendance-subjects.js';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let students=[],records=[];
const summary=$('attendanceStudentSummary');
const form=$('manualAttendanceForm'),studentSelect=$('attendanceStudent'),search=$('attendanceStudentSearch'),rows=$('attendanceRows'),message=$('attendanceMessage');
if ($('attendanceSubject')) $('attendanceSubject').innerHTML='<option value="">اختر المادة</option>'+SUBJECTS.map(x=>`<option>${esc(x)}</option>`).join('');
const subjectSelect=$('attendanceSubject');
function syncAttendanceTeacher(){const teacher=teacherForSubject(subjectSelect?.value);const field=$('attendanceTeacherName');if(field)field.value=teacher||'اختر المادة أولًا';}
subjectSelect?.addEventListener('change',syncAttendanceTeacher);
syncAttendanceTeacher();
if ($('attendanceDate')) $('attendanceDate').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
function filterStudents(){const q=(search.value||'').trim().toLowerCase();const prev=studentSelect.value;const list=students.filter(x=>[x.fullName,x.name,x.email].join(' ').toLowerCase().includes(q));studentSelect.innerHTML='<option value="">اختر الطالب</option>'+list.map(x=>`<option value="${esc(x.id)}">${esc(x.fullName||x.name||x.email||'طالب')} — ${esc(x.email||'')}</option>`).join('');if(list.some(x=>x.id===prev))studentSelect.value=prev;}
function money(v){return Number(v||0).toLocaleString('ar-EG',{maximumFractionDigits:2})+' ج.م';}
function render(){
 rows.innerHTML=records.length?records.map(x=>`<tr>
  <td>${esc(x.studentName||'-')}</td><td>${esc(x.date||'-')}</td><td>${esc(x.subject||'-')}</td>
  <td>${esc(x.status||'-')}</td><td>${money(x.price)}</td>
  <td><button type="button" class="btn ${x.paid===true?'gold':''}" data-paid="${esc(x.id)}" aria-label="تغيير حالة الدفع">${x.paid===true?'✅ مدفوعة':'⏳ غير مدفوعة'}</button></td>
  <td>${esc(x.teacherName||'الإدارة')}</td><td><button type="button" class="btn" data-edit="${esc(x.id)}">تعديل</button> <button type="button" class="btn danger" data-del="${esc(x.id)}">حذف</button></td></tr>`).join(''):'<tr><td colspan="8">لا توجد سجلات حضور بعد.</td></tr>';
 const summarySearch=String($('attendanceSummarySearch')?.value||'').trim().toLocaleLowerCase('ar');
 const subjectFilter=$('attendanceSummarySubject')?.value||'all';
 const sortOrder=$('attendanceSummarySort')?.value||'name';
 // Only count students with real attendance records. Filter by subject before calculating totals.
 const relevant=records.filter(x=>x.studentUid && (x.status==='حاضر'||x.status==='غائب'));
 const subjectSelect=$('attendanceSummarySubject');
 if(subjectSelect){
  const current=subjectSelect.value;
  const subjects=[...new Set(relevant.map(x=>x.subject).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  subjectSelect.innerHTML='<option value="all">كل المواد</option>'+subjects.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  subjectSelect.value=subjects.includes(current)?current:'all';
 }
 const selectedSubject=subjectSelect?.value||subjectFilter;
 const stats=new Map();
 for(const x of relevant){
  if(selectedSubject!=='all'&&x.subject!==selectedSubject)continue;
  const id=x.studentUid;
  if(!stats.has(id))stats.set(id,{name:x.studentName||'طالب',present:0,absent:0,paid:0,unpaid:0});
  const st=stats.get(id);
  if(x.status==='حاضر')st.present++;
  if(x.status==='غائب')st.absent++;
  if(x.paid===true)st.paid+=Number(x.price)||0;
  else st.unpaid+=Number(x.price)||0;
 }
 const cards=[...stats.values()].filter(st=>st.name.toLocaleLowerCase('ar').includes(summarySearch));
 cards.sort((a,b)=>sortOrder==='most-present'?(b.present-a.present||a.name.localeCompare(b.name,'ar')):sortOrder==='most-paid'?(b.paid-a.paid||a.name.localeCompare(b.name,'ar')):a.name.localeCompare(b.name,'ar'));
 const count=$('attendanceSummaryCount');if(count)count.textContent=`${cards.length.toLocaleString('ar-EG')} طالب`;
 const list=$('attendanceSummaryCards');
 if(list)list.innerHTML=cards.length?cards.map(st=>`<article class="attendance-summary-card"><strong>${esc(st.name)}</strong><span>✅ حضر ${st.present} حصة</span><span>❌ غاب ${st.absent} حصة</span><b>💰 المدفوع: ${money(st.paid)}</b><span>⏳ غير المدفوع: ${money(st.unpaid)}</span></article>`).join(''):'<div class="user-mobile-empty">لا توجد سجلات حضور أو غياب مطابقة للبحث أو المادة المختارة.</div>';
}
async function load(){try{message.textContent='جارٍ التحميل...';const [us,att]=await Promise.all([getDocs(collection(db,'users')),getDocs(collection(db,'lessonAttendance'))]);students=us.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.role==='student');records=att.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.source==='manual-attendance' || x.source==='teacher-dashboard').sort((a,b)=>String(b.date).localeCompare(String(a.date)));filterStudents();render();message.textContent='';}catch(e){console.error(e);message.textContent='تعذر تحميل البيانات: '+(e.code||e.message);}}
search?.addEventListener('input',filterStudents);
form?.addEventListener('submit',async e=>{e.preventDefault();const student=students.find(x=>x.id===studentSelect.value);if(!student){message.textContent='اختر الطالب أولًا.';return;}const price=Number($('attendancePrice').value);if(!Number.isFinite(price)||price<0||price>100000){message.textContent='أدخل سعر حصة صحيحًا.';return;}const button=form.querySelector('[type=submit]');button.disabled=true;try{await addDoc(collection(db,'lessonAttendance'),{studentUid:student.id,studentName:student.fullName||student.name||student.email,teacherUid:null,teacherName:teacherForSubject($('attendanceSubject').value)||'غير محدد',recordedByUid:auth.currentUser?.uid||null,date:$('attendanceDate').value,subject:$('attendanceSubject').value,status:$('attendanceStatus').value,price,paid:false,currency:'EGP',note:$('attendanceNote').value.trim(),source:'manual-attendance',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});message.textContent='✅ تم حفظ الحضور بنجاح';await load();}catch(err){console.error(err);message.textContent='تعذر الحفظ: '+(err.code||err.message);}finally{button.disabled=false;}});
rows?.addEventListener('click',async e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-del]'),paid=e.target.closest('[data-paid]');const x=records.find(r=>r.id===(edit?.dataset.edit||del?.dataset.del||paid?.dataset.paid));if(!x)return;try{if(paid){const newPaid=x.paid!==true;if(!confirm(`هل تريد تغيير حالة الحصة إلى ${newPaid?"مدفوعة":"غير مدفوعة"}؟`))return;await updateDoc(doc(db,"lessonAttendance",x.id),{paid:newPaid,paidAt:newPaid?serverTimestamp():null,updatedAt:serverTimestamp()});}else if(del){if(!confirm('هل تريد حذف سجل الحضور هذا؟'))return;await deleteDoc(doc(db,'lessonAttendance',x.id));}else if(edit){const status=prompt('الحالة الجديدة: حاضر أو غائب',x.status);if(status===null)return;if(!['حاضر','غائب'].includes(status.trim())){alert('اختر حاضر أو غائب');return;}const priceText=prompt('سعر الحصة بالجنيه',String(x.price||0));if(priceText===null)return;const price=Number(priceText);if(!Number.isFinite(price)||price<0||price>100000){alert('سعر غير صحيح');return;}await updateDoc(doc(db,'lessonAttendance',x.id),{status:status.trim(),price,updatedAt:serverTimestamp()});}await load();}catch(err){alert('تعذر تنفيذ العملية: '+(err.code||err.message));}});
$('refreshAttendance')?.addEventListener('click',load);
$('attendanceSummarySearch')?.addEventListener('input',render);
$('attendanceSummarySubject')?.addEventListener('change',render);
$('attendanceSummarySort')?.addEventListener('change',render);
load();
