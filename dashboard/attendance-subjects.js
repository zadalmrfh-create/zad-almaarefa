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
  'اللغة الإنجليزية',
  'العلوم',
  'الكيمياء',
  'البرمجة وتكنولوجيا المعلومات'
];

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

function teacherForSingleSubject(subject) {
  const name = String(subject || '').trim();
  if (!name) return '';
  if (name === 'الكيمياء' || name === 'مادة الكيمياء') return 'محمد خالد محمود';
  if (name === 'العلوم' || name === 'مادة العلوم') return 'محمد خالد محمود';
  if (name === 'اللغة الإنجليزية' || name === 'الانجليزي' || name === 'الإنجليزي') return 'علي عبد الحميد';
  if (name === 'البرمجة وتكنولوجيا المعلومات' || name === 'البرمجة') return 'مالك سامح';
  if (DIYAA_SUBJECTS.has(name)) return 'ضياء الدين نبيل';
  return 'ضياء الدين نبيل';
}

export function teacherForSubject(subject) {
  if (Array.isArray(subject)) {
    const teachers = [...new Set(subject.map(teacherForSingleSubject).filter(Boolean))];
    return teachers.join('، ');
  }
  return teacherForSingleSubject(subject);
}
