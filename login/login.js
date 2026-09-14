import {
  auth,
  db,
  FIREBASE_READY
} from '../firebase-config.js';

import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  GithubAuthProvider,
  TwitterAuthProvider,

  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signOut,

  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,

  RecaptchaVerifier,
  signInWithPhoneNumber

} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';



/* =========================================================
   العناصر
========================================================= */

const googleLogin =
  document.getElementById('googleLogin');

const facebookLogin =
  document.getElementById('facebookLogin');

const microsoftLogin =
  document.getElementById('microsoftLogin');

const appleLogin =
  document.getElementById('appleLogin');

const githubLogin =
  document.getElementById('githubLogin');

const twitterLogin =
  document.getElementById('twitterLogin');

const yahooLogin =
  document.getElementById('yahooLogin');

const anonymousLogin =
  document.getElementById('anonymousLogin');

const phoneLogin =
  document.getElementById('phoneLogin');

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

console.log('login.js يعمل بنجاح');

console.log(
  'Firebase جاهز:',
  FIREBASE_READY
);



/* =========================================================
   فحص حالة الحساب
========================================================= */

async function checkUserAndContinue(user) {

  if (!user) {
    throw new Error('لم يتم العثور على المستخدم.');
  }


  console.log(
    'تم تسجيل الدخول:',
    user.email || user.uid
  );


  /* =========================
     فحص الأدمن
  ========================== */

  const adminRef =
    doc(db, 'admins', user.uid);

  const adminSnap =
    await getDoc(adminRef);


  if (adminSnap.exists()) {

    msg(
      'تم تسجيل الدخول كمسؤول، جارٍ فتح لوحة التحكم...',
      'success'
    );

    setTimeout(() => {

      window.location.replace(
        '../dashboard/admin/index.html'
      );

    }, 500);

    return;
  }



  /* =========================
     فحص المستخدم
  ========================== */

  const userRef =
    doc(db, 'users', user.uid);

  const userSnap =
    await getDoc(userRef);



  /* =========================
     مستخدم Google جديد
  ========================== */

  if (!userSnap.exists()) {

    // إنشاء ملف المستخدم تلقائياً حتى يظل تسجيل Google مكتملًا
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || 'مستخدم',
      email: user.email || '',
      photoURL: user.photoURL || '',
      role: 'student',
      status: 'active',
      provider: 'google.com',
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    });

    msg(
      'تم إنشاء الحساب وتسجيل الدخول بنجاح، جارٍ فتح المنصة...',
      'success'
    );

    setTimeout(() => {
      window.location.replace('../index.html');
    }, 500);

    return;
  }



  const profile =
    userSnap.data();



  /* =========================
     محظور
  ========================== */

  if (profile.status === 'banned') {

    await signOut(auth);

    msg(
      '⛔ هذا الحساب محظور حاليًا ولا يمكنك تسجيل الدخول به.'
    );

    return;
  }



  /* =========================
     معطل
  ========================== */

  if (profile.status === 'disabled') {

    await signOut(auth);

    msg(
      '🚫 هذا الحساب معطل حاليًا.'
    );

    return;
  }



  /* =========================
     دخول ناجح
  ========================== */

  msg(
    'تم تسجيل الدخول بنجاح، جارٍ فتح المنصة...',
    'success'
  );

  setTimeout(() => {

    window.location.replace(
      '../index.html'
    );

  }, 500);

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

    'auth/invalid-phone-number':
      'رقم الهاتف غير صحيح.',

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
   Google — تسجيل الدخول باستخدام Redirect
========================================================= */

let googleRedirectHandled = false;

async function handleGoogleRedirectResult() {

  if (googleRedirectHandled) return;
  googleRedirectHandled = true;

  try {

    console.log('فحص نتيجة الرجوع من Google...');

    const result = await getRedirectResult(auth);

    if (!result || !result.user) {
      console.log('لا توجد نتيجة Google Redirect حالياً.');
      return;
    }

    console.log(
      'تم تسجيل الدخول باستخدام Google:',
      result.user.email || result.user.uid
    );

    await checkUserAndContinue(result.user);

  } catch (error) {

    console.error('Google Redirect Error:', error);
    msg(firebaseError(error));

  }
}


/*
 * مهم:
 * Google هنا يستخدم Redirect وليس Popup، لذلك Chrome لن يمنع نافذة.
 */
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
    googleLogin.innerHTML = 'جارٍ الانتقال إلى Google...';

    await configurePersistence();

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    console.log('بدء Google Redirect...');

    await signInWithRedirect(auth, provider);

  } catch (error) {

    console.error('Google Login Error:', error);

    googleLogin.disabled = false;

    if (googleLogin.dataset.originalHTML) {
      googleLogin.innerHTML = googleLogin.dataset.originalHTML;
    }

    msg(firebaseError(error));
  }

});


