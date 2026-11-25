import test from 'node:test';
import assert from 'node:assert/strict';
import { STUDENT_TABS, studentTabFromURL, studentTabURL, focusStudentPanel, studentErrorMessage } from '../dashboard/student/student-navigation-core.js';

test('shared account links reach the requested content, including old profile links', () => {
  assert.equal(studentTabFromURL('/dashboard/student/index.html?tab=notifications'), 'notifications');
  assert.equal(studentTabFromURL('/dashboard/student/index.html#profileCard'), 'profile');
  assert.equal(studentTabFromURL('/dashboard/student/index.html?tab=lectureRatings&lessonId=lesson-8'), 'lectureRatings');
  assert.equal(studentTabFromURL('/dashboard/student/index.html#studentNotificationsCard'), 'notifications');
});

test('every supported tab can be shared and restored after a reload', () => {
  for (const tab of STUDENT_TABS) {
    const url = studentTabURL('/dashboard/student/index.html', tab);
    assert.equal(studentTabFromURL(url), tab);
  }
});

test('unknown or malformed destinations safely show the overview', () => {
  assert.equal(studentTabFromURL('/dashboard/student/index.html?tab=admin'), 'overview');
  assert.equal(studentTabFromURL('/dashboard/student/index.html#%E0%A4%A'), 'overview');
  assert.equal(studentTabFromURL('/dashboard/student/index.html?tab=%3Cscript%3E'), 'overview');
  assert.equal(studentTabFromURL('/dashboard/student/index.html?tab=profile', ['overview','schedule']), 'overview');
  assert.throws(() => studentTabURL('/dashboard/student/index.html', 'unknown'), RangeError);
});

test('a specific legacy section wins over an older generic tab parameter', () => {
  assert.equal(studentTabFromURL('/dashboard/student/index.html?tab=overview#profileCard'), 'profile');
});

test('switching tabs keeps the authorized preview and lesson context but removes an old section anchor', () => {
  const source = 'https://example.test/dashboard/student/index.html?previewRole=student&previewUid=student-42&lessonId=lesson-8&tab=overview#profileCard';
  const result = new URL(studentTabURL(source, 'notifications'), 'https://example.test');
  assert.equal(result.pathname, '/dashboard/student/index.html');
  assert.equal(result.searchParams.get('previewRole'), 'student');
  assert.equal(result.searchParams.get('previewUid'), 'student-42');
  assert.equal(result.searchParams.get('lessonId'), 'lesson-8');
  assert.equal(result.searchParams.get('tab'), 'notifications');
  assert.equal(result.hash, '');
});

test('back and forward URL snapshots restore the same sections without account data', () => {
  const urls = ['overview','schedule','notifications','profile'].map(tab => studentTabURL('/dashboard/student/index.html', tab));
  assert.deepEqual([...urls].reverse().map(url => studentTabFromURL(url)), ['profile','notifications','schedule','overview']);
  assert.deepEqual(urls.map(url => studentTabFromURL(url)), ['overview','schedule','notifications','profile']);
});

test('content activation focuses its visible heading without an unexpected focus scroll', () => {
  const calls = [];
  const heading = {
    hasAttribute: () => false,
    setAttribute: (name, value) => calls.push(['attribute',name,value]),
    focus: options => calls.push(['focus',options])
  };
  const panel = { hidden:false, querySelector:()=>heading, scrollIntoView:options=>calls.push(['scroll',options]) };
  assert.equal(focusStudentPanel(panel), true);
  assert.deepEqual(calls, [['attribute','tabindex','-1'],['focus',{preventScroll:true}],['scroll',{block:'start',behavior:'auto'}]]);
});

test('hidden panels never receive focus; restoration may focus without scrolling', () => {
  assert.equal(focusStudentPanel({hidden:true}), false);
  let focused = false, scrolled = false;
  const panel = { hidden:false, querySelector:()=>null, hasAttribute:()=>true, focus:()=>{focused=true;}, scrollIntoView:()=>{scrolled=true;} };
  assert.equal(focusStudentPanel(panel,{scroll:false}), true);
  assert.equal(focused,true);
  assert.equal(scrolled,false);
});

test('student recovery text does not expose backend errors or developer instructions', () => {
  for (const error of [{code:'permission-denied',message:'Firestore rule internal secret'}, {code:'unavailable',message:'transport failed'}, {message:'Unexpected backend detail'}]) {
    const message = studentErrorMessage(error,'الجدول');
    assert.match(message,/الجدول/);
    assert.doesNotMatch(message,/Firestore|Console|F12|internal|transport|Unexpected|permission-denied/);
  }
  assert.match(studentErrorMessage({code:'auth/requires-recent-login'}),/سجّل الدخول/);
});
