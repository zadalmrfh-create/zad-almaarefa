import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {sameReview,publicCopiesForReview} from '../dashboard/admin/weekly-review-delete-core.js';
import {TEACHER_QUESTIONS,PLATFORM_QUESTIONS,ADMIN_QUESTIONS,scoreAverage,htmlEscape} from '../reviews/weekly-shared.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const id='student-a__2026-10-01__platform';
const hash=createHash('sha256').update(id).digest('hex');
const stamp={seconds:100,nanoseconds:1};
const row={studentUid:'student-a',kind:'platform',periodType:'monthly',weekStart:'2026-10-01',weekEnd:'2026-10-31',teacherUid:'',feedbackId:'',sourceAttendanceId:'',sourceBookingId:'',scores:[4,4,4,4],comment:'Good',publishConsent:true,createdAt:stamp};
const publicRow={kind:'platform',weekStart:row.weekStart,teacherUid:'',text:row.comment,rating:4,createdAt:stamp};
test('legacy copies require the exact timestamp and review fields, not similar text alone',()=>{
 const docs=[{id:'other',...publicRow,createdAt:{seconds:100,nanoseconds:2}},{id:'right',...publicRow},{id:'weekly_'+hash,...publicRow},{id:'wrong-teacher',...publicRow,teacherUid:'other'}];
 assert.deepEqual(publicCopiesForReview({...row,hash},docs),{randomId:'right',ambiguous:false,unresolved:false});
 assert.equal(publicCopiesForReview({...row,hash},[docs[0]]).unresolved,true);
 assert.equal(publicCopiesForReview({...row,hash},[docs[1],{...docs[1],id:'also'}]).ambiguous,true);
 assert.equal(publicCopiesForReview({...row,hash,createdAt:null},docs).randomId,null);
 assert.equal(publicCopiesForReview({...row,hash,kind:'administration'},docs).randomId,null);
 assert.equal(sameReview(row,{...row}),true);
 assert.equal(sameReview(row,{...row,createdAt:{seconds:101,nanoseconds:1}}),false);
});
function harness({cancel=false,reject=false,role='admin',data=row,reviewId=id,extras=[]}={}){
 const nodes=new Map(),alerts=[],transactions=[];
 const dom=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',disabled:false,add(){},querySelectorAll(){return[]},replaceChildren(){this.innerHTML=''},addEventListener(){}});return nodes.get(id)};
 const db={};const auth={currentUser:{uid:'admin-a'}};
 const documents=new Map([['users/admin-a',{role}],['users/student-a',{name:'Test Student'}],['weeklyReviewPrivate/'+reviewId,data],...extras]);
 const ref=(c,i)=>({path:c+(i===undefined?'':'/'+i),id:i});
 const snapshot=r=>({id:r.id,exists:()=>documents.has(r.path),data:()=>documents.get(r.path)});
 const queryDocs=r=>({docs:[...documents].filter(([k,v])=>k.startsWith(r.path+'/')&&(!r.condition||v[r.condition[0]]===r.condition[2])).map(([k])=>snapshot(ref(r.path,k.slice(r.path.length+1))))});
 let onAuth;
 const context={auth,db,document:{getElementById:dom},window:{confirm:()=>!cancel,alert:m=>alerts.push(m)},Option:class{},crypto:webcrypto,TextEncoder,console:{error(){},warn(){}},clearAdminReadCache(){},onAuthStateChanged:(_,fn)=>{onAuth=fn},getDoc:async r=>snapshot(r),getDocsFromServer:async r=>queryDocs(r),collection:(_,c)=>ref(c),doc:(_,c,i)=>ref(c,i),where:(...c)=>c,query:(r,condition)=>({...r,condition}),serverTimestamp:()=>stamp,runTransaction:async(_,fn)=>{
  const deletes=[],sets=[];await fn({get:async r=>snapshot(r),delete:r=>deletes.push(r.path),set:(r,v)=>sets.push([r.path,v])});
  if(reject)throw Object.assign(new Error('denied'),{code:'permission-denied'});
  deletes.forEach(k=>documents.delete(k));sets.forEach(([k,v])=>documents.set(k,v));transactions.push(deletes);
 },TEACHER_QUESTIONS,PLATFORM_QUESTIONS,ADMIN_QUESTIONS,scoreAverage,htmlEscape,sameReview,publicCopiesForReview};
 const source=read('dashboard/admin/weekly-reviews-admin.js').replace(/^import[^\n]+\n/gm,'');
 runInNewContext(source+'\nglobalThis.invokeDelete=deleteReview;',context);
 return {documents,alerts,transactions,dom,auth,init:()=>onAuth(auth.currentUser),signOut:()=>{auth.currentUser=null;return onAuth(null)},del:()=>context.invokeDelete(reviewId)};
}
test('confirmed admin deletion atomically removes selected review and proven public copies and refreshes stats',async()=>{
 const h=harness({extras:[['publicTestimonials/random',publicRow],['publicTestimonials/weekly_'+hash,{...publicRow,createdAt:{seconds:200,nanoseconds:0}}],['publicTestimonials/other',{...publicRow,createdAt:{seconds:300,nanoseconds:0}}]]});await h.init();assert.match(h.dom('zwrAdminResults').innerHTML,/data-zwr-delete/);
 await h.del();assert.equal(h.documents.has('weeklyReviewPrivate/'+id),false);assert.equal(h.documents.has('publicTestimonials/random'),false);assert.equal(h.documents.has('publicTestimonials/weekly_'+hash),false);assert.equal(h.documents.has('publicTestimonials/other'),true);assert.equal(h.transactions.length,1);assert.match(h.dom('zwrAdminStats').textContent,/^0 تقييم/);
});
test('teacher deletion removes only the corresponding anonymous feedback and review',async()=>{
 const teacher={...row,kind:'teacher',periodType:'weekly',teacherUid:'teacher-a',feedbackId:'feedback-a',comment:'',scores:[4,4,4,4,4,4]};const feedback={kind:'teacher',teacherUid:teacher.teacherUid,weekStart:row.weekStart};
 const h=harness({data:teacher,reviewId:'teacher-review',extras:[['weeklyTeacherFeedback/feedback-a',feedback],['weeklyTeacherFeedback/feedback-b',feedback]]});await h.init();await h.del();assert.equal(h.documents.has('weeklyTeacherFeedback/feedback-a'),false);assert.equal(h.documents.has('weeklyTeacherFeedback/feedback-b'),true);assert.equal(h.documents.has('weeklyReviewPrivate/teacher-review'),false);
});
test('cancelled, denied, stale, ambiguous and non-admin requests never remove any review',async()=>{
 for(const opts of [{cancel:true},{reject:true},{role:'student'},{extras:[['publicTestimonials/a',publicRow],['publicTestimonials/b',publicRow]]}]){
  const h=harness(opts);await h.init();await h.del();assert.equal(h.documents.has('weeklyReviewPrivate/'+id),true);assert.equal(h.transactions.length,0);
 }
 const h=harness();await h.init();h.documents.set('weeklyReviewPrivate/'+id,{...row,createdAt:{seconds:999,nanoseconds:0}});await h.del();assert.equal(h.documents.has('weeklyReviewPrivate/'+id),true);assert.equal(h.transactions.length,0);
});
test('admin logout clears review cards and prevents further deletion',async()=>{const h=harness();await h.init();await h.signOut();assert.equal(h.dom('zwrAdminResults').innerHTML,'');await h.del();assert.equal(h.transactions.length,0);});
test('only admin moderation is added to the two specific Firestore collections; review updates still forbidden',()=>{
 const rules=read('firestore.rules');for(const name of ['weeklyReviewPrivate','weeklyTeacherFeedback']){const block=rules.split('match /'+name+'/{')[1].split('\n    }')[0];assert.match(block,/allow update: if false;/);assert.match(block,/allow delete: if isCertificateAdmin\(\);/);assert.doesNotMatch(block,/allow (?:read, )?write:/);}
 assert.match(read('dashboard/admin/index.html'),/weekly-reviews-admin\.js\?v=20261125-delete1/);
});
