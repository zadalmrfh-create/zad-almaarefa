/* Zad Al Maarefa: replace Bilal in active interfaces with Mohamed Talaat.
 * No historical Firestore documents, receipts, or salary amounts are deleted or modified.
 * Runs locally in a browser on the user's own most recent GitHub ZIP. */
(function(root,factory){if(typeof module==='object' && module.exports)module.exports=factory();else root.ZadTeacherUpdate=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const NAME='محمد طلعت عبدالله';
const NEW_CARD=`    <article class="teacher-card">
      <div class="teacher-card-header">
        <span class="teacher-card-photo"><img src="../images/teacher-thumbs/mohamed-talaat.webp" alt="" loading="eager" decoding="async" width="100" height="100"></span>
        <div><h2 class="teacher-card-name">الأستاذ محمد طلعت عبدالله</h2><p class="teacher-card-role">مدرس اللغة الإنجليزية للتعليم الأزهري والعام</p></div>
      </div>
      <dl class="teacher-card-data">
        <div><dt>المادة</dt><dd>اللغة الإنجليزية</dd></div>
        <div><dt>الصفوف والمراحل</dt><dd>الابتدائية والإعدادية والثانوية</dd></div>
      </dl>
      <a class="teacher-card-cta" href="../sections/booking/index.html?teacher=${encodeURIComponent(NAME)}&amp;section=${encodeURIComponent('اللغة الإنجليزية')}&amp;subject=${encodeURIComponent('اللغة الإنجليزية')}" aria-label="احجز حصة مع الأستاذ محمد طلعت عبدالله">احجز حصة</a>
    </article>`;
const TEACHER_MODULE=`// English curriculum teacher – Zad Al Maarefa (not a salary record).
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
  .replace(/[\\u064B-\\u065F\\u0670\\u0640]/g,'')
  .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/^(?:الاستاذة?|استاذ|مستر|ميس|ا\\s*\\/)\\s*/i,'')
  .replace(/\\s+/g,' ').trim().toLowerCase();
export function isRetiredTeacherName(value) {
  const n=clean(value);
  return /^بلال\\s+فرغل/.test(n) || /\\bbilal[\\s_-]*far(?:g|gh)a?l/i.test(n);
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
`;
function replaceOnce(s,a,b,label,strict=true){
  if(s.includes(b))return s; // idempotency for most transformations
  if(!s.includes(a)){if(strict)throw Error('لم أجد موضع '+label);return s;}
  return s.replace(a,b);
}
const fixes={
'assets/english-teacher.js':s=>TEACHER_MODULE,
'dashboard/attendance-subjects.js':s=>{
 s=s.replace('export const ENGLISH_TEACHERS = [ENGLISH_TEACHER_NAME];','export const ENGLISH_TEACHERS = [ENGLISH_TEACHER_NAME]; // محمد طلعت، وليس بلال');
 return s;
},
'teachers/index.html':s=>{
  s=s.replace(/<article class="teacher-card">[\s\S]*?<\/article>/g,block=>/bilal-farghaly|بلال فرغلي/.test(block)?NEW_CARD:block);
  // Some older exports have no static teacher cards; the English profile fallback still works.
  s=s.replace("import {ENGLISH_TEACHER_PROFILE, isEnglishTeacherProfile} from '../assets/english-teacher.js';",
   "import {ENGLISH_TEACHER_PROFILE, isEnglishTeacherProfile, isRetiredTeacherProfile} from '../assets/english-teacher.js';");
  s=s.replace('const raw=stored.filter(t=>!isEnglishTeacherProfile(t)&&!isRemovedTeacher(t));',
    'const raw=stored.filter(t=>!isRetiredTeacherProfile(t)&&!isEnglishTeacherProfile(t)&&!isRemovedTeacher(t));');
  s=s.replace('const list=[...firestoreList,...fallbackList].filter(t=>!isRemovedTeacher(t))',
    'const list=[...firestoreList,...fallbackList].filter(t=>!isRetiredTeacherProfile(t)&&!isRemovedTeacher(t))');
  // Make the static, no-Firestore fallback show the current English teacher, too.
  return s;
},
'sections/booking/booking.js':s=>{
 s=s.replace('import { ENGLISH_SUBJECT, ENGLISH_TEACHER_NAME, findEnglishTeacherAccount } from "../../assets/english-teacher.js";',
   'import { ENGLISH_SUBJECT, ENGLISH_TEACHER_NAME, findEnglishTeacherAccount, isRetiredTeacherProfile } from "../../assets/english-teacher.js";');
 s=s.replace('تم اختيار مستر بلال فرغلي تلقائيًا لحجز مناهج اللغة الإنجليزية.',
    'تم اختيار الأستاذ محمد طلعت عبدالله لحجز اللغة الإنجليزية للتعليم الأزهري والعام.');
 s=s.replace('    }).filter(t=>!/^علي\\s+عبد\\s+الحميد(?:\\s|$)/.test(normalizeArabic(t.fullName || t.name || t.displayName)));',
    '    }).filter(t=>!isRetiredTeacherProfile(t) && !/^علي\\s+عبد\\s+الحميد(?:\\s|$)/.test(normalizeArabic(t.fullName || t.name || t.displayName)));');
 return s;
},
'dashboard/admin/attendance-admin.js':s=>{
 s=s.replace("import { ENGLISH_TEACHER_NAME, findEnglishTeacherAccount, isEnglishCurriculumTeacher } from '../../assets/english-teacher.js';",
   "import { ENGLISH_TEACHER_NAME, findEnglishTeacherAccount, isEnglishCurriculumTeacher, isRetiredTeacherProfile, isRetiredTeacherName } from '../../assets/english-teacher.js';");
 s=s.replace('function teacherUidForName(name) {','function teacherUidForName(name) {\n  if(isRetiredTeacherName(name))return null;');
 s=s.replace(".filter(x=>x.role==='teacher' && x.status==='active');",
    ".filter(x=>x.role==='teacher' && x.status==='active' && !isRetiredTeacherProfile(x));");
 s=s.replace("const teachers=[...new Set(records.map(record=>record.teacherName || 'الإدارة'))].sort((a,b)=>a.localeCompare(b,'ar'));",
    "const teachers=[...new Set(records.map(record=>record.teacherName || 'الإدارة'))].filter(name=>!isRetiredTeacherName(name)).sort((a,b)=>a.localeCompare(b,'ar'));");
 return s;
},
'dashboard/admin/teacher-payroll-admin.js':s=>{
 s=s.replace("import {ENGLISH_TEACHER_NAME, findEnglishTeacherAccount, isEnglishCurriculumTeacher} from '../../assets/english-teacher.js';",
  "import {isRetiredTeacherName,isRetiredTeacherProfile,isEnglishCurriculumTeacher,findEnglishTeacherAccount} from '../../assets/english-teacher.js';");
 s=s.replace('let attendance=[],teachers=[],adjustments=new Map(),filtered=[],missing=0,settlements=new Map();',
  'let attendance=[],teachers=[],adjustments=new Map(),filtered=[],missing=0,settlements=new Map(),retiredTeacherUids=new Set();');
 s=s.replace('function teacherFor(r,adj){',`function teacherFor(r,adj){
  if(isRetiredTeacherName(r?.teacherName)||isRetiredTeacherName(adj?.teacherName)
    ||retiredTeacherUids.has(r?.teacherUid)||retiredTeacherUids.has(adj?.teacherUid))return null;`);
 s=s.replace(/\s*if\(isEnglishCurriculumTeacher\(raw\)\)\{[\s\S]*?\n  \}/, `\n  if(isEnglishCurriculumTeacher(raw)){\n    // Existing account only – never generate a second payroll teacher.\n    const account=findEnglishTeacherAccount(teachers);\n    return account ? {key:\`uid:\${account.id}\`,name:teacherName(account)} : null;\n  }`);
 s=s.replace(/^\s*if\(!findEnglishTeacherAccount\(teachers\)\)ids\.set\([^\n]*\);\s*\n/m,'\n');
 s=s.replace(/\s*if\(!findEnglishTeacherAccount\(teachers\) && \['all',`name:\$\{ENGLISH_TEACHER_NAME\}`\]\.includes\(\$\('salaryTeacher'\)\.value\)\)\s*sums\.set\([^\n]*\);/,'');
 // Do not show retired teacher in current payroll; keep Firestore history untouched.
 s=s.replace("const relevant=attendance.filter(r=>r.deleted!==true&&r.status==='حاضر');",
  "const relevant=attendance.filter(r=>r.deleted!==true&&r.status==='حاضر'&&!isRetiredTeacherName(r.teacherName)&&!retiredTeacherUids.has(r.teacherUid));");
 s=s.replace("return attendance.filter(r=>r.deleted!==true&&r.status==='حاضر').map(salaryRow).filter(r=>{",
   "return attendance.filter(r=>r.deleted!==true&&r.status==='حاضر'&&!isRetiredTeacherName(r.teacherName)&&!retiredTeacherUids.has(r.teacherUid)).map(salaryRow).filter(r=>{");
 s=s.replace("  teachers=profiles.docs.map(d=>({...d.data(),id:d.id})).filter(x=>x.role==='teacher'&&x.status!=='banned');",
   "  const allTeacherProfiles=profiles.docs.map(d=>({...d.data(),id:d.id}));\n  retiredTeacherUids=new Set(allTeacherProfiles.filter(isRetiredTeacherProfile).map(x=>x.id));\n  teachers=allTeacherProfiles.filter(x=>x.role==='teacher'&&x.status!=='banned'&&!isRetiredTeacherProfile(x));");
 return s;
},
'dashboard/admin/teacher-linker-admin.js':s=>{
 s=s.replace("import {auth,db} from '../../firebase-config.js';",
    "import {auth,db} from '../../firebase-config.js';\nimport {isRetiredTeacherProfile,isRetiredTeacherName} from '../../assets/english-teacher.js';");
 s=s.replace(".filter(x=>x.role==='teacher'&&x.status==='active');",
   ".filter(x=>x.role==='teacher'&&x.status==='active'&&!isRetiredTeacherProfile(x));");
 s=s.replace(".filter(x=>x&&!['غير محدد','الإدارة','لم يُعيّن'].includes(x)))",
   ".filter(x=>x&&!isRetiredTeacherName(x)&&!['غير محدد','الإدارة','لم يُعيّن'].includes(x)))");
 return s;
},
'dashboard/admin/index.html':s=>{
 s=s.replace('إضافة بطاقة مستر بلال للإدارة','إضافة بطاقة الأستاذ محمد طلعت للإدارة');
 s=s.replace('بطاقة مستر بلال مسجلة في إدارة طاقم التدريس.','بطاقة الأستاذ محمد طلعت مسجلة في إدارة طاقم التدريس.');
 s=s.replace("import { ENGLISH_TEACHER_NAME, ENGLISH_TEACHER_PROFILE, isEnglishTeacherProfile } from '../../assets/english-teacher.js';",
  "import { ENGLISH_TEACHER_NAME, ENGLISH_TEACHER_PROFILE, isEnglishTeacherProfile, isRetiredTeacherProfile } from '../../assets/english-teacher.js';");
 s=s.replace('const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));',
  "const items = snap.docs.map(d => ({ ...d.data(), id: d.id })).filter(t => type !== 'teachers' || !isRetiredTeacherProfile(t));");
 return s;
},
'public/teachers/index.html':s=>{
 s=s.replace("const raw=snap.docs.map(d=>({id:d.id,...d.data()}));",
   "const raw=snap.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.id!=='zad-bilal-farghaly'&&t.legacyKey!=='zad-bilal-farghaly'&&!(/بلال\\s+فرغل/.test(t.name||t.fullName||''))); ");
 return s;
},
'public/sections/booking/booking.js':s=>{
 // Legacy unlinked public mirror: block retired person in returned teacher results.
 s=s.replace('    activeTeachers = snap.docs.map(docSnap => {',
  "    activeTeachers = snap.docs.filter(d=>!(/بلال\\s+فرغل/.test([d.data().name,d.data().fullName].join(' ')))).map(docSnap => {");
 return s;
}
};
const required=['assets/english-teacher.js','teachers/index.html','sections/booking/booking.js','dashboard/attendance-subjects.js','dashboard/admin/attendance-admin.js','dashboard/admin/teacher-payroll-admin.js','dashboard/admin/index.html','dashboard/admin/teacher-linker-admin.js'];
const changedPaths=[],errors=[],notes=[];
function reset(){changedPaths.length=0;errors.length=0;notes.length=0;}
function patch(path,source){
 const fn=fixes[path];if(!fn)return source;
 try{const result=fn(source);if(result!==source)changedPaths.push(path);else notes.push('لم يتغير: '+path);return result}
 catch(e){errors.push(path+': '+e.message);return source}
}
function verify(available){for(const path of required){if(!available.includes(path))errors.push('ملف أساسي غير موجود: '+path)}
 return {changedPaths:[...changedPaths],errors:[...errors],notes:[...notes]};}
return {fixes,required,reset,patch,verify,NAME};
});
