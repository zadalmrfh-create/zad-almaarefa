import { ENGLISH_SUBJECT, ENGLISH_TEACHER_NAME } from '../assets/english-teacher.js';

export const SUBJECTS = [
  'النحو',
  'الصرف',
  'البلاغة',
  'الأدب والنصوص',
  'التفسير',
  'الحديث',
  'التوحيد',
  'الفقه الحنفي',
  'الفقه الشافعي',
  'العروض والقافية',
  'الفلسفة والمنطق الحديث',
  'المنطق القديم',
  'اللغة العربية (عام)',
  ENGLISH_SUBJECT,
  'العلوم',
  'الكيمياء',
  'الرياضيات',
  'البرمجة وتكنولوجيا المعلومات'
];

export const ENGLISH_TEACHERS = [ENGLISH_TEACHER_NAME];
export const SCIENCE_TEACHERS = ['محمد خالد محمود', 'سعد علاء'];
export const MATH_TEACHER = 'سعد علاء';
export const isScientificSubject = name => ['العلوم','مادة العلوم','الكيمياء','مادة الكيمياء','الرياضيات','الرياضيات (عام)','رياضيات','math','mathematics'].includes(String(name||'').trim().toLowerCase());
export function availableScienceTeachers(subjects) {
 const selected=(Array.isArray(subjects)?subjects:[subjects]).map(x=>String(x||'').trim()).filter(Boolean);
 if(!selected.length||!selected.every(isScientificSubject))return [];
 return selected.some(x=>/رياضيات|^math/i.test(x))?[MATH_TEACHER]:SCIENCE_TEACHERS.slice();
}

export function isEnglishSubject(subject) {
  const key = String(subject ?? '').normalize('NFKC').trim().toLowerCase()
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ');
  return ['اللغه الانجليزيه', 'الانجليزيه', 'انجليزيه', 'الانجليزي', 'انجليزي', 'english'].includes(key);
}

const DIYAA_SUBJECTS = new Set([
  'النحو',
  'الصرف',
  'البلاغة',
  'الأدب والنصوص',
  'الأدب',
  'النصوص',
  'التفسير',
  'الحديث',
  'التوحيد',
  'الفقه الحنفي',
  'الفقه الشافعي',
  'العروض والقافية',
  'الفلسفة والمنطق الحديث',
  'المنطق القديم',
  'اللغة العربية',
  'المواد الشرعية',
  'العلوم الشرعية'
]);

function teacherForSingleSubject(subject, englishTeacher = ENGLISH_TEACHERS[0]) {
  const name = String(subject || '').trim();
  if (!name) return '';
  // اللغة العربية للتعليم العام تُسند تلقائيًا إلى أ/ ضياء الدين نبيل.
  if (name === 'اللغة العربية (عام)') return 'ضياء الدين نبيل';
  if (name === 'الرياضيات' || name === 'الرياضيات (عام)' || name === 'رياضيات') return MATH_TEACHER;
  if (name === 'الكيمياء' || name === 'مادة الكيمياء') return 'محمد خالد محمود';
  if (name === 'العلوم' || name === 'مادة العلوم') return 'محمد خالد محمود';
  if (isEnglishSubject(name)) return ENGLISH_TEACHERS.includes(englishTeacher) ? englishTeacher : ENGLISH_TEACHER_NAME;
  if (name === 'البرمجة وتكنولوجيا المعلومات' || name === 'البرمجة') return 'مالك سامح';
  if (DIYAA_SUBJECTS.has(name)) return 'ضياء الدين نبيل';
  return 'ضياء الدين نبيل';
}

export function teacherForSubject(subject, englishTeacher = ENGLISH_TEACHERS[0]) {
  if (Array.isArray(subject)) {
    const teachers = [...new Set(subject.map(name => teacherForSingleSubject(name, englishTeacher)).filter(Boolean))];
    return teachers.join('، ');
  }
  return teacherForSingleSubject(subject, englishTeacher);
}
