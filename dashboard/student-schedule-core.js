import {lessonStartMs} from './student/student-today-core.js?v=20261120-today1';

export const personalLessonCollection = uid => ['studentSchedules', uid, 'lessons'];

export function personalLessonData(input) {
  const field = key => String(input[key] ?? '').trim();
  const title = field('title'), subject = field('subject'), teacherName = field('teacherName');
  const date = field('date'), meetUrl = field('meetUrl');
  if (!title || title.length > 150 || !subject || subject.length > 100 || teacherName.length > 100) {
    throw Error('اكتب عنوان الحصة والمادة وتأكد من طول البيانات.');
  }
  if (!/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(date) || !Number.isFinite(lessonStartMs(date))) {
    throw Error('اختار تاريخ وساعة صالحين بتوقيت القاهرة.');
  }
  if (meetUrl) {
    let url;
    try { url = new URL(meetUrl); } catch {}
    if (url?.protocol !== 'https:' || url.username || url.password || meetUrl.length > 1000) {
      throw Error('اكتب رابط حصة صالح يبدأ بـ https://.');
    }
  }
  return {title, subject, teacherName, date, meetUrl};
}

export function personalLesson(snap, uid) {
  return {...snap.data(), id:snap.id, audience:'selected', targetUids:[uid], grade:'', privateSchedule:true};
}
