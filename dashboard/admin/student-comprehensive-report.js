import {amountPaid,amountRemaining,money as paymentMoney} from '../payment-utils.js';
/* زاد المعرفة — تقرير الطالب الشامل (للإدارة فقط)
   قراءة فقط: لا تعديل لبيانات الطالب ولا سجلاته. */
import { auth, db } from '../../firebase-config.js';
import { collection, doc, getDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fallback = value => value === null || value === undefined || value === '' ? 'غير مسجل' : value;
const num = value => Number(value || 0).toLocaleString('ar-EG', {maximumFractionDigits:2});
const money = value => `${num(value)} ج.م`;
const date = value => {
  if (!value) return 'غير مسجل';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  try {
    const d = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('ar-EG', {year:'numeric',month:'short',day:'numeric'}).format(d);
  } catch { return 'غير مسجل'; }
};
const sortTime = x => {
  try {const d = typeof x?.toDate === 'function' ? x.toDate() : new Date(x); return Number.isNaN(d.getTime()) ? 0 : d.getTime();} catch {return 0;}
};
const sortRecent = (arr, field = 'createdAt') => [...arr].sort((a,b) => sortTime(b[field] || b.date) - sortTime(a[field] || a.date));
const oneCell = (value, max = 250) => e(String(fallback(value)).slice(0,max));
const renderRows = (items, cells, empty = 'لا توجد بيانات مسجلة') => items.length
  ? items.map(x => `<tr>${cells.map(fn => `<td>${oneCell(fn(x))}</td>`).join('')}</tr>`).join('')
  : `<tr><td colspan="${cells.length}" class="zad-rpt-empty">${e(empty)}</td></tr>`;
const section = (id, title, header, body, countLabel = '') => `<section class="zad-rpt-section" data-report-section="${id}">
  <h3>${e(title)}${countLabel ? ` <small>(${e(countLabel)})</small>`:''}</h3>
  <div class="zad-rpt-scroll"><table class="zad-rpt-table"><thead><tr>${header.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>
</section>`;

const sources = [
  ['attendance','الحضور والغياب','lessonAttendance','studentUid'],
  ['vodafonePayments','تحويلات فودافون كاش','vodafonePayments','studentUid'],
  ['codeExams','نتائج الامتحانات الإلكترونية','codeExamResults','studentUid'],
  ['quizzes','نتائج الاختبارات الأخرى','quizAttempts','studentUid'],
  ['bookings','الحجوزات','bookings','studentUid'],
  ['homeworks','الواجبات','teacherHomeworks','studentUid'],
  ['notes','ملاحظات المعلمين','teacherStudentNotes','studentUid'],
  ['downloads','تنزيلات المكتبة','libraryDownloads','userId'],
  ['certificates','شهادات التقدير','certificates','studentUid'],
  ['loginLogs','سجل تسجيل الدخول','loginLogs','uid'],
  ['ratings','تقييمات الدروس','lessonRatings','studentUid']
];
let report = null;
let running = false;
let activeUid = '';
const modal = $('zadStudentReportModal');
const display = $('zadStudentReportBody');
const state = $('zadStudentReportStatus');
const printShort = $('zadStudentReportPrintShort');
const printFull = $('zadStudentReportPrintFull');

function openModal() {
  if (typeof modal?.showModal === 'function') {
    if (!modal.open) modal.showModal();
  } else if (modal) { modal.setAttribute('open',''); }
}
function closeModal() {
  if (typeof modal?.close === 'function') modal.close();
  else modal?.removeAttribute('open');
}
$('zadStudentReportClose')?.addEventListener('click',closeModal);
modal?.addEventListener('click',evt => { if (evt.target === modal) closeModal(); });

async function verifyAdmin() {
  const user = auth.currentUser;
  if (!user) throw new Error('سجّل الدخول بحساب الإدارة أولًا.');
  const [admin, profile] = await Promise.allSettled([
    getDoc(doc(db,'admins',user.uid)), getDoc(doc(db,'users',user.uid))
  ]);
  // الخادم يطبق Firestore Rules بصورة مستقلة عن هذا الفحص.
  if (admin.status === 'fulfilled' && admin.value.exists()) return;
  if (profile.status === 'fulfilled' && profile.value.data()?.role === 'admin') return;
  if (user.email === 'maleksameh121@gmail.com') return; // توافق مع قواعد المنصة القائمة
  throw new Error('هذه التقارير متاحة للأدمن فقط.');
}

function timed(promise, title, ms=14000) {
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`انتهت مهلة تحميل ${title}`)),ms))
  ]);
}

