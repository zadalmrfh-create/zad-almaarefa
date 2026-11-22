const text = value => typeof value === 'string' ? value.trim() : '';
const directedSections = new Set([
  'القرآن الكريم', 'التزكية والتربية', 'اللغة العربية', 'العلوم الشرعية', 'التعليم الأزهري',
  'اللغة الإنجليزية', 'العلوم', 'الرياضيات', 'البرمجة وتكنولوجيا المعلومات'
]);

function items(...fields) {
  return [...new Set(fields.flatMap(field => (Array.isArray(field) ? field : [field])
    .flatMap(value => text(value).split(/[,،;؛\n]+/))
    .map(value => value.trim()).filter(Boolean)))];
}

export function teacherCardMetadata(profile, coursesOnly) {
  if (coursesOnly) return {subjects:['كورسات اللغة الإنجليزية فقط'],grades:[]};
  return {
    subjects:items(profile.subject,profile.subjects,profile.bookingSubject),
    grades:items(profile.grades,profile.teachingGrades,profile.stages,profile.grade)
  };
}

export function teacherBookingLink(profile, name, subjects) {
  const subject=text(profile.bookingSubject) || subjects[0] || '';
  const requested=text(profile.bookingSection);
  const knownSubjectSections=Object.freeze({
    'الكيمياء':'العلوم', 'الفيزياء':'العلوم', 'التجويد':'القرآن الكريم',
    'حفظ القرآن':'القرآن الكريم', 'الخط العربي':'اللغة العربية',
    'النحو':'اللغة العربية', 'الصرف':'اللغة العربية', 'البلاغة':'اللغة العربية',
    'الفقه':'العلوم الشرعية', 'الحديث':'العلوم الشرعية', 'التفسير':'العلوم الشرعية',
    'التوحيد':'العلوم الشرعية', 'البرمجة':'البرمجة وتكنولوجيا المعلومات'
  });
  const inferred=Object.hasOwn(knownSubjectSections,subject) ? knownSubjectSections[subject] : '';
  const section=directedSections.has(requested) ? requested :
    directedSections.has(subject) ? subject : inferred;
  const params=new URLSearchParams({teacher:name});
  if(section)params.set('section',section);
  if(subject)params.set('subject',subject);
  return '../sections/booking/index.html?'+params.toString();
}

export function teacherPhoto(value, base) {
  let path=text(value);
  if(!path)return '';
  if(path.startsWith('/images/'))path='..'+path;
  if(path.startsWith('images/'))path='../'+path;
  try {
    const url=new URL(path,base);
    return ['https:','http:'].includes(url.protocol) ? path : '';
  } catch {
    return '';
  }
}
