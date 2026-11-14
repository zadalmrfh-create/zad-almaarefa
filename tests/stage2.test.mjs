import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeForDisplay,hasApprovedGrade,createApproval} from '../dashboard/admin/exam-result-verification.js';

test('Unverified student score is provisional, never an achievement',()=>{
 const a=gradeForDisplay({score:20,total:20,percent:100,excellent:true,verified:false});
 assert.equal(a.approved,false);assert.equal(a.excellent,false);assert.equal(a.percent,100);
});
test('Even verified:true without complete final data is NOT approved',()=>{
 assert.equal(hasApprovedGrade({verified:true,score:30,total:30,percent:100}),false);
 assert.equal(hasApprovedGrade({verified:true,finalScore:15,finalTotal:20,finalPercent:90}),false);
});
test('Admin final score takes priority only when consistent',()=>{
 const a=gradeForDisplay({score:20,total:20,percent:100,verified:true,finalScore:10,finalTotal:20,finalPercent:50});
 assert.deepEqual(a,{approved:true,score:10,total:20,percent:50,excellent:false});
});
test('Confirmed excellent is derived from final score',()=>{
 const x={...createApproval('17','20'),reviewedBy:'uid'};
 assert.equal(x.finalPercent,85);assert.equal(gradeForDisplay({...x,score:0,total:20}).excellent,true);
});
test('Approval rejects invalid scores / non integers / unsafe notes',()=>{
 for(const [a,b] of [['-1','20'],['5.5','20'],['99','20'],['5','0'],['5','1001'],['5abc','20']])
  assert.throws(()=>createApproval(a,b));
 assert.throws(()=>createApproval('0','1','a'.repeat(501)));
});
test('Approval keeps exact integer grade, total and private note',()=>{
 assert.deepEqual(createApproval(' 7 ',' 10 ',' مراجعة المقالي '),{verified:true,finalScore:7,finalTotal:10,finalPercent:70,reviewNote:'مراجعة المقالي'});
});
