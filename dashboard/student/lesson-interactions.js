/** Stable Firestore document IDs for quick ratings and Meet opening events.
 * The Firestore rules enforce the same format, so browser refresh or two devices
 * cannot create another submission for the same student + lesson.
 */
function checkedId(value, field) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 150 || value.includes('/')) {
    throw new TypeError(`Invalid ${field}`);
  }
  return value;
}

export function lessonRatingId(studentUid, lessonId) {
  return `${checkedId(studentUid, 'student UID')}__${checkedId(lessonId, 'lesson ID')}`;
}

export function lessonOpenId(studentUid, lessonId) {
  return `${checkedId(studentUid, 'student UID')}__${checkedId(lessonId, 'lesson ID')}`;
}

export function validLessonRating(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}
