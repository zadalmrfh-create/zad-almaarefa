/* زاد المعرفة — مبالغ الحصص بالقرش لتجنب أخطاء الكسور العشرية. */
export const toPiastres = value => Math.max(0, Math.round((Number(value) || 0) * 100));
export const amountDue = record => toPiastres(record.price);
export const cashApplied = record => Math.max(0, Math.round(Number(record.cashPaidPiastres) || 0));
export const amountPaid = record => record.paid === true ? amountDue(record) : Math.min(amountDue(record), cashApplied(record));
export const amountRemaining = record => Math.max(0, amountDue(record) - amountPaid(record));
export const money = pennies => (Number(pennies || 0) / 100).toLocaleString('ar-EG', {minimumFractionDigits:2,maximumFractionDigits:2}) + ' ج.م';
export const html = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const isCharge = r => ['حاضر','غائب','اعتذر'].includes(r.status) && amountDue(r) > 0;
