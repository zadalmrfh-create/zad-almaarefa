const root = new URL('../', import.meta.url);
const examPages = new Map([
  ['code', 'code-exam.html'],
  ['unit', 'unit-one-exam.html'],
  ['special', 'zad-special-exam.html']
]);

export function validDocumentId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 150
    && value !== '.' && value !== '..' && !/[\/\u0000-\u001f\u007f]/.test(value);
}

export function lessonPageUrl(id, from = location.href) {
  if (!validDocumentId(id)) return '';
  const url = new URL('dashboard/student/lesson.html', root);
  url.searchParams.set('id', id);
  const query = new URL(from).searchParams;
  if (query.get('previewRole') === 'student' && validDocumentId(query.get('previewUid'))) {
    url.searchParams.set('previewRole', 'student');
    url.searchParams.set('previewUid', query.get('previewUid'));
  }
  return url.href;
}

export function examPageUrl(exam, base = root) {
  if (!examPages.has(exam?.source) || !validDocumentId(exam?.id)) return '';
  const url = new URL('sections/tests/' + examPages.get(exam.source), base);
  url.searchParams.set('id', exam.id);
  return url.href;
}

export function parseExamPage(value, from, base = root) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), from);
    const id = url.searchParams.get('id');
    if (url.origin !== base.origin || url.username || url.password || !validDocumentId(id)
        || url.searchParams.getAll('id').length !== 1) return null;
    for (const [source, filename] of examPages) {
      if (url.pathname === new URL('sections/tests/' + filename, base).pathname) return {source, id};
    }
  } catch {}
  return null;
}

export function summaryLink(value, from) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim(), from);
    if (url.username || url.password || url.href.length > 2048) return '';
    return url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === new URL(from).origin)
      ? url.href : '';
  } catch {
    return '';
  }
}
