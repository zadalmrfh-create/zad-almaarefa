import {
  auth,
  db,
  FIREBASE_READY
} from '../firebase-config.js';

import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  runTransaction,
  increment,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const emailRegisterForm = document.getElementById('emailRegisterForm');
const emailRegisterBtn = document.getElementById('emailRegisterBtn');
const togglePassword = document.getElementById('togglePassword');
const message = document.getElementById('message');
const roleSelect = document.getElementById('role');

function msg(text, type = 'error') {
  if (!message) return;
  message.textContent = text;
  message.className = `message ${type}`;
}

function clearMsg() {
  if (!message) return;
  message.textContent = '';
  message.className = 'message';
}

function firebaseError(error) {
  const errors = {
    'auth/network-request-failed': 'تحقق من اتصال الإنترنت.',
    'auth/unauthorized-domain': 'هذا النطاق غير مسموح به في Firebase. أضف نطاق GitHub Pages من Firebase Console.',
    'auth/operation-not-allowed': 'طريقة التسجيل هذه غير مفعلة في Firebase Authentication.',
    'auth/email-already-in-use': 'هذا البريد الإلكتروني مستخدم بالفعل. جرّب تسجيل الدخول بدلًا من إنشاء حساب جديد.',
    'auth/invalid-email': 'البريد الإلكتروني غير صحيح.',
    'auth/weak-password': 'كلمة المرور ضعيفة. استخدم كلمة مرور أقوى.',
    'auth/account-exists-with-different-credential': 'هذا البريد مرتبط بطريقة تسجيل دخول أخرى.',
    'auth/too-many-requests': 'تم إجراء محاولات كثيرة. حاول لاحقًا.'
  };
  return errors[error?.code] || `تعذر إنشاء الحساب: ${error?.message || 'خطأ غير معروف'}`;
}

function getRole() {
  return roleSelect?.value === 'teacher' ? 'teacher' : 'student';
}

function updateRoleFields() {
  const isTeacher = getRole() === 'teacher';
  const label = document.getElementById('gradeLabel');
  const input = document.getElementById('grade');
  if (!label || !input) return;

  label.textContent = isTeacher ? 'المادة التي يدرسها' : 'الصف الدراسي';
  input.placeholder = isTeacher
    ? 'مثال: اللغة العربية أو القرآن الكريم'
    : 'مثال: أولى ثانوي أزهري';
}

roleSelect?.addEventListener('change', updateRoleFields);
updateRoleFields();

// إذا وصل المستخدم من صفحة تسجيل الدخول لأنه لا يملك ملف users بعد،
// نستخدم حساب Firebase Auth الحالي وننشئ له ملف المنصة فقط بعد إكمال البيانات.
const pendingRegistration = sessionStorage.getItem('needsProfileRegistration') === '1';

function preparePendingRegistration(user) {
  if (!pendingRegistration || !user) return;

  const emailInput = document.getElementById('registerEmail');
  const nameInput = document.getElementById('fullName');
  const passwordInput = document.getElementById('registerPassword');
  const passwordField = passwordInput?.closest('.field');

  if (emailInput) {
    emailInput.value = user.email || sessionStorage.getItem('pendingRegistrationEmail') || '';
    emailInput.readOnly = true;
  }
  if (nameInput && user.displayName) {
    nameInput.value = user.displayName;
  }

  // Google/Apple: لا نحتاج كلمة مرور جديدة لأن حساب Firebase Auth موجود بالفعل.
  if (passwordInput && user.providerData?.[0]?.providerId !== 'password') {
    passwordInput.required = false;
    passwordInput.removeAttribute('minlength');
    passwordInput.placeholder = 'غير مطلوبة عند التسجيل بهذا الحساب';
    if (passwordField) passwordField.classList.add('hidden');
  }

  msg('ليس لديك حساب على المنصة، أنشئ حسابك أولًا بإكمال البيانات التالية.', 'error');
}

onAuthStateChanged(auth, preparePendingRegistration);

