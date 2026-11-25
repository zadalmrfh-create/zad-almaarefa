import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {runInNewContext} from 'node:vm';
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

test('لوحة الطالب تمنع تكرار التقييم وتستخدم مساعد دخول المحاضرة المشترك',()=>{
  const html=read('dashboard/student/index.html');
  assert.match(html,/doc\(db, 'lessonRatings', lessonRatingId\(uid, lesson\.id\)\)/);
  assert.match(html,/await openLessonMeet\(lesson, uid\)/);
  assert.match(read('dashboard/student/lesson-page.js'),/openLessonMeet\(lesson, viewer\.uid\)/);
  assert.doesNotMatch(html,/addDoc\(collection\(db, 'lessonRatings'\)/);
  assert.doesNotMatch(html,/addDoc\(collection\(db, 'lessonAttendance'\)/);
  assert.match(html,/rateButton\.disabled = true/);
  assert.match(html,/where\('studentUid', '==', uid\)/);
  assert.match(html,/ratedLessonIds\.has\(String\(lesson\.id\)\)/);
});

function meetHarness({popup=true,uid='studentABC',rejectVisit=false}={}) {
  const writes=[],documents=new Map(),navigation=[],warnings=[];
  const room={closed:false,opener:{},location:{replace:url=>navigation.push(url)}};
  const location={href:''};
  const auth={currentUser:uid?{uid}:null};
  const context={
    auth,db:{},lessonOpenId,location,
    window:{open:(url,target)=>{assert.equal(url,'about:blank');assert.equal(target,'_blank');return popup?room:null;}},
    doc:(_db,collection,id)=>({collection,id}),
    serverTimestamp:()=>({serverTimestamp:true}),
    setDoc:async(ref,data)=>{
      writes.push({ref,data});
      if(rejectVisit||documents.has(ref.id))throw Object.assign(new Error('Visit already recorded'),{code:'permission-denied'});
      documents.set(ref.id,data);
    },
    setTimeout:callback=>{callback();return 1;},
    console:{warn:(...args)=>warnings.push(args)}
  };
  // Run the actual browser module with only its imports supplied by this isolated harness.
  const source=read('dashboard/student/lesson-meet.js').replace(/^import[^\n]+\n/gm,'').replace('export async function','async function');
  runInNewContext(source+'\nglobalThis.invoke=openLessonMeet;',context,{filename:'lesson-meet.js'});
  return {...context,writes,documents,navigation,warnings,room};
}

test('محاولات فتح نفس الحصة تستخدم سجلًا ثابتًا منفصلًا عن الحضور الرسمي',async()=>{
  const h=meetHarness();
  const lesson={id:'lessonXYZ',title:'درس التجويد',joinUrl:'https://meet.example.test/lesson'};
  await h.invoke(lesson,'studentABC');
  await h.invoke(lesson,'studentABC');
  assert.equal(h.documents.size,1);
  assert.deepEqual(h.writes.map(x=>x.ref),[
    {collection:'lessonOpenEvents',id:'studentABC__lessonXYZ'},
    {collection:'lessonOpenEvents',id:'studentABC__lessonXYZ'}
  ]);
  const stored=h.documents.get('studentABC__lessonXYZ');
  assert.equal(stored.action,'meet_open');
  assert.equal(stored.studentUid,'studentABC');
  assert.equal(stored.lessonId,'lessonXYZ');
  assert.equal(h.writes.some(x=>x.ref.collection==='lessonAttendance'),false);
  assert.deepEqual(h.navigation,[lesson.joinUrl,lesson.joinUrl]);
  assert.equal(h.room.opener,null);
  assert.equal(h.warnings.length,1); // Duplicate-create rejection must not block the meeting.
});

test('الحصة الخاصة ومعاينة حساب آخر لا تسجلان زيارة باسم الطالب',async()=>{
  const lesson={id:'lessonXYZ',joinUrl:'https://meet.example.test/lesson'};
  for(const [uid,privateSchedule] of [['studentABC',true],['adminUser',false],[null,false]]) {
    const h=meetHarness({uid});
    await h.invoke({...lesson,privateSchedule},'studentABC');
    assert.equal(h.writes.length,0);
    assert.deepEqual(h.navigation,[lesson.joinUrl]);
  }
});

test('حجب النافذة أو فشل تسجيل الزيارة لا يمنع الانتقال إلى رابط الحصة',async()=>{
  const h=meetHarness({popup:false,rejectVisit:true});
  const lesson={id:'lessonXYZ',joinUrl:'https://meet.example.test/lesson'};
  await h.invoke(lesson,'studentABC');
  assert.equal(h.location.href,lesson.joinUrl);
  assert.equal(h.writes.length,1);
  assert.equal(h.documents.size,0);
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
