import {
  auth,
  db,
  FIREBASE_READY
} from '../firebase-config.js';

import {
  GoogleAuthProvider,
  OAuthProvider,

  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,

  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,


} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  writeBatch,
  runTransaction,
  increment,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';



/* =========================================================
   العناصر
========================================================= */

const googleLogin =
  document.getElementById('googleLogin');



const appleLogin =
  document.getElementById('appleLogin');





const emailLoginForm =
  document.getElementById('emailLoginForm');

const emailLoginBtn =
  document.getElementById('emailLoginBtn');

const togglePassword =
  document.getElementById('togglePassword');

const forgotPassword =
  document.getElementById('forgotPassword');

const message =
  document.getElementById('message');



/* =========================================================
   الرسائل
========================================================= */

function msg(text, type = 'error') {

  if (!message) return;

  message.textContent = text;

  message.className =
    `message ${type}`;
}



function clearMsg() {

  if (!message) return;

  message.textContent = '';

  message.className = 'message';
}



/* =========================================================
   Firebase
========================================================= */


async function redirectAfterLogin(user) {
  const target = sessionStorage.getItem('redirectAfterLogin');
  if (target && target.includes('/sections/library.html')) {
    sessionStorage.removeItem('redirectAfterLogin');
    window.location.replace('../sections/library.html');
    return;
  }

  // الأدمن الأساسي دائمًا يذهب إلى لوحة الإدارة
  if (user?.email?.toLowerCase() === 'maleksameh121@gmail.com') {
    window.location.replace('../dashboard/admin/index.html');
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const profile = snap.exists() ? snap.data() : {};
    if (profile.role === 'admin') {
      window.location.replace('../dashboard/admin/index.html');
    } else if (profile.role === 'teacher' && profile.status === 'active') {
      window.location.replace('../dashboard/teacher/index.html');
    } else {
      window.location.replace('../dashboard/student/index.html');
    }
  } catch (e) {
    console.error('تعذر تحديد لوحة الحساب:', e);
    window.location.replace('../dashboard/student/index.html');
  }
}

console.log('login.js يعمل بنجاح');

console.log(
  'Firebase جاهز:',
  FIREBASE_READY
);



/* =========================================================
   فحص حالة الحساب
========================================================= */

async function recordLogin(user, profile = {}) {
  // لا ننشئ سجل دخول لمستخدم عادي إلا بعد نجاح إنشاء/قراءة ملفه في users.
  // هذا يمنع ظهور أشخاص في "سجل تسجيلات الدخول" دون وجودهم في "المستخدمين".
  await addDoc(collection(db, 'loginLogs'), {
    uid: user.uid,
    email: user.email || '',
    name: profile.fullName || profile.name || user.displayName || 'مستخدم زاد المعرفة',
    provider: profile.provider || user.providerData?.[0]?.providerId || 'unknown',
    loginAt: serverTimestamp()
  });
}


