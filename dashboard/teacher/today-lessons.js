import {lessonStartMs} from '../student/student-today-core.js?v=20261120-today1';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone:'Africa/Cairo', year:'numeric', month:'2-digit', day:'2-digit'
});
const dayLabel = new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'full'});
const timeLabel = new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',timeStyle:'short'});
const arabic = value => String(value || '').trim().normalize('NFKC').toLowerCase()
  .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/\s+/g,' ');
const teacherName = value => arabic(value).replace(/^(?:(?:الاستاذ|استاذ|مستر|ميس|الدكتور|دكتور)\s+|[اد]\s*\/\s*)/,'');
const cancelled = new Set(['cancelled','canceled','ملغي','ملغي الحصه']);

export function cairoLessonDay(time = Date.now()) {
  const parts = Object.fromEntries(dayFormat.formatToParts(time).map(({type,value})=>[type,value]));
  return parts.year + '-' + parts.month + '-' + parts.day;
}

export function offsetDay(day, offset) {
  const date = new Date(day+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}

export function lessonsForTeacher(lessons, uid, names, day) {
  const aliases = new Set(names.map(teacherName).filter(Boolean));
  return lessons.flatMap(lesson=>{
    if (lesson.deleted === true || lesson.archived === true || lesson.published === false ||
        cancelled.has(arabic(lesson.status))) return [];
    const owner = String(lesson.teacherUid || lesson.teacherId || '').trim();
    if (owner ? owner !== uid : !aliases.has(teacherName(lesson.teacherName || lesson.teacher))) return [];
    const start = lessonStartMs(lesson.date);
    if (!Number.isFinite(start) || cairoLessonDay(start)!==day) return [];
    return [{...lesson,start}];
  }).sort((first,second)=>first.start-second.start);
}

export function rosterForLesson(lesson, students) {
  if (lesson.audience === 'selected') {
    const targets = new Set((Array.isArray(lesson.targetUids) ? lesson.targetUids : []).filter(Boolean));
    const listed = students.filter(student=>targets.has(student.id) && (student.fullName || student.name));
    return {listed, missing:targets.size-listed.length};
  }
  const grade=arabic(lesson.grade), subject=arabic(lesson.subject);
  const listed = subject ? students.filter(student=>
    (student.fullName || student.name) && (!grade || arabic(student.grade)===grade) &&
    [...(student.lessonSubjects || [])].some(value=>arabic(value)===subject)) : [];
  return {listed,missing:0};
}

function node(tag, text, css = '') {
  const el=document.createElement(tag);
  el.textContent=text;
  if(css)el.className=css;
  return el;
}

export function renderTeacherLessons({status, container, date, lessons, students, phoneDigits, incomplete, error, preview}) {
  date.textContent=dayLabel.format(new Date());
  container.replaceChildren();
  status.textContent=error?'تعذر تحميل بعض مواعيد اليوم. جرّب تحديث بياناتك.':
    !lessons.length?'مفيش حصص مجدولة لك النهارده.':
    incomplete?'قد تكون قائمة الطلاب ناقصة لتعذر قراءة بعض سجلات الربط.':'';
  for(const lesson of lessons){
    const card=node('article','','zad-today-lesson');
    card.append(node('h4',lesson.title||lesson.name||'حصة'),
      node('p',[timeLabel.format(lesson.start)+' بتوقيت القاهرة',lesson.subject,lesson.grade].filter(Boolean).join(' · ')));
    const {listed,missing}=rosterForLesson(lesson,students);
    if(listed.length){
      if(lesson.audience!=='selected') card.append(node('p','طلابك المرتبطون بالمادة والصف'));
      const list=node('ul','','zad-today-list');
      for(const student of listed){
        const row=node('li','');
        const name=student.fullName||student.name;
        row.append(node('strong',name));
        const phone=phoneDigits(student.phone);
        if(!preview && /^[1-9][0-9]{7,14}$/.test(phone)){
          const link=node('a','واتساب','btn gold compact-btn');
          link.href='https://wa.me/'+phone;
          link.target='_blank';
          link.rel='noopener noreferrer';
          link.setAttribute('aria-label','واتساب '+name);
          row.append(link);
        } else if(!preview) row.append(node('small','الرقم غير متاح'));
        list.append(row);
      }
      card.append(list);
    } else if (!missing){
      card.append(node('p',lesson.audience==='selected'?'لسه مفيش طلاب محددين.':'مفيش كشف طلاب مرتبط بالمادة والصف.'));
    }
    if(missing)card.append(node('p',new Intl.NumberFormat('ar-EG').format(missing)+' من الطلاب المحددين بياناتهم لسه غير مرتبطة بحساب المعلم.'));
    container.append(card);
  }
}
