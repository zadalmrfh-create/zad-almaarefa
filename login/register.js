```js
import {
  auth,
  db,
  FIREBASE_READY
} from '../firebase-config.js';

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';


const googleRegister =
  document.getElementById('googleRegister');

const message =
  document.getElementById('message');

const roleSelect =
  document.getElementById('role');


/* ═══════════════════════════════════════
   الرسائل
═══════════════════════════════════════ */

function msg(text, type = 'error') {

  if (!message) return;

  message.textContent = text;

  message.className =
    `message ${type}`;

}


/* ═══════════════════════════════════════
   إنشاء الحساب باستخدام Google
═══════════════════════════════════════ */

googleRegister?.addEventListener(
  'click',
  async () => {

    if (!FIREBASE_READY) {

      return msg(
        'أكمل إعداد Firebase في ملف firebase-config.js أولًا.'
      );

    }


    const role =
      roleSelect?.value === 'teacher'
        ? 'teacher'
        : 'student';


    try {

      googleRegister.disabled = true;

      googleRegister.innerHTML =
        'جارٍ إنشاء الحساب باستخدام Google…';


      /* Google Provider */

      const provider =
        new GoogleAuthProvider();


      provider.setCustomParameters({
        prompt: 'select_account'
      });


      /* تسجيل Google */

      const result =
        await signInWithPopup(
          auth,
          provider
        );


      const user =
        result.user;


      /* ═══════════════════════════════════════
         التحقق من وجود المستخدم
      ═══════════════════════════════════════ */

      const userRef =
        doc(
          db,
          'users',
          user.uid
        );


      const existingUser =
        await getDoc(userRef);


      /* ═══════════════════════════════════════
         الحساب موجود بالفعل
      ═══════════════════════════════════════ */

      if (existingUser.exists()) {

        const profile =
          existingUser.data();


        /* محظور */

        if (
          profile.status === 'banned'
        ) {

          await signOut(auth);

          googleRegister.disabled = false;

          googleRegister.innerHTML =
            '<span class="google-icon">G</span> إنشاء الحساب باستخدام Google';


          return msg(
            '⛔ هذا الحساب محظور حاليًا.'
          );

        }


        msg(
          'هذا الحساب موجود بالفعل، جارٍ فتح المنصة…',
          'success'
        );


        setTimeout(() => {

          const homeUrl =
            new URL(
              '../index.html',
              import.meta.url
            ).href;

          window.location.replace(
            homeUrl
          );

        }, 400);


        return;

      }


      /* ═══════════════════════════════════════
         حساب جديد
      ═══════════════════════════════════════ */

      const name =
        user.displayName ||
        'مستخدم زاد المعرفة';


      const email =
        user.email ||
        '';


      await setDoc(
        userRef,
        {

          name: name,

          fullName: name,

          email: email,

          role: role,

          status:
            role === 'teacher'
              ? 'pending'
              : 'active',

          createdAt:
            serverTimestamp()

        }
      );


      /* ═══════════════════════════════════════
         نجاح التسجيل
      ═══════════════════════════════════════ */

      msg(
        role === 'teacher'
          ? 'تم إنشاء حسابك، وسيتم مراجعته من الإدارة.'
          : 'تم إنشاء حسابك بنجاح، جارٍ فتح المنصة…',
        'success'
      );


      setTimeout(() => {

        const homeUrl =
          new URL(
            '../index.html',
            import.meta.url
          ).href;

        window.location.replace(
          homeUrl
        );

      }, 700);


    } catch (error) {

      console.error(
        'خطأ إنشاء الحساب بجوجل:',
        error
      );


      googleRegister.disabled = false;

      googleRegister.innerHTML =
        '<span class="google-icon">G</span> إنشاء الحساب باستخدام Google';


      const map = {

        'auth/popup-closed-by-user':
          'تم إغلاق نافذة تسجيل الدخول.',

        'auth/popup-blocked':
          'المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.',

        'auth/cancelled-popup-request':
          'تم إلغاء العملية.',

        'auth/network-request-failed':
          'تحقق من اتصال الإنترنت.'

      };


      msg(
        map[error.code] ||
        'تعذر إنشاء الحساب باستخدام Google. حاول مرة أخرى.'
      );

    }

  }
);
```
