import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,updateDoc,writeBatch,serverTimestamp,arrayUnion} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {advanceSnapshot} from '../advance-credit.js';
import {amountPaid,amountDue} from '../payment-utils.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/^(الأستاذ|أستاذ|مستر|ميس|أ\/)\s*/i,'').replace(/\s+/g,' ').trim().toLowerCase();
const say=s=>{if($('zadLinkStatus'))$('zadLinkStatus').textContent=s};
const current={teachers:[],attendance:[],bookings:[],payments:[],signature:'',plan:null,loaded:false};

function aliasMatches(row,alias){return normalize(row.teacherName)===normalize(alias)}
async function retrieve(){
 $('zadLinkApply').hidden=true;current.plan=null;current.loaded=false;
 say('جارٍ قراءة حسابات المعلمين والحضور والحجوزات والتحويلات المعتمدة...');
 try{
  const [u,a,b,p]=await Promise.all([
   getDocs(collection(db,'users')),getDocs(collection(db,'lessonAttendance')),getDocs(collection(db,'bookings')),getDocs(collection(db,'vodafonePayments'))
  ]);
  current.teachers=u.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.role==='teacher'&&x.status==='active');
  current.attendance=a.docs.map(d=>({id:d.id,...d.data()}));
  current.bookings=b.docs.map(d=>({id:d.id,...d.data()}));
  current.payments=p.docs.map(d=>({id:d.id,...d.data()}));
  const t=$('zadLinkTeacher'),prev=t.value;
  t.innerHTML='<option value="">اختر المعلم المعتمد</option>'+current.teachers.map(x=>`<option value="${esc(x.id)}">${esc(x.fullName||x.name||x.email||x.id)}</option>`).join('');
  if(current.teachers.some(x=>x.id===prev))t.value=prev;
  const aliases=[...new Set([...current.attendance,...current.bookings].map(x=>String(x.teacherName||'').trim()).filter(x=>x&&!['غير محدد','الإدارة','لم يُعيّن'].includes(x)))].sort((a,b)=>a.localeCompare(b,'ar'));
  const d=$('zadLinkAlias'),old=d.value;
  d.innerHTML='<option value="">اختر الاسم من سجلات الإدارة</option><option value="__SYNC_ONLY__">مزامنة الأرصدة فقط للحصص المرتبطة بالفعل</option>'+aliases.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  if(aliases.includes(old)||old==='__SYNC_ONLY__')d.value=old;
  current.loaded=true;
  say(`تم تحميل ${current.teachers.length} معلمًا، ${current.attendance.length} حصة، ${current.bookings.length} حجزًا. اختر المعلم والاسم ثم راجع النتائج.`);
 }catch(e){say('❌ فشل تحميل بيانات الإدارة: '+(e.code||e.message));console.error(e)}
}
function buildPlan(){
 if(!current.loaded)throw Error('لم تُحمّل بيانات الإدارة كاملة.');
 const uid=$('zadLinkTeacher').value,alias=$('zadLinkAlias').value;
 const teacher=current.teachers.find(t=>t.id===uid);
 if(!teacher||!alias)throw Error('اختر حساب المعلم والاسم المسجل أولًا.');
 if(alias!=='__SYNC_ONLY__'&&/[،,]/.test(alias))throw Error('اسم السجل يشمل أكثر من معلم. لا يمكن نسب حصة مشتركة أو قيمتها لمعلم واحد تلقائيًا؛ راجعها يدويًا في الإدارة.');
 const syncOnly=alias==='__SYNC_ONLY__';
 const potential=syncOnly?[]:[...current.teachers.filter(x=>[x.fullName,x.name,x.displayName,...(Array.isArray(x.attendanceAliases)?x.attendanceAliases:[])].some(n=>normalize(n)===normalize(alias)))];
 if(potential.some(x=>x.id!==uid))throw Error('الاسم المحدد مرتبط بمعلم آخر. لا يمكن ربطه بحسابين.');
 const lessons=syncOnly?[]:current.attendance.filter(x=>aliasMatches(x,alias));
 const bookings=syncOnly?[]:current.bookings.filter(x=>aliasMatches(x,alias));
 const conflict=[...lessons,...bookings].filter(x=>x.teacherUid&&x.teacherUid!==uid);
 if(conflict.length)throw Error(`يوجد ${conflict.length} سجلًا مرتبطًا بمعلم آخر بالفعل، لذلك تم إيقاف العملية لحماية البيانات.`);
 const linkLessons=lessons.filter(x=>x.teacherUid!==uid),linkBookings=bookings.filter(x=>x.teacherUid!==uid);
 const allTeacherLessons=current.attendance.filter(x=>x.teacherUid===uid||linkLessons.some(l=>l.id===x.id));
 return {teacher,uid,alias,syncOnly,lessons,bookings,linkLessons,linkBookings,allTeacherLessons};
}
function preview(){
 $('zadLinkApply').hidden=true;current.plan=null;$('zadLinkDetails').innerHTML='';
 try{
  const plan=buildPlan();
  const examples=[...plan.linkLessons.map(x=>({type:'حصة',name:x.studentName||x.studentUid,date:x.date,id:x.id})),...plan.linkBookings.map(x=>({type:'حجز',name:x.fullName||x.studentName||x.studentUid,date:x.createdAt?.toDate?.()?.toLocaleDateString('ar-EG')||'',id:x.id}))];
  $('zadLinkDetails').innerHTML='<table class="table"><thead><tr><th>النوع</th><th>الطالب</th><th>التاريخ</th><th>معرف السجل</th></tr></thead><tbody>'+examples.slice(0,100).map(x=>`<tr><td>${esc(x.type)}</td><td>${esc(x.name)}</td><td>${esc(x.date)}</td><td dir="ltr">${esc(x.id)}</td></tr>`).join('')+'</tbody></table>';
  say(`المعلم: ${plan.teacher.fullName||plan.teacher.name}\nالاسم المسجل: ${plan.alias}\nحصص تحتاج ربطًا: ${plan.linkLessons.length}\nحجوزات تحتاج ربطًا: ${plan.linkBookings.length}\nإجمالي حصص المعلم التي ستُراجع أرصدتها: ${plan.allTeacherLessons.length}\nالعملية لا تغير أسعار الحصص أو التحصيل أو الحضور. راجع الطلب جيدًا قبل الاعتماد.`);
  current.plan=plan;$('zadLinkApply').hidden=false;
 }catch(e){say('⚠️ '+e.message)}
}
async function commit(){
 const prior=current.plan;
 if(!prior){say('اضغط «مراجعة السجلات» أولًا.');return;}
 let fresh;
 try{fresh=buildPlan()}catch(e){say(e.message);return;}
 if(fresh.uid!==prior.uid||fresh.alias!==prior.alias||fresh.linkLessons.length!==prior.linkLessons.length||fresh.linkBookings.length!==prior.linkBookings.length){say('تغيرت الاختيارات؛ أعد المراجعة.');return;}
 const count=fresh.linkLessons.length+fresh.linkBookings.length;
 if(!confirm(`تأكيد ربط ${count} سجلًا بالمعلم «${fresh.teacher.fullName||fresh.teacher.name}»، مع تحديث عرض المقدم المخصص للحصص؟\nلا يُغيَّر مبلغ الحصة ولا المبلغ المدفوع.`))return;
 const btn=$('zadLinkApply');btn.disabled=true;
 try{
  // Verify currently stored ownership before any batch.
  for(const x of [...fresh.linkLessons.map(x=>({...x,_type:'lessonAttendance'})),...fresh.linkBookings.map(x=>({...x,_type:'bookings'}))]){
   const d=await getDoc(doc(db,x._type,x.id));
   if(!d.exists()||d.data().teacherUid&&d.data().teacherUid!==fresh.uid||!aliasMatches(d.data(),fresh.alias))throw Error('تغيرت بيانات أحد السجلات خلال المراجعة. أعد التحميل لتجنب ربط خاطئ.');
  }
  const updates=[];
  for(const x of fresh.linkLessons)updates.push({ref:doc(db,'lessonAttendance',x.id),data:{teacherUid:fresh.uid,teacherLinkedByUid:auth.currentUser.uid,teacherLinkedAt:serverTimestamp()}});
  for(const x of fresh.linkBookings)updates.push({ref:doc(db,'bookings',x.id),data:{teacherUid:fresh.uid,teacherLinkedByUid:auth.currentUser.uid,teacherLinkedAt:serverTimestamp()}});
  const existingAliases=(Array.isArray(fresh.teacher.attendanceAliases)?fresh.teacher.attendanceAliases:[]);
  if(!fresh.syncOnly&&!existingAliases.some(x=>normalize(x)===normalize(fresh.alias)))updates.push({ref:doc(db,'users',fresh.uid),data:{attendanceAliases:arrayUnion(fresh.alias)}});
  // Fresh read at commit time: never derive an allocation from a stale preview.
  const [freshAttendanceSnap,freshPaymentsSnap]=await Promise.all([
   getDocs(collection(db,'lessonAttendance')),getDocs(collection(db,'vodafonePayments'))
  ]);
  const liveAttendance=freshAttendanceSnap.docs.map(d=>({id:d.id,...d.data()}));
  const livePayments=freshPaymentsSnap.docs.map(d=>({id:d.id,...d.data()}));
  const newlyLinkedIds=new Set(fresh.linkLessons.map(x=>x.id));
  const liveTeacherLessons=liveAttendance.filter(x=>x.teacherUid===fresh.uid||newlyLinkedIds.has(x.id));
  // Advance is calculated across all teachers and all active lessons, as in admin accounts.
  const byStudent=new Map();
  for(const x of liveAttendance){if(!x.studentUid)continue;const rows=byStudent.get(x.studentUid)||[];rows.push(x);byStudent.set(x.studentUid,rows)}
  const payments=new Map();
  for(const x of livePayments){if(!x.studentUid)continue;const arr=payments.get(x.studentUid)||[];arr.push(x);payments.set(x.studentUid,arr)}
  const creditPerLesson=new Map();
  for(const [uid,lessons] of byStudent){const snap=advanceSnapshot(lessons,payments.get(uid)||[]);for(const [id,c] of snap.byLesson)creditPerLesson.set(id,c.advanceAppliedPiastres||0)}
  for(const x of liveTeacherLessons){
   const max=Math.max(0,amountDue(x)-amountPaid(x));
   updates.push({ref:doc(db,'lessonAttendance',x.id),data:{teacherAdvanceAppliedPiastres:Math.min(max,creditPerLesson.get(x.id)||0),teacherFinanceSyncedAt:serverTimestamp()}});
  }
  // Merge repeated updates to a single lesson (link + finance snapshot).
  const merged=new Map();
  for(const u of updates){const k=u.ref.path;const old=merged.get(k);merged.set(k,{ref:u.ref,data:{...(old?.data||{}),...u.data}})}
  const jobs=[...merged.values()];
  // Only metadata + derived per-lesson allocation is written. 350 operations per atomic chunk.
  let completed=0;
  for(let start=0;start<jobs.length;start+=350){
   const batch=writeBatch(db);
   for(const u of jobs.slice(start,start+350))batch.update(u.ref,u.data);
   await batch.commit();completed+=Math.min(350,jobs.length-start);
   say(`جارٍ اعتماد الربط ومراجعة أرصدة العرض: ${completed} / ${jobs.length}`);
  }
  say(`✅ تم تنفيذ ${jobs.length} عملية ربط/مراجعة. لا توجد تغييرات على أسعار الحصص أو مبالغ السداد. ادخل لوحة المعلم بالحساب الحقيقي لاختبار صلاحيات القراءة.`);
  $('zadLinkApply').hidden=true;current.plan=null;
  window.dispatchEvent(new Event('zad:attendance-changed'));
  await retrieve();
 }catch(e){say('❌ تعذر إكمال الربط: '+(e.code||e.message)+' — قد تكون بعض دفعات الكتابة نُفذت بالفعل، اضغط تحديث وراجع السجلات قبل تكرار العملية.');console.error(e)}
 finally{btn.disabled=false}
}

$('zadLinkPreview')?.addEventListener('click',preview);
$('zadLinkApply')?.addEventListener('click',commit);
$('zadLinkRefresh')?.addEventListener('click',retrieve);
$('zadLinkTeacher')?.addEventListener('change',()=>{$('zadLinkApply').hidden=true;current.plan=null});
$('zadLinkAlias')?.addEventListener('change',()=>{$('zadLinkApply').hidden=true;current.plan=null});
onAuthStateChanged(auth,async user=>{
 if(!user)return;
 try{
  const [ad,u]=await Promise.all([getDoc(doc(db,'admins',user.uid)),getDoc(doc(db,'users',user.uid))]);
  if(ad.exists()||u.data()?.role==='admin'||user.email?.toLowerCase()==='maleksameh121@gmail.com')await retrieve();
 }catch(e){say('لا يمكن التحقق من صلاحية الإدارة: '+(e.code||e.message))}
});
