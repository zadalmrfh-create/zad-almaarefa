import {auth, db, firebaseConfig} from '../../firebase-config.js';
import {initializeApp, deleteApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getAuth, createUserWithEmailAndPassword, updateProfile, signOut, inMemoryPersistence, setPersistence} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {getFirestore, doc, getDoc, setDoc, serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const form=document.getElementById('manualStudentSignup');
const status=document.getElementById('manualStudentSignupStatus');
const usernameToEmail=(v)=>v.toLowerCase()+'@students.zad-almaarefa.example';
form?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!auth.currentUser){status.textContent='سجّل الدخول كأدمن أولًا.';return;}
  const f=event.currentTarget, b=f.querySelector('button[type=submit]');
  const data=Object.fromEntries(new FormData(f));
  const username=String(data.username||'').trim().toLowerCase();
  const fullName=String(data.fullName||'').trim();
  if(!/^[a-z0-9._-]{4,32}$/.test(username)||!fullName||String(data.password||'').length<8){status.textContent='راجع الاسم واسم المستخدم وكلمة المرور (8 أحرف على الأقل).';return;}
  b.disabled=true;status.textContent='جارٍ إنشاء حساب تسجيل دخول فعلي...';
  let secondaryApp,secondaryAuth,uid='';
  try{
    const admin=auth.currentUser;
    const [adminDoc,profileDoc]=await Promise.all([getDoc(doc(db,'admins',admin.uid)),getDoc(doc(db,'users',admin.uid))]);
    if(!adminDoc.exists() && profileDoc.data()?.role!=='admin' && !(admin.email==='maleksameh121@gmail.com' && admin.emailVerified)) throw new Error('الحساب الحالي غير معتمد كأدمن.');
    secondaryApp=initializeApp(firebaseConfig,'student-creation-'+Date.now());
    secondaryAuth=getAuth(secondaryApp);
    await setPersistence(secondaryAuth,inMemoryPersistence);
    const result=await createUserWithEmailAndPassword(secondaryAuth,usernameToEmail(username),String(data.password));
    uid=result.user.uid;
    await updateProfile(result.user,{displayName:fullName});
    // أنشئ مستند الطالب بجلسة الطالب الجديدة؛ قواعد Firestore تسمح للطالب بإنشاء ملفه فقط.
    const studentDb=getFirestore(secondaryApp);
    await setDoc(doc(studentDb,'users',uid),{
      uid,email:usernameToEmail(username),username,fullName,name:fullName,displayName:fullName,
      phone:String(data.phone||'').trim(),grade:String(data.grade||'').trim(),role:'student',status:'active',
      manuallyCreated:true,createdByUid:admin.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()
    });
    status.textContent='✅ تم إنشاء حساب الطالب بنجاح. يدخل باستخدام اسم المستخدم: '+username+' وكلمة المرور التي اخترتها. احتفظ بها بطريقة آمنة.';
    f.reset();
  }catch(e){
    console.error('Manual student account creation',e);
    status.textContent=e.code==='auth/email-already-in-use'?'اسم المستخدم مستخدم بالفعل؛ اختار اسمًا آخر.':
      ('❌ تعذر إنشاء الحساب: '+(e.code||e.message)+(uid?' (تم إنشاء حساب Auth لكن تعذر حفظ ملفه في Firestore؛ راجع Rules وقائمة Authentication قبل إعادة المحاولة.)':''));
  }finally{
    if(secondaryAuth)await signOut(secondaryAuth).catch(()=>{});
    if(secondaryApp)await deleteApp(secondaryApp).catch(()=>{});
    b.disabled=false;
  }
});
