/* إلغاء/استرجاع سجل حصة مع إبقاء أثرها المالي والدفعات المعتمدة كما هي.
   لا تُحذف معاملات فودافون كاش، والأموال المرتبطة بالحصة الملغاة تحتاج تسوية من الإدارة. */
import {auth, db} from '../../firebase-config.js';
import {doc, runTransaction, serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

export async function archiveAttendance(id, reason='إلغاء سجل الحصة من الإدارة') {
  if (!auth.currentUser) throw new Error('سجّل الدخول بحساب الإدارة.');
  const ref=doc(db,'lessonAttendance',id);
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists())throw new Error('سجل الحصة غير موجود بالفعل.');
    if(snap.data().deleted===true)throw new Error('هذه الحصة ملغاة بالفعل.');
    tx.update(ref,{
      deleted:true,deletedAt:serverTimestamp(),deletedByUid:auth.currentUser.uid,
      deletionReason:String(reason||'إلغاء سجل الحصة من الإدارة').slice(0,250),
      updatedAt:serverTimestamp()
    });
  });
}
export async function restoreAttendance(id) {
  if (!auth.currentUser) throw new Error('سجّل الدخول بحساب الإدارة.');
  const ref=doc(db,'lessonAttendance',id);
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists()||snap.data().deleted!==true)throw new Error('لم نعثر على الحصة الملغاة.');
    tx.update(ref,{
      deleted:false,restoredAt:serverTimestamp(),restoredByUid:auth.currentUser.uid,
      updatedAt:serverTimestamp()
    });
  });
}