/*
 * يجب تشغيل getRedirectResult بعد تحميل الصفحة التي يعود إليها Google.
 */
handleGoogleRedirectResult();


/* =========================================================
   Facebook
========================================================= */

facebookLogin?.addEventListener(
  'click',
  async () => {

    const provider =
      new FacebookAuthProvider();


    await loginWithProvider(
      provider,
      facebookLogin,
      'Facebook'
    );

  }
);



/* =========================================================
   Microsoft
========================================================= */

microsoftLogin?.addEventListener(
  'click',
  async () => {

    const provider =
      new OAuthProvider(
        'microsoft.com'
      );


    await loginWithProvider(
      provider,
      microsoftLogin,
      'Microsoft'
    );

  }
);



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
   GitHub
========================================================= */

githubLogin?.addEventListener(
  'click',
  async () => {

    const provider =
      new GithubAuthProvider();


    await loginWithProvider(
      provider,
      githubLogin,
      'GitHub'
    );

  }
);



/* =========================================================
   Twitter / X
========================================================= */

twitterLogin?.addEventListener(
  'click',
  async () => {

    const provider =
      new TwitterAuthProvider();


    await loginWithProvider(
      provider,
      twitterLogin,
      'X'
    );

  }
);



/* =========================================================
   Yahoo
========================================================= */

yahooLogin?.addEventListener(
  'click',
  async () => {

    const provider =
      new OAuthProvider(
        'yahoo.com'
      );


    await loginWithProvider(
      provider,
      yahooLogin,
      'Yahoo'
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



/* =========================================================
   الدخول كزائر
========================================================= */

anonymousLogin?.addEventListener(
  'click',
  async () => {

    clearMsg();


    if (!FIREBASE_READY) {

      msg(
        'إعداد Firebase غير مكتمل.'
      );

      return;
    }


    try {

      anonymousLogin.disabled = true;

      anonymousLogin.dataset.originalHTML =
        anonymousLogin.innerHTML;

      anonymousLogin.innerHTML =
        'جارٍ الدخول كزائر...';


      await configurePersistence();


      const result =
        await signInAnonymously(auth);


      await checkUserAndContinue(
        result.user
      );


    } catch (error) {

      console.error(
        'Anonymous Login Error:',
        error
      );


      msg(
        firebaseError(error)
      );


    } finally {

      anonymousLogin.disabled = false;

      if (
        anonymousLogin.dataset.originalHTML
      ) {

        anonymousLogin.innerHTML =
          anonymousLogin.dataset.originalHTML;
      }

    }

  }
);



/* =========================================================
   تسجيل الدخول برقم الهاتف
========================================================= */

let recaptchaVerifier = null;


function createRecaptcha() {

  if (recaptchaVerifier) {

    return recaptchaVerifier;
  }


  recaptchaVerifier =
    new RecaptchaVerifier(
      auth,
      'recaptcha-container',
      {
        size: 'normal'
      }
    );


  return recaptchaVerifier;
}



phoneLogin?.addEventListener(
  'click',
  async () => {

    clearMsg();


    if (!FIREBASE_READY) {

      msg(
        'إعداد Firebase غير مكتمل.'
      );

      return;
    }


    const phone =
      prompt(
        'اكتب رقم الهاتف بصيغة دولية.\nمثال: +201xxxxxxxxx'
      );


    if (!phone) return;


    try {

      phoneLogin.disabled = true;

      phoneLogin.dataset.originalHTML =
        phoneLogin.innerHTML;

      phoneLogin.innerHTML =
        'جارٍ إرسال رمز التحقق...';


      await configurePersistence();


      const appVerifier =
        createRecaptcha();


      const confirmationResult =
        await signInWithPhoneNumber(
          auth,
          phone,
          appVerifier
        );


      const code =
        prompt(
          'تم إرسال رمز التحقق إلى هاتفك.\nأدخل الرمز:'
        );


      if (!code) {

        msg(
          'تم إلغاء التحقق.'
        );

        return;
      }


      const result =
        await confirmationResult
          .confirm(code);


      await checkUserAndContinue(
        result.user
      );


    } catch (error) {

      console.error(
        'Phone Login Error:',
        error
      );


      if (recaptchaVerifier) {

        try {

          recaptchaVerifier.clear();

        } catch (_) {}

        recaptchaVerifier = null;
      }


      msg(
        firebaseError(error)
      );


    } finally {

      phoneLogin.disabled = false;

      if (
        phoneLogin.dataset.originalHTML
      ) {

        phoneLogin.innerHTML =
          phoneLogin.dataset.originalHTML;
      }

    }

  }
);
