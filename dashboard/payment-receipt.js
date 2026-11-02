/* إيصال دفعة معتمدة من فودافون كاش – للعرض والطباعة فقط.
   رقم الإيصال مشتق من معرّف مستند التحويل نفسه؛ لا ننشئ سجل دفع آخر.
   المقدم المذكور هو ما أضيف وقت اعتماد الدفعة، وليس الرصيد الحالي. */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const asPennies = value => Math.max(0,Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0);
const currency = value => (asPennies(value)/100).toLocaleString('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2})+' ج.م';
const formatDate = value => {
  try {
    const date = typeof value?.toDate === 'function' ? value.toDate() : value?.seconds ? new Date(value.seconds*1000) : new Date(value);
    return Number.isNaN(date.getTime()) ? 'غير مسجل' : new Intl.DateTimeFormat('ar-EG',{dateStyle:'long',timeStyle:'short'}).format(date);
  } catch { return 'غير مسجل'; }
};
const paymentKind = kind => kind === 'advance' ? 'مقدم لحصص قادمة' : kind === 'lessons' ? 'سداد حصص محددة' : 'سداد مستحقات / مقدم';

export function paymentReceiptNumber(payment){
  if(!payment?.id) throw new Error('مستند التحويل لا يحتوي على معرّف صالح.');
  return 'ZAD-'+String(payment.id).toUpperCase();
}

export function paymentReceiptSummary(payment){
  if(payment?.status !== 'approved') throw new Error('لا يمكن إصدار إيصال قبل اعتماد التحويل.');
  return ['إيصال استلام دفعة – أكاديمية زاد المعرفة التعليمية',
    'رقم الإيصال: '+paymentReceiptNumber(payment),
    'اسم الطالب: '+(payment.studentName||'طالب'),
    'المبلغ المعتمد: '+currency(payment.approvedPiastres??payment.amountPiastres),
    'طريقة السداد: فودافون كاش',
    'تاريخ الاعتماد: '+formatDate(payment.reviewedAt),
    'رقم مرجع التحويل: '+(payment.reference||'غير مذكور'),
    'نوع السداد: '+paymentKind(payment.targetType),
    'صادر عن الإدارة بعد مراجعة الدفعة في المنصة.'].join('\n');
}

export function paymentReceiptHtml(payment, lessonMap = new Map(), student = {}, logoUrl = '') {
  if(payment?.status !== 'approved') throw new Error('الإيصالات متاحة للدفعات المعتمدة فقط.');
  if(!payment?.id) throw new Error('لا يمكن إصدار الإيصال دون معرّف التحويل.');
  const amount = asPennies(payment.approvedPiastres??payment.amountPiastres);
  if(amount<=0) throw new Error('مبلغ التحويل غير صحيح.');
  const allocations=Array.isArray(payment.allocations)?payment.allocations:[];
  const rows=allocations.map((a,index)=>{
    const lesson=lessonMap.get(String(a.attendanceId||''));
    const name=lesson?(Array.isArray(lesson.subjects)&&lesson.subjects.length?lesson.subjects.join('، '):lesson.subject||'حصة تعليمية'):'حصة مسجلة';
    const date=lesson?.date||'تاريخ غير متاح';
    const cancelled=lesson?.deleted===true?' (الحصة ملغاة وتحتاج تسوية)':'';
    return `<tr><td>${index+1}</td><td>${escapeHtml(name+cancelled)}<small>${escapeHtml(date)}</small></td><td>${escapeHtml(currency(a.amountPiastres))}</td></tr>`;
  }).join('');
  const allocated=allocations.reduce((sum,a)=>sum+asPennies(a.amountPiastres),0);
  const hasCredit=payment.creditPiastres!==undefined && payment.creditPiastres!==null;
  const credit=hasCredit?asPennies(payment.creditPiastres):Math.max(0,amount-allocated);
  const mismatch=allocated+credit!==amount;
  const email=String(student?.email||'').trim();
  const phone=String(student?.phone||student?.phoneNumber||'').trim();
  const studentName=String(payment.studentName||student?.fullName||student?.name||'طالب');
  const logo=logoUrl?`<img src="${escapeHtml(logoUrl)}" alt="شعار زاد المعرفة" class="logo">`:'';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml('إيصال '+paymentReceiptNumber(payment))}</title><style>
@page{size:A5;margin:9mm}*{box-sizing:border-box}body{margin:0;background:#e9eef4;color:#11233d;font-family:Tahoma,Arial,sans-serif;font-size:13px;line-height:1.7}
.toolbar{display:flex;justify-content:center;align-items:center;gap:12px;padding:12px;background:#10213a;position:sticky;top:0;z-index:2;color:#fff;flex-wrap:wrap}
.toolbar button{font:inherit;cursor:pointer;padding:7px 14px;border:1px solid #d7ad45;border-radius:8px;background:#e7bd4f;color:#12213c;font-weight:700}.toolbar button:last-child{background:transparent;color:#fff}
.sheet{width:148mm;max-width:calc(100% - 20px);margin:18px auto;background:#fff;padding:13mm 12mm;border:1px solid #cbd5e1;box-shadow:0 8px 24px #0002}
.header{text-align:center;border-bottom:3px solid #ca9d2e;padding-bottom:14px}.logo{width:80px;height:80px;object-fit:contain;margin-bottom:4px}.brand{font-size:19px;font-weight:800;color:#0c2b57}
.subtitle{font-size:15px;font-weight:800;color:#96710c;margin:8px 0 4px}.approved{display:inline-block;border:1px solid #76b6a0;color:#14644e;background:#e9faf2;border-radius:30px;padding:3px 13px;font-weight:700}
.number{font-family:Arial,sans-serif;direction:ltr;unicode-bidi:isolate;overflow-wrap:anywhere;font-size:11px;color:#475569;margin:9px auto 0}
.details{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin:19px 0}.field{border-bottom:1px solid #e2e8f0;padding-bottom:6px;overflow-wrap:anywhere}.field span{display:block;color:#697687;font-size:11px}.field b{display:block;font-size:12px}.amount{background:#f3f7fb;border:1px solid #cad4e0;border-right:4px solid #d8a528;padding:12px;text-align:center;margin:8px 0 14px}.amount b{font-size:24px;color:#0d3567;display:block}
section h3{font-size:13px;color:#0d3567;border-bottom:1px solid #cbd5e1;padding-bottom:5px;margin:16px 0 8px}table{width:100%;border-collapse:collapse}td,th{text-align:right;border-bottom:1px solid #e2e8f0;padding:8px 6px;font-size:11px;vertical-align:top}th{background:#f2f5fa;color:#123254}td small{display:block;color:#64748b}.summary{display:grid;grid-template-columns:1fr auto;gap:6px;margin:12px 0}.summary>div{padding:6px 0;border-bottom:1px dashed #cbd5e1}.summary strong{color:#113963}
.notice{font-size:11px;line-height:1.9;background:#fffbeb;color:#6e571b;padding:10px;border:1px solid #eddba0;border-radius:5px;margin-top:15px}.foot{font-size:10px;color:#66758a;text-align:center;margin-top:17px;padding-top:9px;border-top:1px solid #cbd5e1}.copy{font:10px Arial,sans-serif;overflow-wrap:anywhere}
@media(max-width:470px){.sheet{width:auto;padding:8mm 5mm}.details{grid-template-columns:1fr}}@media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{display:none}.sheet{width:100%;max-width:none;margin:0;padding:0;border:none;box-shadow:none} }
</style></head><body>
<div class="toolbar"><span>معاينة إيصال دفعة معتمدة</span><button type="button" onclick="window.print()">🖨️ طباعة / حفظ PDF</button><button type="button" onclick="window.close()">إغلاق</button></div>
<main class="sheet">
<header class="header">${logo}<div class="brand">أكاديمية زاد المعرفة التعليمية</div><div class="subtitle">إيصال استلام دفعة</div><div class="approved">✓ تم اعتماد الدفعة من الإدارة</div><div class="number">${escapeHtml(paymentReceiptNumber(payment))}</div></header>
<div class="details">
<div class="field"><span>اسم الطالب</span><b>${escapeHtml(studentName)}</b></div>
<div class="field"><span>رقم الإيصال</span><b class="copy" dir="ltr">${escapeHtml(paymentReceiptNumber(payment))}</b></div>
${email?`<div class="field"><span>البريد الإلكتروني</span><b>${escapeHtml(email)}</b></div>`:''}
${phone?`<div class="field"><span>هاتف الطالب</span><b dir="ltr">${escapeHtml(phone)}</b></div>`:''}
<div class="field"><span>تاريخ طلب التحويل</span><b>${escapeHtml(formatDate(payment.createdAt))}</b></div>
<div class="field"><span>تاريخ اعتماد الإدارة</span><b>${escapeHtml(formatDate(payment.reviewedAt))}</b></div>
<div class="field"><span>وسيلة الدفع</span><b>فودافون كاش</b></div>
<div class="field"><span>نوع السداد</span><b>${escapeHtml(paymentKind(payment.targetType))}</b></div>
<div class="field"><span>مرجع التحويل المقدم من الطالب</span><b>${escapeHtml(payment.reference||'غير مذكور')}</b></div>
<div class="field"><span>هاتف مرسل التحويل</span><b dir="ltr">${escapeHtml(payment.senderPhone||'غير مسجل')}</b></div>
</div><div class="amount"><span>المبلغ المعتمد والمستلم</span><b>${escapeHtml(currency(amount))}</b></div>
<section><h3>تفصيل توزيع هذه الدفعة</h3>
${rows?`<table><thead><tr><th>#</th><th>الحصة</th><th>المبلغ المخصص</th></tr></thead><tbody>${rows}</tbody></table>`:'<p>لا توجد حصص موزّع عليها هذا التحويل عند الاعتماد.</p>'}
<div class="summary"><div>مجموع ما خُصص للحصص</div><div><strong>${escapeHtml(currency(allocated))}</strong></div><div>مقدم أُضيف عند الاعتماد</div><div><strong>${escapeHtml(currency(credit))}</strong></div></div>
</section>
${mismatch?'<div class="notice">⚠️ يوجد اختلاف بين إجمالي التحويل والمبالغ المسجلة للتخصيص. راجع العملية مع الإدارة قبل مشاركة الإيصال.</div>':''}
<div class="notice">هذا الإيصال يثبت اعتماد دفعة واحدة مسجلة على المنصة بعد مراجعة الإدارة، ولا يُعد فاتورة ضريبية. المقدم الموضح هو المبلغ المضاف وقت اعتماد الدفعة، وقد يكون استُخدم بعد ذلك في حصص لاحقة؛ للاستعلام عن الرصيد الحالي راجع كشف حساب الطالب.</div>
<footer class="foot">أكاديمية زاد المعرفة التعليمية · إيصال إلكتروني للدفعة المعتمدة<br>معرّف السجل الأصلي: <span class="copy" dir="ltr">${escapeHtml(payment.id)}</span></footer>
</main></body></html>`;
}