async function checkUserAndContinue(user) {
  if (!user) throw new Error('لم يتم العثور على المستخدم.');

  console.log('تم تسجيل الدخول:', user.email || user.uid);

  let profile = null;
  let isAdminAccount = false;

  // الأدمن الرئيسي أو الأدمن الموجود في admins لا يحتاج أن يكون طالبًا في users.
  const isPrimaryAdmin =
    user?.email?.toLowerCase() === 'maleksameh121@gmail.com';

  if (!isPrimaryAdmin) {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    isAdminAccount = adminSnap.exists();
  } else {
    isAdminAccount = true;
  }

  if (isAdminAccount) {
    // سجل دخول الأدمن أيضًا، لكن لا نضعه في قائمة الطلاب/المستخدمين تلقائيًا.
    await recordLogin(user, {
      name: user.displayName || 'مدير المنصة',
      fullName: user.displayName || 'مدير المنصة',
      provider: user.providerData?.[0]?.providerId || 'unknown'
    });

    msg('تم تسجيل الدخول كمسؤول، جارٍ فتح لوحة التحكم...', 'success');
    setTimeout(() => window.location.replace('../dashboard/admin/index.html'), 300);
    return;
  }

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const displayName = user.displayName || 'مستخدم زاد المعرفة';
    profile = {
      uid: user.uid,
      name: displayName,
      fullName: displayName,
      email: user.email || '',
      photoURL: user.photoURL || '',
      phone: '',
      grade: '',
      subject: '',
      role: 'student',
      status: 'active',
      provider: user.providerData?.[0]?.providerId || 'google.com',
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };

    const claimRef = doc(db, 'studentCounterClaims', user.uid);
    const statsRef = doc(db, 'publicStats', 'students');

    // إنشاء المستخدم + claim + تحديث العداد في معاملة واحدة.
    // إذا فشلت المعاملة لأي سبب، لن نكتب loginLogs ولن نفتح الحساب.
    await runTransaction(db, async (transaction) => {
      const statsSnap = await transaction.get(statsRef);
      const claimSnap = await transaction.get(claimRef);

      transaction.set(userRef, profile);

      if (claimSnap.exists()) return;

      transaction.create(claimRef, {
        uid: user.uid,
        createdAt: serverTimestamp()
      });

      const rawTotal = statsSnap.exists() ? statsSnap.data().total : 0;
      const currentTotal = Number.isFinite(Number(rawTotal))
        ? Number(rawTotal)
        : 0;

      transaction.set(
        statsRef,
        { total: currentTotal + 1 },
        { merge: true }
      );
    });
  } else {
    profile = userSnap.data();

    if (profile.status === 'banned') {
      await signOut(auth);
      msg('⛔ هذا الحساب محظور حاليًا.');
      return;
    }

    // تحديث آخر دخول فقط بعد التأكد أن الحساب موجود فعلًا.
    await setDoc(
      userRef,
      { lastLoginAt: serverTimestamp() },
      { merge: true }
    );

    profile = {
      ...profile,
      lastLoginAt: serverTimestamp()
    };
  }

  // مهم: تسجيل الدخول في loginLogs يأتي بعد نجاح users فقط.
  await recordLogin(user, profile);

  msg('تم تسجيل الدخول بنجاح، جارٍ فتح المنصة...', 'success');
  setTimeout(() => redirectAfterLogin(user), 300);
}


/* =========================================================
   أخطاء Firebase
========================================================= */

function firebaseError(error) {

  console.error(
    'Firebase Error:',
    error
  );


  const errors = {

    'auth/popup-closed-by-user':
      'تم إغلاق نافذة تسجيل الدخول.',

    'auth/redirect-cancelled-by-user':
      'تم إلغاء تسجيل الدخول باستخدام Google.',

    'auth/popup-blocked':
      'المتصفح منع نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة.',

    'auth/cancelled-popup-request':
      'تم إلغاء تسجيل الدخول.',

    'auth/network-request-failed':
      'تحقق من اتصال الإنترنت.',

    'auth/unauthorized-domain':
      'هذا النطاق غير مسموح به في Firebase.',

    'auth/operation-not-allowed':
      'طريقة تسجيل الدخول هذه غير مفعلة في Firebase.',

    'auth/internal-error':
      'حدث خطأ داخلي في Firebase.',

    'auth/invalid-email':
      'البريد الإلكتروني غير صحيح.',

    'auth/user-not-found':
      'لا يوجد حساب بهذا البريد الإلكتروني.',

    'auth/wrong-password':
      'كلمة المرور غير صحيحة.',

    'auth/invalid-credential':
      'بيانات تسجيل الدخول غير صحيحة.',

    'auth/user-disabled':
      'تم تعطيل هذا الحساب.',

    'auth/too-many-requests':
      'تم إجراء محاولات كثيرة. حاول لاحقًا.',

    'auth/email-already-in-use':
      'هذا البريد الإلكتروني مستخدم بالفعل.',

    'auth/weak-password':
      'كلمة المرور ضعيفة.',

    'auth/account-exists-with-different-credential':
      'هذا البريد مرتبط بطريقة تسجيل دخول أخرى.',

    'auth/invalid-verification-code':
      'رمز التحقق غير صحيح.',

  
    'auth/quota-exceeded':
      'تم تجاوز الحد المسموح به.'
  };


  return (
    errors[error.code] ||
    `تعذر تسجيل الدخول: ${error.code || error.message}`
  );
}



/* =========================================================
   إعداد Firebase Persistence
========================================================= */

async function configurePersistence() {

  const remember =
    document.getElementById(
      'rememberMe'
    )?.checked;


  if (remember) {

    await setPersistence(
      auth,
      browserLocalPersistence
    );

  } else {

    await setPersistence(
      auth,
      browserSessionPersistence
    );

  }

}



/* =========================================================
   تشغيل مزود OAuth
========================================================= */

