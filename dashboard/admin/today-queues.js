import {codeExamProgress} from './exam-result-verification.js';

export const todayQueues = new EventTarget();
const snapshots = new Map();

export function publishTodayQueue(source, uid, snapshot) {
  if (!uid) return;
  snapshots.set(source, {uid, ...snapshot});
  todayQueues.dispatchEvent(new Event('change'));
}

export function todayQueue(source, uid) {
  const value = snapshots.get(source);
  return uid && value?.uid === uid ? value : null;
}

export function essayTask(source, {id, data}, exam) {
  let count;
  if (source === 'code') {
    const progress = codeExamProgress(data);
    if (progress.pendingEssay) count = progress.essays.length;
  } else {
    const questions = Array.isArray(exam?.questions) ? exam.questions : [];
    const essays = questions.filter(question => question.type === 'essay');
    const final = typeof data.finalScore === 'number' && Number.isFinite(data.finalScore)
      && data.finalScore >= 0 && data.finalScore <= questions.length;
    const approved = source === 'unit' ? final && Array.isArray(data.essayMarks) &&
      data.essayMarks.length === essays.length : final;
    if (!approved) count = essays.length;
  }
  if (!count) return null;
  return {source, id, count, title: exam?.title || data.examTitle || 'امتحان', student: data.studentName || 'طالب',
    when: data.createdAt?.toMillis?.() || (data.createdAt?.seconds || 0) * 1000};
}
