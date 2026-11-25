import {mountMistakeReview} from '../../sections/tests/mistake-review.js?v=20261122-step3';
import {reviewBankAttempt, reviewCodeAttempt} from '../../sections/tests/mistake-review-core.js?v=20261122-step3';
import {auth, db} from '../../firebase-config.js';
import {getPreviewContext} from '../admin-preview-core.js';
import {codeExamProgress} from '../admin/exam-result-verification.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection, doc, getDoc, onSnapshot, query, where} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {dateMs, lessonForStudent, lessonPhase, lessonStartMs, webUrl} from './student-today-core.js?v=20261120-today1';
import {examPageUrl, summaryLink, validDocumentId} from '../lesson-page-links.js?v=20261125-weekly';
import {openLessonMeet} from './lesson-meet.js?v=20261122-schedule';
import {personalLessonCollection, personalLessonForPage} from '../student-schedule-core.js?v=20261125-weekly';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const isPersonal = params.get('private') === '1';
$('lessonResourceGrid').hidden = isPersonal;
const lessonId = params.get('id');
const occurrenceDay = params.get('day') || ''; 
const number = new Intl.NumberFormat('ar-EG');
const clock = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  hour: 'numeric', minute: '2-digit'
});
let generation = 0;
let lesson, viewer, start;
let stopLesson, stopResources, stopResult;
let resultGeneration = 0;

function showError(message) {
  $('lessonContent').hidden = true;
  $('lessonStatus').textContent = message;
  $('lessonStatus').hidden = false;
}

function setLink(id, href) {
  const element = $(id);
  if (href) element.href = href;
  else element.removeAttribute('href');
  element.hidden = !href;
}

function updateMeet() {
  if (!lesson || !viewer) return;
  const phase = lessonPhase(start);
  const available = Boolean(lesson.joinUrl) && (phase === 'available' || phase === 'unknown');
  $('lessonJoin').hidden = !available;
  const message = !lesson.joinUrl ? 'رابط الدخول لسه ما اتضافش.'
    : phase === 'past' ? 'انتهى وقت الدخول للحصة.'
    : phase === 'upcoming' ? 'الدخول بيفتح قبل الموعد بـ١٥ دقيقة.'
    : phase === 'unknown' ? 'الموعد غير محدد.' : 'الدخول متاح دلوقتي.';
  if ($('lessonMeetState').textContent !== message) $('lessonMeetState').textContent = message;
}

$('lessonJoin').addEventListener('click', () => {
  if (!lesson?.joinUrl || !viewer || auth.currentUser?.uid !== viewer.authUid) return;
  const phase = lessonPhase(start);
  if (phase === 'available' || phase === 'unknown') void openLessonMeet(lesson, viewer.uid);
});
setInterval(updateMeet, 10_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateMeet(); });

function resultDisplay(message, score, total, submitted = false) {
  const validScore = Number.isFinite(score) && Number.isFinite(total) && total > 0 && score >= 0 && score <= total;
  $('lessonResultScore').hidden = !validScore;
  $('lessonResultScore').textContent = validScore ? number.format(score) + ' من ' + number.format(total) : '';
  $('lessonResultState').textContent = message;
  $('lessonExam').textContent = submitted ? 'افتح الامتحان' : 'ابدأ الامتحان';
}

const reviewBanks = new Map();

function loadReviewBank(source) {
  if (!reviewBanks.has(source)) {
    const folder = source === 'special' ? 'zad-special' : 'unit1';
    const bank = fetch('../../exams/' + folder + '/bank.json', {cache:'no-cache'})
      .then(response => {
        if (!response.ok) throw Error('تعذر تحميل بنك الأسئلة');
        return response.json();
      })
      .then(data => Array.isArray(data.exams) ? data.exams : [])
      .catch(error => {
        reviewBanks.delete(source);
        throw error;
      });
    reviewBanks.set(source, bank);
  }
  return reviewBanks.get(source);
}

