/**
 * تقارير إجابات زاد المعرفة - مقارنة موثقة فقط.
 * - بنك أسئلة الوحدة الأولى والاختبارات الاعتيادية يحتوي على الإجابات الصحيحة.
 * - نتائج HTML القديمة لا تحفظ نص السؤال أو المفتاح؛ لا نخترع بيانات مفقودة.
 * - مفتاح الامتحانات بالكود يدخل من الأدمن ويظل في مجموعة Firestore خاصة بالإدارة.
 */
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized = value => String(value ?? '').trim().toLowerCase()
  .replace(/[\u064b-\u065f\u0670]/g, '').replace(/[أإآ]/g,'ا')
  .replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'')
  .replace(/\s+/g,' ');
const formatDate = value => {
  try {
    if (value?.toDate) return value.toDate().toLocaleString('ar-EG');
    if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString('ar-EG');
    if (value) return new Date(value).toLocaleString('ar-EG');
  } catch {}
  return 'غير مسجل';
};
const isAnswered = value => value !== null && value !== undefined && String(value).trim() !== '' && !(Array.isArray(value) && !value.length);
const typeName = type => ({mcq:'اختيار من متعدد',tf:'صح أو خطأ',truefalse:'صح أو خطأ',fill:'أكمل',essay:'مقالي',ordering:'ترتيب',radio:'اختيار',checkbox:'اختيار متعدد',text:'إجابة قصيرة',textarea:'مقالي',select:'اختيار'})[type] || 'سؤال';
const asTrueFalse = value => (value === true || String(value).toLowerCase() === 'true') ? 'صح' : (value === false || String(value).toLowerCase() === 'false') ? 'خطأ' : String(value);
const showAnswer = value => {
  if (!isAnswered(value)) return 'لم يُجب الطالب';
  if (Array.isArray(value)) return value.map(showAnswer).join('، ');
  if (value === true || value === false || value === 'true' || value === 'false') return asTrueFalse(value);
  return String(value);
};
function readAnswer(q, value) {
  if (!isAnswered(value)) return 'لم يُجب الطالب';
  if (q.type === 'mcq' && Number.isInteger(Number(value))) return q.options?.[Number(value)] ?? String(value);
  if (q.type === 'tf' || q.type === 'truefalse') return asTrueFalse(value);
  if (q.type === 'ordering' && Array.isArray(value)) return value.map((rank,i) => `${q.options?.[i] || 'العنصر '+(i+1)}: ${Number(rank) || '—'}`).join(' | ');
  return showAnswer(value);
}
function modelAnswer(q) {
  switch(q.type) {
    case 'mcq': return q.options?.[q.answer] ?? 'غير متوفرة';
    case 'tf': case 'truefalse': return typeof q.answer === 'boolean' ? asTrueFalse(q.answer) : 'غير متوفرة';
    case 'fill': return (q.answers || []).join(' أو ') || 'غير متوفرة';
    case 'ordering': return (q.correctOrder || []).map(i => q.options?.[i] ?? '—').join(' ← ') || 'غير متوفرة';
    case 'essay': return q.rubric || 'يُراجع هذا السؤال بواسطة الإدارة';
    default: return 'غير متوفرة';
  }
}
function right(q,value) {
  if (!isAnswered(value)) return null;
  if (q.type === 'mcq') return Number.isInteger(Number(value)) && Number(value) === q.answer;
  if (q.type === 'tf' || q.type === 'truefalse') return typeof q.answer === 'boolean' ? (value === true || value === 'true') === q.answer : null;
  if (q.type === 'fill') return (q.answers || []).length ? q.answers.some(s => normalized(s) === normalized(value) && normalized(value) !== '') : null;
  if (q.type === 'ordering') return Array.isArray(value) && (q.correctOrder || []).length === value.length && q.correctOrder.every((index,i) => index === Number(value[i]) - 1);
  return null;
}
function questionCard({number,kind,question,student,correct,status='لم تُراجع',cls='pending',notes='',label='السؤال'}) {
  return `<article class="question-card ${esc(cls)}">
    <div class="question-header"><strong>${esc(label)} ${esc(number)} <span class="kind">${esc(kind||'')}</span></strong><span class="status ${esc(cls)}">${esc(status)}</span></div>
    <div class="question-text">${esc(question || 'نص السؤال غير محفوظ في هذا السجل')}</div>
    <div class="answer-grid">
      <section class="answer-box student"><div class="caption">إجابة الطالب</div><div class="answer-value">${esc(student)}</div></section>
      <section class="answer-box model"><div class="caption">الإجابة الصحيحة / النموذجية</div><div class="answer-value">${esc(correct)}</div></section>
    </div>
    ${notes?`<p class="answer-note">${esc(notes)}</p>`:''}
  </article>`;
}
function questionCards(exam,answers,essayMarks) {
  let essayIndex=0;
  return (exam?.questions || []).map((q,i) => {
    const value=answers?.[i],essay=q.type==='essay',ok=essay?null:right(q,value);
    const mark=essay && Array.isArray(essayMarks) ? essayMarks[essayIndex] : null;
    if(essay)essayIndex++;
    const cls=essay?'essay':!isAnswered(value)?'unanswered':ok===true?'correct':ok===false?'wrong':'pending';
    const status=essay ? (mark===null||mark===undefined?'بانتظار تصحيح المقالي':`درجة المقالي: ${mark} / 1`)
      : cls==='correct'?'إجابة صحيحة':cls==='wrong'?'إجابة غير صحيحة':cls==='unanswered'?'لم يُجب':'بانتظار المراجعة';
    return questionCard({number:i+1,kind:typeName(q.type),question:q.text,student:readAnswer(q,value),correct:modelAnswer(q),cls,status});
  }).join('');
}

