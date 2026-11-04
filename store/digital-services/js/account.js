import {$,renderShell,esc,egp,showToast,setAlert,clearAlert,statuses} from './shared.js';
import {configured} from './firebase-config.js';
renderShell('account');
let fb=null,profileUnsub=null,ordersUnsub=null,viewVersion=0;
const show=(id,yes)=>$(id).classList.toggle('hide',!yes);
const busy=(id,on)=>{const b=$(id);b.disabled=on;b.dataset.original ||= b.textContent;b.textContent=on?'جارٍ التنفيذ…':b.dataset.original};
function friendly(e){switch(e?.code){
 case 'auth/email-already-in-use':return 'هذا البريد مُستخدم بالفعل. سجّل الدخول من النموذج الآخر. طلبات الضيف السابقة يمكن متابعتها بكود التتبع.';
 case 'auth/invalid-email':return 'تأكد من صحة البريد الإلكتروني.';
 case 'auth/weak-password':return 'اختار كلمة مرور أقوى (6 أحرف على الأقل).';
 case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found':return 'البريد أو كلمة المرور غير صحيحين.';
 case 'auth/too-many-requests':return 'محاولات كثيرة، حاول لاحقًا أو استخدم استرجاع كلمة المرور.';
 case 'auth/network-request-failed':return 'تحقق من اتصال الإنترنت.';
 case 'auth/popup-closed-by-user':case 'auth/cancelled-popup-request':return 'تم إغلاق نافذة Google قبل إكمال الدخول.';
 case 'auth/popup-blocked':return 'المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة لهذا الموقع وجرب مجددًا.';
 case 'auth/unauthorized-domain':return 'الدومين غير مسموح به في Firebase. أضفه في Authentication > Settings > Authorized domains.';
 case 'auth/operation-not-allowed':return 'تسجيل Google غير مفعّل. فعّله في Firebase Authentication > Sign-in method.';
 case 'auth/account-exists-with-different-credential':return 'البريد مرتبط بطريقة دخول أخرى. ادخل بالبريد وكلمة المرور واربط Google من داخل حسابك.';
 case 'auth/credential-already-in-use':return 'حساب Google مستخدم بالفعل. يمكنك الدخول به، لكن طلبات الضيف الحالية لن تنتقل تلقائيًا.';
 case 'permission-denied':return 'تعذّر الوصول إلى البيانات. انشر ملف firestore.rules المحدَّث.';
 default: return 'حصل خطأ غير متوقع. تأكد من الإعدادات وحاول مرة أخرى.';}}
const googleProvider=()=>{const provider=new fb.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return provider};
async function ensureGoogleProfile(user){
 // A Google login must not overwrite profile details a customer already saved.
 const ref=fb.doc(fb.db,'customers',user.uid);
 const existing=await fb.getDoc(ref);
 if(existing.exists())return;
 const given=(user.displayName||'').trim().slice(0,70);
 const name=given.length>=3?given:'عميل Google';
 await fb.setDoc(ref,{uid:user.uid,name,phone:'',createdAt:fb.serverTimestamp(),updatedAt:fb.serverTimestamp()});
}
async function finishGoogleSignIn(user){
 await user.getIdToken(true);
 try{await ensureGoogleProfile(user)}catch(e){console.error('Google profile creation failed:',e);showToast('تم تسجيل الدخول، لكن تعذّر حفظ الملف الشخصي. تحقق من قواعد Firestore.');}
 showMember(user);
 showToast('تم تسجيل الدخول باستخدام Google بنجاح');
}
function clearListeners(){if(profileUnsub){profileUnsub();profileUnsub=null;}if(ordersUnsub){ordersUnsub();ordersUnsub=null;}}
function formatDate(ts){return ts?.toDate?.()?.toLocaleString('ar-EG')||'—';}
function drawOrders(records){$('orderCount').textContent=`${records.length} طلب`;
 if(!records.length){$('myOrders').innerHTML='<div class="empty">لسه مفيش طلبات محفوظة في حسابك. <a class="inline-link" href="./checkout.html">قدّم أول طلب</a></div>';return;}
 records.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 $('myOrders').innerHTML=records.map(o=>`<article class="client-order"><div class="panel-head"><div><strong dir="ltr">${esc(o.id)}</strong><p class="muted" style="margin:0;font-size:12px">${esc(formatDate(o.createdAt))}</p></div><span class="status-pill">${esc(statuses[o.status]||o.status)}</span></div><div class="client-order-meta"><span>الخدمة: <strong>${o.serviceType==='finance'?'الثقافة المالية — SPRIX Learning':o.serviceType==='chapters'?'شابترات':o.serviceType==='retries'?'إعادات':'شابترات وإعادات'}</strong></span>${o.serviceType==='finance'?`<span>السعر: <strong>${o.totalPiasters?egp(o.totalPiasters):'طلب سابق بدون سعر'}</strong></span>`:`<span>الشابترات: <strong>${Number(o.chapters)||0}</strong></span><span>الإعادات: <strong>${Number(o.retries)||0}</strong></span><span>التكلفة: <strong>${egp(o.totalPiasters||0)}</strong></span>`}</div><div class="actions"><a class="btn btn-outline" href="./track.html?code=${encodeURIComponent(o.trackingCode)}">متابعة الطلب ←</a></div></article>`).join('');}
