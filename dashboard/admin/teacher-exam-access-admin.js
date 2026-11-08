// This operation is deliberate and admin-only; no automatic full collection scans.
// A single admin-managed index per teacher authorizes live results without copying exams.
import {auth,db} from '../../firebase-config.js';
import {collection,doc,getDocs,serverTimestamp,writeBatch} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const button=document.getElementById('syncTeacherExamAccess');
const status=document.getElementById('teacherExamAccessStatus');
const say=s=>{if(status)status.textContent=s;};
const text=v=>String(v??'').trim();
function eligible(row,origin){
 if(!row.studentUid||!row.teacherUid||row.deleted===true||row.archived===true)return false;
 if(origin==='booking'&&['مرفوض','ملغى','ملغي','rejected','cancelled','canceled'].includes(text(row.status).toLowerCase()))return false;
 return true;
}
async function syncAccess(){
 const user=auth.currentUser;
 if(!user){say('سجّل الدخول بحساب الإدارة أولًا.');return;}
 if(!confirm('سنقرأ حجوزات الطلاب والحضور مرة واحدة لإعداد صلاحيات المعلمين، وسيستهلك ذلك من حصة قراءات Firestore. هل تريد المتابعة؟'))return;
 button.disabled=true;
 try{
  say('جارٍ قراءة حجوزات الطلاب والحضور وسجل صلاحيات المعلمين...');
  const [bookings,attendance,old]=await Promise.all([
   getDocs(collection(db,'bookings')),
   getDocs(collection(db,'lessonAttendance')),
   getDocs(collection(db,'teacherExamStudentIndex'))
  ]);
  const edges=new Map();
  const add=(snap,origin,excludeStudentSet=null)=>{for(const d of snap.docs){const x=d.data();if(!eligible(x,origin))continue;
    const teacherUid=text(x.teacherUid),studentUid=text(x.studentUid);
    if(!teacherUid||!studentUid||teacherUid.includes('/')||studentUid.includes('/'))continue;
    if(excludeStudentSet?.has(studentUid))continue;
    const key=teacherUid+'|'+studentUid;
    if(!edges.has(key))edges.set(key,{teacherUid,studentUid});
  }};
  // A current booking supersedes historic attendance; this prevents a former
  // teacher from retaining access after the student has changed instructors.
  add(bookings,'booking');
  const enrolled=new Set([...edges.values()].map(x=>x.studentUid));
  add(attendance,'attendance',enrolled);
  if(!bookings.size&&!attendance.size&&old.empty){say('لا توجد بيانات ربط أو صلاحيات سابقة. لم تتغيّر أي صلاحيات.');return;}
  if(!bookings.size&&!attendance.size&&!confirm('لا توجد أي حجوزات أو حصص الآن. سيؤدي الاستمرار إلى إلغاء كل روابط المعلمين القديمة. هل هذا مقصود؟'))return;
  const byTeacher=new Map();for(const {teacherUid,studentUid} of edges.values()){
   if(!byTeacher.has(teacherUid))byTeacher.set(teacherUid,new Set());
   byTeacher.get(teacherUid).add(studentUid);
  }
  const existing=new Map(old.docs.map(d=>[d.id,d.data()]));
  const allTeachers=new Set([...byTeacher.keys(),...existing.keys()]);
  const changes=[];
  for(const teacherUid of allTeachers){
   const uids=[...(byTeacher.get(teacherUid)||[])].sort();
   if(uids.length>1000)throw Error('عدد الطلاب المرتبطين بمعلم واحد يتجاوز 1000؛ يلزم تقسيم الفهرس.');
   const prior=existing.get(teacherUid);
   const same=prior?.teacherUid===teacherUid&&JSON.stringify((prior.studentUids||[]).slice().sort())===JSON.stringify(uids);
   if(!same)changes.push({teacherUid,studentUids:uids});
  }
  say(`ارتباطات صحيحة: ${edges.size} بين ${byTeacher.size} معلمًا. يلزم تعديل ${changes.length} سجل صلاحيات.`);
  if(!changes.length){say('✅ صلاحيات نتائج المعلمين متزامنة بالفعل. النتائج الجديدة تظهر تلقائيًا بعد تسليمها.');return;}
  if(!confirm(`هل تعتمد تحديث ${changes.length} فهرس معلم؟ تُلغى تلقائيًا ارتباطات المعلمين القدامى غير الموجودة في الحجوزات الحالية.`))return;
  let done=0;
  for(let i=0;i<changes.length;i+=350){const batch=writeBatch(db);
   for(const x of changes.slice(i,i+350)){
    batch.set(doc(db,'teacherExamStudentIndex',x.teacherUid),{
     teacherUid:x.teacherUid,studentUids:x.studentUids,count:x.studentUids.length,
     updatedBy:user.uid,updatedAt:serverTimestamp()
    });
   }
   await batch.commit();done+=Math.min(350,changes.length-i);
   say(`جارٍ اعتماد صلاحيات المعلمين: ${done} من ${changes.length}...`);
  }
  say(`✅ تم الربط: ${edges.size} ارتباطًا بين ${byTeacher.size} معلمًا وطلابهم. النتائج وتعديلات الدرجات تظهر مباشرة دون نسخها. أعد مزامنة الارتباطات عند نقل أي طالب.`);
 }catch(error){console.error('teacher exam index',error);say('❌ تعذر مزامنة الصلاحيات: '+(error.code||error.message)+'. حاول مرة أخرى بعد علاج السبب.');}
 finally{button.disabled=false;}
}
button?.addEventListener('click',syncAccess);
