/* تفاصيل مالية مستقلة لكل طالب، للعرض فقط (لا تُعدَّل بيانات Firebase).
   ملاحظة: المدفوع المسجل على الحصة يشمل الدفع اليدوي والتحويلات الموزعة عليها.
   المقدم المستخدم قيمة عرض محسوبة مسبقاً ولا يجب أن يُسجَّل ثانية على الحصة. */
import {amountDue,amountPaid,isCharge} from './payment-utils.js';
import {isCurrentPayment,paymentCreatedMs} from './payment-ledger-period.js';

const positive=value=>Number.isFinite(Number(value))?Math.max(0,Math.round(Number(value))):0;

export function studentPaymentBreakdown(lessons=[],payments=[],balance={}){
  const appliedByLesson=balance.byLesson instanceof Map?balance.byLesson:new Map();
  const approvedAllocations=new Map();
  for(const payment of payments){
    if(payment.status!=='approved'||!isCurrentPayment(payment)||!Array.isArray(payment.allocations))continue;
    for(const a of payment.allocations){
      const id=String(a.attendanceId||'');
      if(!id)continue;
      if(!approvedAllocations.has(id))approvedAllocations.set(id,[]);
      approvedAllocations.get(id).push({paymentId:payment.id||'',reference:payment.reference||'',amountPiastres:positive(a.amountPiastres)});
    }
  }
  const sessions=lessons.filter(isCharge).map(l=>{
    const pricePiastres=amountDue(l);
    const paidInLessonPiastres=amountPaid(l);
    const detail=appliedByLesson.get(l.id);
    // تسجيل الحصة هو مصدر الحقيقة للدفع المباشر، ولا يُضاف توزيع التحويل مرة ثانية.
    const advanceUsedPiastres=Math.min(Math.max(0,pricePiastres-paidInLessonPiastres),positive(detail?.advanceAppliedPiastres));
    const outstandingPiastres=Math.max(0,pricePiastres-paidInLessonPiastres-advanceUsedPiastres);
    const coveredPiastres=paidInLessonPiastres+advanceUsedPiastres;
    return {
      id:l.id||'',date:l.date||'',subject:Array.isArray(l.subjects)&&l.subjects.length?l.subjects.join('، '):l.subject||'مادة غير محددة',
      teacherName:l.teacherName||'غير محدد',attendanceStatus:l.status||'',note:l.note||'',
      pricePiastres,paidInLessonPiastres,advanceUsedPiastres,coveredPiastres,outstandingPiastres,
      allocations:approvedAllocations.get(String(l.id))||[],
      paymentStatus:outstandingPiastres===0?'paid':coveredPiastres>0?'partial':'unpaid'
    };
  }).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
  const transfers=payments.slice().sort((a,b)=>paymentCreatedMs(b)-paymentCreatedMs(a)).map(p=>({
    ...p,archived:!isCurrentPayment(p),
    approvedAndCurrent:p.status==='approved'&&isCurrentPayment(p),
    allocations:Array.isArray(p.allocations)?p.allocations:[]
  }));
  const sessionCounts={paid:0,partial:0,unpaid:0};
  for(const s of sessions)sessionCounts[s.paymentStatus]++;
  return {sessions,transfers,sessionCounts};
}
