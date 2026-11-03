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

async function getReconciliation(oldUid,newUid) {
  await checkAdmin();
  if(!oldUid||!newUid||oldUid===newUid)throw new Error('اختر حسابين مختلفين، ولا تترك أحدهما فارغًا.');
  if(oldUid.includes('/')||newUid.includes('/')||newUid.length>256)throw new Error('معرّف حساب غير صالح.');
  const [oldDoc,newDoc,attendance,payments,destinationAttendance,destinationPayments] = await Promise.all([
    getDoc(doc(db,'users',oldUid)), getDoc(doc(db,'users',newUid)),
    getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',oldUid))),
    getDocs(query(collection(db,'vodafonePayments'),where('studentUid','==',oldUid))),
    getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',newUid))),
    getDocs(query(collection(db,'vodafonePayments'),where('studentUid','==',newUid)))
  ]);
  if (!oldDoc.exists()||!newDoc.exists())throw new Error('أحد الحسابين غير موجود داخل مجموعة users. راجع UID المكتوب.');
  const old=oldDoc.data(),actual=newDoc.data();
  if(old.role!=='student'||actual.role!=='student')throw new Error('النقل متاح فقط بين حسابين دورهما student.');
  // Firestore security rules additionally require exact equality (not fuzzy matching).
  if(!old.email||!actual.email||old.email !== actual.email)throw new Error('تم إيقاف العملية لحماية الخصوصية: البريد الإلكتروني المسجل في الحسابين غير متطابق حرفيًا. لا تنقل السجلات لطالب آخر.');
  if(old.linkedToUid && old.linkedToUid!==newUid)throw new Error('هذا الحساب القديم سبق ربطه بحساب آخر. يلزم مراجعة الإدارة يدويًا.');
  return {oldUid,newUid,old,actual,attendance:attendance.docs,payments:payments.docs,
    destinationAttendance:destinationAttendance.size,destinationPayments:destinationPayments.size};
}

