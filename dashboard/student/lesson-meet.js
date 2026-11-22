import {auth, db} from '../../firebase-config.js';
import {doc, setDoc, serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {lessonOpenId} from './lesson-interactions.js';

// An open attempt is recorded separately from official attendance.
export async function openLessonMeet(lesson, studentUid) {
  const room = window.open('about:blank', '_blank');
  const logVisit = !lesson.privateSchedule && auth.currentUser?.uid === studentUid
    ? setDoc(doc(db, 'lessonOpenEvents', lessonOpenId(studentUid, lesson.id)), {
      lessonId: lesson.id,
      studentUid,
      lessonTitle: String(lesson.title || lesson.name || '').slice(0, 160),
      action: 'meet_open',
      openedAt: serverTimestamp()
    }).catch(error => console.warn('تعذر تسجيل فتح المحاضرة:', error.code || error.message))
    : Promise.resolve();
  if (room && !room.closed) {
    room.opener = null;
    room.location.replace(lesson.joinUrl);
  } else {
    await Promise.race([logVisit, new Promise(resolve => setTimeout(resolve, 900))]);
    location.href = lesson.joinUrl;
  }
}