function observeResult(exam, uid) {
  const request = ++resultGeneration;
  let sequence = 0;
  const reviewHost = $('lessonMistakes');
  const canReview = () => request === resultGeneration && !viewer?.active && auth.currentUser?.uid === uid;
  reviewHost.replaceChildren();
  stopResult?.();
  stopResult = undefined;
  if (!exam) {
    resultDisplay('النتيجة بتظهر هنا بعد ربط امتحان بالحصة وتسليمه.');
    return;
  }

  resultDisplay('جارٍ تحميل النتيجة…');
  const error = () => {
    if (request !== resultGeneration) return;
    sequence++;
    reviewHost.replaceChildren();
    resultDisplay('تعذر تحميل نتيجة الامتحان. جرّب تحديث الصفحة.');
  };
  if (exam.source === 'code') {
    const scope = query(collection(db, 'codeExamResults'), where('studentUid', '==', uid), where('examId', '==', exam.id));
    stopResult = onSnapshot(scope, {includeMetadataChanges: true}, snapshot => {
      if (request !== resultGeneration) return;
      const latest = snapshot.docs.map(entry => entry.data())
        .sort((a, b) => (dateMs(b.createdAt) || 0) - (dateMs(a.createdAt) || 0))[0];
      if (!latest) {
        reviewHost.replaceChildren();
        resultDisplay('الامتحان لسه ما اتسلّمش.');
        return;
      }
      const grade = codeExamProgress(latest);
      resultDisplay(grade.label, grade.score, grade.total, true);
      if (canReview() && !snapshot.metadata.hasPendingWrites) {
        mountMistakeReview(reviewHost, reviewCodeAttempt(latest));
      } else {
        reviewHost.replaceChildren();
      }
    }, error);
    return;
  }

  const source = exam.source === 'special' ? 'zad_exam_submissions' : 'unitOneExamAttempts';
  stopResult = onSnapshot(doc(db, source, uid + '_' + exam.id), {includeMetadataChanges: true}, async snapshot => {
    if (request !== resultGeneration) return;
    const current = ++sequence;
    if (!snapshot.exists()) {
      reviewHost.replaceChildren();
      resultDisplay('الامتحان لسه ما اتسلّمش.');
      return;
    }
    const result = snapshot.data();
    const total = result.answers?.length;
    if (Number.isFinite(result.finalScore) && result.finalScore >= 0 && result.finalScore <= total) {
      resultDisplay('الدرجة النهائية المعتمدة', result.finalScore, total, true);
    } else {
      resultDisplay('تم تسليم الامتحان. النتيجة النهائية مستنية التصحيح.', null, null, true);
    }
    if (!canReview() || result.studentUid !== uid || snapshot.metadata.hasPendingWrites) {
      reviewHost.replaceChildren();
      return;
    }

    let review = null;
    try {
      if (Array.isArray(result.answers)) {
        const bank = await loadReviewBank(exam.source);
        const questions = bank.find(item => item.id === exam.id);
        review = reviewBankAttempt(questions, result.answers, exam.source);
      }
    } catch (error) {
      console.info('تعذر تحميل مراجعة أخطاء امتحان الحصة.', error);
    }
    if (canReview() && current === sequence) mountMistakeReview(reviewHost, review);
  }, error);
}

function renderResources(data = {}) {
  const summary = summaryLink(data.summaryUrl, location.href);
  const examHref = examPageUrl(data.exam);
  const exam = examHref ? data.exam : null;
  setLink('lessonSummary', summary);
  $('lessonSummaryState').hidden = Boolean(summary);
  $('lessonSummaryState').textContent = summary ? '' : 'الملخص لسه ما اتضافش.';
  setLink('lessonExam', viewer.active ? '' : examHref);
  $('lessonExamState').textContent = examHref ? 'امتحان إلكتروني مجاني.' : 'لسه مفيش امتحان مرتبط بالحصة.';
  observeResult(exam, viewer.uid);
}

