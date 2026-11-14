/**
 * Dependency-free pre-deploy check for the canonical GitHub Pages site.
 * Run from repository root: node scripts/check-stage1.mjs
 * This deliberately does not delete or overwrite the legacy public/ copy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const present = p => fs.existsSync(path.join(root, p));
let errors = 0;
const fail = message => { console.error('✗ ' + message); errors++; };
const ok = message => console.log('✓ ' + message);

const entries = [
  'index.html', 'dashboard/admin/index.html', 'dashboard/student/index.html',
  'dashboard/teacher/index.html', 'sections/tests/code-exams.html',
  'firestore.rules', 'dashboard/student/lesson-interactions.js'
];
for (const file of entries) {
  if (!present(file)) fail(`ملف أساسي مفقود: ${file}`);
  else ok(`موجود: ${file}`);
}

if (present('dashboard/student/index.html')) {
  const student = read('dashboard/student/index.html');
  if (!student.includes("from './lesson-interactions.js'")) fail('لوحة الطالب لا تستدعي وحدة التقييم الجديدة');
  if (student.includes("addDoc(collection(db, 'lessonRatings')")) fail('يوجد تقييم سريع بمعرف عشوائي يسمح بالتكرار');
  if (student.includes("addDoc(collection(db, 'lessonAttendance')")) fail('محاولة دخول Meet ما زالت تكتب في الحضور الرسمي');
  if (!student.includes("doc(db, 'lessonOpenEvents', lessonOpenId(uid, lesson.id))")) fail('سجل فتح Meet الجديد غير مربوط');
  if (!student.includes("doc(db, 'lessonRatings', lessonRatingId(uid, lesson.id))")) fail('التقييم لا يستخدم معرفًا ثابتًا');
  const modules = [...student.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => /type\s*=\s*["']module["']/i.test(match[1]) && !/\bsrc\s*=/i.test(match[1]));
  if (!modules.length) fail('لا توجد وحدة JavaScript داخل لوحة الطالب');
  for (let i=0; i<modules.length; i++) {
    try {
      execFileSync(process.execPath, ['--input-type=module','--check'], {
        input: modules[i][2], encoding:'utf8', stdio:['pipe','pipe','pipe']
      });
      ok(`فحص صياغة JavaScript للوحدة ${i + 1}`);
    } catch (error) { fail(`خطأ صياغة JavaScript في وحدة الطالب ${i + 1}: ${(error.stderr || error.message).slice(0,450)}`); }
  }
}

if (present('firestore.rules')) {
  const rules = read('firestore.rules');
  for (const block of ['match /lessonRatings/{ratingId}', 'match /lessonOpenEvents/{eventId}',
    'match /lessonAttendance/{attendanceId}', 'match /weeklyReviewPrivate/{reviewId}']) {
    if (!rules.includes(block)) fail(`قواعد Firestore ناقصة: ${block}`);
  }
  if (!rules.includes("eventId == request.auth.uid + '__' + request.resource.data.lessonId")) fail('سجل Meet غير مربوط بمعرف الطالب والمحاضرة');
  if (!rules.includes("ratingId == request.auth.uid + '__' + request.resource.data.lessonId")) fail('قواعد التقييم لا تمنع المعرف العشوائي');
  if (!rules.includes("request.resource.data.periodType == (request.resource.data.kind == 'teacher' ? 'weekly' : 'monthly')")) fail('قد تكون قواعد التقييم الشهري القديمة قد استُبدلت');
  if (errors === 0) ok('تم التحقق من وجود قواعد التقييم الشهري والحضور');
}

const publicAdmin='public/dashboard/admin/index.html';
if (present(publicAdmin) && present('dashboard/admin/index.html') && read(publicAdmin)!==read('dashboard/admin/index.html')) {
  console.warn('⚠ توجد نسخة أخرى مختلفة في public/dashboard/admin/index.html — لا ترفعها فوق dashboard/admin/index.html؛ راجع مصدر نشر Vercel بشكل منفصل.');
}

// Require correct app-relative assets in the actual administrative entry point.
if (present('dashboard/admin/index.html')) {
  const admin = read('dashboard/admin/index.html');
  for (const script of ['code-exams-admin.js','code-exam-results-admin.js','lecture-reviews-admin.js']) {
    if (!present('dashboard/admin/'+script)) fail('ملف الأدمن مفقود: '+script);
    if (!admin.includes(script)) fail('رابط سكريبت غير موجود في صفحة الأدمن: '+script);
  }
}
if (present('dashboard/student/lesson-interactions.js')) {
  try { execFileSync(process.execPath, ['--check',path.join(root,'dashboard/student/lesson-interactions.js')]); ok('صياغة وحدة معرّفات التقييمات سليمة'); }
  catch(e) { fail('خطأ في وحدة معرّفات التقييمات: '+e.message); }
}
if (errors) {
  console.error(`\nفشل فحص ما قبل النشر: ${errors} مشكلة.`);
  process.exitCode = 1;
} else {
  console.log('\n✅ فحوصات المرحلة الأولى نجحت. اختبر Firestore على مشروع تجريبي قبل النشر الفعلي.');
}
