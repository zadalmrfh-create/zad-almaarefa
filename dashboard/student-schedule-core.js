import {lessonStartMs, lessonForStudent} from './student/student-today-core.js?v=20261120-today1';
import {cairoDay,daysAfter} from './student/stage4-core.js';

export const personalLessonCollection = uid => ['studentSchedules', uid, 'lessons'];
export const WEEKDAYS = [[6,'السبت'],[0,'الأحد'],[1,'الاثنين'],[2,'الثلاثاء'],[3,'الأربعاء'],[4,'الخميس'],[5,'الجمعة']];
const validDay = value => typeof value === 'string' && /^20\d\d-\d\d-\d\d$/.test(value)
  && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const validWeekdays = value => Array.isArray(value) && value.length>0 && value.length<=7
  && new Set(value).size===value.length && value.every(day=>Number.isInteger(day)&&day>=0&&day<=6);

export function personalLessonData(input) {
  const field = key => String(input[key] ?? '').trim();
  const title = field('title'), subject = field('subject'), teacherName = field('teacherName');
  const meetUrl = field('meetUrl'), recurrence = field('recurrence') || 'once';
  if (!title || title.length > 150 || !subject || subject.length > 100 || teacherName.length > 100) {
    throw Error('اكتب عنوان الحصة والمادة وتأكد من طول البيانات.');
  }
  if (meetUrl) {
    let url;
    try { url = new URL(meetUrl); } catch {}
    if (url?.protocol !== 'https:' || url.username || url.password || meetUrl.length > 1000) {
      throw Error('اكتب رابط حصة صالح يبدأ بـ https://.');
    }
  }
  const common = {title,subject,teacherName,meetUrl};
  if (recurrence === 'once') {
    const date=field('date');
    if (!/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(date) || !Number.isFinite(lessonStartMs(date))) {
      throw Error('اختار تاريخ وساعة صالحين بتوقيت القاهرة.');
    }
    return {...common,date,recurrence,weekdays:[],endDate:''};
  }
  if (recurrence !== 'weekly') throw Error('نوع الموعد غير صالح.');
  const startDate=field('startDate'), time=field('time'), endDate=field('endDate');
  const weekdays=Array.isArray(input.weekdays)?input.weekdays.map(day=>typeof day==='number'?day:typeof day==='string'&&/^[0-6]$/.test(day)?Number(day):NaN):[];
  if (!validWeekdays(weekdays)) throw Error('اختار يومًا واحدًا على الأقل من أيام الأسبوع.');
  if (!validDay(startDate) || !validTime(time) || (endDate && (!validDay(endDate)||endDate<startDate))) {
    throw Error('راجع تاريخ البداية والساعة وتاريخ النهاية الاختياري.');
  }
  return {...common,date:startDate+'T'+time,recurrence,weekdays:WEEKDAYS.map(([n])=>n).filter(n=>weekdays.includes(n)),endDate};
}

export function personalLesson(snap, uid) {
  return {...snap.data(), id:snap.id, audience:'selected', targetUids:[uid], grade:'', privateSchedule:true};
}

// A series is one private Firestore document; occurrences are calculated in Cairo wall time.
// No copies, attendance records, background writes or automatic billing are generated.
export function personalOccurrence(lesson, day) {
  if (!lesson || lesson.recurrence!=='weekly' || !validDay(day)) return null;
  const date=String(lesson.date||''), start=date.slice(0,10), time=date.slice(11);
  if (!validDay(start)||!validTime(time)||date!==start+'T'+time||!validWeekdays(lesson.weekdays)
    || (lesson.endDate && (!validDay(lesson.endDate)||day>lesson.endDate)) || day<start
    || !lesson.weekdays.includes(new Date(day+'T00:00:00Z').getUTCDay())) return null;
  const occurrenceDate=day+'T'+time;
  if (!Number.isFinite(lessonStartMs(occurrenceDate))) return null;
  return {...lesson,date:occurrenceDate,occurrenceDay:day};
}

export function expandPersonalLessons(snapshots, uid, range) {
  const result=[];
  for(const snap of snapshots){
    const item=personalLesson(snap,uid);
    if (!lessonForStudent(item,uid,''))continue;
    if (item.recurrence!=='weekly') {result.push(item);continue;}
    // A strict cap prevents malformed ranges from creating unbounded occurrences.
    if (!validDay(range?.start)||!validDay(range?.end)||range.end<range.start)continue;
    for(let i=0,day=range.start;i<31&&day<=range.end;i++,day=daysAfter(day,1)){
      const occurrence=personalOccurrence(item,day);
      if(occurrence)result.push(occurrence);
    }
  }
  return result;
}

export function personalLessonForPage(snapshot, uid, day) {
  const item=personalLesson(snapshot,uid);
  if (!lessonForStudent(item,uid,'')) return null;
  if(item.recurrence==='weekly')return personalOccurrence(item,day);
  return day ? null : item;
}

export function personalUpcomingRange(now=new Date()) {
  const day=cairoDay(now);
  return {start:daysAfter(day,-1),end:daysAfter(day,14)};
}
