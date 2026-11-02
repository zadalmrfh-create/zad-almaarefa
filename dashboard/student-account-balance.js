/* كشف حساب مستقل لكل طالب — لا نجمع مقدم طالب مع مديونية طالب آخر.
   كل القيم بالقرش، من تحويلات معتمدة تخص السجل الجديد فقط.
   لا تعدل هذه الدوال بيانات Firestore أو سجلات الحضور. */
import {amountDue,amountPaid,isCharge} from './payment-utils.js';
import {advanceSnapshot} from './advance-credit.js';
import {isCurrentPayment} from './payment-ledger-period.js';

const positive = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0;
export function studentAccountBalance(lessons = [], payments = []) {
  const charged = lessons.filter(isCharge);
  const approved = payments.filter(p => p.status === 'approved' && isCurrentPayment(p));
  const advance = advanceSnapshot(charged, payments);
  const totalPricePiastres = charged.reduce((sum,l) => sum + amountDue(l), 0);
  const paidOnLessonsPiastres = charged.reduce((sum,l) => sum + amountPaid(l), 0);
  const approvedTransfersPiastres = approved.reduce((sum,p) => sum + positive(p.amountPiastres), 0);
  // مدفوع الحصص يشمل الدفع المباشر والعلامات اليدوية؛ لا نجمعه مع التحويلات مرة ثانية.
  const coveredLessonsPiastres = paidOnLessonsPiastres + advance.usedAdvancePiastres;
  return {
    ...advance,
    totalPricePiastres,
    paidOnLessonsPiastres,
    approvedTransfersPiastres,
    coveredLessonsPiastres,
    availableToStudentPiastres: advance.availableAdvancePiastres,
    owedByStudentPiastres: advance.unpaidAfterPiastres,
    netStudentPiastres: advance.availableAdvancePiastres - advance.unpaidAfterPiastres
  };
}
// للعرض في كشف حساب الإدارة فقط: لا نظهر طالباً لم تحدث له أي حركة مالية.
// الحساب المسدد بالكامل يظل ظاهراً لأنه دفع بالفعل، حتى لو كان صافي رصيده صفراً.
// التحويلات المعلقة/المرفوضة أو المؤرشفة وحدها لا تجعل حساب الطالب مالياً نشطاً.
export function hasStudentFinancialActivity(account) {
  const b = account?.balance || {};
  return b.availableToStudentPiastres > 0 || b.owedByStudentPiastres > 0 ||
    b.approvedTransfersPiastres > 0 || b.paidOnLessonsPiastres > 0;
}

export function groupStudentAccounts(students = [], lessons = [], payments = []) {
  const map = new Map();
  const ensure = uid => {
    if (!map.has(uid)) map.set(uid,{uid,student:null,lessons:[],payments:[]});
    return map.get(uid);
  };
  for (const student of students) {
    if (student.id) ensure(student.id).student = student;
  }
  for (const lesson of lessons) {
    if (lesson.studentUid) ensure(lesson.studentUid).lessons.push(lesson);
  }
  for (const payment of payments) {
    if (payment.studentUid) ensure(payment.studentUid).payments.push(payment);
  }
  return [...map.values()].map(record => ({
    ...record,
    balance: studentAccountBalance(record.lessons, record.payments)
  }));
}
