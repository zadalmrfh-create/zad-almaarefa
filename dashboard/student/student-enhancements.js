import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged, updatePassword } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let uid = '';
const statusBox = $('profileSaveStatus');

function setStatus(message, ok = false) {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = ok ? 'notice success' : 'notice';
  statusBox.style.display = 'block';
}

function fill(profile = {}) {
  const values = {
    profileName: profile.fullName || profile.name || '',
    profilePhone: profile.phone || '',
    profileCountry: profile.country || '',
    profileCity: profile.city || '',
    profileGrade: profile.grade || profile.studyGrade || profile.className || ''
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = $(id);
    if (el) el.value = value;
  });

  const loc = $('profileLocationSummary');
  if (loc) {
    loc.textContent = [profile.country, profile.city].filter(Boolean).join(' — ') || 'لم يتم تحديد البلد والمدينة';
  }
}

async function refreshStats() {
  if (!uid) return;
  try {
    const [attempts, bookings, library] = await Promise.all([
      getDocs(query(collection(db, 'quizAttempts'), where('studentUid', '==', uid))),
      getDocs(query(collection(db, 'bookings'), where('studentUid', '==', uid))),
      getDocs(collection(db, 'users', uid, 'library'))
    ]);

    let total = 0;
    let score = 0;
    attempts.forEach(item => {
      const value = Number(item.data().score);
      if (Number.isFinite(value)) {
        score += value;
        total++;
      }
    });

    const avg = total ? Math.round(score / total) : 0;
    if ($('profileQuizCount')) $('profileQuizCount').textContent = attempts.size;
    if ($('profileAvgScore')) $('profileAvgScore').textContent = avg + '%';
    if ($('profileBookingCount')) $('profileBookingCount').textContent = bookings.size;
    if ($('profileLibraryCount')) $('profileLibraryCount').textContent = library.size;
  } catch (error) {
    console.warn('تعذر تحميل بعض إحصائيات الملف الشخصي:', error);
  }
}

$('profileForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  event.stopPropagation();

  if (!uid) {
    setStatus('لم يتم التعرف على حسابك بعد. أعد تحميل الصفحة ثم حاول مرة أخرى.');
    return;
  }

  const saveButton = $('profileSaveBtn');
  const data = {
    fullName: $('profileName')?.value.trim() || '',
    name: $('profileName')?.value.trim() || '',
    phone: $('profilePhone')?.value.trim() || '',
    country: $('profileCountry')?.value.trim() || '',
    city: $('profileCity')?.value.trim() || '',
    grade: $('profileGrade')?.value.trim() || '',
    updatedAt: serverTimestamp(),
    profileCompletedAt: serverTimestamp()
  };

  if (!data.fullName) {
    setStatus('اكتب الاسم الكامل أولًا.');
    $('profileName')?.focus();
    return;
  }

  if (!data.country) {
    setStatus('اكتب البلد أولًا.');
    $('profileCountry')?.focus();
    return;
  }

  if (!data.city) {
    setStatus('اكتب المدينة أولًا.');
    $('profileCity')?.focus();
    return;
  }

  if (!data.grade) {
    setStatus('اكتب الصف الدراسي أولًا.');
    $('profileGrade')?.focus();
    return;
  }

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = '⏳ جارٍ الحفظ...';
    }
    setStatus('جارٍ حفظ البيانات...');

    // لا يتم استخدام Firebase Storage هنا نهائيًا.
    await updateDoc(doc(db, 'users', uid), data);

    setStatus('تم حفظ بيانات الملف الشخصي بنجاح ✅', true);

    const nameElement = document.querySelector('[data-name]');
    if (nameElement) nameElement.textContent = data.fullName;

    const loc = $('profileLocationSummary');
    if (loc) loc.textContent = `${data.country} — ${data.city}`;
  } catch (error) {
    console.error('PROFILE_SAVE_ERROR:', error);
    let message = error?.message || 'تعذر حفظ البيانات.';

    if (error?.code === 'permission-denied') {
      message = 'تم رفض حفظ البيانات من Firebase Rules. تأكد أن هذا الحساب هو صاحب بياناته.';
    } else if (error?.code === 'failed-precondition') {
      message = 'تعذر الاتصال بقاعدة البيانات حاليًا. حاول مرة أخرى.';
    }

    setStatus(message);
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = '💾 حفظ البيانات';
    }
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) return;
  uid = user.uid;

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) fill(snap.data());
    else setStatus('لم يتم العثور على بيانات حسابك في قاعدة البيانات.');
    await refreshStats();
  } catch (error) {
    console.error('Student enhancements:', error);
    setStatus('تعذر تحميل بيانات الحساب.');
  }
});

$('passwordForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const password = $('newPassword')?.value || '';
  const confirmation = $('confirmPassword')?.value || '';
  const box = $('passwordStatus');

  if (password.length < 6 || password !== confirmation) {
    if (box) {
      box.textContent = password.length < 6 ? 'كلمة المرور يجب ألا تقل عن 6 أحرف.' : 'كلمتا المرور غير متطابقتين.';
      box.style.display = 'block';
    }
    return;
  }

  try {
    await updatePassword(auth.currentUser, password);
    if (box) {
      box.textContent = 'تم تغيير كلمة المرور بنجاح.';
      box.className = 'notice success';
      box.style.display = 'block';
    }
    event.target.reset();
  } catch (error) {
    if (box) {
      box.textContent = error.code === 'auth/requires-recent-login'
        ? 'لأسباب أمنية، سجّل الدخول مرة أخرى ثم غيّر كلمة المرور.'
        : (error.message || 'تعذر تغيير كلمة المرور.');
      box.style.display = 'block';
    }
  }
});