async function fetchReport(uid) {
  await verifyAdmin();
  const studentSnap = await timed(getDoc(doc(db,'users',uid)),'بيانات الطالب');
  if (!studentSnap.exists()) throw new Error('حساب الطالب غير موجود في Firestore.');
  const student = {uid, ...studentSnap.data()};
  if (student.role && student.role !== 'student') throw new Error('التقرير الشامل مخصص لحسابات الطلاب فقط.');
  const promises = sources.map(async ([key,label,col,field]) => {
    const snap = await timed(getDocs(query(collection(db,col),where(field,'==',uid))),label);
    return {key, docs: snap.docs.map(d=>({id:d.id,...d.data()}))};
  });
  // قائمة المحاضرات العامة/الموجهة — مفصولة حتى لا تعطل بقية التقرير.
  promises.push((async()=>({key:'lessons',docs:(await timed(getDocs(collection(db,'lessons')),'المحاضرات')).docs
    .map(d=>({id:d.id,...d.data()})).filter(l=>{
      if(l.audience === 'selected') return Array.isArray(l.targetUids) && l.targetUids.includes(uid);
      if(l.audience === 'grade') return String(l.grade||'')===String(student.grade||student.studyGrade||'');
      return (!l.grade || String(l.grade)===String(student.grade||student.studyGrade||''));
    })}))());
  const settled = await Promise.allSettled(promises);
  const out = {student, errors: [], loaded: new Set()};
  settled.forEach((item,i)=>{
    const key = i < sources.length ? sources[i][0] : 'lessons';
    if (item.status === 'fulfilled') {
      out[key] = item.value.docs;
      out.loaded.add(key);
    } else {
      out[key] = [];
      out.errors.push(`${i<sources.length?sources[i][1]:'المحاضرات'}: ${item.reason?.code || item.reason?.message || 'خطأ غير معروف'}`);
      console.warn('Student report query failed',key,item.reason);
    }
  });
  return out;
}

function buildMetrics(data) {
  const a = data.attendance.filter(r => ['حاضر','غائب','اعتذر'].includes(r.status));
  const present = a.filter(r=>r.status==='حاضر').length;
  const absent = a.filter(r=>r.status==='غائب').length;
  const excused = a.filter(r=>r.status==='اعتذر').length;
  const paid = a.reduce((total,r)=>total+amountPaid(r)/100,0);
  const unpaid = a.reduce((total,r)=>total+amountRemaining(r)/100,0);
  const due = paid + unpaid;
  const rate = present+absent ? `${num(Math.round(present/(present+absent)*100))}٪` : '—';
  const completed = data.bookings.filter(b=>['تم الحجز','مكتمل','مؤكد'].includes(b.status)).length;
  return {a,present,absent,excused,paid,unpaid,due,rate,completed};
}
function metric(label,value,unavailable=false) {
  return `<div class="zad-rpt-metric"><span>${e(label)}</span><strong>${unavailable?'تعذر التحميل':e(value)}</strong></div>`;
}
function info(label,value) {
  return `<div class="zad-rpt-info"><span>${e(label)}</span><b>${oneCell(value,120)}</b></div>`;
}
function reportSummary(data) {
  const s=data.student,m=buildMetrics(data),ok=k=>data.loaded.has(k);
  const exams = [...sortRecent(data.codeExams),...sortRecent(data.quizzes)].slice(0,5);
  const overview = `<div class="zad-rpt-info-grid">
    ${info('اسم الطالب',s.fullName||s.name||s.displayName||'بدون اسم')}
    ${info('المرحلة والصف',[s.stage,s.grade||s.studyGrade||s.className].filter(Boolean).join(' — '))}
    ${info('النظام التعليمي',s.educationType||s.educationSystem)}
    ${info('تاريخ التسجيل',date(s.createdAt))}
    ${info('حالة الحساب',s.status==='active'?'نشط':s.status||'غير مسجل')}
    ${info('رقم الهاتف',s.phone||s.phoneNumber)}
  </div>`;
  const metrics=`<div class="zad-rpt-metrics">
    ${metric('عدد الحصص',num(m.a.length),!ok('attendance'))}
    ${metric('حضور',num(m.present),!ok('attendance'))}
    ${metric('غياب',num(m.absent),!ok('attendance'))}
    ${metric('نسبة الحضور',m.rate,!ok('attendance'))}
    ${metric('إجمالي المسجل',money(m.due),!ok('attendance'))}
    ${metric('المدفوع',money(m.paid),!ok('attendance'))}
    ${metric('غير المدفوع',money(m.unpaid),!ok('attendance'))}
    ${metric('عدد الامتحانات',num(data.codeExams.length+data.quizzes.length),!ok('codeExams')||!ok('quizzes'))}
  </div>`;
  const results=section('quick-results','أحدث نتائج الامتحانات', ['الامتحان','الدرجة','النسبة / التقدير'],
    renderRows(exams,[x=>String(x.examTitle||x.quizTitle||x.title||'امتحان').slice(0,65),x=>x.total!=null ? `\u200e${x.score ?? x.correct ?? 0} / ${x.total}\u200e` : '—', x=>x.percent!=null?`${x.percent}٪`:(x.score!=null?`${x.score}٪`:'—')], !ok('codeExams')||!ok('quizzes')?'تعذر تحميل بعض النتائج':'لا توجد نتائج مسجلة'));
  return {overview,metrics,results};
}