function showMember(user){show('authLoading',false);show('guestView',false);show('memberView',true);$('guestReminder').hidden=true;
 $('welcomeName').textContent=user.displayName||'عميلنا';$('accountEmail').textContent=user.email||'—';
 $('emailVerificationStatus').textContent=user.emailVerified?'✓ البريد الإلكتروني مؤكد':'البريد الإلكتروني لم يتم تأكيده بعد (تسجيل الطلب متاح).';
 $('verifyEmailButton').hidden=user.emailVerified;
 $('linkGoogleAccount').hidden=user.providerData.some(p=>p.providerId==='google.com');clearAlert('linkGoogleError');
 $('profileName').value=user.displayName||'';$('profilePhone').value='';
 $('myOrders').innerHTML='<div class="empty">جارٍ تحميل طلباتك…</div>';
 const thisView=++viewVersion;clearListeners();
 profileUnsub=fb.onSnapshot(fb.doc(fb.db,'customers',user.uid),snap=>{
  if(thisView!==viewVersion)return;
  if(snap.exists()){const p=snap.data();$('profileName').value=p.name||user.displayName||'';$('profilePhone').value=p.phone||'';
   $('welcomeName').textContent=p.name||user.displayName||'عميلنا';}
 },err=>console.warn('Profile read error',err));
 // Firestore rules require where uid==auth.uid. Sorting client-side avoids a composite index.
 ordersUnsub=fb.onSnapshot(fb.query(fb.collection(fb.db,'orders'),fb.where('uid','==',user.uid),fb.limit(100)),snap=>{
  if(thisView!==viewVersion)return;drawOrders(snap.docs.map(d=>({id:d.id,...d.data()})));
 },err=>{console.error(err);if(thisView===viewVersion)$('myOrders').innerHTML='<div class="alert alert-error">تعذر تحميل الطلبات. تأكد من نشر قواعد Firestore الجديدة.</div>'});
}
function showGuest(user){++viewVersion;clearListeners();show('authLoading',false);show('guestView',true);show('memberView',false);$('guestReminder').hidden=false;
 $('guestReminder').querySelector('strong').textContent=user?.isAnonymous?'طلبات الضيف الحالية:':'مهم للطلبات السابقة:';
 $('accountEmail').textContent='';$('profilePhone').value='';$('myOrders').replaceChildren();
}
async function doGoogleLogin(existingAccount=false){
 if(!fb)return;
 clearAlert('googleAuthError');
 if(!existingAccount)$('googleExistingAccount').hidden=true;
 const button=existingAccount?$('googleExistingAccount'):$('googleSignIn');
 if(existingAccount)busy(button.id,true);
 else{button.disabled=true;button.querySelector('span').textContent='جارٍ الاتصال بـGoogle…';}
 $('googleSignIn').disabled=true;
 try{
  // Popup must start directly from the button click; no await before it.
  const current=fb.auth.currentUser;
  const provider=googleProvider();
  // Link a guest's fresh Google identity to the same UID, retaining their orders.
  // Google accounts that already exist cannot be linked to a guest: use explicit sign-in instead.
  const result=(!existingAccount&&current?.isAnonymous)
   ?await fb.linkWithPopup(current,provider)
   :await fb.signInWithPopup(fb.auth,provider);
  await finishGoogleSignIn(result.user);
 }catch(e){
  console.error('Google auth failed:',e);
  setAlert('googleAuthError',friendly(e));
  if(!existingAccount&&fb.auth.currentUser?.isAnonymous&&
     ['auth/credential-already-in-use','auth/email-already-in-use'].includes(e.code)){
   $('googleExistingAccount').hidden=false;
   setAlert('googleAuthError','البريد ده مرتبط بحساب موجود. لو دخلت باستخدام Google بالحساب الموجود، طلبات الضيف الحالية مش هتتنقل تلقائيًا؛ احتفظ بكود التتبع الخاص بيها.');
  }
 }finally{
  if(existingAccount)busy(button.id,false);
  else{button.disabled=false;button.querySelector('span').textContent='المتابعة باستخدام Google';}
  $('googleSignIn').disabled=false;
 }
}
$('googleSignIn').addEventListener('click',()=>doGoogleLogin());
$('googleExistingAccount').addEventListener('click',()=>doGoogleLogin(true));
$('linkGoogleAccount').addEventListener('click',async()=>{
 if(!fb?.auth.currentUser||fb.auth.currentUser.isAnonymous)return;
 clearAlert('linkGoogleError');busy('linkGoogleAccount',true);
 try{const result=await fb.linkWithPopup(fb.auth.currentUser,googleProvider());
  await result.user.getIdToken(true);
  $('linkGoogleAccount').hidden=true;showToast('تم ربط Google بحسابك الحالي.');
 }catch(e){console.error(e);setAlert('linkGoogleError',friendly(e));}
 finally{busy('linkGoogleAccount',false)}
});
async function start(){if(!configured){showGuest(null);setAlert('accountGlobalMessage','إعدادات Firebase غير مكتملة.');return}
 try{fb=await import('./firebase-service.js');fb.onAuthStateChanged(fb.auth,u=>{if(u&&!u.isAnonymous)showMember(u);else showGuest(u)});
 }catch(e){console.error(e);showGuest(null);setAlert('accountGlobalMessage','تعذر الاتصال بـFirebase.')}}
