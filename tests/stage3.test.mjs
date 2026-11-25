import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {cairoDay,followingDay,row,timeText,csvCell,csvReport,BOOKING_REVIEW,LIMITS} from '../dashboard/admin/daily-ops-core.js';
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

class TestElement {
 constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.id=id;this.value='';this.textContent='';this.disabled=false;this.children=[];this.listeners=new Map();}
 addEventListener(type,callback){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(callback);}
 async emit(type,event={}){for(const callback of this.listeners.get(type)||[])await callback(event);}
 replaceChildren(...nodes){this.children=[...nodes];this.textContent='';}
 append(...nodes){this.children.push(...nodes);}
 click(){return this.emit('click');}
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const snapshot=rows=>({size:rows.length,docs:rows.map((data,index)=>({id:'lesson-'+index,data:()=>data}))});
function dailyHarness(){
 const html=read('dashboard/admin/index.html');
 const required=['zadOpsDate','zadOpsStatus','zadOpsSummary','zadOpsRefresh','zadOpsCSV','zadOpsPrint','zadDailyOpsSection'];
 const elements=new Map(required.map(id=>{
   assert.match(html,new RegExp('id=["\']'+id+'["\']'),'Report control is present in the real admin page: '+id);
   return[id,new TestElement('div',id)];
 }));
 const auth={currentUser:null},requests=[],writes=[],events=[],blobs=[],downloads=[],printed=[];
 let allowed;
 const context={
  auth,db:{},cairoDay,followingDay,row,timeText,csvReport,LIMITS,Blob,
  guard:(role,callback)=>{assert.equal(role,'admin');allowed=callback;},
  collection:(_db,path)=>({path}),
  where:(field,op,value)=>({type:'where',field,op,value}),
  limit:value=>({type:'limit',value}),
  query:(collection,...constraints)=>({collection,constraints}),
  getDocs:query=>{const response=deferred();requests.push({query,...response});return response.promise;},
  document:{
   getElementById:id=>elements.get(id),
   createElement:tag=>{
    const node=new TestElement(tag);
    if(tag==='a')node.click=()=>downloads.push({href:node.href,name:node.download});
    return node;
   }
  },
  window:{
   dispatchEvent:event=>events.push({type:event.type,detail:JSON.parse(JSON.stringify(event.detail))}),
   open:()=>({document:{write:text=>printed.push(text),close(){}},focus(){},print(){}})
  },
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  URL:{createObjectURL:blob=>{blobs.push(blob);return'blob:test-'+blobs.length;},revokeObjectURL(){}},
  setTimeout:callback=>{callback();return 1;},
  console:{warn(){},error(){}}
 };
 // Any attempt to mutate data fails the behavioral test rather than being silently ignored.
 for(const name of ['addDoc','setDoc','updateDoc','deleteDoc','writeBatch','runTransaction'])context[name]=(...args)=>{writes.push({name,args});throw Error('Unexpected database mutation: '+name);};
 const source=read('dashboard/admin/daily-ops-admin.js').replace(/^import[^\n]+\n/gm,'');
 runInNewContext(source,context,{filename:'daily-ops-admin.js'});
 return {auth,requests,writes,events,blobs,downloads,printed,html,
  get:id=>elements.get(id),
  grant(uid='admin-1'){auth.currentUser={uid};allowed();}
 };
}