function detailedSections(data) {
  const m = buildMetrics(data),items=[];
  const add = (key,label,heads,cols,sort='createdAt') => {
    const err = !data.loaded.has(key);
    const records = sortRecent(data[key],sort);
    items.push(section(key,label,heads,renderRows(records,cols,err?'تعذر تحميل هذا القسم':'لا توجد بيانات مسجلة'),!err?num(records.length):'غير متاح'));
  };
  add('attendance','تفاصيل الحضور والغياب',['التاريخ','المواد (الحصة الواحدة تحسب مرة)','المعلم','الحالة','السعر','الدفع'],[
    x=>x.date||date(x.createdAt),x=>(Array.isArray(x.subjects)&&x.subjects.length?x.subjects.join('، '):x.subject)||'—',x=>x.teacherName||'—',x=>x.status||'—',x=>money(x.price),x=>amountRemaining(x)===0?'مدفوعة':amountPaid(x)>0?'مدفوع جزئيًا '+paymentMoney(amountPaid(x)):'غير مدفوعة'],'date');
  add('vodafonePayments','تحويلات فودافون كاش',['التاريخ','المبلغ','حالة التحويل','رقم المرجع','ملاحظات'],[
    x=>date(x.createdAt),x=>paymentMoney(x.amountPiastres),x=>x.status==='approved'?'معتمد':x.status==='rejected'?'مرفوض':'قيد المراجعة',x=>x.reference||'—',x=>x.adminNote||'—']);
  add('codeExams','الامتحانات الإلكترونية',['الامتحان','الدرجة','النسبة','نوع النتيجة','التاريخ'],[
    x=>x.examTitle||'—',x=>`\u200e${x.score??0} / ${x.total??'—'}\u200e`,x=>x.percent!=null?`${x.percent}٪`:'—',x=>x.verified===true?'مراجَعة':'غير معتمدة (إبلاغ المتصفح)',x=>date(x.createdAt)]);
  add('quizzes','الاختبارات والواجبات القصيرة',['الامتحان','الدرجة','النسبة','الحالة','التاريخ'],[
    x=>x.quizTitle||x.title||'اختبار',x=>`\u200e${x.correct??'—'} / ${x.total??'—'}\u200e`,x=>x.score!=null?`${x.score}٪`:'—',x=>x.passed===true?'نجاح':x.passed===false?'لم يجتز':'—',x=>date(x.createdAt)]);
  add('bookings','حجوزات الحصص',['المادة','المعلم','نوع الحصة','الحالة','تاريخ الحجز'],[
    x=>x.subject||x.section||'—',x=>x.teacherName||'—',x=>x.lessonMode||'—',x=>x.status||'—',x=>date(x.createdAt)]);
  add('lessons','المحاضرات الموجّهة للطالب',['المحاضرة','المادة','المعلم','التاريخ'],[
    x=>x.title||'—',x=>x.subject||'—',x=>x.teacherName||'—',x=>x.date||date(x.createdAt)],'date');
  add('homeworks','الواجبات',['الواجب','المادة','الحالة','المعلم','التاريخ'],[
    x=>x.title||x.homeworkTitle||x.description||'واجب',x=>x.subject||'—',x=>x.status||'غير محدد',x=>x.teacherName||'—',x=>date(x.createdAt)]);
  add('notes','ملاحظات المعلمين (للإدارة)',['المعلم','التصنيف','الملاحظة','التاريخ'],[
    x=>x.teacherName||'—',x=>x.category||'—',x=>x.text||x.note||'—',x=>date(x.createdAt)]);
  add('downloads','نشاط تنزيل الكتب',['الكتاب','القسم','التاريخ'],[
    x=>x.bookTitle||'—',x=>x.source==='azhar'?'التعليم الأزهري':'المكتبة',x=>date(x.downloadedAt||x.createdAt||x.clientDownloadedAt)]);
  add('certificates','الشهادات الصادرة',['الشهادة / الامتحان','التقدير','تاريخ الإصدار'],[
    x=>x.title||'—',x=>x.grade||'—',x=>x.issueDate||date(x.createdAt)]);
  add('ratings','تقييمات الطالب للحصص',['التقييم','الملاحظة','التاريخ'],[
    x=>x.rating!=null?`${x.rating} / 5`:'—',x=>x.comment||x.note||'—',x=>date(x.createdAt)]);
  add('loginLogs','نشاط تسجيل الدخول',['التاريخ','الجهاز / المصدر'],[
    x=>date(x.createdAt||x.loggedAt||x.timestamp),x=>x.device||x.provider||x.source||'—']);
  return items.join('');
}

