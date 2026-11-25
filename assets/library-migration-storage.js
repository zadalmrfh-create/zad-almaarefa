import {auth,db,ADMIN_EMAIL} from '../firebase-config.js';
import {doc,collection,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {getStorage,ref,uploadBytes,deleteObject} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js';
import {isLibraryOwner,validateLibraryPdf} from './library-migration-core.mjs';

export function assertLibraryFileOwner(expectedUid) {
  const user = auth.currentUser;
  if (!isLibraryOwner(user,ADMIN_EMAIL) || (expectedUid && user.uid !== expectedUid)) {
    throw new Error('رفع الملفات المحمية متاح لحساب المالك ذي البريد الموثّق فقط.');
  }
  return user;
}

/** Upload bytes to the existing protected path. Never request getDownloadURL. */
export async function uploadLibraryPdf({file,title,expectedUid,onStatus=()=>{}}) {
  const user = assertLibraryFileOwner(expectedUid);
  const cleanTitle = String(title || '').trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 180) throw new Error('اكتب عنوانًا من حرفين إلى 180 حرفًا.');
  await validateLibraryPdf(file);
  assertLibraryFileOwner(user.uid);
  const bookRef = doc(collection(db,'libraryProtectedBooks'));
  const storagePath = 'libraryProtected/'+bookRef.id+'/content.pdf';
  let uploaded = false;
  try {
    onStatus('جارٍ رفع PDF إلى المسار المحمي…');
    await uploadBytes(ref(getStorage(),storagePath),file,{contentType:'application/pdf'});
    uploaded = true;
    assertLibraryFileOwner(user.uid);
    await setDoc(bookRef,{title:cleanTitle,storagePath,published:true,createdAt:serverTimestamp(),createdBy:user.uid,updatedAt:serverTimestamp()});
    return {id:bookRef.id,title:cleanTitle,storagePath,published:true};
  } catch (error) {
    if (uploaded) {
      try {
        assertLibraryFileOwner(user.uid);
        await deleteObject(ref(getStorage(),storagePath));
      } catch {
        const failure = new Error('تعذر حفظ بيانات الكتاب أو تنظيف الملف المرفوع. راجع المسار '+storagePath+' قبل إعادة الرفع.');
        failure.cause = error;throw failure;
      }
    }
    throw error;
  }
}
