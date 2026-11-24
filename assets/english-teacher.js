// English curriculum teacher – Zad Al Maarefa (not a salary record).
export const ENGLISH_SUBJECT = 'اللغة الإنجليزية';
export const ENGLISH_TEACHER_NAME = 'محمد طلعت عبدالله';
export const ENGLISH_TEACHER_PROFILE = Object.freeze({
  legacyKey: 'zad-mohamed-talaat-abdallah',
  name: 'الأستاذ ' + ENGLISH_TEACHER_NAME,
  subject: ENGLISH_SUBJECT,
  role: 'مدرس اللغة الإنجليزية للتعليم الأزهري والعام',
  image: '../images/teacher-thumbs/mohamed-talaat.webp',
  stages: 'المرحلة الابتدائية والإعدادية والثانوية — أزهري وعام',
  bio: 'شرح وتأسيس في اللغة الإنجليزية، قواعد ومفردات وقراءة وكتابة وترجمة وتدريبات مع متابعة للطلاب.',
  specialties: 1,
  bookingSection: ENGLISH_SUBJECT,
  bookingSubject: ENGLISH_SUBJECT
});
const clean = value => String(value ?? '').normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670\u0640]/g,'')
  .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/^(?:الاستاذة?|استاذ|مستر|ميس|ا\s*\/)\s*/i,'')
  .replace(/\s+/g,' ').trim().toLowerCase();
export function isRetiredTeacherName(value) {
  const n=clean(value);
  return /^بلال\s+فرغل/.test(n) || /\bbilal[\s_-]*far(?:g|gh)a?l/i.test(n);
}
export function isRetiredTeacherProfile(profile){
  if(!profile)return false;
  if(typeof profile==='string')return isRetiredTeacherName(profile);
  return profile.id==='zad-bilal-farghaly'||profile.legacyKey==='zad-bilal-farghaly'
    || [profile.name,profile.fullName,profile.displayName,profile.nameAr,profile.teacherName].some(isRetiredTeacherName);
}
export function isEnglishCurriculumTeacher(name){
  const n=clean(name);return n==='محمد طلعت'||n.startsWith('محمد طلعت ');
}
export function isEnglishTeacherProfile(profile){
  if(!profile)return false;
  return profile.id===ENGLISH_TEACHER_PROFILE.legacyKey||profile.legacyKey===ENGLISH_TEACHER_PROFILE.legacyKey
    || [profile.name,profile.fullName,profile.displayName,profile.nameAr].some(isEnglishCurriculumTeacher);
}
export function findEnglishTeacherAccount(profiles=[]){
  const matches=profiles.filter(p=>p.role==='teacher'&&p.status==='active'&&!isRetiredTeacherProfile(p)
    && [p.fullName,p.name,p.displayName,...(Array.isArray(p.attendanceAliases)?p.attendanceAliases:[])].some(isEnglishCurriculumTeacher));
  return matches.length===1?matches[0]:null;
}
