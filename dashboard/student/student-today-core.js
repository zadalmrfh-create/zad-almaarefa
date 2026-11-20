const minute = 60_000;
const day = 24 * 60 * minute;
const cairoClock = new Intl.DateTimeFormat('en-GB-u-nu-latn', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

function wallClockMs(ms) {
  const fields = Object.fromEntries(cairoClock.formatToParts(ms).map(part => [part.type, part.value]));
  return Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
}

export function dateMs(value) {
  const raw = typeof value?.toMillis === 'function' ? value.toMillis() : value;
  if (raw instanceof Date || typeof raw === 'number') return new Date(raw).getTime();
  return typeof raw === 'string' && raw.trim() ? Date.parse(raw) : NaN;
}

// The admin's datetime-local field stores a Cairo wall time with no UTC offset.
export function lessonStartMs(value) {
  const local = typeof value === 'string' && value.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!local) {
    if (typeof value === 'string' && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())) return NaN;
    return dateMs(value);
  }
  const iso = local[1] + 'T' + local[2] + ':' + (local[3] || '00');
  const guess = Date.parse(iso + 'Z');
  if (!Number.isFinite(guess) || new Date(guess).toISOString().slice(0, 19) !== iso) return NaN;
  const offsets = new Set([guess - day, guess + day].map(ms => wallClockMs(ms) - ms));
  const candidates = [...offsets].map(offset => guess - offset).filter(ms => wallClockMs(ms) === guess);
  // In the fall-back hour a legacy wall time is ambiguous. Use its earlier occurrence.
  return candidates.length ? Math.min(...candidates) : NaN;
}

export function lessonPhase(start, now = Date.now()) {
  if (!Number.isFinite(start)) return 'unknown';
  if (now >= start + 60 * minute) return 'past';
  if (now >= start - 15 * minute) return 'available';
  return 'upcoming';
}

export function lessonForStudent(lesson, uid, grade) {
  const status = String(lesson.status || '').trim().toLowerCase();
  if (lesson.deleted === true || lesson.published === false
    || ['cancelled', 'canceled', 'ملغى', 'ملغي', 'مُلغى'].includes(status)) return false;
  if (lesson.audience === 'selected' && (!Array.isArray(lesson.targetUids) || !lesson.targetUids.includes(uid))) return false;
  return !lesson.grade || String(lesson.grade).trim() === String(grade || '').trim();
}

export function webUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function chooseLesson(lessons, now = Date.now()) {
  const ordered = lessons.filter(lesson => Number.isFinite(lesson.start)).sort((a, b) => a.start - b.start);
  const open = ordered.filter(lesson => lesson.canJoin && lessonPhase(lesson.start, now) === 'available');
  const joinable = open.filter(lesson => lesson.start <= now).at(-1) || open[0];
  if (joinable) return {lesson: joinable, phase: 'available'};

  const next = ordered.find(lesson => lessonPhase(lesson.start, now) === 'upcoming'
    || (!lesson.canJoin && lessonPhase(lesson.start, now) === 'available'));
  if (next && Math.floor(wallClockMs(now) / day) === Math.floor(wallClockMs(next.start) / day)) {
    return {lesson: next, phase: now < next.start ? 'upcoming' : 'details'};
  }

  const recent = ordered.filter(lesson => lessonPhase(lesson.start, now) === 'past'
    && now < lesson.start + 60 * minute + day).at(-1);
  if (recent) return {lesson: recent, phase: 'past'};
  return next ? {lesson: next, phase: 'upcoming'} : null;
}

export function latestExam(items) {
  return items.reduce((latest, item) => !latest || (item.updated || 0) > (latest.updated || 0) ? item : latest, null);
}

export function pendingBookings(bookings) {
  const pending = new Set(['جديد', 'قيد المراجعة', 'تم التواصل', 'قيد الانتظار', 'pending', 'new']);
  return bookings.filter(booking => pending.has(String(booking.status || 'جديد').trim()));
}
