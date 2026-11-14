import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {lessonRatingId,lessonOpenId,validLessonRating} from '../dashboard/student/lesson-interactions.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>readFileSync(resolve(root,p),'utf8');

test('معرّف التقييم ثابت لنفس الطالب والمحاضرة ويتغير بتغيرهما',()=>{
  const a=lessonRatingId('studentABC','lessonXYZ');
  assert.equal(a,'studentABC__lessonXYZ');
  assert.equal(a,lessonRatingId('studentABC','lessonXYZ'));
  assert.notEqual(a,lessonRatingId('studentDEF','lessonXYZ'));
  assert.notEqual(a,lessonRatingId('studentABC','lessonDEF'));
  assert.equal(lessonOpenId('studentABC','lessonXYZ'),a);
});

test('يمنع إنشاء معرّف غير صالح في المتصفح',()=>{
  for(const bad of ['',null,4,'with/slash']) {
    assert.throws(()=>lessonRatingId('studentABC',bad));
    assert.throws(()=>lessonOpenId(bad,'lessonXYZ'));
  }
});

test('تقييم سريع صحيح من 1 إلى 5 فقط',()=>{
  for(const v of [1,2,3,4,5]) assert.equal(validLessonRating(v),true);
  for(const v of [0,-1,6,3.5,NaN,Infinity,'4',null]) assert.equal(validLessonRating(v),false);
});

test('لوحة الطالب تحفظ التقييم والزيارة مرة واحدة لكل معرف',()=>{
  const html=read('dashboard/student/index.html');
  assert.match(html,/doc\(db, 'lessonRatings', lessonRatingId\(uid, lesson\.id\)\)/);
  assert.match(html,/doc\(db, 'lessonOpenEvents', lessonOpenId\(uid, lesson\.id\)\)/);
  assert.doesNotMatch(html,/addDoc\(collection\(db, 'lessonRatings'\)/);
  assert.doesNotMatch(html,/addDoc\(collection\(db, 'lessonAttendance'\)/);
  assert.match(html,/rateButton\.disabled = true/);
  assert.match(html,/where\('studentUid', '==', uid\)/);
  assert.match(html,/ratedLessonIds\.has\(String\(lesson\.id\)\)/);
});

test('قواعد Firestore لا تسمح بتعديل تقييم الطالب ولا تخلط فتح Meet بالحضور',()=>{
  const rules=read('firestore.rules');
  const rating=rules.split('match /lessonRatings/{ratingId} {')[1].split('match /lessonOpenEvents/{eventId} {')[0];
  assert.match(rating,/ratingId == request\.auth\.uid \+ '__' \+ request\.resource\.data\.lessonId/);
  assert.match(rating,/allow create:/);
  assert.match(rating,/allow list: if isAdmin\(\)/);
  assert.match(rating,/resource\.data\.studentUid == request\.auth\.uid/);
  assert.doesNotMatch(rating,/allow update, delete: if signedIn/);
  const opening=rules.split('match /lessonOpenEvents/{eventId} {')[1].split('match /quizzes/{quizId} {')[0];
  assert.match(opening,/request\.resource\.data\.action == 'meet_open'/);
  assert.match(opening,/allow update, delete: if false/);
  const attendance=rules.split('match /lessonAttendance/{attendanceId} {')[1].split('match /teacherHomeworks/{homeworkId} {')[0];
  assert.match(attendance,/allow create, update, delete: if isAdmin\(\)/);
});

test('قواعد آخر شهر مكتمل محفوظة ولم نرجع للتقييمات العامة الأسبوعية',()=>{
  assert.match(read('firestore.rules'),/periodType == \(request\.resource\.data\.kind == 'teacher' \? 'weekly' : 'monthly'\)/);
});
