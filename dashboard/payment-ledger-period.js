/* زاد المعرفة — بداية السجل الجديد لفودافون كاش.
   هذا حد عرض وتقارير فقط. التحويلات الأقدم محفوظة كأرشيف مالي في Firestore.
   وقت اعتماد بدء السجل: 24 أكتوبر 2026، 05:15:58 صباحًا بتوقيت القاهرة. */
export const PAYMENT_LEDGER_START_UTC = '2026-10-24T02:15:58.000Z';
export const PAYMENT_LEDGER_START_MS = Date.parse(PAYMENT_LEDGER_START_UTC);
export const ledgerStartedAt = new Intl.DateTimeFormat('ar-EG', {
  dateStyle:'medium', timeStyle:'short', timeZone:'Africa/Cairo'
}).format(new Date(PAYMENT_LEDGER_START_MS));
export function paymentCreatedMs(payment) {
  const ts = payment?.createdAt;
  if (!ts) return 0; // معاملات قديمة بلا تاريخ محفوظ تظل في الأرشيف
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
  const ms = typeof ts === 'number' ? ts : Date.parse(String(ts));
  return Number.isFinite(ms) ? ms : 0;
}
export const isCurrentPayment = payment => paymentCreatedMs(payment) >= PAYMENT_LEDGER_START_MS;