function reportContent(data, mode) {
  const s=data.student,sum=reportSummary(data),full=mode==='full';
  const generated=date(new Date()),name=e(s.fullName||s.name||s.displayName||'طالب');
  const errors=data.errors.length?`<p class="zad-rpt-warning">⚠ بعض البيانات غير مكتملة: ${full ? data.errors.map(e).join(' | ') : `تعذر تحميل ${num(data.errors.length)} قسم، راجع الصلاحيات أو الاتصال.`}</p>`:'';
  return `<div class="zad-rpt-document" dir="rtl">
    <header class="zad-rpt-header">
      <img src="../../images/logo.png" alt="شعار زاد المعرفة" onerror="this.style.display='none'">
      <div><div class="zad-rpt-platform">منصة زاد المعرفة للتعليم والتربية</div>
      <h1>${full?'التقرير الشامل للطالب':'ملخص متابعة الطالب'}</h1>
      <p>الطالب: <b>${name}</b> — تاريخ إصدار التقرير: ${e(generated)}</p></div>
    </header>
    <div class="zad-rpt-section"><h3>البيانات الأساسية</h3>${sum.overview}</div>
    <div class="zad-rpt-section"><h3>ملخص المتابعة</h3>${sum.metrics}</div>
    <div class="zad-rpt-summary-exams">${sum.results}</div>
    ${full?`<div class="zad-rpt-detail-start"><h2>السجل التفصيلي</h2><p>تعتمد البيانات على السجلات المحفوظة في المنصة وقت إصدار التقرير.</p></div>${detailedSections(data)}`:''}
    <p class="zad-rpt-disclaimer">${full?'النتائج المُدخلة من المتصفح ليست درجات رسمية معتمدة حتى تراجعها الإدارة.':''} إجمالي المستحقات محسوب من أسعار الحصص المسجلة بغض النظر عن حالة الحضور؛ يُرجع لسياسة الغياب المعتمدة لدى المنصة.</p>
    ${errors}
    <footer class="zad-rpt-footer"><div><span>توقيع الإدارة</span><i></i></div><div><span>ختم المنصة</span><i></i></div></footer>
    <p class="zad-rpt-copy">تقرير مستخرج من نظام زاد المعرفة — خاص بالطالب والإدارة ولا يُنشر للعامة.</p>
  </div>`;
}