/** Parse the submitted answers without treating raw form-field positions as question IDs. */
export function parseCodeAnswers(raw) {
  if (Array.isArray(raw)) return raw.map((value,i)=>({number:i+1,question:'',type:'',studentAnswer:showAnswer(value)}));
  const source=String(raw??'');
  try {
    const parsed=JSON.parse(source);
    if((parsed?.format==='zad-answers-v2'||parsed?.format==='zad-answers-v3') && Array.isArray(parsed.questions)){
      return parsed.questions.slice(0,150).map((q,i)=>({
        number:Number.isInteger(Number(q.number))&&Number(q.number)>0?Number(q.number):i+1,
        question:String(q.question||'').slice(0,1000),type:String(q.type||'').slice(0,35),
        studentAnswer:showAnswer(q.studentAnswer),
        correctAnswer:parsed.format==='zad-answers-v3'?String(q.correctAnswer||'').slice(0,700):'',
        answerStatus:parsed.format==='zad-answers-v3'?String(q.answerStatus||''):'',
        answerSource:parsed.format==='zad-answers-v3'?String(q.answerSource||''):''
      }));
    }
  } catch {}
  const lines=source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!lines.length)return [];
  const entries=[];
  for(const line of lines){
    const m=line.match(/^([0-9٠-٩]+)\s*[.)\-:\u066b]\s*(.*)$/);
    if(m){
      const number=Number(m[1].replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
      entries.push({number,question:'',type:'',studentAnswer:showAnswer(m[2])});
    }else if(entries.length){
      entries[entries.length-1].studentAnswer+='\n'+showAnswer(line);
    }else entries.push({number:1,question:'',type:'',studentAnswer:showAnswer(line)});
  }
  return entries.slice(0,150);
}
function compareEnteredAnswer(student,correct) {
  if (!isAnswered(student)||showAnswer(student)==='لم يُجب الطالب') return {status:'لم يُجب',cls:'unanswered'};
  const alternatives=String(correct||'').split('||').map(s=>normalized(showAnswer(s))).filter(Boolean);
  if(!alternatives.length)return {status:'غير محددة',cls:'pending'};
  const a=normalized(showAnswer(student));
  return alternatives.includes(a)?{status:'إجابة مطابقة',cls:'correct'}:{status:'إجابة مختلفة',cls:'wrong'};
}
/** `answerKey` is admin-only data read from codeExamAnswerKeys/{examId}. */
export function codeAnswerCards(result,answerKey=null) {
  const saved=parseCodeAnswers(result.answers);
  // Old results may use raw field positions, while v3 uses consecutive question indices.
  // Don't append unrelated, automatically recovered field numbers to newer reports.
  const savedNumbers=new Set(saved.map(q=>q.number));
  const known=(Array.isArray(answerKey?.items)?answerKey.items:[])
    .filter(q=>answerKey?.source!=='auto-extracted'||savedNumbers.has(Number(q.number)));
  const byNumber=new Map(known.filter(x=>Number.isInteger(Number(x.number))).map(x=>[Number(x.number),x]));
  const allNumbers=[...new Set([...saved.map(x=>x.number),...byNumber.keys()])].sort((a,b)=>a-b);
  const savedMap=new Map(saved.map(x=>[x.number,x]));
  let compared=0,matches=0;
  const html=allNumbers.map(number=>{
    const row=savedMap.get(number)||{number,question:'',type:'',studentAnswer:''};
    const key=byNumber.get(number)||{};
    const correct=String(key.correctAnswer||row.correctAnswer||'').trim();
    const student=showAnswer(row.studentAnswer);
    const assessed=String(key.type||row.type)==='essay' ? {status:'يحتاج تصحيحًا بشريًا',cls:'essay'} : correct ? compareEnteredAnswer(student,correct) : {status:isAnswered(row.studentAnswer)?'الإجابة النموذجية غير متاحة من كود الامتحان':'لم يُجب',cls:isAnswered(row.studentAnswer)?'pending':'unanswered'};
    if(correct&&isAnswered(row.studentAnswer)&&String(key.type||row.type)!=='essay'){compared++;if(assessed.cls==='correct')matches++;}
    const kind=typeName(key.type||row.type);
    const legacy=!String(result.answers||'').trim().startsWith('{');
    return questionCard({number,kind,label:legacy&&!String(key.question||row.question||'').trim()?'الخانة المحفوظة':'السؤال',question:String(key.question||row.question||''),student,correct:correct.replace(/\|\|/g,' أو ')||'غير متاحة من كود الامتحان',cls:assessed.cls,status:assessed.status,
      notes:correct?(answerKey?.source==='auto-extracted'?'مقارنة آلية مستخرجة من الكود؛ راجع ترتيب الأرقام إذا كانت المحاولة قديمة.':key.correctAnswer?'مقارنة بالمفتاح الذي اعتمدته الإدارة.':'التقط النظام الإجابة النموذجية تلقائيًا من كود الامتحان؛ تبقى النتيجة بحاجة إلى تحقق إداري إذا كانت معتمدة رسميًا.') : ''});
  }).join('');
  return {html,compared,matches,total:allNumbers.length,withKey:known.some(q=>String(q.correctAnswer||'').trim())||saved.some(q=>String(q.correctAnswer||'').trim()),automaticKey:saved.some(q=>String(q.correctAnswer||'').trim()),legacy:!String(result.answers||'').trim().startsWith('{')};
}
const logoUrl=new URL('../../images/logo.png',import.meta.url).href;
function printHtml({studentName,examTitle,date,status,summary,content,notice,targetWindow}) {
  const win=targetWindow || window.open('','_blank');
  if(!win){window.alert('المتصفح منع نافذة التقرير. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');return false;}
  win.document.open();
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>تقرير إجابات ${esc(studentName)} - ${esc(examTitle)}</title>
  <style>
  @page{size:A4 portrait;margin:12mm 11mm 14mm}
  *{box-sizing:border-box}html,body{margin:0;color:#192b45;background:#f3f6fa;font:14px/1.7 Tahoma,Arial,sans-serif}
  .container{max-width:960px;margin:auto;padding:22px}
  .header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 0 13px;border-bottom:3px solid #cba74b}
  .logo{width:70px;height:70px;object-fit:contain}.platform{font-size:17px;font-weight:800;color:#172d50}
  h1{margin:0;color:#102747;font-size:22px}.subtitle{font-size:12px;color:#63748b}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:7px 14px;margin:14px 0;padding:12px 14px;border:1px solid #d9e1e9;background:#fff;border-radius:11px}
  .info div{min-width:0;overflow-wrap:anywhere}.info strong{color:#82621c}
  .summary{border-radius:10px;background:#122d51;color:#fff;padding:12px 14px;font-weight:bold;overflow-wrap:anywhere}
  .notice{background:#fff7e0;border:1px solid #e4cb7c;border-radius:9px;padding:10px 12px;margin:13px 0;color:#634b1b}
  h2{font-size:18px;color:#162f55;border-bottom:2px solid #e0c581;margin:17px 0 13px;padding-bottom:4px}
  .question-card{background:white;border:1px solid #dbe3ec;border-right:5px solid #c6a453;border-radius:10px;margin-bottom:10px;padding:10px 12px;break-inside:avoid;page-break-inside:avoid;overflow-wrap:anywhere}
  .question-card.correct{border-right-color:#339463}.question-card.wrong{border-right-color:#c54d4d}.question-card.essay{border-right-color:#bc9635}
  .question-header{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
  .kind{font-size:11px;color:#758399;font-weight:normal;margin-right:7px}
  .status{padding:3px 9px;border-radius:8px;font-weight:700;font-size:11px;background:#eef0f3;color:#4c596a}
  .status.correct{background:#e0f4e8;color:#12633c}.status.wrong{background:#ffe9e6;color:#a12c23}.status.essay{background:#fff0ca;color:#785919}.status.unanswered{background:#f1f1f1}
  .question-text{font-weight:700;font-size:14px;white-space:pre-wrap;margin:7px 0 10px}
  .answer-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
  .answer-box{min-width:0;overflow-wrap:anywhere;border-radius:8px;padding:9px 10px;background:#eef4fb;border:1px solid #d6e3f1;white-space:pre-wrap}
  .answer-box.model{background:#fbf7ea;border-color:#ead8a7}
  .caption{font-size:11px;font-weight:800;color:#617083;margin-bottom:3px}.answer-value{font-size:13px}
  .answer-note{font-size:10px;color:#6a7688;margin:6px 0 0}
  .empty{border:1px dashed #c6cbd3;background:#fff;border-radius:10px;padding:25px;text-align:center;color:#677385}
  .foot{margin-top:14px;padding-top:9px;border-top:1px solid #cfb977;color:#657287;font-size:11px}
  .print-btn{position:fixed;bottom:15px;left:20px;background:#e3bc52;color:#152e4d;border:0;padding:11px 18px;border-radius:11px;font-weight:800;cursor:pointer}
  @media(max-width:620px){.container{padding:12px}.info,.answer-grid{grid-template-columns:1fr}.header{align-items:flex-start}}
  @media print{html,body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.container{padding:0;max-width:100%}.print-btn{display:none!important}.question-card{box-shadow:none}.answer-grid{grid-template-columns:1fr 1fr}}
  </style></head><body><main class="container">
  <header class="header"><div><div class="platform">منصة زاد المعرفة للتعليم والتربية</div><h1>تقرير إجابات الامتحان</h1><div class="subtitle">نسخة المتابعة التعليمية والإدارية</div></div><img class="logo" src="${esc(logoUrl)}" alt="شعار المنصة"></header>
  <section class="info"><div><strong>اسم الطالب: </strong>${esc(studentName)}</div><div><strong>اسم الامتحان: </strong>${esc(examTitle)}</div><div><strong>تاريخ التسليم: </strong>${esc(date)}</div><div><strong>حالة التصحيح: </strong>${esc(status)}</div></section>
  <div class="summary">${esc(summary)}</div>
  ${notice?`<div class="notice">${esc(notice)}</div>`:''}
  <h2>تفاصيل الأسئلة والإجابات</h2>
  ${content||'<div class="empty">لا توجد إجابات محفوظة لهذا الامتحان.</div>'}
  <footer class="foot">تُعرض إجابات الطالب المحفوظة وقت التسليم. مفاتيح تصحيح امتحانات الكود تدخلها الإدارة، والمقارنة النصية لا تحل محل التصحيح البشري للإجابات المقالية.</footer>
  </main><button class="print-btn" type="button" onclick="window.print()">طباعة / حفظ PDF</button></body></html>`);
  win.document.close();win.focus();
  const logo=win.document.querySelector('.logo');let printed=false;
  const once=()=>{if(!printed&&!win.closed){printed=true;win.print();}};
  if(logo&&!logo.complete){logo.addEventListener('load',once,{once:true});logo.addEventListener('error',once,{once:true});setTimeout(once,1800);} else setTimeout(once,300);
  return true;
}
export function printUnitExamAnswers(exam,attempt){
  const questions=Array.isArray(exam?.questions)?exam.questions:[];
  const answers=Array.isArray(attempt?.answers)?attempt.answers:[];
  const objective=questions.reduce((n,q,i)=>n+(q.type!=='essay'&&right(q,answers[i])===true?1:0),0);
  const marks=Array.isArray(attempt?.essayMarks)?attempt.essayMarks:[];
  const graded=marks.length===questions.filter(q=>q.type==='essay').length && Number.isInteger(attempt?.finalScore);
  const approved=Number.isInteger(attempt?.autoScoreOverride)?attempt.autoScoreOverride:objective;
  const score=graded?`الدرجة النهائية المعتمدة: ${attempt.finalScore} من ${questions.length} | الموضوعي: ${approved} | المقالي: ${marks.reduce((a,b)=>a+Number(b||0),0)}`:
    `الدرجة الموضوعية المبدئية: ${objective} من ${questions.filter(q=>q.type!=='essay').length} | المقالي بانتظار التصحيح`;
  return printHtml({studentName:attempt.studentName||attempt.studentUid||'طالب',examTitle:exam?.title||attempt.examId||'امتحان',date:formatDate(attempt.createdAt),status:graded?'معتمد':'مبدئي',summary:score,
    content:questions.length?questionCards(exam,answers,marks):'',notice:questions.length&&!graded?'الدرجة النهائية لا تُعتمد قبل مراجعة الإجابات المقالية.':!questions.length?'تعذر تحميل بنك الأسئلة؛ لا تتوفر مقارنة موثوقة.':''});
}
export function printCodeExamAnswers(result,answerKey=null,targetWindow=null){
  const data=codeAnswerCards(result,answerKey);
  const summary=`الدرجة الآلية المسجلة: ${result.score??'—'} من ${result.total??'—'} (${result.percent??'—'}%) — غير معتمدة إداريًا${data.compared?` | إجابات متطابقة مع المفتاح المتاح: ${data.matches} من ${data.compared} مقارنة`:''}`;
  const notices=[];
  if(data.legacy)notices.push('هذا سجل قديم؛ قد تنقص نصوص بعض الأسئلة أو يصعب تأكيد ترتيبها. إن أمكن استخراج الإجابات من الكود الأصلي فستظهر تلقائيًا للمقارنة دون تغيير الدرجة المحفوظة.');
  if(!data.withKey)notices.push('لم يستطع كود الامتحان تقديم الإجابات النموذجية؛ الدرجة التلقائية صادرة من الامتحان نفسه، ولا يمكن تمييز الصح والخطأ لكل سؤال من غير مفتاح.');
  else if(answerKey?.source==='auto-extracted')notices.push('تم استخراج الإجابات من كود HTML الأصلي تلقائيًا؛ لم تُعتمد هذه المقارنة يدويًا، ويجب التأكد من تطابق ترتيب الأسئلة في المحاولات القديمة. المقالي يحتاج مراجعة بشرية.');
  else if(answerKey?.items?.some(q=>q.correctAnswer))notices.push('المقارنة تعتمد على مفتاح الإجابات المعتمد من الإدارة. المقال يحتاج مراجعة بشرية.');
  else notices.push('ظهرت الإجابات النموذجية تلقائيًا من كود الامتحان المتاح. المقالي يحتاج مراجعة بشرية، والدرجة المرسلة من كود HTML ليست موثقة من خادم مستقل.');
  return printHtml({studentName:result.studentName||'طالب',examTitle:result.examTitle||'امتحان إلكتروني',date:formatDate(result.createdAt),status:answerKey?.source==='auto-extracted'?'مقارنة آلية مستخرجة من كود الامتحان':answerKey?.items?.some(q=>q.correctAnswer)?'مقارنة حسب مفتاح الإدارة':data.automaticKey?'تصحيح تلقائي بمفتاح كود الامتحان':'نتيجة آلية — لا يتوفر مفتاح للمقارنة',summary,
    content:data.html,notice:notices.join(' '),targetWindow});
}
export function printQuizAnswers(quiz,attempt){
  const questions=Array.isArray(quiz?.questions)?quiz.questions:[];
  const answers=Array.isArray(attempt?.answers)?attempt.answers:[];
  return printHtml({studentName:attempt.studentName||attempt.studentUid||'طالب',examTitle:quiz?.title||attempt.quizTitle||'اختبار إلكتروني',date:formatDate(attempt.createdAt),status:'تصحيح إلكتروني',
    summary:`الدرجة: ${attempt.correct??'—'} من ${attempt.total??questions.length} (${attempt.score??'—'}%)`,content:questions.length?questionCards(quiz,answers,[]):'',notice:questions.length?'':'لم يتم تحميل بنك أسئلة هذا الاختبار.'});
}
