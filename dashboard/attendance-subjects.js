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
  'اللغة الإنجليزية',
  'العلوم',
  'الكيمياء',
  'البرمجة وتكنولوجيا المعلومات'
];

export const ENGLISH_TEACHERS = ['علي عبد الحميد', 'فاطمة ضياء'];

export function isEnglishSubject(subject) {
  return ['اللغة الإنجليزية', 'الانجليزي', 'الإنجليزي'].includes(String(subject || '').trim());
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
  if (name === 'الكيمياء' || name === 'مادة الكيمياء') return 'محمد خالد محمود';
  if (name === 'العلوم' || name === 'مادة العلوم') return 'محمد خالد محمود';
  if (isEnglishSubject(name)) return ENGLISH_TEACHERS.includes(englishTeacher) ? englishTeacher : ENGLISH_TEACHERS[0];
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
