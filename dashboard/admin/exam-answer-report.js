/**
 * Printable admin-only review of a submitted examination.
 * Never assume missing model answers for legacy HTML exams.
 */
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalized = value => String(value ?? '').trim().toLowerCase()
  .replace(/[\u064b-\u065f\u0670]/g, '').replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
const formatDate = value => {
  try {
    if (value?.toDate) return value.toDate().toLocaleString('ar-EG');
    if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString('ar-EG');
    if (value) return new Date(value).toLocaleString('ar-EG');
  } catch {}
  return 'غير مسجل';
};
const isAnswered = value => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && !value.length);
const typeName = type => ({mcq:'اختر',tf:'صح أم خطأ',truefalse:'صح أم خطأ',fill:'أكمل',essay:'مقالي',ordering:'ترتيب'})[type] || 'سؤال';
function readAnswer(q, value) {
  if (!isAnswered(value)) return 'لم يُجب الطالب';
  if (q.type === 'mcq' && Number.isInteger(Number(value))) return q.options?.[Number(value)] ?? String(value);
  if (q.type === 'tf' || q.type === 'truefalse') return value === true || value === 'true' ? 'صح' : 'خطأ';
  if (q.type === 'ordering' && Array.isArray(value)) {
    return value.map((rank,i) => `${q.options?.[i] || 'العنصر '+(i+1)}: ${Number(rank) || '—'}`).join(' | ');
  }
  return String(value);
}
function modelAnswer(q) {
  switch(q.type) {
    case 'mcq': return q.options?.[q.answer] ?? 'غير متوفرة';
    case 'tf': case 'truefalse': return q.answer ? 'صح' : 'خطأ';
    case 'fill': return (q.answers || []).join(' أو ') || 'غير متوفرة';
    case 'ordering': return (q.correctOrder || []).map(i => q.options?.[i] ?? '—').join(' ← ') || 'غير متوفرة';
    case 'essay': return q.rubric || 'الإجابة المقالية تُصحَّح بواسطة الإدارة';
    default: return 'غير متوفرة';
  }
}
function right(q,value) {
  if (!isAnswered(value)) return null;
  if (q.type === 'mcq') return Number.isInteger(Number(value)) && Number(value) === q.answer;
  if (q.type === 'tf' || q.type === 'truefalse') {
    return (value === true || value === 'true') === q.answer;
  }
  if (q.type === 'fill') return (q.answers || []).some(s => normalized(s) === normalized(value) && normalized(value) !== '');
  if (q.type === 'ordering') return Array.isArray(value) &&
    (q.correctOrder || []).length === value.length &&
    q.correctOrder.every((index,i) => index === Number(value[i]) - 1);
  return null;
}
function questionCards(exam, answers, essayMarks) {
  let essayIndex=0;
  return (exam?.questions || []).map((q,i) => {
    const value = answers?.[i];
    const isEssay = q.type === 'essay';
    const ok = isEssay ? null : right(q,value);
    const mark = isEssay ? (Array.isArray(essayMarks) && essayIndex < essayMarks.length ? essayMarks[essayIndex] : null) : ok === null ? null : Number(ok);
    if (isEssay) essayIndex++;
    const assessment = isEssay ? (mark === null || mark === undefined ? 'بانتظار التصحيح' : `درجة المقالي: ${mark} / 1`)
      : ok === true ? 'صحيحة' : ok === false ? 'غير صحيحة' : 'لم يُجب';
    const statusClass = isEssay ? 'essay' : ok === true ? 'correct' : ok === false ? 'wrong' : 'pending';
    return `<section class="question-card">
        <div class="question-header"><strong>السؤال ${i+1} — ${esc(typeName(q.type))}</strong><span class="status ${statusClass}">${esc(assessment)}</span></div>
        <p class="question-text">${esc(q.text || 'السؤال غير متاح')}</p>
        <div class="answer-grid"><div class="answer-box"><div class="caption">إجابة الطالب</div><div>${esc(readAnswer(q,value))}</div></div>
        <div class="answer-box model"><div class="caption">${isEssay?'محاور الإجابة / معايير التصحيح':'الإجابة الصحيحة'}</div><div>${esc(modelAnswer(q))}</div></div></div>
      </section>`;
  }).join('');
}
const logoUrl = new URL('../../images/logo.png', import.meta.url).href;
function printHtml({studentName,examTitle,date,status,summary,content,notice}) {
  const win=window.open('', '_blank');
  if(!win){window.alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة للموقع وجرب مجددًا.');return false;}
  win.document.open();
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
    <title>تقرير إجابات ${esc(studentName)} - ${esc(examTitle)}</title>
    <style>
      @page { size: A4 portrait; margin: 13mm 12mm 15mm; }
      *{box-sizing:border-box}
      html,body{margin:0;background:#f7f5f0;color:#142541;font-family:Tahoma,Arial,sans-serif;line-height:1.65}
      .container{width:100%;max-width:960px;margin:auto;padding:20px 25px}
      .header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0 13px;border-bottom:3px solid #c6a34d;margin-bottom:18px}
      .logo{width:72px;height:72px;object-fit:contain}
      .platform{font-size:18px;color:#122b53;font-weight:800}
      h1{color:#09244a;margin:1px 0;font-size:23px}
      .muted{color:#5b6476;font-size:13px}
      .tag{font-size:13px;color:#79560d;background:#fff0bf;border:1px solid #d3b65a;padding:4px 8px;border-radius:8px;display:inline-block}
      .info{border:1px solid #ddc88d;border-radius:9px;background:#fff;padding:13px 16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;margin:16px 0}
      .info div{overflow-wrap:anywhere}.info strong{color:#8d651a}
      .summary{padding:12px 15px;background:#11284b;color:#fff;border-radius:9px;margin-bottom:18px;font-weight:bold;overflow-wrap:anywhere}
      .notice{margin:14px 0;padding:10px 12px;border-radius:7px;background:#fff6dc;border:1px solid #ddbc65;color:#4d3916}
      h2{color:#122b53;border-bottom:1px solid #d9bf78;font-size:18px;margin:18px 0 12px;padding-bottom:5px}
      .question-card{background:#fff;border:1px solid #d6dce2;border-right:5px solid #caa34b;border-radius:7px;margin-bottom:11px;padding:11px 12px;break-inside:avoid;page-break-inside:avoid;overflow-wrap:anywhere}
      .question-header{display:flex;justify-content:space-between;align-items:center;gap:12px}
      .status{font-size:12px;font-weight:bold;padding:3px 7px;border-radius:6px;white-space:nowrap}
      .correct{background:#e0f4e8;color:#145631}.wrong{background:#ffe6e4;color:#922d22}.pending{background:#eeeeee;color:#4b5563}.essay{background:#fff1cb;color:#795519}
      .question-text{font-size:15px;font-weight:700;white-space:pre-wrap;margin:7px 0 12px}
      .answer-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .answer-box{padding:9px 10px;border-radius:7px;background:#eef3fb;border:1px solid #d5e2f0;white-space:pre-wrap;font-size:14px;min-width:0;overflow-wrap:anywhere}
      .model{background:#f7f2e6;border-color:#e2d2a4}.caption{font-size:12px;color:#555e6c;font-weight:bold;margin-bottom:4px}
      .raw-answers{background:white;border:1px solid #ddd2ad;border-radius:8px;padding:13px 15px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}
      .foot{border-top:1px solid #c9ab63;padding-top:8px;margin-top:15px;color:#657080;font-size:12px}
      .no-print{position:fixed;left:20px;bottom:20px;background:#cda544;border:0;border-radius:9px;font-size:15px;font-weight:bold;padding:11px 18px;cursor:pointer}
      @media(max-width:650px){.container{padding:14px}.info,.answer-grid{grid-template-columns:1fr}.header{align-items:flex-start}}
      @media print {html,body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.container{padding:0;max-width:unset}.question-card{box-shadow:none}.no-print{display:none!important}.info,.answer-grid{grid-template-columns:1fr 1fr}}
    </style></head><body><main class="container">
      <header class="header"><div><div class="platform">منصة زاد المعرفة للتعليم والتربية</div><h1>تقرير إجابات الامتحان</h1><div class="tag">للاطلاع الإداري والمتابعة التعليمية</div></div><img class="logo" src="${esc(logoUrl)}" alt="شعار زاد المعرفة" /></header>
      <div class="info"><div><strong>الطالب: </strong>${esc(studentName)}</div><div><strong>الامتحان: </strong>${esc(examTitle)}</div><div><strong>تاريخ الحل: </strong>${esc(date)}</div><div><strong>حالة التصحيح: </strong>${esc(status)}</div></div>
      <div class="summary">${esc(summary)}</div>${notice?`<p class="notice">${esc(notice)}</p>`:''}
      <h2>تفاصيل الأسئلة والإجابات</h2>${content}
      <footer class="foot">هذا التقرير يعرض الإجابات المسجلة في المنصة وقت الطباعة. الإجابات المقالية تخضع لتصحيح الإدارة.</footer>
    </main><button type="button" class="no-print" onclick="window.print()">🖨️ طباعة / حفظ PDF</button></body></html>`);
  win.document.close();
  win.focus();
  const logo=win.document.querySelector('.logo');
  const printOnce=()=>{if(!win.closed)win.print();};
  if(logo && !logo.complete){logo.addEventListener('load',printOnce,{once:true});logo.addEventListener('error',printOnce,{once:true});setTimeout(printOnce,1400);}
  else setTimeout(printOnce,250);
  return true;
}
export function printUnitExamAnswers(exam,attempt){
  const questions = Array.isArray(exam?.questions) ? exam.questions : [];
  const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
  const objective = questions.reduce((n,q,i)=>n+(q.type!=='essay'&&right(q,answers[i])===true?1:0),0);
  const marks = Array.isArray(attempt?.essayMarks)?attempt.essayMarks:[];
  const graded = marks.length===questions.filter(q=>q.type==='essay').length && Number.isInteger(attempt?.finalScore);
  const approved = Number.isInteger(attempt?.autoScoreOverride) ? attempt.autoScoreOverride : objective;
  const score = graded ? `الدرجة النهائية المعتمدة: ${attempt.finalScore} من ${questions.length} | الموضوعي المعتمد: ${approved} | المقالي: ${marks.reduce((a,b)=>a+Number(b||0),0)}` :
      `الدرجة الموضوعية المبدئية: ${objective} من ${questions.filter(q=>q.type!=='essay').length} | المقالي بانتظار التصحيح`;
  const note = questions.length ? (!graded ? 'الدرجة النهائية لا تُعتمد قبل مراجعة وتصحيح الأسئلة المقالية.' : '') : 'تعذر تحميل بنك الأسئلة، ولذلك لا تتوفر مقارنة الإجابات.';
  return printHtml({studentName:attempt.studentName||attempt.studentUid||'طالب',examTitle:exam?.title||attempt.examId||'امتحان الوحدة الأولى',date:formatDate(attempt.createdAt),status:graded?'معتمد':'مبدئي — المقالي قيد التصحيح',summary:score,content:questions.length?questionCards(exam,answers,marks):'<p>بيانات الأسئلة غير متوفرة.</p>',notice:note});
}
export function printCodeExamAnswers(result){
  const raw=typeof result.answers==='string' ? result.answers : (Array.isArray(result.answers)?result.answers.map((a,i)=>`${i+1}. ${a}`).join('\n'):'');
  // The embedded HTML code-exam runner only stores user answers, not a trusted marking key.
  const correctData = Array.isArray(result.correctAnswers)?result.correctAnswers:null;
  const rows = correctData && Array.isArray(result.answers) ? result.answers.map((value,i)=>{
    return `<section class="question-card"><strong>السؤال ${i+1}</strong><div class="answer-grid"><div class="answer-box"><div class="caption">إجابة الطالب</div>${esc(value)}</div><div class="answer-box model"><div class="caption">الإجابة الصحيحة المسجلة</div>${esc(correctData[i]??'غير متوفرة')}</div></div></section>`;
  }).join('') : `<div class="raw-answers">${esc(raw||'لم تُحفظ إجابات مفصلة لهذا الامتحان.')}</div>`;
  return printHtml({studentName:result.studentName||'طالب',examTitle:result.examTitle||'امتحان إلكتروني',date:formatDate(result.createdAt),status:'نتيجة آلية غير معتمدة',summary:`الدرجة المسجلة: ${result.score??0} من ${result.total??0} (${result.percent??0}%)`,content:rows,notice:correctData?'':'لا توجد إجابات نموذجية موثقة في سجل هذا الامتحان المصمم بكود HTML؛ لذلك تظهر إجابات الطالب المحفوظة فقط ولا تُختلق إجابات صحيحة.'});
}
export function printQuizAnswers(quiz,attempt){
  const questions=Array.isArray(quiz?.questions)?quiz.questions:[];
  const answers=Array.isArray(attempt?.answers)?attempt.answers:[];
  return printHtml({studentName:attempt.studentName||attempt.studentUid||'طالب',examTitle:quiz?.title||attempt.quizTitle||'اختبار إلكتروني',date:formatDate(attempt.createdAt),status:'تصحيح إلكتروني',summary:`الدرجة: ${attempt.correct??'—'} من ${attempt.total??questions.length} (${attempt.score??'—'}%)`,content:questions.length?questionCards(quiz,answers,[]):'<p>أسئلة هذا الاختبار لم تعد متاحة للمقارنة.</p>',notice:questions.length?'':'النتيجة موجودة، لكن لم يتم تحميل الأسئلة أو الإجابات الصحيحة لهذا الاختبار.'});
}
