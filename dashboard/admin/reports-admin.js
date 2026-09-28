import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const STATUS_ORDER = ['جديد', 'قيد المراجعة', 'تم التواصل', 'تم الحجز', 'مكتمل', 'ملغي'];
let allBookings = [];
let filteredBookings = [];
let allLibraryDownloads = [];
let filteredLibraryDownloads = [];
let currentModalCsvRows = [];
let currentModalFilename = 'report.csv';
let currentPrintHtml = '';
let currentBookingForNotes = null;
let initialized = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function toDate(value) {
  if (!value) return null;
  try {
    if (typeof value.toDate === 'function') return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function fmtDate(value) {
  const date = toDate(value);
  if (!date) return 'غير متوفر';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function dayStart(value = new Date()) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthStart(value = new Date()) {
  const d = new Date(value);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateRangeMatches(date, fromValue, toValue) {
  if (!date) return !fromValue && !toValue;
  if (fromValue) {
    const from = new Date(`${fromValue}T00:00:00`);
    if (date < from) return false;
  }
  if (toValue) {
    const to = new Date(`${toValue}T23:59:59.999`);
    if (date > to) return false;
  }
  return true;
}

function bookingStudentKey(b) {
  return String(b.studentUid || b.email || b.phone || b.fullName || b.id || '').toLowerCase();
}

function downloadUserKey(item) {
  return String(item.userId || item.userEmail || item.userName || item.id || '').toLowerCase();
}

function downloadTime(item) {
  return toDate(item.downloadedAt || item.clientDownloadedAt);
}

function countBy(items, getter) {
  const map = new Map();
  items.forEach(item => {
    const key = String(getter(item) || 'غير محدد').trim() || 'غير محدد';
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function sortedEntries(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderBars(id, entries, limit = 8) {
  const box = $(id);
  if (!box) return;
  const rows = entries.slice(0, limit);
  if (!rows.length) {
    box.innerHTML = '<div class="report-empty">لا توجد بيانات مطابقة.</div>';
    return;
  }
  const max = Math.max(...rows.map(([, v]) => Number(v) || 0), 1);
  box.innerHTML = rows.map(([label, value]) => `
    <div class="report-bar-row" title="${esc(label)}: ${Number(value).toLocaleString('ar-EG')}">
      <span class="report-bar-label">${esc(label)}</span>
      <div class="report-bar-track"><div class="report-bar-fill" style="width:${Math.max(2, (Number(value) / max) * 100)}%"></div></div>
      <span class="report-bar-value">${Number(value).toLocaleString('ar-EG')}</span>
    </div>`).join('');
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printHtml(title, html) {
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) {
    alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');
    return;
  }
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:Arial,Tahoma,sans-serif;padding:28px;color:#111;direction:rtl}h1,h2,h3{color:#6b4f00}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #bbb;padding:8px;text-align:right}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.box{border:1px solid #ccc;padding:10px;border-radius:8px}.muted{color:#666}.no-print{display:none!important}
  </style></head><body><h1>${esc(title)}</h1>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

function optionValues(items, getter) {
  return [...new Set(items.map(getter).map(v => String(v || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ar'));
}

function fillSelect(id, values, allLabel) {
  const el = $(id);
  if (!el) return;
  const old = el.value || 'all';
  el.innerHTML = `<option value="all">${esc(allLabel)}</option>` + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if ([...el.options].some(o => o.value === old)) el.value = old;
}

/* =====================================================
   BOOKINGS REPORTS
===================================================== */

async function loadBookingReportData() {
  const result = $('bookingReportResultCount');
  if (result) result.textContent = 'جارٍ تحديث تقرير الحجوزات…';
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    allBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allBookings.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));

    fillSelect('bookingReportSection', optionValues(allBookings, b => b.section), 'كل الأقسام');
    fillSelect('bookingReportSubject', optionValues(allBookings, b => b.subject), 'كل المواد');
    fillSelect('bookingReportTeacher', optionValues(allBookings, b => b.teacherName || 'لم يُعيّن'), 'كل المعلمين');
    renderBookingReports();
  } catch (error) {
    console.error('Booking reports error:', error);
    if (result) result.textContent = 'تعذر تحميل تقرير الحجوزات: ' + (error.code || error.message);
    const body = $('bookingAggregateRows');
    if (body) body.innerHTML = '<tr><td colspan="7">تعذر تحميل التقرير.</td></tr>';
  }
}

function renderBookingReports() {
  const search = ($('bookingReportSearch')?.value || '').trim().toLowerCase();
  const status = $('bookingReportStatus')?.value || 'all';
  const section = $('bookingReportSection')?.value || 'all';
  const subject = $('bookingReportSubject')?.value || 'all';
  const teacher = $('bookingReportTeacher')?.value || 'all';
  const mode = $('bookingReportMode')?.value || 'all';
  const from = $('bookingReportFrom')?.value || '';
  const to = $('bookingReportTo')?.value || '';

  filteredBookings = allBookings.filter(b => {
    const haystack = [b.fullName, b.email, b.phone, b.subject, b.teacherName, b.grade, b.stage, b.section].join(' ').toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (status !== 'all' && (b.status || 'جديد') !== status) return false;
    if (section !== 'all' && (b.section || '') !== section) return false;
    if (subject !== 'all' && (b.subject || '') !== subject) return false;
    if (teacher !== 'all' && (b.teacherName || 'لم يُعيّن') !== teacher) return false;
    if (mode !== 'all' && (b.lessonMode || '') !== mode) return false;
    if (!dateRangeMatches(toDate(b.createdAt), from, to)) return false;
    return true;
  });

  const counts = Object.fromEntries(STATUS_ORDER.map(s => [s, 0]));
  filteredBookings.forEach(b => counts[b.status || 'جديد'] = (counts[b.status || 'جديد'] || 0) + 1);
  const uniqueStudents = new Set(filteredBookings.map(bookingStudentKey).filter(Boolean));
  const converted = (counts['تم الحجز'] || 0) + (counts['مكتمل'] || 0);
  const conversion = filteredBookings.length ? Math.round((converted / filteredBookings.length) * 100) : 0;

  setText('bookReportTotal', filteredBookings.length.toLocaleString('ar-EG'));
  setText('bookReportStudents', uniqueStudents.size.toLocaleString('ar-EG'));
  setText('bookReportNew', (counts['جديد'] || 0).toLocaleString('ar-EG'));
  setText('bookReportReview', (counts['قيد المراجعة'] || 0).toLocaleString('ar-EG'));
  setText('bookReportContacted', (counts['تم التواصل'] || 0).toLocaleString('ar-EG'));
  setText('bookReportBooked', (counts['تم الحجز'] || 0).toLocaleString('ar-EG'));
  setText('bookReportCompleted', (counts['مكتمل'] || 0).toLocaleString('ar-EG'));
  setText('bookReportCancelled', (counts['ملغي'] || 0).toLocaleString('ar-EG'));
  setText('bookReportConversion', `${conversion.toLocaleString('ar-EG')}%`);
  setText('bookingReportResultCount', `يعرض ${filteredBookings.length.toLocaleString('ar-EG')} حجزًا من أصل ${allBookings.length.toLocaleString('ar-EG')}.`);

  renderBars('bookingStatusChart', STATUS_ORDER.map(s => [s, counts[s] || 0]).filter(([, v]) => v > 0), 6);
  renderBars('bookingSubjectChart', sortedEntries(countBy(filteredBookings, b => b.subject || 'غير محدد')), 8);
  renderBars('bookingSectionChart', sortedEntries(countBy(filteredBookings, b => b.section || 'غير محدد')), 8);
  renderBars('bookingTeacherChart', sortedEntries(countBy(filteredBookings, b => b.teacherName || 'لم يُعيّن')), 8);
  renderBars('bookingPeriodChart', sortedEntries(countBy(filteredBookings, b => b.preferredPeriod || 'غير محدد')), 8);

  const dayMap = new Map();
  filteredBookings.forEach(b => {
    [b.preferredDay1, b.preferredDay2].filter(Boolean).forEach(day => dayMap.set(day, (dayMap.get(day) || 0) + 1));
  });
  renderBars('bookingDayChart', sortedEntries(dayMap), 7);

  const daily = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = dayStart(now); d.setDate(d.getDate() - i);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const label = new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric' }).format(d);
    const total = filteredBookings.filter(b => { const dt = toDate(b.createdAt); return dt && dt >= d && dt < next; }).length;
    daily.push([label, total]);
  }
  renderBars('bookingDailyChart', daily, 7);

  const teacherStats = new Map();
  filteredBookings.forEach(b => {
    const name = b.teacherName || 'لم يُعيّن';
    if (!teacherStats.has(name)) teacherStats.set(name, { total: 0, booked: 0, completed: 0, cancelled: 0 });
    const x = teacherStats.get(name);
    x.total += 1;
    if (b.status === 'تم الحجز') x.booked += 1;
    if (b.status === 'مكتمل') x.completed += 1;
    if (b.status === 'ملغي') x.cancelled += 1;
  });
  const teacherRows = $('bookingTeacherStatsRows');
  if (teacherRows) {
    const list = [...teacherStats.entries()].sort((a, b) => b[1].total - a[1].total);
    teacherRows.innerHTML = list.length ? list.map(([name, x]) => `<tr><td>${esc(name)}</td><td>${x.total}</td><td>${x.booked}</td><td>${x.completed}</td><td>${x.cancelled}</td></tr>`).join('') : '<tr><td colspan="5">لا توجد بيانات مطابقة.</td></tr>';
  }

  const body = $('bookingAggregateRows');
  if (body) {
    body.innerHTML = filteredBookings.length ? filteredBookings.slice(0, 500).map(b => `
      <tr>
        <td>${esc(b.fullName || '—')}</td>
        <td>${esc(b.subject || '—')}</td>
        <td>${esc(b.teacherName || 'لم يُعيّن')}</td>
        <td>${esc(b.lessonMode || '—')}</td>
        <td><span class="status-pill" data-status="${esc(b.status || 'جديد')}">${esc(b.status || 'جديد')}</span></td>
        <td>${esc(fmtDate(b.createdAt))}</td>
        <td><button class="btn booking-report-btn" data-booking-report-id="${esc(b.id)}" type="button">📄 فتح</button></td>
      </tr>`).join('') : '<tr><td colspan="7">لا توجد حجوزات مطابقة للفلاتر.</td></tr>';
  }
}

function bookingCsvRows(items = filteredBookings) {
  return [
    ['اسم الطالب', 'الهاتف', 'البريد', 'القسم', 'نظام التعليم', 'المرحلة', 'الصف', 'المادة', 'نوع الحصة', 'المعلم', 'اليوم الأول', 'اليوم الثاني', 'الفترة', 'طريقة الحصة', 'الحالة', 'تاريخ الطلب', 'آخر تحديث', 'ملاحظات الطالب', 'ملاحظات الإدارة'],
    ...items.map(b => [
      b.fullName || '', b.phone || '', b.email || '', b.section || '', b.educationType || '', b.stage || '', b.grade || '', b.subject || '', b.lessonType || '', b.teacherName || 'لم يُعيّن', b.preferredDay1 || '', b.preferredDay2 || '', b.preferredPeriod || '', b.lessonMode || '', b.status || 'جديد', fmtDate(b.createdAt), fmtDate(b.updatedAt), b.notes || '', b.adminNotes || ''
    ])
  ];
}

function bookingAggregatePrintableHtml() {
  const counts = Object.fromEntries(STATUS_ORDER.map(s => [s, filteredBookings.filter(b => (b.status || 'جديد') === s).length]));
  const uniqueStudents = new Set(filteredBookings.map(bookingStudentKey).filter(Boolean)).size;
  const converted = (counts['تم الحجز'] || 0) + (counts['مكتمل'] || 0);
  const conversion = filteredBookings.length ? Math.round(converted / filteredBookings.length * 100) : 0;
  return `
    <div class="grid">
      <div class="box"><b>إجمالي الحجوزات</b><br>${filteredBookings.length}</div>
      <div class="box"><b>طلاب مختلفون</b><br>${uniqueStudents}</div>
      <div class="box"><b>نسبة التحويل</b><br>${conversion}%</div>
    </div>
    <h2>الحالات</h2>
    <table><thead><tr><th>الحالة</th><th>العدد</th></tr></thead><tbody>${STATUS_ORDER.map(s => `<tr><td>${esc(s)}</td><td>${counts[s] || 0}</td></tr>`).join('')}</tbody></table>
    <h2>تفاصيل الحجوزات</h2>
    <table><thead><tr><th>الطالب</th><th>المادة</th><th>المعلم</th><th>الطريقة</th><th>الحالة</th><th>تاريخ الطلب</th></tr></thead><tbody>${filteredBookings.map(b => `<tr><td>${esc(b.fullName || '—')}</td><td>${esc(b.subject || '—')}</td><td>${esc(b.teacherName || 'لم يُعيّن')}</td><td>${esc(b.lessonMode || '—')}</td><td>${esc(b.status || 'جديد')}</td><td>${esc(fmtDate(b.createdAt))}</td></tr>`).join('')}</tbody></table>`;
}

async function openBookingReport(bookingId) {
  const booking = allBookings.find(b => b.id === bookingId);
  if (!booking) return alert('تعذر العثور على بيانات الحجز. اضغط تحديث التقارير ثم أعد المحاولة.');
  currentBookingForNotes = booking;

  let history = [];
  try {
    const snap = await getDocs(query(collection(db, 'bookingStatusHistory'), where('bookingId', '==', booking.id)));
    history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    history.sort((a, b) => {
      const da = toDate(a.changedAt || a.clientChangedAt)?.getTime() || 0;
      const dbb = toDate(b.changedAt || b.clientChangedAt)?.getTime() || 0;
      return da - dbb;
    });
  } catch (e) {
    console.warn('Booking history load error:', e);
  }

  const created = toDate(booking.createdAt);
  const updated = toDate(booking.updatedAt);
  const duration = created && updated ? humanDuration(updated - created) : 'غير متوفر';
  const historyHtml = [
    `<div class="report-history-item"><b>تم إنشاء الطلب — جديد</b><small>${esc(fmtDate(booking.createdAt))}</small></div>`,
    ...history.map(h => `<div class="report-history-item"><b>${esc(h.previousStatus || '—')} ← ${esc(h.status || '—')}</b><small>${esc(fmtDate(h.changedAt || h.clientChangedAt))} — بواسطة ${esc(h.changedByName || h.changedByEmail || 'الإدارة')}</small></div>`),
    ...(history.length === 0 && (booking.status || 'جديد') !== 'جديد' ? [`<div class="report-history-item"><b>الحالة الحالية: ${esc(booking.status)}</b><small>هذا الحجز أقدم من نظام سجل الحالات؛ سيبدأ التسجيل التفصيلي من أول تغيير جديد.</small></div>`] : [])
  ].join('');

  const details = [
    ['الطالب', booking.fullName || '—'], ['الهاتف', booking.phone || '—'], ['البريد', booking.email || '—'],
    ['القسم', booking.section || '—'], ['نظام التعليم', booking.educationType || '—'], ['المرحلة', booking.stage || '—'],
    ['الصف', booking.grade || '—'], ['المادة', booking.subject || '—'], ['نوع الحصة', booking.lessonType || '—'],
    ['المعلم', booking.teacherName || 'لم يُعيّن'], ['طريقة الحصة', booking.lessonMode || '—'], ['الفترة', booking.preferredPeriod || '—'],
    ['اليوم الأول', booking.preferredDay1 || '—'], ['اليوم الثاني', booking.preferredDay2 || '—'], ['الحالة الحالية', booking.status || 'جديد'],
    ['تاريخ الطلب', fmtDate(booking.createdAt)], ['آخر تحديث', fmtDate(booking.updatedAt)], ['المدة حتى آخر تحديث', duration]
  ];

  const html = `
    <h3 class="report-title">تقرير الحجز: ${esc(booking.fullName || booking.id)}</h3>
    <div class="report-info-grid">${details.map(([k, v]) => `<div class="report-info-item"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>
    <h3 class="report-section-title">📝 ملاحظات الطالب</h3><div class="report-info-item">${esc(booking.notes || 'لا توجد ملاحظات.')}</div>
    <h3 class="report-section-title">🕓 سجل حالة الحجز</h3><div class="report-history">${historyHtml}</div>
    <div class="report-note-area no-print">
      <label for="bookingAdminNotesInput">ملاحظات الإدارة على هذا الحجز</label>
      <textarea id="bookingAdminNotesInput" rows="4" placeholder="اكتب ملاحظة إدارية خاصة بالحجز…">${esc(booking.adminNotes || '')}</textarea>
      <div class="actions"><button id="saveBookingAdminNotes" class="btn gold" type="button">💾 حفظ الملاحظات</button><span id="bookingAdminNotesStatus"></span></div>
    </div>`;

  const printVersion = `
    <div class="grid">${details.map(([k, v]) => `<div class="box"><span class="muted">${esc(k)}</span><br><b>${esc(v)}</b></div>`).join('')}</div>
    <h2>ملاحظات الطالب</h2><p>${esc(booking.notes || 'لا توجد ملاحظات.')}</p>
    <h2>ملاحظات الإدارة</h2><p>${esc(booking.adminNotes || 'لا توجد ملاحظات.')}</p>
    <h2>سجل الحالة</h2>${historyHtml}`;

  currentModalCsvRows = [
    ['البند', 'القيمة'],
    ...details,
    ['ملاحظات الطالب', booking.notes || ''],
    ['ملاحظات الإدارة', booking.adminNotes || ''],
    [],
    ['سجل الحالة', 'من', 'إلى', 'الوقت', 'بواسطة'],
    ...history.map(h => ['', h.previousStatus || '', h.status || '', fmtDate(h.changedAt || h.clientChangedAt), h.changedByName || h.changedByName || h.changedByEmail || 'الإدارة'])
  ];
  currentModalFilename = `تقرير-حجز-${safeFilename(booking.fullName || booking.id)}.csv`;
  currentPrintHtml = printVersion;
  openModal(`تقرير الحجز — ${booking.fullName || ''}`, html);
}

function humanDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'غير متوفر';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ساعة و${mins % 60} دقيقة`;
  const days = Math.floor(hours / 24);
  return `${days} يوم و${hours % 24} ساعة`;
}

function safeFilename(value) {
  return String(value || 'report').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80);
}

function openStudentReportByBooking(bookingId) {
  const selected = allBookings.find(b => b.id === bookingId);
  if (!selected) return alert('تعذر العثور على بيانات الطالب.');
  const key = bookingStudentKey(selected);
  const items = allBookings.filter(b => bookingStudentKey(b) === key);
  const statuses = countBy(items, b => b.status || 'جديد');
  const completed = items.filter(b => b.status === 'مكتمل').length;
  const booked = items.filter(b => b.status === 'تم الحجز').length;
  const cancelled = items.filter(b => b.status === 'ملغي').length;

  const html = `
    <h3 class="report-title">تقرير الطالب: ${esc(selected.fullName || 'طالب')}</h3>
    <div class="report-info-grid">
      <div class="report-info-item"><small>الاسم</small><b>${esc(selected.fullName || '—')}</b></div>
      <div class="report-info-item"><small>الهاتف</small><b>${esc(selected.phone || '—')}</b></div>
      <div class="report-info-item"><small>البريد</small><b>${esc(selected.email || '—')}</b></div>
      <div class="report-info-item"><small>إجمالي الحجوزات</small><b>${items.length.toLocaleString('ar-EG')}</b></div>
      <div class="report-info-item"><small>تم الحجز/مكتمل</small><b>${(booked + completed).toLocaleString('ar-EG')}</b></div>
      <div class="report-info-item"><small>ملغي</small><b>${cancelled.toLocaleString('ar-EG')}</b></div>
    </div>
    <h3 class="report-section-title">📅 كل حجوزات الطالب</h3>
    <div class="table-wrap"><table class="table report-table-compact"><thead><tr><th>المادة</th><th>المعلم</th><th>الطريقة</th><th>الحالة</th><th>تاريخ الطلب</th><th>الحجز</th></tr></thead><tbody>
      ${items.map(b => `<tr><td>${esc(b.subject || '—')}</td><td>${esc(b.teacherName || 'لم يُعيّن')}</td><td>${esc(b.lessonMode || '—')}</td><td>${esc(b.status || 'جديد')}</td><td>${esc(fmtDate(b.createdAt))}</td><td><button class="btn booking-report-btn" data-booking-report-id="${esc(b.id)}" type="button">فتح التقرير</button></td></tr>`).join('')}
    </tbody></table></div>
    <h3 class="report-section-title">ملخص الحالات</h3><div class="report-info-grid">${sortedEntries(statuses).map(([s, c]) => `<div class="report-info-item"><small>${esc(s)}</small><b>${c}</b></div>`).join('')}</div>`;

  currentModalCsvRows = bookingCsvRows(items);
  currentModalFilename = `تقرير-الطالب-${safeFilename(selected.fullName || selected.email || 'student')}.csv`;
  currentPrintHtml = `<p><b>الاسم:</b> ${esc(selected.fullName || '—')} &nbsp; <b>الهاتف:</b> ${esc(selected.phone || '—')} &nbsp; <b>البريد:</b> ${esc(selected.email || '—')}</p><table><thead><tr><th>المادة</th><th>المعلم</th><th>الطريقة</th><th>الحالة</th><th>تاريخ الطلب</th></tr></thead><tbody>${items.map(b => `<tr><td>${esc(b.subject || '—')}</td><td>${esc(b.teacherName || 'لم يُعيّن')}</td><td>${esc(b.lessonMode || '—')}</td><td>${esc(b.status || 'جديد')}</td><td>${esc(fmtDate(b.createdAt))}</td></tr>`).join('')}</tbody></table>`;
  currentBookingForNotes = null;
  openModal(`تقرير الطالب — ${selected.fullName || ''}`, html);
}

/* =====================================================
   LIBRARY DOWNLOAD REPORTS
===================================================== */

async function loadLibraryReportData() {
  try {
    const snap = await getDocs(collection(db, 'libraryDownloads'));
    allLibraryDownloads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allLibraryDownloads.sort((a, b) => (downloadTime(b)?.getTime() || 0) - (downloadTime(a)?.getTime() || 0));
    renderLibraryReports();
  } catch (error) {
    console.error('Library reports error:', error);
    const body = $('libraryUserStatsRows');
    if (body) body.innerHTML = `<tr><td colspan="6">تعذر تحميل التقرير: ${esc(error.code || error.message)}</td></tr>`;
  }
}

function renderLibraryReports() {
  const search = ($('libraryReportSearch')?.value || '').trim().toLowerCase();
  const source = $('libraryReportSource')?.value || 'all';
  const from = $('libraryReportFrom')?.value || '';
  const to = $('libraryReportTo')?.value || '';

  filteredLibraryDownloads = allLibraryDownloads.filter(item => {
    const haystack = [item.userName, item.userEmail, item.bookTitle, item.sourceLabel].join(' ').toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (source !== 'all' && (item.source || '') !== source) return false;
    if (!dateRangeMatches(downloadTime(item), from, to)) return false;
    return true;
  });

  const now = new Date();
  const today = dayStart(now);
  const week = new Date(today); week.setDate(week.getDate() - 6);
  const month = monthStart(now);
  const todayCount = allLibraryDownloads.filter(x => (downloadTime(x)?.getTime() || 0) >= today.getTime()).length;
  const weekCount = allLibraryDownloads.filter(x => (downloadTime(x)?.getTime() || 0) >= week.getTime()).length;
  const monthCount = allLibraryDownloads.filter(x => (downloadTime(x)?.getTime() || 0) >= month.getTime()).length;

  const users = new Set(filteredLibraryDownloads.map(downloadUserKey).filter(Boolean));
  const books = new Set(filteredLibraryDownloads.map(x => `${x.source || ''}|${x.bookTitle || ''}|${x.bookUrl || ''}`));
  setText('libraryTodayCount', todayCount.toLocaleString('ar-EG'));
  setText('libraryWeekCount', weekCount.toLocaleString('ar-EG'));
  setText('libraryMonthCount', monthCount.toLocaleString('ar-EG'));
  setText('libraryFilteredUsers', users.size.toLocaleString('ar-EG'));
  setText('libraryFilteredBooks', books.size.toLocaleString('ar-EG'));
  setText('libraryFilteredTotal', filteredLibraryDownloads.length.toLocaleString('ar-EG'));

  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const d = dayStart(now); d.setDate(d.getDate() - i);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const label = new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric' }).format(d);
    const count = filteredLibraryDownloads.filter(x => {
      const dt = downloadTime(x); return dt && dt >= d && dt < next;
    }).length;
    daily.push([label, count]);
  }
  renderBars('libraryDailyChart', daily, 7);
  renderBars('libraryTopBooksChart', sortedEntries(countBy(filteredLibraryDownloads, x => x.bookTitle || 'كتاب بدون اسم')), 8);
  renderBars('librarySourceChart', sortedEntries(countBy(filteredLibraryDownloads, x => x.sourceLabel || (x.source === 'azhar' ? 'مكتبة التعليم الأزهري' : 'المكتبة العامة'))), 5);

  const byUser = new Map();
  filteredLibraryDownloads.forEach(item => {
    const key = downloadUserKey(item);
    if (!key) return;
    if (!byUser.has(key)) byUser.set(key, { key, name: item.userName || 'مستخدم', email: item.userEmail || '—', books: new Set(), clicks: 0, last: item });
    const entry = byUser.get(key);
    entry.books.add(`${item.source || ''}|${item.bookTitle || ''}|${item.bookUrl || ''}`);
    entry.clicks += 1;
    if ((downloadTime(item)?.getTime() || 0) > (downloadTime(entry.last)?.getTime() || 0)) entry.last = item;
  });
  const usersList = [...byUser.values()].sort((a, b) => b.clicks - a.clicks || b.books.size - a.books.size);
  const body = $('libraryUserStatsRows');
  if (body) {
    body.innerHTML = usersList.length ? usersList.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.books.size}</td><td>${u.clicks}</td><td>${esc(fmtDate(u.last.downloadedAt || u.last.clientDownloadedAt))}</td><td><button class="btn library-user-report-btn" data-library-user-key="${esc(encodeURIComponent(u.key))}" type="button">👤 عرض النشاط</button></td></tr>`).join('') : '<tr><td colspan="6">لا توجد تنزيلات مطابقة للفلاتر.</td></tr>';
  }
}

function libraryCsvRows(items = filteredLibraryDownloads) {
  return [
    ['الاسم', 'الإيميل', 'الكتاب', 'المكتبة', 'وقت التنزيل'],
    ...items.map(x => [x.userName || 'مستخدم', x.userEmail || '', x.bookTitle || 'كتاب بدون اسم', x.sourceLabel || (x.source === 'azhar' ? 'مكتبة التعليم الأزهري' : 'المكتبة العامة'), fmtDate(x.downloadedAt || x.clientDownloadedAt)])
  ];
}

function libraryPrintableHtml() {
  return `<p><b>إجمالي العمليات في التقرير:</b> ${filteredLibraryDownloads.length}</p><table><thead><tr><th>الاسم</th><th>الإيميل</th><th>الكتاب</th><th>المكتبة</th><th>الوقت</th></tr></thead><tbody>${filteredLibraryDownloads.map(x => `<tr><td>${esc(x.userName || 'مستخدم')}</td><td>${esc(x.userEmail || '—')}</td><td>${esc(x.bookTitle || 'كتاب بدون اسم')}</td><td>${esc(x.sourceLabel || (x.source === 'azhar' ? 'مكتبة التعليم الأزهري' : 'المكتبة العامة'))}</td><td>${esc(fmtDate(x.downloadedAt || x.clientDownloadedAt))}</td></tr>`).join('')}</tbody></table>`;
}

function openLibraryUserReport(encodedKey) {
  const key = decodeURIComponent(encodedKey || '');
  const items = allLibraryDownloads.filter(x => downloadUserKey(x) === key);
  if (!items.length) return alert('تعذر العثور على سجل هذا العضو.');
  const first = items[0];
  const uniqueBooks = new Set(items.map(x => `${x.source || ''}|${x.bookTitle || ''}|${x.bookUrl || ''}`));
  const html = `
    <h3 class="report-title">تقرير تنزيلات العضو: ${esc(first.userName || 'مستخدم')}</h3>
    <div class="report-info-grid">
      <div class="report-info-item"><small>الاسم</small><b>${esc(first.userName || 'مستخدم')}</b></div>
      <div class="report-info-item"><small>البريد</small><b>${esc(first.userEmail || '—')}</b></div>
      <div class="report-info-item"><small>كتب مختلفة</small><b>${uniqueBooks.size}</b></div>
      <div class="report-info-item"><small>إجمالي التنزيلات</small><b>${items.length}</b></div>
      <div class="report-info-item"><small>أول تنزيل</small><b>${esc(fmtDate(items[items.length - 1]?.downloadedAt || items[items.length - 1]?.clientDownloadedAt))}</b></div>
      <div class="report-info-item"><small>آخر تنزيل</small><b>${esc(fmtDate(items[0]?.downloadedAt || items[0]?.clientDownloadedAt))}</b></div>
    </div>
    <h3 class="report-section-title">📚 سجل التنزيلات</h3>
    <div class="table-wrap"><table class="table report-table-compact"><thead><tr><th>الكتاب</th><th>المكتبة</th><th>الوقت</th></tr></thead><tbody>${items.map(x => `<tr><td>${esc(x.bookTitle || 'كتاب بدون اسم')}</td><td>${esc(x.sourceLabel || (x.source === 'azhar' ? 'مكتبة التعليم الأزهري' : 'المكتبة العامة'))}</td><td>${esc(fmtDate(x.downloadedAt || x.clientDownloadedAt))}</td></tr>`).join('')}</tbody></table></div>`;
  currentModalCsvRows = libraryCsvRows(items);
  currentModalFilename = `تقرير-تنزيلات-${safeFilename(first.userName || first.userEmail || 'member')}.csv`;
  currentPrintHtml = `<p><b>الاسم:</b> ${esc(first.userName || 'مستخدم')} &nbsp; <b>البريد:</b> ${esc(first.userEmail || '—')}</p>${libraryPrintableTable(items)}`;
  currentBookingForNotes = null;
  openModal(`تقرير تنزيلات — ${first.userName || 'مستخدم'}`, html);
}

function libraryPrintableTable(items) {
  return `<table><thead><tr><th>الكتاب</th><th>المكتبة</th><th>الوقت</th></tr></thead><tbody>${items.map(x => `<tr><td>${esc(x.bookTitle || 'كتاب بدون اسم')}</td><td>${esc(x.sourceLabel || (x.source === 'azhar' ? 'مكتبة التعليم الأزهري' : 'المكتبة العامة'))}</td><td>${esc(fmtDate(x.downloadedAt || x.clientDownloadedAt))}</td></tr>`).join('')}</tbody></table>`;
}

/* =====================================================
   MODAL / EVENTS
===================================================== */

function openModal(title, html) {
  const modal = $('reportModal');
  setText('reportModalTitle', title);
  const content = $('reportModalContent');
  if (content) content.innerHTML = html;
  modal?.classList.add('show');
  modal?.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  const modal = $('reportModal');
  modal?.classList.remove('show');
  modal?.setAttribute('aria-hidden', 'true');
  currentBookingForNotes = null;
}

async function saveBookingAdminNotes() {
  if (!currentBookingForNotes) return;
  const input = $('bookingAdminNotesInput');
  const status = $('bookingAdminNotesStatus');
  const button = $('saveBookingAdminNotes');
  try {
    if (button) button.disabled = true;
    if (status) status.textContent = 'جارٍ الحفظ…';
    const notes = input?.value?.trim() || '';
    await updateDoc(doc(db, 'bookings', currentBookingForNotes.id), {
      adminNotes: notes,
      adminNotesUpdatedAt: serverTimestamp()
    });
    currentBookingForNotes.adminNotes = notes;
    const original = allBookings.find(b => b.id === currentBookingForNotes.id);
    if (original) original.adminNotes = notes;
    if (status) status.textContent = '✅ تم الحفظ';
  } catch (error) {
    console.error('Admin notes save error:', error);
    if (status) status.textContent = '❌ ' + (error.code || error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function resetBookingFilters() {
  ['bookingReportSearch', 'bookingReportFrom', 'bookingReportTo'].forEach(id => { if ($(id)) $(id).value = ''; });
  ['bookingReportStatus', 'bookingReportSection', 'bookingReportSubject', 'bookingReportTeacher', 'bookingReportMode'].forEach(id => { if ($(id)) $(id).value = 'all'; });
  renderBookingReports();
}

function resetLibraryFilters() {
  ['libraryReportSearch', 'libraryReportFrom', 'libraryReportTo'].forEach(id => { if ($(id)) $(id).value = ''; });
  if ($('libraryReportSource')) $('libraryReportSource').value = 'all';
  renderLibraryReports();
}

function bindEvents() {
  if (initialized) return;
  initialized = true;

  ['bookingReportSearch', 'bookingReportStatus', 'bookingReportSection', 'bookingReportSubject', 'bookingReportTeacher', 'bookingReportMode', 'bookingReportFrom', 'bookingReportTo']
    .forEach(id => $(id)?.addEventListener(id.includes('Search') ? 'input' : 'change', renderBookingReports));
  ['libraryReportSearch', 'libraryReportSource', 'libraryReportFrom', 'libraryReportTo']
    .forEach(id => $(id)?.addEventListener(id.includes('Search') ? 'input' : 'change', renderLibraryReports));

  $('resetBookingReportFilters')?.addEventListener('click', resetBookingFilters);
  $('resetLibraryReportFilters')?.addEventListener('click', resetLibraryFilters);
  $('bookingReportRefresh')?.addEventListener('click', loadBookingReportData);
  $('refreshLibraryDownloads')?.addEventListener('click', loadLibraryReportData);

  $('bookingReportExport')?.addEventListener('click', () => downloadCsv('تقرير-الحجوزات.csv', bookingCsvRows()));
  $('libraryReportExport')?.addEventListener('click', () => downloadCsv('تقرير-تنزيلات-المكتبة.csv', libraryCsvRows()));
  $('bookingReportPrint')?.addEventListener('click', () => printHtml('التقرير المجمّع للحجوزات', bookingAggregatePrintableHtml()));
  $('libraryReportPrint')?.addEventListener('click', () => printHtml('تقرير تنزيلات المكتبة', libraryPrintableHtml()));

  $('reportModalClose')?.addEventListener('click', closeModal);
  $('reportModal')?.addEventListener('click', e => { if (e.target === $('reportModal')) closeModal(); });
  $('reportModalDownload')?.addEventListener('click', () => downloadCsv(currentModalFilename, currentModalCsvRows));
  $('reportModalPrint')?.addEventListener('click', () => printHtml($('reportModalTitle')?.textContent || 'التقرير', currentPrintHtml || $('reportModalContent')?.innerHTML || ''));

  document.addEventListener('click', event => {
    const bookingBtn = event.target.closest('.booking-report-btn');
    if (bookingBtn) {
      openBookingReport(bookingBtn.dataset.bookingReportId);
      return;
    }
    const studentBtn = event.target.closest('.booking-student-report-btn');
    if (studentBtn) {
      openStudentReportByBooking(studentBtn.dataset.bookingStudentId);
      return;
    }
    const libraryUserBtn = event.target.closest('.library-user-report-btn');
    if (libraryUserBtn) {
      openLibraryUserReport(libraryUserBtn.dataset.libraryUserKey);
      return;
    }
    if (event.target.closest('#saveBookingAdminNotes')) {
      saveBookingAdminNotes();
      return;
    }
    if (event.target.closest('.booking-save-btn') || event.target.closest('.booking-delete-btn')) {
      setTimeout(loadBookingReportData, 1200);
    }
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

onAuthStateChanged(auth, user => {
  if (!user) return;
  bindEvents();
  Promise.allSettled([loadBookingReportData(), loadLibraryReportData()]);
});
