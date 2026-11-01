/* رصيد المدفوعات المقدمة: الحساب بالقرش ومن التحويلات المعتمدة فقط.
   يتم احتساب استخدام المقدم على المستحقات تلقائياً في العرض، من الأقدم للأحدث.
   لا يتم تعديل سجلات الحصص بهذا الاحتساب، فلا يُحتسب الخصم مرتين عند تجديد الصفحة. */
import {amountRemaining,isCharge} from './payment-utils.js';
import {isCurrentPayment} from './payment-ledger-period.js';
const asMoney = n => Number.isSafeInteger(Number(n)) && Number(n)>0 ? Number(n) : 0;
export function approvedAdvanceTotal(payments=[]){
  return payments.filter(p=>p.status==='approved' && isCurrentPayment(p))
    .reduce((sum,p)=>sum+asMoney(p.creditPiastres),0);
}
export function advanceSnapshot(lessons=[],payments=[]){
  const totalAdvancePiastres=approvedAdvanceTotal(payments);
  const byLesson=new Map();
  let rest=totalAdvancePiastres,unpaidBefore=0;
  const due=lessons.filter(isCharge).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')) || String(a.id||'').localeCompare(String(b.id||'')));
  for(const l of due){
    const before=amountRemaining(l);
    unpaidBefore+=before;
    const used=Math.min(before,rest);
    byLesson.set(l.id,{beforePiastres:before,advanceAppliedPiastres:used,afterPiastres:before-used});
    rest-=used;
  }
  return {
    totalAdvancePiastres,
    usedAdvancePiastres:totalAdvancePiastres-rest,
    availableAdvancePiastres:rest,
    unpaidBeforePiastres:unpaidBefore,
    unpaidAfterPiastres:unpaidBefore-(totalAdvancePiastres-rest),
    byLesson
  };
}