function watchResources(request) {
  stopResources = onSnapshot(doc(db, 'lessonResources', lessonId), snapshot => {
    if (request !== generation || !lesson) return;
    renderResources(snapshot.data());
  }, () => {
    if (request !== generation || !lesson) return;
    renderResources();
    $('lessonSummaryState').textContent = 'تعذر تحميل الملخص.';
    $('lessonExamState').textContent = 'تعذر تحميل امتحان الحصة.';
    resultDisplay('تعذر تحميل نتيجة الامتحان.');
  });
}

function stopLessonDetails() {
  stopResources?.();
  stopResources = undefined;
  stopResult?.();
  stopResult = undefined;
  resultGeneration++;
  $('lessonMistakes').replaceChildren();
  lesson = undefined;
}

onAuthStateChanged(auth, async user => {
  const request = ++generation;
  stopLesson?.();
  stopLesson = undefined;
  stopLessonDetails();
  viewer = undefined;
  if (!validDocumentId(lessonId)) { showError('رابط الحصة غير صالح. افتحها من جدول حصصك.'); return; }
  if (!user) {
    sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search);
    location.replace('../../login/index.html');
    return;
  }

  showError('جارٍ تحميل الحصة…');
  try {
    const context = await getPreviewContext(user, 'student');
    if (request !== generation) return;
    if (context.denied) { showError('معاينة الحصة غير متاحة للحساب الحالي.'); return; }
    const profile = context.profile || (await getDoc(doc(db, 'users', context.uid))).data();
    if (request !== generation) return;
    if (profile?.role !== 'student') { showError('صفحة الحصة متاحة بحساب طالب.'); return; }
    viewer = {...context, authUid: user.uid};
    const grade = profile.grade || profile.studyGrade || profile.className || '';
    if (viewer.active) {
      const back = new URL('index.html', location.href);
      back.searchParams.set('previewRole', 'student');
      back.searchParams.set('previewUid', viewer.uid);
      $('lessonBack').href = back.href;
    } else {
      $('lessonBack').href = 'index.html';
    }

    const reference = isPersonal ? doc(db, ...personalLessonCollection(viewer.uid), lessonId) : doc(db, 'lessons', lessonId);
    stopLesson = onSnapshot(reference, snapshot => {
      if (request !== generation) return;
      const data = snapshot.exists() && (isPersonal ? personalLessonForPage(snapshot,viewer.uid,occurrenceDay) : snapshot.data());
      if (!data || !lessonForStudent(data, viewer.uid, grade)) {
        stopLessonDetails();
        showError('الحصة غير متاحة لحسابك. ارجع لجدول حصصك.');
        return;
      }

      lesson = {...data, id: snapshot.id,
        joinUrl: webUrl(data.meetUrl || data.meetLink || data.googleMeetUrl || data.googleMeet)};
      start = lessonStartMs(lesson.date);
      const title = lesson.title || lesson.name || 'حصتك';
      document.title = title + ' | زاد المعرفة';
      $('lessonSubject').textContent = lesson.subject || lesson.section || 'صفحة الحصة';
      $('lessonTitle').textContent = title;
      const time = Number.isFinite(start) ? clock.format(start) + ' بتوقيت القاهرة' : 'الموعد غير محدد';
      $('lessonMeta').textContent = [time, lesson.teacherName || lesson.teacher, lesson.grade].filter(Boolean).join(' · ');
      updateMeet();
      $('lessonStatus').hidden = true;
      $('lessonContent').hidden = false;
      if (!isPersonal && !stopResources) watchResources(request);
    }, () => {
      if (request !== generation) return;
      stopLessonDetails();
      showError('تعذر تحميل الحصة. جرّب تحديث الصفحة.');
    });
  } catch (error) {
    if (request === generation) showError('تعذر تحميل الحصة. جرّب تحديث الصفحة.');
  }
});
