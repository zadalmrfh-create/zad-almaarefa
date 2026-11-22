const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const display = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'UTC', dateStyle: 'full', timeStyle: 'short'
});
const currency = new Intl.NumberFormat('ar-EG', {style: 'currency', currency: 'EGP', maximumFractionDigits: 2});

export function normalizeArabic(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function bookingPrice({section, subject, lessonType}, assignment) {
  if (assignment === 'math') return 75;
  if (assignment === 'science' || assignment === 'chemistry') return 60;
  if (assignment !== 'default') return null;
  const name = normalizeArabic(subject);
  if (normalizeArabic(section) === 'اللغه العربيه' ||
      /(^| )(العربيه|النحو|الصرف|البلاغه|الادب|العروض|القافيه|النصوص)( |$)/.test(name)) return 75;
  if (lessonType === 'حصة فردية' && (normalizeArabic(section) === 'العلوم الشرعيه' ||
      /(^| )(الفقه|التفسير|التوحيد|العقيده|الحديث|الشرعيه)( |$)/.test(name))) return 75;
  return null;
}

export function asBookingPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function formatBookingPrice(amount) {
  return amount === null ? '' : amount === 0 ? 'مجانية' : currency.format(amount);
}

export function cairoNowSlot(now = new Date()) {
  const parts = Object.fromEntries(clock.formatToParts(now).map(({type, value}) => [type, value]));
  return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute;
}

export function validBookingSlot(slot) {
  if (typeof slot !== 'string' || !/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(slot)) return false;
  const date = new Date(slot + ':00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === slot;
}

export function formatBookingSlot(slot) {
  return validBookingSlot(slot) ? display.format(new Date(slot + ':00Z')) + ' بتوقيت القاهرة' : '';
}

export function bookingStatusLabel(status) {
  return ({
    'جديد': 'الطلب اتبعت',
    'قيد المراجعة': 'قيد المراجعة',
    'تم التواصل': 'تم التواصل',
    'تم الحجز': 'تم تأكيد الموعد',
    'مكتمل': 'الحصة مكتملة',
    'ملغي': 'الحجز ملغي'
  })[status] || 'حالة الطلب';
}

export function bookingProfile(user, profile = {}) {
  return {
    fullName: profile.fullName || profile.name || profile.displayName || user.displayName || '',
    phone: profile.phone || profile.whatsapp || profile.phoneNumber || profile.mobile || user.phoneNumber || '',
    email: profile.email || user.email || '',
    stage: profile.stage || profile.studyStage || profile.level || '',
    grade: profile.grade || profile.studyGrade || profile.className || '',
    educationType: profile.educationType || profile.schoolSystem || ''
  };
}
