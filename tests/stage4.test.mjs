import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {cairoDay,weekRange,eligibleLesson,scheduleDays,studentMetrics} from '../dashboard/student/stage4-core.js';
import {gradeForDisplay,codeExamProgress,createEssayReview} from '../dashboard/admin/exam-result-verification.js';
const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
test('weekly calendar starts Saturday and closes Friday',()=>{
 const r=weekRange('2026-11-14'); assert.deepEqual(r,{start:'2026-11-14',end:'2026-11-20',until:'2026-11-21'});
 assert.equal(weekRange('2026-11-14',1).start,'2026-11-21');
 assert.equal(cairoDay(new Date('2026-11-13T23:30:00Z')),'2026-11-14');
});
test('student schedule respects actual date, grade and targeted student',()=>{
 const r=weekRange('2026-11-14');
 const l={date:'2026-11-15T10:00',grade:'الثاني الثانوي',audience:'selected',targetUids:['s1']};
 assert.equal(eligibleLesson(l,'s1','الثاني الثانوي',r),true);
 assert.equal(eligibleLesson(l,'s2','الثاني الثانوي',r),false);
 assert.equal(eligibleLesson(l,'s1','الأول الثانوي',r),false);
 assert.equal(eligibleLesson({...l,date:'2026-11-21T10:00'},'s1','الثاني الثانوي',r),false);
 assert.equal(scheduleDays([l],r).flatMap(d=>d.lessons).length,1);
});
test('real progress excludes future and excused lessons from attendance rate',()=>{
 const d=studentMetrics([{status:'حاضر',date:'2026-11-10'}, {status:'غائب',date:'2026-11-11'}, {status:'اعتذر',date:'2026-11-12'}, {status:'حاضر',date:'2026-01-01'}],
  [{complete:true,percent:80},{pendingEssay:true,percent:100}], '2026-11-14');
 assert.equal(d.attendanceRate,50);assert.equal(d.pendingEssay,1);assert.equal(d.averageExam,80);
});
test('objective auto-grade immediately, essay awaits only manual essay marks',()=>{
 const q=[{number:1,type:'radio',answerStatus:'correct',studentAnswer:'أ'},
          {number:2,type:'radio',answerStatus:'incorrect',studentAnswer:'ب'},
          {number:3,type:'essay',answerStatus:'essay',studentAnswer:'إجابتي'}];
 const x={score:1,total:2,verified:false,answers:JSON.stringify({format:'zad-answers-v3',questions:q})};
 const a=codeExamProgress(x);assert.equal(a.pendingEssay,true);assert.equal(a.score,1);
 const marked=createEssayReview(x,[{score:2,max:3}]);
 const b=gradeForDisplay({...x,...marked});assert.equal(b.approved,true);assert.equal(b.score,3);assert.equal(b.total,5);
});
test('UI is wired, without general approval or a false mobile push claim',()=>{
 const student=read('dashboard/student/index.html'),admin=read('dashboard/admin/code-exam-results-admin.js');
 assert.match(student,/data-student-tab="schedule"/);assert.match(student,/stage4-student\.js/);
 assert.match(student,/zadStage4ProgressCards/);assert.match(student,/zadStage4ScheduleList/);
 assert.match(admin,/تصحيح المقالي/);assert.doesNotMatch(admin,/reviewCodeGrade\(/);
 assert.match(read('dashboard/student/stage4-student.js'),/window\.addEventListener\('zad:stage4-exam-data'/);
 assert.match(read('firestore.rules'),/'essayGrades'/);
});
