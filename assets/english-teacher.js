export const ENGLISH_SUBJECT = 'اللغة الإنجليزية';
export const ENGLISH_TEACHER_NAME = 'بلال فرغلي';
export const ENGLISH_TEACHER_PROFILE = Object.freeze({
  legacyKey: 'zad-bilal-farghaly',
  name: 'مستر ' + ENGLISH_TEACHER_NAME,
  subject: ENGLISH_SUBJECT,
  role: 'مدرس مناهج اللغة الإنجليزية',
  image: '../images/bilal-farghaly.webp',
  stages: 'المرحلة الثانوية — عام وبكالوريا',
  bio: 'شرح منهج اللغة الإنجليزية للمرحلة الثانوية العامة والبكالوريا، مع تدريبات ومراجعات أونلاين.',
  specialties: 1,
  bookingSection: ENGLISH_SUBJECT,
  bookingSubject: ENGLISH_SUBJECT
});

export function isEnglishCurriculumTeacher(name) {
  const normalized = String(name ?? '').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').trim()
    .replace(/^(?:الاستاذ|استاذ|مستر|ا\s*\/)\s*/, '').replace(/\s+/g, ' ');
  return normalized === ENGLISH_TEACHER_NAME || normalized.startsWith(ENGLISH_TEACHER_NAME + ' ');
}

export function isEnglishTeacherProfile(profile) {
  return profile.id === ENGLISH_TEACHER_PROFILE.legacyKey
    || profile.legacyKey === ENGLISH_TEACHER_PROFILE.legacyKey
    || [profile.name, profile.fullName, profile.displayName, profile.nameAr].some(isEnglishCurriculumTeacher);
}

export function findEnglishTeacherAccount(profiles) {
  const matches = profiles.filter(profile => profile.role === 'teacher' && profile.status === 'active'
    && [profile.fullName, profile.name, profile.displayName, ...(Array.isArray(profile.attendanceAliases) ? profile.attendanceAliases : [])]
      .some(isEnglishCurriculumTeacher));
  return matches.length === 1 ? matches[0] : null;
}
