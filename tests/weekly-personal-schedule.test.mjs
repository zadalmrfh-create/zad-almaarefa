import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {personalLessonData,personalOccurrence,personalLesson,expandPersonalLessons,personalLessonForPage,personalUpcomingRange} from '../dashboard/student-schedule-core.js';
import {lessonStartMs,lessonForStudent,chooseLesson} from '../dashboard/student/student-today-core.js';
import {weekRange,eligibleLesson,scheduleDays} from '../dashboard/student/stage4-core.js';
import {lessonPageUrl} from '../dashboard/lesson-page-links.js';
const base={title:'رياضيات',subject:'الرياضيات',teacherName:'',meetUrl:'https://meet.google.com/example',recurrence:'weekly',weekdays:['6','3'],startDate:'2026-11-25',time:'21:00',endDate:''};
const snap=(id,data)=>({id,data:()=>data});
const data=personalLessonData(base);
const series=snap('math',data);
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('weekly payload stores one rule and validates all fields, including selected days and optional end',()=>{
 assert.deepEqual(data.weekdays,[6,3]);assert.equal(data.date,'2026-11-25T21:00');assert.equal(data.recurrence,'weekly');
 for(const bad of [{weekdays:[]},{weekdays:['']},{weekdays:[null]},{weekdays:[2,2]},{weekdays:[7]},{time:'25:00'},{startDate:'2026-02-30'},{endDate:'2026-11-24'},{recurrence:'monthly'},{meetUrl:'javascript:alert(1)'}])assert.throws(()=>personalLessonData({...base,...bad}));
});
test('Saturday and Wednesday recur in consecutive weeks, starting on or after the actual start date',()=>{
 const first=weekRange('2026-11-25'),second=weekRange('2026-11-25',1);
 assert.deepEqual(expandPersonalLessons([series],'s1',first).map(x=>x.date),['2026-11-25T21:00']);
 const next=expandPersonalLessons([series],'s1',second);
 assert.deepEqual(next.map(x=>x.date),['2026-11-28T21:00','2026-12-02T21:00']);
 assert.equal(scheduleDays(next,second).flatMap(x=>x.lessons).length,2);
 assert.ok(next.every(x=>eligibleLesson(x,'s1','',second)&&!eligibleLesson(x,'s2','',second)));
});
test('different times on different weekdays coexist, with no duplicated weekly template on its start date',()=>{
 const a=snap('a',personalLessonData({...base,weekdays:[2],time:'13:00'}));
 const b=snap('b',personalLessonData({...base,weekdays:[4],time:'20:00'}));
 assert.deepEqual(expandPersonalLessons([a,b],'s1',weekRange('2026-12-01')).map(x=>x.date),['2026-12-01T13:00','2026-12-03T20:00']);
});
test('end date is inclusive and deleted series disappear without writing attendance or expanding stale entries',()=>{
 const finite=snap('finite',personalLessonData({...base,endDate:'2026-11-28'}));
 assert.deepEqual(expandPersonalLessons([finite],'s1',weekRange('2026-11-28')).map(x=>x.date),['2026-11-28T21:00']);
 assert.deepEqual(expandPersonalLessons([snap('deleted',{...data,deleted:true})],'s1',weekRange('2026-11-28')),[]);
 assert.equal(personalLessonForPage(snap('deleted',{...data,deleted:true}),'s1','2026-11-28'),null);
});
test('legacy one-off lessons still render with no occurrence date and do not repeat',()=>{
 const legacy=snap('old',{title:'حصة',subject:'لغة',date:'2026-11-26T18:00'});
 const lesson=expandPersonalLessons([legacy],'s1',weekRange('2026-11-25'))[0];
 assert.equal(lesson.date,'2026-11-26T18:00');assert.equal(lesson.occurrenceDay,undefined);
 assert.equal(eligibleLesson(lesson,'s1','',weekRange('2026-11-25',1)),false);
 assert.equal(personalLessonForPage(legacy,'s1','2026-11-26'),null);
 assert.equal(personalLessonForPage(legacy,'s1','').id,'old');
 const once=personalLessonData({...base,recurrence:'once',date:'2026-11-26T18:00'});
 assert.equal(once.recurrence,'once');assert.deepEqual(once.weekdays,[]);assert.equal(once.endDate,'');
});
test('recurring links preserve the private owner route, preview, and validated occurrence day',()=>{
 const from='https://example.test/dashboard/student/index.html?previewRole=student&previewUid=s1';
 const url=new URL(lessonPageUrl('math',from,true,'2026-11-28'));
 assert.equal(url.searchParams.get('id'),'math');assert.equal(url.searchParams.get('private'),'1');
 assert.equal(url.searchParams.get('day'),'2026-11-28');assert.equal(url.searchParams.get('previewUid'),'s1');
 assert.equal(lessonPageUrl('math',from,true,'invalid'),'');
 const lesson=personalLessonForPage(series,'s1',url.searchParams.get('day'));
 assert.equal(lesson.date,'2026-11-28T21:00');assert.equal(lessonForStudent(lesson,'s2',''),false);
 for(const bad of ['','2026-11-27','2026-11-21','2026-02-30'])assert.equal(personalLessonForPage(series,'s1',bad),null);
 assert.equal(new URL(lessonPageUrl('general',from,false,'2026-11-28')).searchParams.has('day'),false);
});
test('recurring hour is Cairo wall time in summer and winter, including actual DST offset',()=>{
 const allYear=snap('year',personalLessonData({...base,startDate:'2026-01-01',weekdays:[6]}));
 const row=personalLesson(allYear,'s1');
 const winter=personalOccurrence(row,'2026-01-03'),summer=personalOccurrence(row,'2026-07-04');
 assert.equal(new Date(lessonStartMs(winter.date)).toISOString(),'2026-01-03T19:00:00.000Z');
 assert.equal(new Date(lessonStartMs(summer.date)).toISOString(),'2026-07-04T18:00:00.000Z');
});
test('next lesson selects actual recurrence date instead of original starting date',()=>{
 const now=new Date('2026-12-01T17:00:00Z');
 const upcoming=expandPersonalLessons([series],'s1',personalUpcomingRange(now)).map(x=>({...x,start:lessonStartMs(x.date),canJoin:true}));
 assert.equal(chooseLesson(upcoming,+now).lesson.date,'2026-12-02T21:00');
});
test('all seven inputs and student routes are wired; same private Firestore collection and no attendance writes',()=>{
 const admin=read('dashboard/admin/index.html'),controller=read('dashboard/admin/personal-schedule-admin.js');
 assert.equal((admin.match(/name="weekdays"/g)||[]).length,7);
 assert.match(admin,/name="recurrence"/);assert.match(admin,/name="time"/);assert.match(admin,/name="startDate"/);
 assert.match(controller,/values\.getAll\('weekdays'\)/);assert.match(controller,/weekdayFields\.disabled = !weekly/);
 const student=read('dashboard/student/index.html'),stage=read('dashboard/student/stage4-student.js'),page=read('dashboard/student/lesson-page.js'),today=read('dashboard/student/student-today.js');
 assert.match(student,/expandPersonalLessons\(personal\.value/);assert.match(stage,/where\('recurrence','==','weekly'\)/);
 for(const file of [student,stage,today])assert.match(file,/lessonPageUrl\(lesson\.id,\s*location\.href,\s*lesson\.privateSchedule,\s*lesson\.occurrenceDay\)/);
 assert.match(page,/personalLessonForPage\(snapshot,viewer\.uid,occurrenceDay\)/);
 assert.match(read('dashboard/student/lesson-meet.js'),/!lesson\.privateSchedule/);
 assert.doesNotMatch(controller,/collection\(db,\s*['"]attendance/);
});
