export function normalizePracticeAnswer(value) {
  return String(value ?? '').trim().toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

const normalizeCodeAnswer = value => normalizePracticeAnswer(value).replace(/ـ/g, '');

function summarize(rows) {
  if (!rows.length) return null;
  const missed = rows.filter(row => row.status !== 'correct');
  return {total: rows.length, missed};
}

function choicesFor(question, source) {
  if (source === 'unit' && question.type === 'tf') {
    return typeof question.answer === 'boolean'
      ? {choices: ['صح', 'خطأ'], expected: question.answer ? 0 : 1}
      : null;
  }
  const choices = question.options;
  const expected = question.answer;
  if (!['mcq', 'tf'].includes(question.type) || !Array.isArray(choices) ||
      choices.length < 2 || !choices.every(label => typeof label === 'string' && label.trim()) ||
      !Number.isInteger(expected) || expected < 0 || expected >= choices.length) return null;
  return {choices, expected};
}

export function reviewBankAttempt(exam, answers, source) {
  if (!['unit', 'special'].includes(source) || !Array.isArray(exam?.questions) ||
      !Array.isArray(answers) || answers.length !== exam.questions.length) return null;
  return summarize(exam.questions.flatMap((question, index) => {
    if (typeof question?.text !== 'string' || !question.text.trim()) return [];
    const base = {number: index + 1, prompt: question.text, section: question.section || ''};
    const answer = answers[index];
    const options = choicesFor(question, source);
    if (options) {
      const {choices, expected} = options;
      let selected = answer;
      if (source === 'special') selected = /^[0-9]+$/.test(String(answer)) ? Number(answer) : null;
      if (source === 'unit' && question.type === 'tf') selected = typeof answer === 'boolean' ? (answer ? 0 : 1) : null;
      const previous = choices[Number.isInteger(selected) ? selected : -1] || '';
      return [{...base, ...options, previous, model: choices[expected],
        status: !previous ? 'unanswered' : selected === expected ? 'correct' : 'incorrect'}];
    }
    if (source !== 'unit' || question.type !== 'fill' || !Array.isArray(question.answers)) return [];
    const models = question.answers.filter(value => typeof value === 'string' && normalizePracticeAnswer(value));
    if (!models.length) return [];
    const previous = typeof answer === 'string' ? answer.trim() : '';
    const accepted = models.map(normalizePracticeAnswer);
    return [{...base, previous, accepted, model: models.join(' / '),
      status: !previous ? 'unanswered' : accepted.includes(normalizePracticeAnswer(previous)) ? 'correct' : 'incorrect'}];
  }));
}

export function reviewCodeAttempt(result) {
  if (typeof result?.answers !== 'string') return null;
  let report;
  try { report = JSON.parse(result.answers); } catch { return null; }
  if (report?.format !== 'zad-answers-v3' || !Array.isArray(report.questions)) return null;

  const rows = report.questions.flatMap((row, index) => {
    if (!['radio', 'select', 'text', 'checkbox'].includes(row?.type) ||
        !['correct', 'incorrect', 'unanswered'].includes(row.answerStatus) ||
        typeof row.question !== 'string' || !row.question.trim() ||
        typeof row.correctAnswer !== 'string' || !normalizeCodeAnswer(row.correctAnswer)) return [];
    // The saved report has answer labels, but it has no original list of choices.
    const previous = row.answerStatus !== 'unanswered' && typeof row.studentAnswer === 'string'
      ? row.studentAnswer.trim() : '';
    const model = row.correctAnswer.trim();
    const accepted = [normalizeCodeAnswer(model)];
    if (model === 'صح') accepted.push('true');
    if (model === 'خطأ') accepted.push('false');
    const number = Number.isInteger(row.number) && row.number > 0 ? row.number : index + 1;
    return [{number, prompt: row.question, previous, model,
      accepted, code: true, multiple: row.type === 'checkbox', status: row.answerStatus}];
  });
  return summarize(rows);
}

const selections = value => value.split(/[,،\n]/).map(normalizeCodeAnswer).filter(Boolean).sort();

export function checkPracticeAnswer(question, answer) {
  if (answer == null || typeof answer !== 'string' || !answer.trim()) return false;
  if (question.choices) return answer === String(question.expected);
  const normalize = question.code ? normalizeCodeAnswer : normalizePracticeAnswer;
  if (question.accepted.includes(normalize(answer))) return true;
  if (!question.multiple) return false;
  const expected = selections(question.model);
  const provided = selections(answer);
  return expected.length > 1 && provided.length === expected.length &&
    expected.every((value, index) => value === provided[index]);
}