async function loginWithProvider(
  provider,
  button,
  providerName
) {

  clearMsg();


  if (!FIREBASE_READY) {

    msg(
      'إعداد Firebase غير مكتمل.'
    );

    return;
  }


  try {

    if (button) {

      button.disabled = true;

      button.dataset.originalHTML =
        button.innerHTML;

      button.innerHTML =
        `جارٍ تسجيل الدخول باستخدام ${providerName}...`;
    }


    await configurePersistence();


    console.log(
      `جارٍ فتح نافذة ${providerName}...`
    );


    const result =
      await signInWithPopup(
        auth,
        provider
      );


    const user =
      result.user;


    await checkUserAndContinue(user);


  } catch (error) {

    console.error(
      `${providerName} Login Error:`,
      error
    );


    if (button) {

      button.disabled = false;

      if (button.dataset.originalHTML) {

        button.innerHTML =
          button.dataset.originalHTML;
      }
    }


    msg(
      firebaseError(error)
    );
  }

}



/* =========================================================
   Google — تسجيل الدخول باستخدام Popup
========================================================= */
googleLogin?.addEventListener('click', async (event) => {
  event.preventDefault();
  clearMsg();

  if (!FIREBASE_READY) {
    msg('إعداد Firebase غير مكتمل.');
    return;
  }

  try {
    googleLogin.disabled = true;
    googleLogin.dataset.originalHTML = googleLogin.innerHTML;
    googleLogin.innerHTML = 'جارٍ تسجيل الدخول باستخدام Google...';

    await configurePersistence();

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    await checkUserAndContinue(result.user);

  } catch (error) {
    console.error('Google Login Error:', error);
    googleLogin.disabled = false;
    if (googleLogin.dataset.originalHTML) {
      googleLogin.innerHTML = googleLogin.dataset.originalHTML;
    }
    msg(firebaseError(error));
  }
});

/* =========================================================
   Apple
========================================================= */

appleLogin?.addEventListener(
  'click',
  async () => {

    const provider =
      new OAuthProvider(
        'apple.com'
      );


    await loginWithProvider(
      provider,
      appleLogin,
      'Apple'
    );

  }
);



/* =========================================================
   البريد الإلكتروني وكلمة المرور
========================================================= */

emailLoginForm?.addEventListener(
  'submit',
  async (event) => {

    event.preventDefault();


    clearMsg();


    if (!FIREBASE_READY) {

      msg(
        'إعداد Firebase غير مكتمل.'
      );

      return;
    }


    const email =
      document.getElementById(
        'email'
      ).value.trim();


    const password =
      document.getElementById(
        'password'
      ).value;


    if (!email || !password) {

      msg(
        'من فضلك أدخل البريد الإلكتروني وكلمة المرور.'
      );

      return;
    }


    try {

      emailLoginBtn.disabled = true;

      emailLoginBtn.dataset.originalHTML =
        emailLoginBtn.innerHTML;

      emailLoginBtn.innerHTML =
        'جارٍ تسجيل الدخول...';


      await configurePersistence();


      const result =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );


      await checkUserAndContinue(
        result.user
      );


    } catch (error) {

      console.error(
        'Email Login Error:',
        error
      );


      msg(
        firebaseError(error)
      );


    } finally {

      emailLoginBtn.disabled = false;

      if (
        emailLoginBtn.dataset.originalHTML
      ) {

        emailLoginBtn.innerHTML =
          emailLoginBtn.dataset.originalHTML;
      }

    }

  }
);



/* =========================================================
   نسيت كلمة المرور
========================================================= */

forgotPassword?.addEventListener(
  'click',
  async (event) => {

    event.preventDefault();


    const email =
      document.getElementById(
        'email'
      )?.value.trim();


    if (!email) {

      msg(
        'اكتب بريدك الإلكتروني أولًا.'
      );

      document
        .getElementById('email')
        ?.focus();

      return;
    }


    try {

      await sendPasswordResetEmail(
        auth,
        email
      );


      msg(
        'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.',
        'success'
      );


    } catch (error) {

      console.error(
        'Password Reset Error:',
        error
      );


      msg(
        firebaseError(error)
      );

    }

  }
);



/* =========================================================
   إظهار / إخفاء كلمة المرور
========================================================= */

togglePassword?.addEventListener(
  'click',
  () => {

    const password =
      document.getElementById(
        'password'
      );


    if (!password) return;


    if (
      password.type === 'password'
    ) {

      password.type = 'text';

      togglePassword.textContent =
        '🙈';

    } else {

      password.type = 'password';

      togglePassword.textContent =
        '👁';

    }

  }
);
