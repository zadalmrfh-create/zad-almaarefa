// ZAD | Admin-only reconciliation of historical student UIDs.
// Never infer ownership by similar names. Require matching student-profile emails and an explicit admin decision.
import {auth, db} from '../../firebase-config.js';
import {
  collection, doc, getDoc, getDocs, query, where,
  writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const source = $('zadRepairSourceUid');
const target = $('zadRepairTargetUid');
const previewButton = $('zadRepairPreview');
const migrateButton = $('zadRepairApply');
const refreshButton = $('zadRepairReload');
const report = $('zadRepairReport');
let people = [];
let lastPreview = null;
let busy = false;
const normalized = v => String(v || '').trim().toLowerCase();
const label = u => String(u?.fullName || u?.name || u?.email || 'طالب');
const status = message => {if (report) report.textContent = message;};
function setBusy(value) {
  busy = value;
  for (const button of [previewButton,migrateButton,refreshButton]) if(button) button.disabled = value;
  if (source) source.disabled = value;
  if (target) target.disabled = value;
}

async function checkAdmin() {
  const admin=auth.currentUser;
  if (!admin) throw new Error('يجب تسجيل الدخول بحساب الأدمن.');
  const [flag,profile] = await Promise.all([
    getDoc(doc(db,'admins',admin.uid)),getDoc(doc(db,'users',admin.uid))
  ]);
  if (!(flag.exists() || profile.data()?.role === 'admin' || (admin.email === 'maleksameh121@gmail.com' && admin.emailVerified))) {
    throw new Error('لا تملك صلاحية إصلاح سجلات الطلاب.');
  }
  return admin;
}

async function reloadPeople() {
  if (busy) return;
  setBusy(true);
  lastPreview=null;
  try {
    await checkAdmin();
    const snap = await getDocs(collection(db,'users'));
    people = snap.docs.map(d=>({id:d.id,...d.data()}))
      .filter(x=>x.role==='student')
      .sort((a,b)=>label(a).localeCompare(label(b),'ar'));
    const previous=source.value;
    source.replaceChildren(new Option('اختر الحساب الذي سُجّلت عليه الحصص بالخطأ',''),...people.map(p=>{
      const duplicates=people.filter(x=>normalized(x.email)===normalized(p.email)).length;
      const marker=duplicates>1?' ⚠️ بريد مكرر':'';
      return new Option(label(p)+' — '+(p.email||'بدون بريد')+' — UID: '+p.id+marker,p.id);
    }));
    if(people.some(p=>p.id===previous))source.value=previous;
    status('اختر الحساب القديم، ثم الصق UID الحساب الحقيقي من صفحة الطالب، واضغط «فحص السجلات».\nلا تعتمد على تشابه الاسم فقط.');
  } catch(e) {status('تعذر تحميل الحسابات: '+(e.code||e.message));}
  finally {setBusy(false);}
}

// Gather every legacy account that has exactly the same registered email as
// the selected source and the target. Never use name similarity for ownership.
async function getReconciliation(oldUid,newUid) {
  await checkAdmin();
  if (!oldUid || !newUid || oldUid === newUid) {
    throw new Error('اختر حسابًا قديمًا وUID حقيقيًا مختلفًا.');
  }
  if ([oldUid,newUid].some(id=>id.includes('/') || id.length > 256)) {
    throw new Error('UID غير صالح.');
  }
  const [oldDoc,newDoc] = await Promise.all([
    getDoc(doc(db,'users',oldUid)),getDoc(doc(db,'users',newUid))
  ]);
  if (!oldDoc.exists() || !newDoc.exists()) {
    throw new Error('حساب من الحسابين غير موجود في users؛ راجع UID.');
  }
  const old=oldDoc.data(),actual=newDoc.data();
  if (old.role !== 'student' || actual.role !== 'student') {
    throw new Error('يمكن إصلاح حسابات الطلاب فقط.');
  }
  // Exact match is deliberate: the published Firestore rules require it too.
  if (!old.email || !actual.email || old.email !== actual.email) {
    throw new Error('حماية خصوصية الطلاب: البريد المسجل في الحساب القديم والجديد غير متطابق حرفيًا. لا يتم النقل بالاسم فقط.');
  }
  // Refresh profiles before every preview/commit, not only from a cached menu.
  const fresh=await getDocs(collection(db,'users'));
  const candidates=fresh.docs.map(d=>({uid:d.id,...d.data()}))
    .filter(p=>p.uid!==newUid && p.role==='student' && p.email===actual.email);
  if (!candidates.some(p=>p.uid===oldUid)) {
    throw new Error('الحساب القديم لم يعد ضمن الحسابات المطابقة. حدّث قائمة الحسابات.');
  }
  if (candidates.length > 25) throw new Error('عدد حسابات البريد المكرر كبير وغير متوقع؛ راجع الإدارة أولًا.');
  for (const p of candidates) {
    if (p.linkedToUid && p.linkedToUid !== newUid) {
      throw new Error('الحساب '+p.uid+' مربوط مسبقًا بحساب آخر؛ أُوقفت العملية.');
    }
  }
  const sources=[];
  const attendance=[];
  const payments=[];
  for (const p of candidates) {
    const [att,pay]=await Promise.all([
      getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',p.uid))),
      getDocs(query(collection(db,'vodafonePayments'),where('studentUid','==',p.uid)))
    ]);
    sources.push({uid:p.uid,profile:p,attendanceCount:att.size,paymentCount:pay.size});
    for (const snap of att.docs) attendance.push({snap,oldUid:p.uid});
    for (const snap of pay.docs) payments.push({snap,oldUid:p.uid});
  }
  const [destinationAttendance,destinationPayments]=await Promise.all([
    getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',newUid))),
    getDocs(query(collection(db,'vodafonePayments'),where('studentUid','==',newUid)))
  ]);
  return {oldUid,newUid,old,actual,sources,attendance,payments,
    destinationAttendance:destinationAttendance.size,
    destinationPayments:destinationPayments.size};
}

function describe(result) {
  const approved=result.payments.filter(d=>d.snap.data().status==='approved').length;
  const pending=result.payments.filter(d=>d.snap.data().status==='pending').length;
  const accounts=result.sources.map(s=>
    '• '+label(s.profile)+' | UID: '+s.uid+' | '+s.attendanceCount+' حصة، '+s.paymentCount+' تحويل'
  ).join('\n');
  return [
    '✅ تم التحقق من تطابق البريد حرفيًا: '+result.actual.email,
    'الحساب الحقيقي: '+label(result.actual)+' | UID: '+result.newUid,
    'الحسابات القديمة المطابقة لنفس البريد ('+result.sources.length+'):',
    accounts,
    'إجمالي الحصص القديمة المطلوب ربطها: '+result.attendance.length,
    'إجمالي التحويلات القديمة: '+result.payments.length+' (معتمدة: '+approved+'، معلّقة: '+pending+')',
    'الحصص المسجلة بالفعل على UID الحقيقي: '+result.destinationAttendance,
    'التحويلات المسجلة بالفعل على UID الحقيقي: '+result.destinationPayments,
    'الحصص التي سبق تصحيحها على الحساب الحقيقي لن تتكرر؛ سيتم تعديل UID السجلات القديمة في أماكنها فقط.',
    'لا تغيير في تاريخ أو سعر حصة، ولا حالة دفع أو مرجع تحويل.',
    '⚠️ يجب أن يكون UID الحقيقي مأخوذًا من جلسة دخول الطالب نفسه. راجع التقرير قبل التأكيد.'
  ].join('\n');
}

async function preview() {
  if(busy)return;
  setBusy(true);
  lastPreview=null;
  migrateButton.hidden=true;
  try {
    const data=await getReconciliation(source.value,target.value.trim());
    lastPreview=data;
    status(describe(data));
    if(data.attendance.length||data.payments.length)migrateButton.hidden=false;
  }catch(e){status('❌ '+(e.code||e.message));}
  finally{setBusy(false);}
}

async function migrate() {
  if(busy || !lastPreview)return;
  setBusy(true);
  try {
    const data=await getReconciliation(source.value,target.value.trim());
    if(data.oldUid!==lastPreview.oldUid || data.newUid!==lastPreview.newUid) {
      throw new Error('الحساب المختار تغير؛ افحص البيانات من جديد.');
    }
    const key=x=>x.oldUid+'/'+x.snap.id;
    for (const kind of ['attendance','payments']) {
      const before=new Set(lastPreview[kind].map(key));
      const now=new Set(data[kind].map(key));
      if(before.size!==now.size || [...before].some(id=>!now.has(id))) {
        throw new Error('تغيرت السجلات بعد الفحص؛ أعد المعاينة قبل النقل.');
      }
    }
    const total=data.attendance.length+data.payments.length;
    if(!total){
      status('✅ كل الحصص والتحويلات المعروفة موجودة بالفعل على UID الحقيقي، ولا توجد سجلات قديمة لنقلها.');
      migrateButton.hidden=true;return;
    }
    const choice=window.prompt(
      'تأكيد نقل ربط '+data.attendance.length+' حصة و'+data.payments.length+
      ' تحويل من '+data.sources.length+' حساب قديم إلى UID الحقيقي '+data.newUid+
      '.\nلن يتم إنشاء حصص أو تحويلات جديدة. اكتب «نقل» للتأكيد:', ''
    );
    if(choice?.trim()!=='نقل'){
      status('تم إلغاء العملية دون تغيير أي سجل.');return;
    }
    const admin=await checkAdmin();
    const entries=[
      ...data.attendance.map(x=>({kind:'attendance',...x})),
      ...data.payments.map(x=>({kind:'payment',...x}))
    ];
    let moved=0,attendanceMoved=0,paymentMoved=0;
    // Small batches keep security-rule reads below Firestore limits.
    for (let i=0;i<entries.length;i+=4) {
      const chunk=entries.slice(i,i+4);
      const batch=writeBatch(db);
      for (const item of chunk) {
        if(item.snap.data().studentUid !== item.oldUid) {
          throw new Error('سجل تغيّر ارتباطه أثناء العملية.');
        }
        batch.update(item.snap.ref,{
          studentUid:data.newUid,
          studentName:label(data.actual),
          relinkFromUid:item.oldUid,
          relinkedBy:admin.uid,
          relinkedAt:serverTimestamp()
        });
      }
      batch.set(doc(collection(db,'auditLogs')),
        {action:'student-record-uid-repair',sourceUids:[...new Set(chunk.map(x=>x.oldUid))],
          targetUid:data.newUid,studentEmail:data.actual.email,
          attendanceIds:chunk.filter(x=>x.kind==='attendance').map(x=>x.snap.id),
          paymentIds:chunk.filter(x=>x.kind==='payment').map(x=>x.snap.id),
          performedByUid:admin.uid,createdAt:serverTimestamp()});
      await batch.commit();
      moved+=chunk.length;
      attendanceMoved+=chunk.filter(x=>x.kind==='attendance').length;
      paymentMoved+=chunk.filter(x=>x.kind==='payment').length;
      status('✅ تم تصحيح '+moved+' من '+total+' سجل. لا تغلق الصفحة حتى ظهور رسالة الاكتمال.');
    }
    // Mark every legacy profile as linked. Future attendance selectors exclude it.
    for(let i=0;i<data.sources.length;i+=4){
      const chunk=data.sources.slice(i,i+4);
      const batch=writeBatch(db);
      for(const account of chunk){
        batch.update(doc(db,'users',account.uid),{
          linkedToUid:data.newUid,linkedAt:serverTimestamp(),linkedBy:admin.uid
        });
      }
      batch.set(doc(collection(db,'auditLogs')),
        {action:'student-account-uid-repair-complete',
          sourceUids:chunk.map(x=>x.uid),targetUid:data.newUid,
          studentEmail:data.actual.email,attendanceMoved,paymentMoved,
          performedByUid:admin.uid,createdAt:serverTimestamp()});
      await batch.commit();
    }
    status('✅ اكتمل الإصلاح: '+attendanceMoved+' حصة و'+paymentMoved+
      ' تحويل رُبطت بحساب الطالب الصحيح. الحسابات القديمة تم تعطيل اختيارها في تسجيل الحضور الجديد.\n'+
      'افتح لوحة الطالب وراجع السجلات، ولا تنشئ نسخًا إضافية منها.');
    lastPreview=null;
    migrateButton.hidden=true;
    window.dispatchEvent(new Event('zad:attendance-changed'));
    window.dispatchEvent(new Event('zad:payment-approved'));
  } catch(e) {
    status('❌ تعذر استكمال النقل: '+(e.code||e.message)+
      '\nقد تكون بعض الدُفعات نُقلت بالفعل. اضغط فحص السجلات مرة أخرى قبل إعادة المحاولة. لا تعيد إنشاء حصص أو مدفوعات بدلًا منها.');
    lastPreview=null;migrateButton.hidden=true;
  } finally {setBusy(false);}
}

previewButton?.addEventListener('click',preview);
migrateButton?.addEventListener('click',migrate);
refreshButton?.addEventListener('click',reloadPeople);
source?.addEventListener('change',()=>{lastPreview=null;migrateButton.hidden=true;});
target?.addEventListener('input',()=>{lastPreview=null;migrateButton.hidden=true;});
reloadPeople();