const printStyle = `
  @page { size: A4 portrait; margin: 11mm; }
  * { box-sizing:border-box; }
  html,body { margin:0; padding:0; background:#fff; color:#142846; font:13px/1.55 Tahoma,Arial,sans-serif; direction:rtl; }
  .print-bar { position:sticky;top:0;background:#0f2342;color:#fff;padding:10px;text-align:center;z-index:10; }
  .print-bar button {background:#d2af50;border:0;border-radius:7px;padding:9px 20px;cursor:pointer;font-weight:bold;}
  .zad-rpt-document {max-width:195mm;margin:auto;padding:6mm 3mm;background:#fff;}
  .zad-rpt-header {display:flex;align-items:center;gap:14px;padding-bottom:10px;border-bottom:3px solid #c9a84c;}
  .zad-rpt-header img{width:57px;height:57px;object-fit:contain;}
  .zad-rpt-platform{color:#10264b;font-size:14px;font-weight:900;}
  .zad-rpt-header h1{font-size:24px;color:#9b7420;margin:2px 0;}
  .zad-rpt-header p{margin:2px 0;color:#34445a;font-size:11px;}
  .zad-rpt-section {margin-top:12px;break-inside:auto;}
  .zad-rpt-section h3 {border-right:4px solid #c9a84c;background:#f7f2e8;padding:5px 10px;color:#10294a;margin:0 0 7px;font-size:13px;break-after:avoid;}
  .zad-rpt-section h3 small{font-weight:normal;color:#777;}
  .zad-rpt-info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
  .zad-rpt-info,.zad-rpt-metric{border:1px solid #e4daca;border-radius:5px;padding:5px 7px;min-width:0;}
  .zad-rpt-info span,.zad-rpt-metric span{display:block;color:#64748b;font-size:10px;}
  .zad-rpt-info b,.zad-rpt-metric strong{display:block;color:#10264b;font-size:12px;overflow-wrap:anywhere;}
  .zad-rpt-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
  .zad-rpt-metric strong{font-size:15px;color:#172c50;}
  .zad-rpt-table{border-collapse:collapse;width:100%;font-size:10px;table-layout:fixed;}
  .zad-rpt-table th,.zad-rpt-table td{border:1px solid #d8dfe7;text-align:right;padding:5px;overflow-wrap:anywhere;}
  .zad-rpt-table th{background:#10294b;color:#fff;font-weight:bold;}
  .zad-rpt-table tbody tr:nth-child(even){background:#f8f8f6;}
  .zad-rpt-table tr{break-inside:avoid;}
  .zad-rpt-table thead{display:table-header-group;}
  .zad-rpt-empty{text-align:center!important;color:#777;}
  .zad-rpt-detail-start{break-before:page;margin-top:8mm;}
  .zad-rpt-detail-start h2{border-bottom:2px solid #c9a84c;color:#10294b;}
  .zad-rpt-detail-start p{color:#555;}
  .zad-rpt-disclaimer{font-size:10px;color:#6b7280;margin:12px 0 0;}
  .zad-rpt-warning{font-size:10px;padding:7px;background:#fff4db;border:1px solid #e3b45b;color:#7b4d06;overflow-wrap:anywhere;}
  .zad-rpt-footer{display:flex;justify-content:space-between;gap:20mm;margin-top:18px;break-inside:avoid;}
  .zad-rpt-footer>div{width:43%;font-size:12px;font-weight:bold;text-align:center;}
  .zad-rpt-footer i{display:block;border-bottom:1px solid #15284a;height:19mm;}
  .zad-rpt-copy{text-align:center;color:#64748b;font-size:9px;margin-top:13px;}
  @media print { .print-bar{display:none!important;} .zad-rpt-document{padding:0;} .zad-rpt-scroll{overflow:visible!important;} }
`;

function printReport(mode) {
  if (!report) return;
  const pop = window.open('','_blank');
  if (!pop) { state.textContent='اسمح بفتح نافذة منبثقة للطباعة، ثم اضغط على الزر مرة أخرى.'; return; }
  const title = mode === 'full' ? 'التقرير الشامل' : 'ملخص الطالب';
  const content = reportContent(report,mode);
  const baseHref = new URL('./',location.href).href;
  pop.document.open();
  pop.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base href="${e(baseHref)}"><title>${title} - ${e(report.student.fullName||report.student.name||'طالب')} - زاد المعرفة</title><style>${printStyle}</style></head><body><div class="print-bar"><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button></div>${content}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),450));<\/script></body></html>`);
  pop.document.close();
  pop.focus();
}
printShort?.addEventListener('click',()=>printReport('summary'));
printFull?.addEventListener('click',()=>printReport('full'));

async function openReport(uid) {
  if (!uid || running) return;
  running=true;activeUid=uid;report=null;
  printShort.disabled=true;printFull.disabled=true;
  state.textContent='جارٍ جمع بيانات الطالب من Firebase…';
  display.textContent='جارٍ تحميل الحضور والامتحانات والحجوزات وبقية البيانات…';
  openModal();
  try {
    const data=await fetchReport(uid);
    if (activeUid!==uid) return;
    report=data;
    display.innerHTML=reportContent(data,'summary');
    state.textContent=data.errors.length?`اكتمل التقرير جزئيًا؛ تعذر تحميل ${data.errors.length} قسم. التفاصيل موضحة في أسفل التقرير.`:'✅ جميع أقسام التقرير متاحة للطباعة.';
    printShort.disabled=false;printFull.disabled=false;
  } catch(err) {
    console.error('Student comprehensive report failed',err);
    display.textContent='تعذر إعداد التقرير. تحقق من حساب الأدمن وصلاحيات Firestore.';
    state.textContent='❌ '+(err.code||err.message||'حدث خطأ');
  } finally {running=false;}
}
window.addEventListener('zad:student-report',evt=>openReport(String(evt.detail?.uid||'')));
