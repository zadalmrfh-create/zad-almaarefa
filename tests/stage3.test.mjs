import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cairoDay,followingDay,row,csvCell,csvReport,groupSpecs,BOOKING_REVIEW,LIMITS} from '../dashboard/admin/daily-ops-core.js';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(ROOT,p),'utf8');
test('Cairo calendar day handles month and year rollover',()=>{
 assert.equal(cairoDay(new Date('2026-11-14T02:20:00Z')),'2026-11-14');
 assert.equal(followingDay('2026-12-31'),'2027-01-01');
 assert.equal(followingDay('2024-02-28'),'2024-02-29');
 assert.throws(()=>followingDay('2026-02-31'));
});
test('status categories and snapshots are bounded',()=>{
 assert.ok(BOOKING_REVIEW.has('جديد'));assert.ok(BOOKING_REVIEW.has('قيد المراجعة'));
 assert.ok(LIMITS.bookings<=100&&LIMITS.payments<=100&&LIMITS.essays<=200);
});
test('cash values are denominated in Egyptian pounds',()=>{
 const x=row('payments','id',{studentName:'طالب',amountPiastres:2500});
 assert.match(x.detail,/25 ج.م/);assert.equal(x.kind,'payments');
});
test('CSV escapes quotes, controls, and spreadsheet formulas',()=>{
 assert.equal(csvCell('a"b'),'"a""b"');
 assert.equal(csvCell('=1+2'),'"\'=1+2"');
 assert.equal(csvCell('  @SUM(1)'),'"\'  @SUM(1)"');
 assert.match(csvReport({bookings:[row('bookings','a',{fullName:'=HYPERLINK("oops")'})]}),/^\ufeff/);
 assert.ok(!csvReport({}).includes('undefined'));
});
test('daily center integrated in admin page and correct home tab',()=>{
 const html=read('dashboard/admin/index.html');const ws=read('dashboard/admin/admin-workspace.js');
 assert.match(html,/id="zadDailyOpsSection"/);assert.match(html,/daily-ops-admin\.js/);assert.match(html,/data-zad-ops-shortcut="student"/);
 assert.match(ws,/sections:\['zadDailyOpsSection','platformAnalytics'/);
 assert.match(ws,/data\.financeMode/);assert.match(ws,/data\.sectionId/);
 for(const s of Object.values(groupSpecs))assert.ok(html.includes(`id="${s.sectionId}"`)||s.sectionId==='contentManagement');
});
test('daily module reads only on demand and does not mutate Firebase',()=>{
 const src=read('dashboard/admin/daily-ops-admin.js');
 assert.match(src,/button\?\.addEventListener\('click',load\)/);
 assert.match(src,/Promise\.allSettled/);
 assert.doesNotMatch(src,/\b(addDoc|setDoc|updateDoc|deleteDoc|onSnapshot)\b/);
 assert.match(src,/codeExamProgress\(x\.data\(\)\)\.pendingEssay/);
});
test('stage 3 leaves teacher and essay grading code unchanged',()=>{
 const src=read('dashboard/admin/daily-ops-admin.js');
 assert.match(src,/financeMode:'review'|financeMode:spec\.financeMode/);
 assert.doesNotMatch(src,/essayGrades\s*=/);
});