async function saveUserProfile(user, role, provider, extraData = {}) {
  const userRef = doc(db, 'users', user.uid);
  const existingUser = await getDoc(userRef);

  if (existingUser.exists()) {
    const profile = existingUser.data();
    if (profile.status === 'banned') {
      await signOut(auth);
      throw Object.assign(new Error('هذا الحساب محظور حاليًا.'), { code: 'app/banned' });
    }
    return false;
  }

  const name = user.displayName || 'مستخدم زاد المعرفة';

  const profileData = {
    uid: user.uid,
    name,
    fullName: name,
    email: user.email || '',
    photoURL: user.photoURL || '',
    phone: extraData.phone || '',
    country: extraData.country || '',
    city: extraData.city || '',
    grade: role === 'student' ? (extraData.grade || '') : '',
    subject: role === 'teacher' ? (extraData.grade || '') : '',
    role,
    status: role === 'teacher' ? 'pending' : 'active',
    provider,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  };

  if (role === 'student') {
    // تُكتب بيانات الحساب وطلب زيادة العداد في عملية ذرّية واحدة.
    const claimRef = doc(db, 'studentCounterClaims', user.uid);
    const statsRef = doc(db, 'publicStats', 'students');

    // تسجيل الطالب وزيادة العداد في معاملة واحدة.
    // إذا كان مستند العداد غير موجود يبدأ من 1، وإلا يزيد بمقدار واحد.
    await runTransaction(db, async (transaction) => {
      const statsSnap = await transaction.get(statsRef);
      const claimSnap = await transaction.get(claimRef);

      if (claimSnap.exists()) {
        transaction.set(userRef, profileData, { merge: true });
        return;
      }

      transaction.set(userRef, profileData, { merge: true });
      transaction.set(claimRef, { uid: user.uid, createdAt: serverTimestamp() }, { merge: true });

      const currentTotal = statsSnap.exists() && Number.isFinite(statsSnap.data().total)
        ? Number(statsSnap.data().total)
        : 0;

      transaction.set(statsRef, { total: currentTotal + 1 }, { merge: true });
    });
  } else {
    await setDoc(userRef, profileData, { merge: true });
  }

  return true;
}

function goHome() {
  window.location.replace('../index.html');
}

async function finishRegistration(user, role, provider, extraData = {}) {
  const created = await saveUserProfile(user, role, provider, extraData);

  if (created) {
    msg(
      role === 'teacher'
        ? 'تم إنشاء حساب المعلم بنجاح، وسيتم مراجعته من الإدارة.'
        : 'تم إنشاء حسابك بنجاح، جارٍ فتح المنصة…',
      'success'
    );
  } else {
    msg('هذا الحساب موجود بالفعل، جارٍ فتح المنصة…', 'success');
  }

  setTimeout(goHome, 700);
}

emailRegisterForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMsg();

  if (!FIREBASE_READY) {
    msg('إعداد Firebase غير مكتمل في firebase-config.js.');
    return;
  }

  const name = document.getElementById('fullName')?.value.trim() || '';
  const email = document.getElementById('registerEmail')?.value.trim() || '';
  const password = document.getElementById('registerPassword')?.value || '';
  const phone = document.getElementById('phone')?.value.trim() || '';
  const country = document.getElementById('country')?.value.trim() || '';
  const city = document.getElementById('city')?.value.trim() || '';
  const grade = document.getElementById('grade')?.value.trim() || '';
  const role = getRole();

  if (name.length < 2) {
    msg('اكتب الاسم بالكامل.');
    return;
  }
  if (!email) {
    msg('اكتب البريد الإلكتروني.');
    return;
  }
  if (!phone) {
    msg('اكتب رقم الهاتف.');
    return;
  }
  if (!grade) {
    msg(role === 'teacher' ? 'اكتب المادة التي يدرسها المعلم.' : 'اكتب الصف الدراسي.');
    return;
  }
  if (!country) {
    msg('اكتب البلد.');
    return;
  }
  if (!city) {
    msg('اكتب المدينة.');
    return;
  }
  const currentAuthUser = auth.currentUser;
  const needsNewPassword = !currentAuthUser;

  if (needsNewPassword && password.length < 6) {
    msg('كلمة المرور يجب ألا تقل عن 6 أحرف.');
    return;
  }

  try {
    emailRegisterBtn.disabled = true;
    emailRegisterBtn.dataset.originalHTML = emailRegisterBtn.innerHTML;
    emailRegisterBtn.innerHTML = 'جارٍ إنشاء الحساب...';

    let registrationUser = auth.currentUser;

    if (registrationUser) {
      // المستخدم جاء من تسجيل الدخول بحساب Auth موجود، لكنه لم ينشئ ملف users بعد.
      if (registrationUser.email && email && registrationUser.email.toLowerCase() !== email.toLowerCase()) {
        msg('البريد الإلكتروني المرتبط بحساب تسجيل الدخول مختلف عن البريد المكتوب.');
        return;
      }
      await updateProfile(registrationUser, { displayName: name });
    } else {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      registrationUser = result.user;
      await updateProfile(registrationUser, { displayName: name });
    }

    await finishRegistration(registrationUser, role, registrationUser.providerData?.[0]?.providerId || 'password', { phone, grade, country, city });
    sessionStorage.removeItem('needsProfileRegistration');
    sessionStorage.removeItem('pendingRegistrationEmail');
    sessionStorage.removeItem('pendingRegistrationName');
  } catch (error) {
    console.error('Email Register Error:', error);
    msg(firebaseError(error));
  } finally {
    emailRegisterBtn.disabled = false;
    if (emailRegisterBtn.dataset.originalHTML) {
      emailRegisterBtn.innerHTML = emailRegisterBtn.dataset.originalHTML;
    }
  }
});

togglePassword?.addEventListener('click', () => {
  const password = document.getElementById('registerPassword');
  if (!password) return;
  const visible = password.type === 'text';
  password.type = visible ? 'password' : 'text';
  togglePassword.textContent = visible ? '👁' : '🙈';
});
