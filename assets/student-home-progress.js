import {studentHomeSummary} from './student-home-progress-core.js';
const root=document.getElementById('zadStudentProgress');
const resultSources=['codeExamResults','unitOneExamAttempts','zad_exam_submissions'];
const number=new Intl.NumberFormat('ar-EG');
const node=(tag,content,className)=>{const element=document.createElement(tag);if(content!==undefined)element.textContent=content;if(className)element.className=className;return element;};
let sdk=null,connection=null,unsubscribe=null,generation=0,loading=false,currentUser=null,metaPromise=null;
const active=(sequence,uid)=>sequence===generation&&sdk?.auth.currentUser?.uid===uid;
if(root){root.classList.add('zad-home-progress','zad-discovery');showMessage('جارٍ التحقق من حسابك…','loading');connect();}
function base(title='تقدمك في زاد المعرفة',description='ملخص من سجلات حسابك، بتوقيت القاهرة.'){
  root.replaceChildren();const header=node('header',undefined,'zad-discovery-head'),copy=node('div');
  copy.append(node('p','حسابك الدراسي','zad-discovery-kicker'));const heading=node('h2',title);heading.id='zadStudentProgressTitle';copy.append(heading,node('p',description,'zad-discovery-description'));header.append(copy);root.append(header);return header;
}
function link(text,href,secondary=false){const element=node('a',text,'zad-discovery-button'+(secondary?' secondary':''));element.href=href;return element;}
function refreshButton(header){const button=node('button','تحديث البيانات','zad-discovery-button secondary');button.type='button';button.disabled=loading;button.addEventListener('click',()=>sdk?loadUser(sdk.auth.currentUser):connect());header.append(button);}
function showMessage(message,state){const header=base();const status=node('p',message,'zad-discovery-status');status.setAttribute('role','status');root.append(status);root.dataset.state=state;root.setAttribute('aria-busy',state==='loading'?'true':'false');
  if(state==='signed-out'){const actions=node('div',undefined,'zad-discovery-actions');actions.append(link('تسجيل الدخول','login/index.html'),link('إنشاء حساب','login/register.html',true));root.append(actions);}
  if(state==='error')refreshButton(header);
}
function deadline(promise,ms=14000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),ms);})]).finally(()=>clearTimeout(timer));}
async function examMetadata(){if(!metaPromise)metaPromise=deadline(fetch(new URL('./search-index.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('metadata');return r.json();}).then(data=>new Map((data.records||[]).filter(x=>x.type==='exam').map(x=>[x.id,x.title]))),7000).catch(()=>new Map());return metaPromise;}
async function connect(){if(connection)return connection;showMessage('جارٍ الاتصال بحسابك…','loading');connection=(async()=>{
  try{const [config,authApi,firestore]=await deadline(Promise.all([import('../firebase-config.js'),import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')]));if(!config.FIREBASE_READY||!config.auth||!config.db)throw Error('configuration');sdk={...config,...authApi,...firestore};if(unsubscribe)unsubscribe();unsubscribe=sdk.onAuthStateChanged(sdk.auth,user=>{currentUser=user;loadUser(user);},()=>{loading=false;showMessage('تعذر التحقق من الجلسة. أعد المحاولة.','error');});}
  catch{sdk=null;loading=false;showMessage('تعذر الاتصال بخدمة الحساب. جرّب التحديث؛ يمكنك متابعة التصفح والبحث.','error');}
  finally{connection=null;}
})();return connection;}
async function loadUser(user){const sequence=++generation;currentUser=user;loading=true;if(!user){loading=false;showMessage('سجّل الدخول لعرض حضورك ونتائجك المسجلة، وآخر حصة حضرتها.','signed-out');return;}showMessage('جارٍ تحميل سجلات حسابك…','loading');
  const uid=user.uid,read=source=>deadline(sdk.getDocsFromServer(sdk.query(sdk.collection(sdk.db,source),sdk.where('studentUid','==',uid))));
  let profile;
  try{const snapshot=await deadline(sdk.getDocFromServer(sdk.doc(sdk.db,'users',uid)));if(!active(sequence,uid))return;profile=snapshot.data()||{};}
  catch{if(active(sequence,uid)){loading=false;showMessage('تعذر قراءة ملف حسابك. أعد المحاولة لتحديث ملخص الطالب.','error');}return;}
  if(profile.role&&profile.role!=='student'){loading=false;const header=base('أهلًا '+(profile.fullName||user.displayName||'بك'),'ملخص الحضور والنتائج مخصص لحسابات الطلاب.');root.dataset.state='other-role';root.setAttribute('aria-busy','false');root.append(link('فتح حسابك',profile.role==='admin'?'dashboard/admin/index.html':'dashboard/teacher/index.html'));return;}
  const values=await Promise.allSettled([read('lessonAttendance'),...resultSources.map(read)]);if(!active(sequence,uid))return;
  const attendanceOk=values[0].status==='fulfilled',resultsOk=values.slice(1).every(x=>x.status==='fulfilled');
  const docs=result=>result.status==='fulfilled'?result.value.docs.filter(item=>!item.metadata.hasPendingWrites).map(item=>({...item.data(),id:item.id})):[];
  const resultData=Object.fromEntries(resultSources.map((source,index)=>[source,docs(values[index+1])]));
  const data=studentHomeSummary({uid,attendance:docs(values[0]),results:resultData});
  const titles=await examMetadata();if(!active(sequence,uid))return;loading=false;
  const name=String(profile.fullName||user.displayName||'بك').trim().split(/\s+/).slice(0,3).join(' ');const header=base('أهلًا '+name+'، هذه متابعتك',`الأسبوع من ${data.week.start} إلى ${data.week.end} · توقيت القاهرة`);refreshButton(header);root.setAttribute('aria-busy','false');root.dataset.state=attendanceOk&&resultsOk?'ready':'partial-error';
  const grid=node('div',undefined,'zad-home-progress-grid');
  function card(title,value,description,href,label){const article=node('article',undefined,'zad-home-progress-card');article.append(node('h3',title),node('strong',value,'zad-home-progress-value'),node('p',description,'zad-discovery-description'));if(href)article.append(link(label,href,true));grid.append(article);return article;}
  card('حضورك هذا الأسبوع',attendanceOk?number.format(data.present)+' حصة':'تعذر التحميل',attendanceOk?(data.weeklyRecords?`حضور مسجل من الإدارة · غياب ${number.format(data.absent)} · اعتذار ${number.format(data.excused)}`:'لا توجد سجلات حضور أو غياب لهذا الأسبوع حتى الآن.'):'لم نتمكن من قراءة سجلات الحضور. لا تعني هذه الحالة عدم وجود حضور.','dashboard/student/index.html?tab=attendance','سجل الحضور');
  const exam=data.lastApproved;let examTitle=exam?.examTitle||'';if(exam&&!examTitle){const prefix=exam.collection==='unitOneExamAttempts'?'unit-one-exam.html:':exam.collection==='zad_exam_submissions'?'zad-special-exam.html:':'';examTitle=titles.get(prefix+exam.examId)||'امتحان إلكتروني';}
  card(data.approvedUndated?'نتيجة معتمدة':'آخر نتيجة معتمدة',!resultsOk?'تعذر التحميل':exam?`${number.format(exam.score)} / ${number.format(exam.total)}`:'لا توجد نتيجة معتمدة',!resultsOk?'تعذر تحميل بعض مصادر النتائج؛ حدّث البيانات لعرض آخر نتيجة صحيحة.':exam?examTitle+(data.approvedUndated?' · توجد نتائج قديمة بلا تاريخ.':''):'تظهر هنا الدرجات المعتمدة بعد مراجعة الإدارة. النتائج الأولية متاحة في حسابك.','dashboard/student/index.html?tab=progress','عرض النتائج');
  const last=data.lastAttendance;card('آخر حصة حضرتها',!attendanceOk?'تعذر التحميل':last?(last.subject||last.lessonTitle||'حصة مسجلة'):'لا توجد حصة مسجلة',!attendanceOk?'تعذر قراءة سجل آخر حصة.':last?[last.day,last.teacherName].filter(Boolean).join(' · '):'تظهر آخر حصة سجّلت الإدارة حضورك فيها.','dashboard/student/index.html?tab=attendance','تفاصيل الحضور');root.append(grid);
  const status=node('p',attendanceOk&&resultsOk?'حُدِّثت البيانات من حسابك. فتح كتاب أو رابط لا يُحتسب إكمالًا لدرس.':'تعذر تحديث جزء من البيانات. الأجزاء المحمّلة فقط معروضة؛ جرّب التحديث.','zad-discovery-note');status.setAttribute('role','status');root.append(status);
}
window.addEventListener('pagehide',()=>{generation++;unsubscribe?.();unsubscribe=null;});

window.addEventListener('pageshow',event=>{if(event.persisted&&root)connect();});
