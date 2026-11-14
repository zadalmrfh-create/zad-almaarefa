/* مصدر واحد لحالة الدرجات — لا يعتمد على Firebase ولا يمنح صلاحيات. */
export function hasApprovedGrade(result) {
  const x=result||{};
  return x.verified === true &&
    Number.isInteger(x.finalScore) && Number.isInteger(x.finalTotal) &&
    x.finalTotal>=1 && x.finalTotal<=1000 && x.finalScore>=0 && x.finalScore<=x.finalTotal &&
    Number.isInteger(x.finalPercent) && x.finalPercent===Math.round(x.finalScore/x.finalTotal*100);
}
export function gradeForDisplay(result) {
  const x=result||{};
  const approved=hasApprovedGrade(x);
  const score=approved?x.finalScore:(Number.isInteger(x.score)?x.score:0);
  const total=approved?x.finalTotal:(Number.isInteger(x.total)&&x.total>0?x.total:1);
  const percent=approved?x.finalPercent:Math.round(score/total*100);
  return {approved,score,total,percent,excellent:approved&&percent>=85};
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
