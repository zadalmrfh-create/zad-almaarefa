export const SUBJECTS = ['اللغة العربية','المواد الشرعية','الفلسفة والمنطق الحديث','المنطق القديم','اللغة الإنجليزية','العلوم','البرمجة وتكنولوجيا المعلومات'];


// Exact subject-based assignment: 'العلوم الشرعية' must NOT be classified as science.
export function teacherForSubject(subject) {
  const name=String(subject||'').trim();
  if (!name) return '';
  if (name==='العلوم' || name==='مادة العلوم') return 'فاطمة أشرف';
  if (name==='اللغة الإنجليزية' || name==='الانجليزي' || name==='الإنجليزي') return 'علي عبد الحميد';
  if (name==='البرمجة وتكنولوجيا المعلومات' || name==='البرمجة') return 'مالك سامح';
  return 'ضياء الدين نبيل';
}