function describe(result) {
  const approved=result.payments.filter(d=>d.data().status==='approved').length;
  const pending=result.payments.filter(d=>d.data().status==='pending').length;
  return [
    'التحقق من تطابق البريد: ناجح ✅',
    'البريد المتطابق: '+result.old.email,
    'الحساب القديم: '+label(result.old)+' | UID: '+result.oldUid,
    'الحساب الحقيقي المستهدف: '+label(result.actual)+' | UID: '+result.newUid,
    'الحصص المطلوب نقلها: '+result.attendance.length,
    'التحويلات المطلوب نقلها: '+result.payments.length+' (معتمدة: '+approved+'، معلّقة: '+pending+')',
    'الحصص الموجودة بالفعل بالحساب الحقيقي: '+result.destinationAttendance,
    'التحويلات الموجودة بالفعل بالحساب الحقيقي: '+result.destinationPayments,
    'لن يتم تغيير تاريخ أي حصة أو مبلغ دفع أو حالة سداد أو مرجع تحويل. ولن يتم حذف أي سجل.',
    '⚠️ لا تضغط تنفيذ إلا بعد مقارنة UID المستهدف بالذي يظهر عند تسجيل دخول الطالب بنفسه.'
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
    if(data.oldUid!==lastPreview.oldUid||data.newUid!==lastPreview.newUid)throw new Error('الحساب المختار تغيّر؛ افحص البيانات من جديد.');
    const oldAttendance=new Set(lastPreview.attendance.map(d=>d.id));
    const oldPayments=new Set(lastPreview.payments.map(d=>d.id));
    if(data.attendance.length!==oldAttendance.size||data.payments.length!==oldPayments.size||
       data.attendance.some(d=>!oldAttendance.has(d.id))||data.payments.some(d=>!oldPayments.has(d.id))) {
      throw new Error('تغيّرت السجلات منذ المعاينة. اضغط فحص السجلات مجددًا.');
    }
    const total=data.attendance.length+data.payments.length;
    if(!total){status('لا توجد سجلات قديمة للنقل.');migrateButton.hidden=true;return;}
    const choice=window.prompt('تأكيد أخير: ستنقل '+data.attendance.length+' حصة و'+data.payments.length+' تحويل من UID القديم إلى حساب '+label(data.actual)+' ('+data.actual.email+').\nاكتب كلمة «نقل» لتأكيد تطابق الحسابات.','');
    if(choice?.trim()!=='نقل'){status('تم إلغاء النقل، لم تتغير أي سجلات.');return;}
    const admin=await checkAdmin();
    const entries=[...data.attendance.map(s=>({kind:'attendance',snap:s})),...data.payments.map(s=>({kind:'payment',snap:s}))];
    let moved=0, attendanceMoved=0, paymentMoved=0;
    // Small batches avoid Firestore security-rule document access limits.
    for(let i=0;i<entries.length;i+=4){
      const chunk=entries.slice(i,i+4);
      const batch=writeBatch(db);
      for(const item of chunk){
        const oldUid=item.snap.data().studentUid;
        if(oldUid!==data.oldUid)throw new Error('تم اكتشاف سجل تغيّر حسابه أثناء النقل.');
        batch.update(item.snap.ref,{
          studentUid:data.newUid,
          studentName:label(data.actual),
          relinkFromUid:data.oldUid,
          relinkedBy:admin.uid,
          relinkedAt:serverTimestamp()
        });
      }
      batch.set(doc(collection(db,'auditLogs')),{action:'student-record-uid-repair',
        sourceUid:data.oldUid,targetUid:data.newUid,studentEmail:data.actual.email,
        attendanceIds:chunk.filter(x=>x.kind==='attendance').map(x=>x.snap.id),
        paymentIds:chunk.filter(x=>x.kind==='payment').map(x=>x.snap.id),
        performedByUid:admin.uid,createdAt:serverTimestamp()});
      await batch.commit();
      moved+=chunk.length;
      attendanceMoved+=chunk.filter(x=>x.kind==='attendance').length;
      paymentMoved+=chunk.filter(x=>x.kind==='payment').length;
      status('جاري تصحيح الربط... '+moved+' من '+total+' سجل. لا تغلق الصفحة.');
    }
    // Mark the orphan profile only after all records have been safely transferred.
    const finalBatch=writeBatch(db);
    finalBatch.update(doc(db,'users',data.oldUid),{linkedToUid:data.newUid,linkedAt:serverTimestamp(),linkedBy:admin.uid});
    finalBatch.set(doc(collection(db,'auditLogs')),{action:'student-account-uid-repair-complete',
      sourceUid:data.oldUid,targetUid:data.newUid,studentEmail:data.actual.email,
      attendanceMoved,paymentMoved,performedByUid:admin.uid,createdAt:serverTimestamp()});
    await finalBatch.commit();
    status('✅ تم تصحيح الربط بنجاح. نُقلت '+attendanceMoved+' حصة و'+paymentMoved+' تحويل للحساب الحقيقي.\nاطلب من الطالب تحديث صفحة حضوري ومدفوعاتي.\nالحساب القديم لم يُحذف، وتم وضع علامة عليه لمنع اختياره مرة أخرى عند تسجيل حصة.');
    lastPreview=null;
    migrateButton.hidden=true;
    window.dispatchEvent(new Event('zad:attendance-changed'));
    window.dispatchEvent(new Event('zad:payment-approved'));
  }catch(e){
    // A failed later batch may leave earlier batches committed; rerunning preview checks what remains.
    status('❌ تعذّر إكمال تصحيح الربط: '+(e.code||e.message)+'\nلو تم نقل بعض السجلات، اضغط فحص السجلات مرة أخرى قبل إعادة المحاولة. لا تُنشئ تحويلات أو حصصًا جديدة كبديل.');
    lastPreview=null;migrateButton.hidden=true;
  }finally{setBusy(false);}
}

previewButton?.addEventListener('click',preview);
migrateButton?.addEventListener('click',migrate);
refreshButton?.addEventListener('click',reloadPeople);
source?.addEventListener('change',()=>{lastPreview=null;migrateButton.hidden=true;});
target?.addEventListener('input',()=>{lastPreview=null;migrateButton.hidden=true;});
reloadPeople();