$('registerForm').addEventListener('submit',async e=>{e.preventDefault();clearAlert('registerError');if(!fb)return;
 const name=$('registerName').value.trim(),email=$('registerEmail').value.trim(),phone=$('registerPhone').value.trim(),pw=$('registerPassword').value;
 if(name.length<3||name.length>70||phone&&!/^01[0-9]{9}$/.test(phone)){setAlert('registerError','راجع الاسم ورقم الهاتف.');return}
 if(pw!==$('confirmPassword').value){setAlert('registerError','كلمتا المرور غير متطابقتين.');return}
 busy('registerSubmit',true);
 try{
  const guest=fb.auth.currentUser;
  let cred;
  if(guest?.isAnonymous){const c=fb.EmailAuthProvider.credential(email,pw);cred=await fb.linkWithCredential(guest,c)}
  else cred=await fb.createUserWithEmailAndPassword(fb.auth,email,pw);
  // تحديث الـID Token بعد ترقية الضيف لضمان تفعيل صلاحيات الحساب المسجل فورًا.
  await cred.user.getIdToken(true);
  await fb.updateProfile(cred.user,{displayName:name});
  try{await fb.setDoc(fb.doc(fb.db,'customers',cred.user.uid),{uid:cred.user.uid,name,phone,createdAt:fb.serverTimestamp(),updatedAt:fb.serverTimestamp()});}
  catch(err){console.error('Profile save failed:',err);showToast('تم إنشاء الحساب، لكن بيانات التواصل لم تُحفظ. افتح ملفك الشخصي وأعد الحفظ.');}
  fb.sendEmailVerification(cred.user).catch(()=>{});
  $('registerForm').reset();showMember(cred.user);showToast('تم إنشاء حسابك بنجاح!');
 }catch(err){console.error(err);setAlert('registerError',friendly(err))}finally{busy('registerSubmit',false)}
});
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();clearAlert('loginError');if(!fb)return;busy('loginSubmit',true);
 try{const cred=await fb.signInWithEmailAndPassword(fb.auth,$('loginEmail').value.trim(),$('loginPassword').value);showMember(cred.user);$('loginPassword').value='';}
 catch(err){console.error(err);setAlert('loginError',friendly(err))}finally{busy('loginSubmit',false)}
});
$('resetPassword').addEventListener('click',async()=>{if(!fb)return;clearAlert('loginError');const email=$('loginEmail').value.trim();if(!email){setAlert('loginError','اكتب بريدك الإلكتروني أولًا في نموذج الدخول.');return}
 try{await fb.sendPasswordResetEmail(fb.auth,email);setAlert('loginError','لو البريد مسجل، هتوصلك رسالة لاستعادة كلمة المرور.','success')}
 catch(e){console.error(e);setAlert('loginError',friendly(e))}});
$('logoutButton').addEventListener('click',async()=>{if(!fb)return;await fb.signOut(fb.auth);showToast('تم تسجيل الخروج')});
$('verifyEmailButton').addEventListener('click',async()=>{if(!fb?.auth.currentUser)return;
 try{await fb.sendEmailVerification(fb.auth.currentUser);showToast('تم إرسال رسالة تأكيد البريد (راجع صندوق الوارد)')}
 catch(err){console.error(err);showToast('تعذر الإرسال حاليًا. حاول لاحقًا.')}});
$('profileForm').addEventListener('submit',async e=>{e.preventDefault();if(!fb?.auth.currentUser)return;clearAlert('profileMessage');
 const user=fb.auth.currentUser,name=$('profileName').value.trim(),phone=$('profilePhone').value.trim();
 if(name.length<3||name.length>70||(phone&&!/^01[0-9]{9}$/.test(phone))){setAlert('profileMessage','راجع الاسم ورقم الهاتف المصري.');return}
 busy('saveProfile',true);
 try{const ref=fb.doc(fb.db,'customers',user.uid),existing=await fb.getDoc(ref);
  if(existing.exists()){await fb.updateDoc(ref,{name,phone,updatedAt:fb.serverTimestamp()})}
  else await fb.setDoc(ref,{uid:user.uid,name,phone,createdAt:fb.serverTimestamp(),updatedAt:fb.serverTimestamp()});
  await fb.updateProfile(user,{displayName:name});$('welcomeName').textContent=name;
  setAlert('profileMessage','تم تحديث الملف الشخصي.','success');
 }catch(err){console.error(err);setAlert('profileMessage',friendly(err))}finally{busy('saveProfile',false)}
});
start();
