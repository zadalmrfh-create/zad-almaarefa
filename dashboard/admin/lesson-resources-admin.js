import {auth, db} from '../../firebase-config.js';
import {isAdminAccount} from '../admin-preview-core.js';
import {collection, deleteDoc, doc, getDoc, getDocs, setDoc, serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {examPageUrl, parseExamPage, summaryLink} from '../lesson-page-links.js?v=20261120-lesson1';

const $ = id => document.getElementById(id);
const load = $('loadLessonResources');
const form = $('lessonResourcesForm');
const picker = $('lessonResourceId');
const save = $('saveLessonResources');
const summary = $('lessonResourceSummaryUrl');
const exam = $('lessonResourceExamUrl');
const status = $('lessonResourceStatus');
const banks = new Map([
  ['special', '../../exams/zad-special/bank.json'],
  ['unit', '../../exams/unit1/bank.json']
]);
let adminUid = '';
let selection = 0;

function report(text) {
  status.textContent = text;
}

for (const [id, label] of [
  ['balagha-qasr-azhar-2', 'البلاغة — القصر'],
  ['balagha-qasr-types-azhar-2', 'البلاغة — أقسام القصر']
]) {
  const option = document.createElement('option');
  option.value = examPageUrl({source: 'special', id});
  option.label = label;
  $('lessonResourceExamExamples').append(option);
}

onAuthStateChanged(auth, async user => {
  adminUid = '';
  selection++;
  form.hidden = true;
  load.disabled = true;
  if (!user || !await isAdminAccount(user) || auth.currentUser?.uid !== user.uid) return;
  adminUid = user.uid;
  load.disabled = false;
});

load.addEventListener('click', async () => {
  if (!adminUid) return;
  const uid = adminUid;
  selection++;
  load.disabled = true;
  form.hidden = true;
  save.disabled = true;
  report('جارٍ تحميل الحصص…');
  try {
    const snapshot = await getDocs(collection(db, 'lessons'));
    if (uid !== adminUid) return;
    picker.replaceChildren();
    picker.append(new Option('اختار الحصة', ''));
    const lessons = snapshot.docs.map(item => ({...item.data(), id: item.id}))
      .filter(item => item.deleted !== true)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    for (const lesson of lessons) {
      const label = [lesson.title || lesson.name || 'حصة', lesson.grade, lesson.date].filter(Boolean).join(' · ');
      picker.append(new Option(label, lesson.id));
    }
    summary.value = '';
    exam.value = '';
    form.hidden = !lessons.length;
    report(lessons.length ? 'اختار حصة عشان تعرض الروابط المحفوظة فيها.' : 'لا توجد حصص مجدولة متاحة.');
  } catch {
    if (uid === adminUid) report('تعذر تحميل الحصص. جرّب مرة تانية.');
  } finally {
    if (uid === adminUid) load.disabled = false;
  }
});

picker.addEventListener('change', async () => {
  const request = ++selection;
  const id = picker.value;
  save.disabled = true;
  summary.value = '';
  exam.value = '';
  if (!id || !adminUid) return;
  report('جارٍ تحميل روابط الحصة…');
  try {
    const {summaryUrl, exam: linkedExam} = (await getDoc(doc(db, 'lessonResources', id))).data() || {};
    if (request !== selection) return;
    summary.value = summaryUrl || '';
    exam.value = examPageUrl(linkedExam);
    save.disabled = false;
    report('تقدر تضيف الروابط أو تعدّلها، وبعدها اضغط حفظ.');
  } catch {
    if (request === selection) report('تعذر تحميل روابط الحصة. تأكد إن قواعد Firestore الجديدة منشورة.');
  }
});

async function examIsAvailable(linkedExam) {
  if (!linkedExam) return true;
  if (linkedExam.source === 'code') {
    const snapshot = await getDoc(doc(db, 'codeExams', linkedExam.id));
    return snapshot.data()?.published === true;
  }
  const response = await fetch(banks.get(linkedExam.source));
  if (!response.ok) throw new Error('تعذر التحقق من الامتحان.');
  const bank = await response.json();
  return bank.exams?.some(item => item.id === linkedExam.id && !item.archived);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!adminUid || !picker.value || save.disabled) return;
  const id = picker.value;
  const summaryUrl = summaryLink(summary.value, location.href);
  const linkedExam = parseExamPage(exam.value, location.href);
  if (summary.value.trim() && !summaryUrl) { report('اكتب رابط ملخص صالح يبدأ بـ HTTPS.'); return; }
  if (exam.value.trim() && !linkedExam) { report('انسخ رابط الامتحان نفسه من قائمة الامتحانات في المنصة.'); return; }

  const request = selection;
  save.disabled = true;
  picker.disabled = true;
  load.disabled = true;
  report('جارٍ حفظ روابط الحصة…');
  try {
    if (!await examIsAvailable(linkedExam)) { report('الامتحان غير متاح. اختار امتحان منشور.'); return; }
    if (request !== selection || !adminUid) return;
    const ref = doc(db, 'lessonResources', id);
    if (!summaryUrl && !linkedExam) await deleteDoc(ref);
    else await setDoc(ref, {summaryUrl, exam: linkedExam, updatedAt: serverTimestamp()});
    if (request === selection) {
      summary.value = summaryUrl;
      exam.value = examPageUrl(linkedExam);
      report('تم حفظ روابط الحصة.');
    }
  } catch {
    if (request === selection) report('تعذر حفظ الروابط. تأكد من الاتصال ونشر قواعد Firestore.');
  } finally {
    picker.disabled = false;
    if (request === selection) {
      save.disabled = false;
      load.disabled = false;
    }
  }
});
