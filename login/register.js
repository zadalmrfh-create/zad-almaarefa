import {
  auth,
  db,
  FIREBASE_READY
} from '../firebase-config.js';

import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
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

  await setDoc(userRef, {
    uid: user.uid,
    name,
    fullName: name,
    email: user.email || '',
    photoURL: user.photoURL || '',
    phone: extraData.phone || '',
    grade: role === 'student' ? (extraData.grade || '') : '',
    subject: role === 'teacher' ? (extraData.grade || '') : '',
    role,
    status: role === 'teacher' ? 'pending' : 'active',
    provider,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  }, { merge: true });

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
  if (password.length < 6) {
    msg('كلمة المرور يجب ألا تقل عن 6 أحرف.');
    return;
  }

  try {
    emailRegisterBtn.disabled = true;
    emailRegisterBtn.dataset.originalHTML = emailRegisterBtn.innerHTML;
    emailRegisterBtn.innerHTML = 'جارٍ إنشاء الحساب...';

    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    await finishRegistration(result.user, role, 'password', { phone, grade });
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