test('daily report uses existing controls and shortcuts navigate to the current admin sections',async()=>{
 const h=dailyHarness();h.grant();
 assert.match(h.html,/src=["'][^"']*daily-ops-admin\.js/);
 const targets={
  student:{tab:'users',sectionId:'usersManagement'},
  teachers:{tab:'users',sectionId:'teacherExamAccessAdmin'},
  attendance:{tab:'lessons',sectionId:'attendanceManagement',attendanceMode:'reports'}
 };
 for(const [shortcut,target]of Object.entries(targets)){
  assert.match(h.html,new RegExp('data-zad-ops-shortcut=["\']'+shortcut+'["\']'));
  assert.match(h.html,new RegExp('id=["\']'+target.sectionId+'["\']'));
  await h.get('zadDailyOpsSection').emit('click',{target:{closest:()=>({dataset:{zadOpsShortcut:shortcut}})}});
  assert.deepEqual(h.events.at(-1),{type:'zad:open-admin-tab',detail:target});
 }
 await h.get('zadDailyOpsSection').emit('click',{target:{closest:()=>({dataset:{zadOpsShortcut:'unknown'}})}});
 assert.equal(h.events.length,3);
 assert.equal(h.requests.length,0);assert.equal(h.writes.length,0);
});

test('report reads only after admin approval and a click, and requests one bounded calendar day',async()=>{
 const h=dailyHarness();
 await h.get('zadOpsRefresh').click();
 assert.equal(h.requests.length,0,'An unauthorised click must not read data');
 h.grant();
 assert.equal(h.requests.length,0,'Granting access alone must not query the database');
 h.get('zadOpsDate').value='2026-12-31';
 const loading=h.get('zadOpsRefresh').click();
 assert.equal(h.requests.length,1);
 assert.deepEqual(h.requests[0].query,{collection:{path:'lessons'},constraints:[
  {type:'where',field:'date',op:'>=',value:'2026-12-31'},
  {type:'where',field:'date',op:'<',value:'2027-01-01'},
  {type:'limit',value:LIMITS.lessons+1}
 ]});
 assert.equal(h.get('zadOpsRefresh').disabled,true);
 h.requests[0].resolve(snapshot([{title:'حصة اختبار',date:'2026-12-31T13:00',subject:'عربي'}]));
 await loading;
 assert.equal(h.get('zadOpsSummary').children.length,1);
 assert.match(h.get('zadOpsSummary').children[0].textContent,/حصة اختبار/);
 assert.equal(h.get('zadOpsCSV').disabled,false);
 assert.equal(h.writes.length,0);
});

test('invalid dates never start a request or enable exports',async()=>{
 const h=dailyHarness();h.grant();
 for(const day of ['','2026-02-31','tomorrow']){
  h.get('zadOpsDate').value=day;
  await h.get('zadOpsRefresh').click();
  assert.equal(h.requests.length,0);
  assert.match(h.get('zadOpsStatus').textContent,/تاريخًا صالحًا/);
  assert.equal(h.get('zadOpsCSV').disabled,true);
  assert.equal(h.get('zadOpsPrint').disabled,true);
 }
});

test('changing the selected date discards old responses and exports the newest day only',async()=>{
 const h=dailyHarness();h.grant();
 h.get('zadOpsDate').value='2026-11-24';
 const oldLoad=h.get('zadOpsRefresh').click();
 h.get('zadOpsDate').value='2026-11-25';
 await h.get('zadOpsDate').emit('change');
 assert.equal(h.get('zadOpsCSV').disabled,true);
 const newLoad=h.get('zadOpsRefresh').click();
 h.requests[1].resolve(snapshot([{title:'الحصة الجديدة',date:'2026-11-25T10:00'}]));await newLoad;
 h.requests[0].resolve(snapshot([{title:'الحصة القديمة',date:'2026-11-24T10:00'}]));await oldLoad;
 assert.equal(h.get('zadOpsSummary').children.length,1);
 assert.match(h.get('zadOpsSummary').children[0].textContent,/الحصة الجديدة/);
 await h.get('zadOpsCSV').click();
 assert.equal(h.downloads[0].name,'zad-lessons-2026-11-25.csv');
 assert.match(await h.blobs[0].text(),/الحصة الجديدة/);
 assert.doesNotMatch(await h.blobs[0].text(),/الحصة القديمة/);
 assert.equal(h.writes.length,0);
});

test('logout or switching accounts invalidates pending results and prevents export',async()=>{
 const h=dailyHarness();h.grant();
 h.get('zadOpsDate').value='2026-11-25';
 const pending=h.get('zadOpsRefresh').click();
 h.auth.currentUser={uid:'another-admin'};
 h.requests[0].resolve(snapshot([{title:'معلومات الحساب السابق',date:'2026-11-25T10:00'}]));await pending;
 assert.equal(h.get('zadOpsSummary').children.length,0);
 await h.get('zadOpsCSV').click();await h.get('zadOpsPrint').click();await h.get('zadOpsRefresh').click();
 assert.equal(h.downloads.length,0);assert.equal(h.printed.length,0);assert.equal(h.requests.length,1);
 h.auth.currentUser=null;
 await h.get('zadOpsRefresh').click();assert.equal(h.requests.length,1);
 assert.equal(h.writes.length,0);
});

test('failed requests leave exports disabled and allow a new attempt',async()=>{
 const h=dailyHarness();h.grant();h.get('zadOpsDate').value='2026-11-25';
 const failure=h.get('zadOpsRefresh').click();h.requests[0].reject(new Error('offline'));await failure;
 assert.match(h.get('zadOpsStatus').textContent,/تعذر/);
 assert.equal(h.get('zadOpsCSV').disabled,true);assert.equal(h.get('zadOpsPrint').disabled,true);
 assert.equal(h.get('zadOpsRefresh').disabled,false);
 const retry=h.get('zadOpsRefresh').click();h.requests[1].resolve(snapshot([]));await retry;
 assert.match(h.get('zadOpsStatus').textContent,/مفيش حصص/);
 assert.equal(h.requests.length,2);assert.equal(h.writes.length,0);
});

test('large snapshots stay bounded, hide unpublished/deleted lessons, and escape printable content',async()=>{
 const h=dailyHarness();h.grant();h.get('zadOpsDate').value='2026-11-25';
 const rows=Array.from({length:LIMITS.lessons+1},(_,index)=>Object.freeze({title:'درس '+index,date:'2026-11-25T12:00'}));
 rows[0]=Object.freeze({...rows[0],deleted:true});rows[1]=Object.freeze({...rows[1],published:false});
 rows[2]=Object.freeze({...rows[2],title:'<img src=x onerror=alert(1)>'});
 const pending=h.get('zadOpsRefresh').click();h.requests[0].resolve(snapshot(rows));await pending;
 assert.equal(h.get('zadOpsSummary').children.length,LIMITS.lessons-2);
 assert.match(h.get('zadOpsStatus').textContent,/محدود/);
 assert.equal(h.get('zadOpsSummary').children.some(node=>node.textContent.includes('درس '+LIMITS.lessons)),false);
 await h.get('zadOpsPrint').click();
 assert.match(h.printed[0],/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(h.printed[0],/<img src=x/);
 assert.equal(h.writes.length,0,'No grading, attendance, teacher, or other database records may be changed');
});
