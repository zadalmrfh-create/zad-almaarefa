/* مصدر واحد لحالة الدرجات — لا يعتمد على Firebase ولا يمنح صلاحيات. */
export function hasApprovedGrade(result) {
  const x=result||{};
  return x.verified === true &&
    Number.isInteger(x.finalScore) && Number.isInteger(x.finalTotal) &&
    x.finalTotal>=1 && x.finalTotal<=1000 && x.finalScore>=0 && x.finalScore<=x.finalTotal &&
    Number.isInteger(x.finalPercent) && x.finalPercent===Math.round(x.finalScore/x.finalTotal*100);
}
export function gradeForDisplay(result) {
  // A single source of truth for all exam presentation surfaces.
  // Objective results are immediate; essays stay pending until marked by the admin.
  const g=codeExamProgress(result);
  return {approved:g.approved,score:g.score,total:g.total,percent:g.percent,excellent:g.excellent};
}
export function createApproval(scoreInput,totalInput,noteInput='') {
  // Numeric text validated strictly (not parseInt('10abc') etc).
  const asInt=(v)=>{const s=String(v).trim();return /^\d{1,4}$/.test(s)?Number(s):NaN};
  const finalScore=asInt(scoreInput),finalTotal=asInt(totalInput);
  if(!Number.isInteger(finalScore)||!Number.isInteger(finalTotal)||finalTotal<1||finalTotal>1000||finalScore<0||finalScore>finalTotal)
    throw new Error('اكتب درجة صحيحة من صفر إلى الدرجة الكلية (بحد أقصى 1000).');
  const reviewNote=String(noteInput||'').trim();
  if(reviewNote.length>500)throw new Error('الملاحظة يجب ألا تزيد عن 500 حرف.');
  return {verified:true,finalScore,finalTotal,finalPercent:Math.round(finalScore/finalTotal*100),reviewNote};
}


// Code-based exams: objective answers appear immediately; only essays need human marks.
// Scores received from the student browser are provisional, not server-verified.
const safeMark = (score,total) => Number.isInteger(score)&&Number.isInteger(total)&&total>=1&&total<=1000&&score>=0&&score<=total;
const essayType = type => ['essay','textarea','long-answer','long_text'].includes(String(type||'').toLowerCase());
export function codeAnswerQuestions(raw) {
  try {
    const data=typeof raw==='string'?JSON.parse(raw):raw;
    if(!['zad-answers-v2','zad-answers-v3'].includes(data?.format)||!Array.isArray(data.questions))return [];
    return data.questions.slice(0,150).map((q,i)=>({
      number:Number.isInteger(Number(q.number))&&Number(q.number)>0?Number(q.number):i+1,
      question:String(q.question||'').slice(0,800),
      studentAnswer:String(q.studentAnswer||'').slice(0,1200),
      type:String(q.type||'').slice(0,40).toLowerCase(),
      answerStatus:String(q.answerStatus||'').toLowerCase()
    }));
  }catch{return []}
}
export function codeExamProgress(result) {
  const x=result||{},questions=codeAnswerQuestions(x.answers);
  const essays=questions.filter(q=>essayType(q.type)||q.answerStatus==='essay');
  const objective=questions.filter(q=>!essays.includes(q));
  const validStatuses=new Set(['correct','incorrect','unanswered']);
  const reliablyMarked=objective.length>0 && objective.every(q=>validStatuses.has(q.answerStatus));
  let objectiveScore=null,objectiveTotal=null,source='unavailable';
  if(reliablyMarked){objectiveScore=objective.filter(q=>q.answerStatus==='correct').length;objectiveTotal=objective.length;source='answer-comparison';}
  else if(!objective.length&&essays.length){objectiveScore=0;objectiveTotal=0;source='essay-only';}
  else if(safeMark(x.score,x.total) && (!essays.length || x.total===objective.length)){
    // No reliable key in a legacy code exam: display its reported score, never call it verified.
    objectiveScore=x.score;objectiveTotal=x.total;source='client-reported';
  }
  let gradingMethod='';
  try{const meta=typeof x.answers==='string'?JSON.parse(x.answers):x.answers;gradingMethod=String(meta?.gradingMethod||'')}catch{}
  if(gradingMethod==='essay-pending' && source==='client-reported'){objectiveScore=null;objectiveTotal=null;source='unavailable';}
  const approved=hasApprovedGrade(x);
  if(approved){
    return {phase:'final',approved:true,pendingEssay:false,questions,essays,
      objectiveScore,objectiveTotal,source,score:x.finalScore,total:x.finalTotal,
      percent:x.finalPercent,excellent:x.finalPercent>=85,label:essays.length?'✅ النتيجة النهائية بعد تصحيح المقالي':'✅ درجة قديمة معتمدة'};
  }
  if(essays.length){
    return {phase:'essay-pending',approved:false,pendingEssay:true,questions,essays,
      objectiveScore,objectiveTotal,source,score:objectiveScore,total:objectiveTotal,
      percent:objectiveTotal>0&&objectiveScore!==null?Math.round(objectiveScore/objectiveTotal*100):null,
      excellent:false,label:'⏳ في انتظار نتيجة الأسئلة المقالية'};
  }
  return {phase:objectiveScore!==null?'automatic':'unavailable',approved:false,pendingEssay:false,questions,essays,
    objectiveScore,objectiveTotal,source,score:objectiveScore,total:objectiveTotal,
    percent:objectiveTotal>0&&objectiveScore!==null?Math.round(objectiveScore/objectiveTotal*100):null,
    excellent:false,label:source==='answer-comparison'?'✅ تصحيح تلقائي للأسئلة الموضوعية':'📊 نتيجة الامتحان الآلية المسجلة'};
}
export function createEssayReview(result, marks, noteInput='') {
  const progress=codeExamProgress(result);
  if(!progress.essays.length)throw new Error('الامتحان لا يحتوي على أسئلة مقالية محفوظة.');
  if(progress.objectiveScore===null||progress.objectiveTotal===null)
    throw new Error('لا يمكن حساب الدرجة النهائية لأن تصحيح الموضوعي غير مكتمل. راجع مفتاح الإجابات في الامتحان أولًا.');
  if(!Array.isArray(marks)||marks.length!==progress.essays.length)throw new Error('عدد درجات المقالي غير مطابق للأسئلة.');
  const asInt=v=>/^(0|[1-9]\d{0,2})$/.test(String(v).trim())?Number(v):NaN;
  const essayGrades=marks.map((entry,i)=>{
    const score=asInt(entry.score),max=asInt(entry.max);
    if(!Number.isInteger(score)||!Number.isInteger(max)||max<1||score>max)
      throw new Error('درجة السؤال المقالي '+(i+1)+' يجب أن تكون عددًا صحيحًا بين صفر والدرجة الكلية للسؤال.');
    return {number:progress.essays[i].number,score,max};
  });
  const finalTotal=progress.objectiveTotal+essayGrades.reduce((v,g)=>v+g.max,0);
  const finalScore=progress.objectiveScore+essayGrades.reduce((v,g)=>v+g.score,0);
  if(finalTotal<1||finalTotal>1000)throw new Error('إجمالي درجات الامتحان غير صالح.');
  const reviewNote=String(noteInput||'').trim();
  if(reviewNote.length>500)throw new Error('الملاحظات يجب ألا تزيد عن 500 حرف.');
  return {verified:true,finalScore,finalTotal,finalPercent:Math.round(finalScore/finalTotal*100),
    essayGrades,reviewNote};
}
