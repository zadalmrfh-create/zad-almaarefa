import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {personalLessonCollection, personalLessonData, personalLesson} from '../dashboard/student-schedule-core.js';
import {lessonForStudent} from '../dashboard/student/student-today-core.js';
const read = path => readFileSync(resolve(import.meta.dirname,'..',path),'utf8');
const admin = read('dashboard/admin/index.html');
const script = read('dashboard/admin/personal-schedule-admin.js');
test('personal schedule is a real top-level admin panel with a quick link and loaded controller',()=>{
  assert.match(admin, /href="#personalScheduleManagement"/);
  const section = /<section\b[^>]*id="personalScheduleManagement"[\s\S]*?<\/section>/.exec(admin)?.[0];
  assert.ok(section);
  for (const id of ['personalScheduleStudent','personalScheduleForm','personalScheduleSave','personalScheduleCancel','personalScheduleStatus','personalScheduleList']) {
    assert.equal(admin.match(new RegExp(`id="${id}"`,'g'))?.length, 1);
    assert.ok(section.includes(`id="${id}"`));
    assert.ok(script.includes(`$('${id}')`));
  }
  for (const name of ['title','subject','teacherName','date','meetUrl']) assert.match(section,new RegExp(`name="${name}"`));
  assert.match(section,/name="date" type="datetime-local" required/);
  assert.match(admin,/src="personal-schedule-admin\.js\?/);
  assert.match(read('dashboard/admin/admin-workspace.js'),/id:'studentSchedule'[^\n]*sections:\['personalScheduleManagement'\]/);
});
test('content management allows only events, teachers and featured students; independent library links stay',()=>{
  const tabs = [...admin.matchAll(/data-content-tab="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(tabs,['events','teachers','featuredStudents']);
  const types = /const contentTypes = \{([\s\S]*?)\};/.exec(admin)[1];
  const fields = /const fieldSets = \{([\s\S]*?)\};/.exec(admin)[1];
  assert.doesNotMatch(types,/\b(?:libraryBooks|azharBooks)\b/);
  assert.doesNotMatch(fields,/\b(?:libraryBooks|azharBooks)\b/);
  assert.match(admin,/href="library-protected-admin\.html"/);
  assert.match(admin,/href="library-migration\.html"/);
  assert.match(admin,/id="libraryDownloadTracking"/);
});
test('personal lesson payload and access target the selected student, not other accounts',()=>{
  const data = personalLessonData({title:' English ',subject:'English',teacherName:'Miss Fatma',date:'2026-11-26T16:00',meetUrl:'https://meet.google.com/abc-defg-hij'});
  assert.equal(data.title,'English');
  assert.deepEqual(personalLessonCollection('student-a'),['studentSchedules','student-a','lessons']);
  assert.throws(()=>personalLessonData({...data,meetUrl:'javascript:alert(1)'}));
  const lesson = personalLesson({id:'lesson-a',data:()=>data},'student-a');
  assert.equal(lessonForStudent(lesson,'student-a',''),true);
  assert.equal(lessonForStudent(lesson,'student-b',''),false);
  assert.equal(lessonForStudent({...lesson,deleted:true},'student-a',''),false);
  assert.match(read('firestore.rules'),/match \/studentSchedules\/\{studentUid\}\/lessons\/\{lessonId\}\s*\{\s*allow read: if request.auth != null && \(request.auth.uid == studentUid \|\| isAdmin\(\)\);\s*allow create, update, delete: if isAdmin\(\);/);
});
