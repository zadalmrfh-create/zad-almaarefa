import { ENGLISH_SUBJECT, ENGLISH_TEACHER_NAME, findEnglishTeacherAccount } from "../../assets/english-teacher.js";
import { auth, db } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, doc, getDoc, getDocFromServer, getDocs, setDoc, addDoc, onSnapshot, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { asBookingPrice, bookingPrice, bookingProfile, bookingStatusLabel, cairoNowSlot,
  formatBookingPrice, formatBookingSlot, normalizeArabic, validBookingSlot } from './booking-core.js?v=20261122-step4';

let currentUser = null;
let activeTeachers = [];
let assignedTeacher = { uid: null, name: "ضياء الدين نبيل" };
let bookingTeachersReady = Promise.resolve();
const selectedScienceTeachers = { science: "محمد خالد محمود", chemistry: "محمد خالد محمود" };

const form = document.getElementById("bookingForm");
const statusBox = document.getElementById("bookingStatus");
const teacherSelect = document.getElementById("bookingTeacher");
const sectionSelect = document.getElementById("bookingSection");
const subjectInput = form?.elements?.subject;
const teacherAutoHint = document.getElementById("teacherAutoHint");

// Google Translate (or the browser translator) changes visible <option> text.
// Never use translated text as a stored Firestore enum value. The selected
// position stays stable across Arabic, English, French, and Russian.
const BOOKING_SELECT_VALUES = Object.freeze({
  section: [
    "", "القرآن الكريم", "التزكية والتربية", "اللغة العربية",
    "العلوم الشرعية", "التعليم الأزهري", ENGLISH_SUBJECT,
    "العلوم", "الرياضيات", "البرمجة وتكنولوجيا المعلومات"
  ],
  educationType: ["", "غير مرتبط بنظام تعليمي", "أزهري", "عام", "لغات"],
  lessonType: [
    "حصة فردية", "مراجعة", "حل تدريبات / امتحانات",
    "تأسيس", "متابعة", "تحفيظ"
  ],
  preferredDay1: ["", "السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"],
  preferredDay2: ["", "السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"],
  preferredPeriod: ["صباحًا", "ظهرًا", "مساءً"],
  lessonMode: ["أونلاين", "حضوري"]
});

function canonicalBookingSelection(name) {
  const select = form?.elements?.namedItem?.(name) || form?.elements?.[name];
  const choices = BOOKING_SELECT_VALUES[name];
  if (!select || !choices || !Array.isArray(choices)) return "";
  const index = select.selectedIndex;
  return Number.isInteger(index) && index >= 0 && index < choices.length
    ? choices[index]
    : "";
}


const params = new URLSearchParams(window.location.search);
const initialSection = params.get("section");
const initialTeacher = params.get('teacher') || '';
const initialSubject = params.get('subject')?.trim().slice(0, 150) || '';

function detectTeacherAssignment() {
  const canonicalSection = canonicalBookingSelection("section");
  const combined = normalizeArabic(`${canonicalSection} ${subjectInput?.value || ""}`);

  if (canonicalSection === ENGLISH_SUBJECT) return englishAssignment();

  if (combined.includes("برمج") || combined.includes("تكنولوجيا المعلومات")) {
    return {
      key: "programming",
      targetName: "مالك سامح",
      hint: "تم اختيار مالك سامح تلقائيًا لأن المادة/القسم برمجة أو تكنولوجيا معلومات."
    };
  }

  if (/انجليز|english/.test(combined)) return englishAssignment();

  const requestedSubject = normalizeArabic(subjectInput?.value || "");
  // Maths is taught by Saad Alaa; science/chemistry may be taught by either teacher.
  if (normalizeArabic(canonicalSection) === "الرياضيات" || requestedSubject.includes("رياضيات") || requestedSubject.includes("رياضه") || requestedSubject.includes("math")) {
    return { key:"math", targetName:"سعد علاء", hint:"الرياضيات مع الأستاذ سعد علاء." };
  }
  // Preserve the previous science teacher; allow choosing Saad Alaa as well.
  if (normalizeArabic(subjectInput?.value || "").includes("كيمياء")
      || normalizeArabic(subjectInput?.value || "").includes("chemistry")) {
    return {
      key: "chemistry",
      targetName: "محمد خالد محمود",
      hint: "تم اختيار الأستاذ محمد خالد محمود تلقائيًا لمادة الكيمياء (المرحلة الثانوية)."
    };
  }

  if (requestedSubject.includes("علوم") || requestedSubject.includes("science") || normalizeArabic(canonicalSection) === normalizeArabic("العلوم")) {
    return {
      key: "science",
      targetName: "محمد خالد محمود",
      hint: "تم اختيار الأستاذ محمد خالد محمود تلقائيًا لمادة العلوم."
    };
  }

  return {
    key: "default",
    targetName: "ضياء الدين نبيل",
    hint: "تم اختيار ضياء الدين نبيل تلقائيًا لهذه المادة."
  };
}
function englishAssignment() {
  return {
    key: 'english',
    targetName: ENGLISH_TEACHER_NAME,
    hint: 'تم اختيار مستر بلال فرغلي تلقائيًا لحجز مناهج اللغة الإنجليزية.'
  };
}

function matchesTeacherName(teacher, name) {
  const n = normalizeArabic(teacher.fullName || teacher.name || teacher.displayName || teacher.email).replace(/^(الاستاذ|استاذ|مستر|ميس|ا) /, "");
  const key = normalizeArabic(name);
  return n === key || n.startsWith(key + " ");
}
function resolveActiveTeacher(name) {
  if (name === ENGLISH_TEACHER_NAME) return findEnglishTeacherAccount(activeTeachers);
  const candidates = activeTeachers.filter(t => matchesTeacherName(t, name));
  // Never bind to an ambiguous UID: teacher records are financial and private.
  return candidates.length === 1 ? candidates[0] : null;
}
function teacherChoicesFor(assignment) {
  if (assignment.key === 'english') return [
    { name: ENGLISH_TEACHER_NAME, label: 'مستر ' + ENGLISH_TEACHER_NAME }
  ];
  if (assignment.key === 'science' || assignment.key === 'chemistry') return [
    { name: 'محمد خالد محمود', label: 'أ/ محمد خالد محمود' },
    { name: 'سعد علاء', label: 'أ/ سعد علاء' }
  ];
  return [{name:assignment.targetName,label:'أ/ '+assignment.targetName}];
}
function updateAssignedTeacher() {
  const assignment = detectTeacherAssignment();
  const choices = teacherChoicesFor(assignment);
  const preferredFromLink = normalizeArabic(initialTeacher);
  const selectedFromLink = choices.find(x => preferredFromLink.includes(normalizeArabic(x.name)));
  const stored = selectedScienceTeachers[assignment.key] || assignment.targetName;
  // On the first selection, preserve the teacher chosen on the public profile card.
  const choice = choices.find(x=>x.name === (assignedTeacher._category === assignment.key ? assignedTeacher.name : ''))
    || selectedFromLink || choices.find(x=>x.name === stored) || choices[0];
  if (teacherSelect) {
    teacherSelect.replaceChildren(...choices.map(item=>{
      const found=resolveActiveTeacher(item.name);
      const option=new Option(item.label,found?.uid||'');
      option.dataset.teacherName=item.name;
      return option;
    }));
    const wanted=[...teacherSelect.options].find(x=>x.dataset.teacherName===choice.name);
    if(wanted) wanted.selected=true;
    teacherSelect.disabled=choices.length===1;
    teacherSelect.setAttribute('aria-disabled', String(choices.length===1));
  }
  const found=resolveActiveTeacher(choice.name);
  assignedTeacher={uid:found?.uid||null,name:choice.name,_category:assignment.key};
  if(teacherAutoHint)teacherAutoHint.textContent=choices.length>1
    ? 'اختر المدرس المناسب. '+(!found?'قد يحتاج ربط الحساب من الإدارة.':'')
    : assignment.hint;
  renderPrice();
}
teacherSelect?.addEventListener('change',()=>{
  const option=teacherSelect.selectedOptions[0];
  if(!option?.dataset.teacherName)return;
  const name=option.dataset.teacherName;
  const category=detectTeacherAssignment().key;
  if(category==='science'||category==='chemistry')selectedScienceTeachers[category]=name;
  const found=resolveActiveTeacher(name);
  assignedTeacher={uid:found?.uid||null,name,_category:category};
  if(teacherAutoHint)teacherAutoHint.textContent=found
    ? 'تم ربط الحجز بحساب المعلم المسجل.'
    : 'الاختيار محفوظ باسم المعلم، وتحتاج الإدارة لربطه بحسابه المعتمد.';
});

async function loadBookingTeachers(user) {
  try {
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "teacher"), where("status", "==", "active")));
    if (currentUser?.uid !== user.uid) return;
    activeTeachers = snap.docs.map(docSnap => {
      return { ...docSnap.data(), uid: docSnap.id };
    }).filter(t=>!/^علي\s+عبد\s+الحميد(?:\s|$)/.test(normalizeArabic(t.fullName || t.name || t.displayName)));
  } catch (error) {
    console.warn("تعذر تحميل حسابات المعلمين، سيتم حفظ اسم المعلم المحدد تلقائيًا:", error);
    if (currentUser?.uid !== user.uid) return;
    activeTeachers = [];
  }
  updateAssignedTeacher();
}

const $ = id => document.getElementById(id);
const field = name => form.elements.namedItem(name);
const steps = Array.from(form.querySelectorAll('.booking-step'));
const next = $('bookingNext');
const back = $('bookingBack');
const accountStatus = $('bookingAccountStatus');
const loginLink = $('bookingLogin');
const tracked = $('bookingTrackResults');
const trackedStatus = $('bookingTrackStatus');
const summary = $('bookingSummary');
const number = new Intl.NumberFormat('ar-EG');
const touchedProfileFields = new Set();
const autoProfileFields = new Map();
const subjectsForSection = {
  'اللغة العربية': ['اللغة العربية', 'النحو', 'الصرف', 'البلاغة', 'الأدب والنصوص', 'العروض والقافية'],
  'العلوم الشرعية': ['الفقه', 'التفسير', 'الحديث', 'التوحيد'],
  'التعليم الأزهري': ['النحو', 'الصرف', 'البلاغة', 'الفقه', 'التفسير', 'الحديث', 'التوحيد'],
  'العلوم': ['العلوم', 'الكيمياء'],
  'الرياضيات': ['الرياضيات'],
  'اللغة الإنجليزية': [ENGLISH_SUBJECT],
  'القرآن الكريم': ['القرآن الكريم', 'التجويد', 'التحفيظ'],
  'التزكية والتربية': ['التزكية والتربية'],
  'البرمجة وتكنولوجيا المعلومات': ['البرمجة', 'تكنولوجيا المعلومات']
};
let step = 0;
let bookingSubmitting = false;
let pendingRef = null;
let stopTracking;
let session = 0;
let profile = {};

function switchStep(index, focus = true) {
  step = index;
  steps.forEach((item, position) => { item.hidden = position !== step; });
  back.hidden = step === 0;
  next.textContent = step === steps.length - 1 ? 'إرسال طلب الحجز' : 'التالي';
  $('bookingProgress').textContent = 'الخطوة ' + number.format(step + 1) + ' من ' + number.format(steps.length);
  if (focus) steps[step].querySelector('legend').focus();
}

function showStatus(message, state = '') {
  statusBox.textContent = message;
  statusBox.className = 'booking-status ' + state;
}

function restoreLinkSelections() {
  if (BOOKING_SELECT_VALUES.section.includes(initialSection)) sectionSelect.value = initialSection;
  subjectInput.value = initialSubject;
}

function renderSubjects() {
  const section = canonicalBookingSelection('section');
  const subjects = subjectsForSection[section] || [ENGLISH_SUBJECT, 'الرياضيات', 'الكيمياء', 'العلوم'];
  $('zadBookingSubjects').replaceChildren(...subjects.map(subject => new Option(subject, subject)));
}

function selections() {
  const data = Object.fromEntries(Array.from(new FormData(form), ([key, value]) => [key, String(value).trim()]));
  for (const key of Object.keys(BOOKING_SELECT_VALUES)) data[key] = canonicalBookingSelection(key);
  if (data.requestedSlot && !data.preferredDay1 && !data.preferredDay2) data.preferredPeriod = '';
  return data;
}

function proposedPrice(data) {
  return data.subject ? bookingPrice(data, assignedTeacher._category) : null;
}

function renderPrice() {
  const price = proposedPrice({section: canonicalBookingSelection('section'), subject: subjectInput.value.trim(), lessonType: canonicalBookingSelection('lessonType')});
  $('bookingPrice').textContent = price === null
    ? 'الإدارة بتبلّغك بسعر الحصة قبل تأكيد الموعد.'
    : 'سعر الحصة: ' + formatBookingPrice(price);
}

function addDetail(list, label, value) {
  if (!value) return;
  const row = document.createElement('div');
  const name = document.createElement('dt');
  const detail = document.createElement('dd');
  name.textContent = label;
  detail.textContent = value;
  row.append(name, detail);
  list.append(row);
}

function showSummary(data) {
  const price = proposedPrice(data);
  summary.replaceChildren();
  for (const [label, value] of [
    ['الطالب', data.fullName],
    ['الصف والنظام', [data.grade, data.educationType].filter(Boolean).join(' · ')],
    ['المادة', data.subject],
    ['المعلم', assignedTeacher.name],
    ['نوع الحصة', data.lessonType + ' · ' + data.lessonMode],
    ['سعر الحصة', price === null ? 'الإدارة بتبلّغك بالسعر قبل تأكيد الموعد' : formatBookingPrice(price)],
    ['الأيام والفترة', [data.preferredDay1, data.preferredDay2, data.preferredPeriod].filter(Boolean).join(' · ')],
    ['الموعد المقترح', formatBookingSlot(data.requestedSlot)],
    ['الهاتف', data.phone],
    ['البريد الإلكتروني', data.email],
    ['ملاحظاتك', data.notes]
  ]) addDetail(summary, label, value);
}

function fillProfile(user) {
  const values = bookingProfile(user, profile);
  for (const [key, raw] of Object.entries(values)) {
    const control = field(key);
    if (!raw || touchedProfileFields.has(key) ||
        (control.value && control.value !== autoProfileFields.get(key))) continue;
    if (key === 'educationType' && !BOOKING_SELECT_VALUES.educationType.includes(raw)) continue;
    const value = String(raw).trim();
    control.value = control.maxLength > 0 ? value.slice(0, control.maxLength) : value;
    autoProfileFields.set(key, control.value);
  }
  if (!field('educationType').value && !touchedProfileFields.has('educationType')) {
    const grade = normalizeArabic(values.grade);
    const detected = grade.includes('ازهر') ? 'أزهري' : grade.includes('عام') ? 'عام' : '';
    if (detected) {
      field('educationType').value = detected;
      autoProfileFields.set('educationType', detected);
    }
  }
}

function drawBookings(snapshot) {
  tracked.replaceChildren();
  const bookings = snapshot.docs.filter(item => !item.metadata.hasPendingWrites)
    .map(item => ({id: item.id, data: item.data()}))
    .sort((a, b) => (b.data.createdAt?.toMillis?.() || 0) - (a.data.createdAt?.toMillis?.() || 0));
  trackedStatus.textContent = bookings.length ? '' : 'لسه مفيش طلبات حجز في حسابك.';
  for (const {id, data} of bookings) {
    const article = document.createElement('article');
    article.className = 'booking-track-card';
    article.id = 'booking-' + id;
    const title = document.createElement('h3');
    title.textContent = data.subject || data.section || 'طلب حصة';
    const status = document.createElement('strong');
    status.className = 'booking-track-badge';
    status.dataset.status = data.status || 'جديد';
    const confirmed = data.status === 'تم الحجز' || data.status === 'مكتمل';
    const confirmedSlot = confirmed ? formatBookingSlot(data.confirmedSlot) : '';
    status.textContent = data.status === 'تم الحجز' && !confirmedSlot ? 'تم الحجز' : bookingStatusLabel(data.status || 'جديد');
    const details = document.createElement('dl');
    details.className = 'booking-summary';
    addDetail(details, 'المعلم', data.teacherName || 'جاري تحديد المعلم');
    addDetail(details, 'الموعد المؤكد', confirmedSlot);
    if (!confirmedSlot) {
      const preferences = [data.preferredDay1, data.preferredDay2, data.preferredPeriod].filter(Boolean).join(' · ');
      addDetail(details, 'تفضيلات الموعد', formatBookingSlot(data.requestedSlot) || preferences);
    }
    const officialPrice = confirmed ? asBookingPrice(data.confirmedPrice) : null;
    const quote = asBookingPrice(data.quotedPrice);
    if (officialPrice !== null) addDetail(details, 'السعر المؤكد', formatBookingPrice(officialPrice));
    else if (quote !== null) addDetail(details, 'السعر المعروض عند الطلب', formatBookingPrice(quote));
    article.append(title, status, details);
    tracked.append(article);
  }
}

function startTracking(user, request) {
  trackedStatus.textContent = 'جارٍ تحميل طلباتك…';
  const scope = query(collection(db, 'bookings'), where('studentUid', '==', user.uid));
  stopTracking = onSnapshot(scope, {includeMetadataChanges: true}, snapshot => {
    if (request === session) drawBookings(snapshot);
  }, error => {
    if (request !== session) return;
    tracked.replaceChildren();
    trackedStatus.textContent = 'تعذر تحميل طلباتك. جرّب تحديث الصفحة.';
    console.warn('تعذر تحميل الحجوزات', error);
  });
}

function resetBooking(user) {
  form.reset();
  touchedProfileFields.clear();
  autoProfileFields.clear();
  assignedTeacher = {uid: null, name: 'ضياء الدين نبيل'};
  selectedScienceTeachers.science = selectedScienceTeachers.chemistry = 'محمد خالد محمود';
  restoreLinkSelections();
  renderSubjects();
  if (user) fillProfile(user);
  updateAssignedTeacher();
}

form.addEventListener('input', event => {
  if (['fullName', 'phone', 'email', 'grade', 'stage', 'educationType'].includes(event.target.name)) {
    touchedProfileFields.add(event.target.name);
  }
  if (statusBox.classList.contains('error')) showStatus('');
});
loginLink.addEventListener('click', () => {
  try {
    sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search + location.hash);
  } catch {}
});
back.addEventListener('click', () => {
  showStatus('');
  switchStep(step - 1);
});
sectionSelect.addEventListener('change', () => {
  const section = canonicalBookingSelection('section');
  if (section === ENGLISH_SUBJECT || section === 'الرياضيات') subjectInput.value = section;
  else if ([ENGLISH_SUBJECT, 'الرياضيات'].includes(subjectInput.value)) subjectInput.value = '';
  renderSubjects();
  updateAssignedTeacher();
});
subjectInput.addEventListener('input', updateAssignedTeacher);
field('lessonType').addEventListener('change', renderPrice);

restoreLinkSelections();
renderSubjects();
updateAssignedTeacher();
switchStep(0, false);
form.noValidate = true;

onAuthStateChanged(auth, user => {
  if (session && currentUser?.uid === user?.uid) return;
  const previous = currentUser;
  const request = ++session;
  currentUser = user;
  profile = {};
  pendingRef = null;
  activeTeachers = [];
  bookingSubmitting = false;
  back.disabled = false;
  tracked.replaceChildren();
  stopTracking?.();
  stopTracking = undefined;
  if (previous) {
    resetBooking(null);
    switchStep(0, false);
    showStatus('');
  }
  next.disabled = !user;
  loginLink.hidden = Boolean(user);
  accountStatus.textContent = user ? 'بيانات حسابك هتتعبّى تلقائيًا وتقدر تعدّلها في الطلب.' : 'سجّل دخولك علشان تكمل الحجز.';
  updateAssignedTeacher();
  bookingTeachersReady = user ? loadBookingTeachers(user) : Promise.resolve();
  if (!user) {
    trackedStatus.textContent = 'سجّل دخولك علشان تتابع طلباتك.';
    return;
  }
  fillProfile(user);
  startTracking(user, request);
  getDoc(doc(db, 'users', user.uid)).then(snapshot => {
    if (request !== session || !snapshot.exists()) return;
    profile = snapshot.data();
    fillProfile(user);
    if (step === steps.length - 1 && !bookingSubmitting) showSummary(selections());
  }).catch(error => console.warn('تعذر تعبئة بيانات الحجز من الحساب', error));
});

function validateStep(index, data, show) {
  const invalid = Array.from(steps[index].querySelectorAll('input, select, textarea')).find(control =>
    control.willValidate && (!control.validity.valid || (control.required && !control.value.trim())));
  const hasDays = data.preferredDay1 && data.preferredDay2;
  const needsDays = index === 2 && !data.requestedSlot && !hasDays;
  const sameDay = index === 2 && hasDays && data.preferredDay1 === data.preferredDay2;
  const problem = invalid ??
    (needsDays ? field(data.preferredDay1 ? 'preferredDay2' : 'preferredDay1') : null) ??
    (sameDay ? field('preferredDay2') : null) ??
    (index === 2 && data.requestedSlot && (!validBookingSlot(data.requestedSlot) || data.requestedSlot <= cairoNowSlot())
      ? field('requestedSlot') : null);
  if (!problem) return true;
  if (show) {
    if (index !== step) switchStep(index, false);
    if (invalid && !invalid.validity.valid) {
      invalid.reportValidity();
      showStatus('أكمل البيانات المطلوبة في الخطوة دي.', 'error');
    } else {
      const message = invalid ? 'أكمل البيانات المطلوبة في الخطوة دي.'
        : needsDays ? 'اختار تاريخ وساعة أو يومين مناسبين.'
        : sameDay ? 'اختار يومين مختلفين.'
        : 'اختار تاريخ وساعة في المستقبل بتوقيت القاهرة.';
      showStatus(message, 'error');
      problem.focus();
    }
  }
  return false;
}

async function saveBooking(data) {
  const request = session;
  const studentUid = currentUser.uid;
  const {name: teacherName, _category: category} = assignedTeacher;
  const amount = proposedPrice(data);
  const autoAssignedTeacher = teacherSelect.disabled;
  const bookingRef = pendingRef || doc(collection(db, 'bookings'));
  pendingRef = bookingRef;
  bookingSubmitting = true;
  next.disabled = true;
  back.disabled = true;
  showStatus('جارٍ إرسال طلبك…');
  try {
    if (category === 'english') await bookingTeachersReady;
    if (request !== session || auth.currentUser?.uid !== studentUid) return;
    let saved = false;
    try {
      await setDoc(bookingRef, {
        ...data,
        teacherUid: resolveActiveTeacher(teacherName)?.uid || null,
        teacherName,
        studentUid,
        status: 'جديد',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: 'booking',
        bookingVersion: 4,
        autoAssignedTeacher,
        quotedPrice: amount
      });
    } catch (error) {
      const receipt = await getDocFromServer(bookingRef).catch(() => null);
      if (!receipt?.exists() || receipt.data().studentUid !== studentUid) throw error;
      saved = true;
    }
    if (request !== session) return;
    if (!saved) {
      addDoc(collection(db, 'notifications'), {
        audience: 'admin',
        targetRole: 'admin',
        type: 'booking',
        title: '📅 طلب حجز حصة جديد',
        message: `الطالب ${data.fullName} أرسل طلب حجز لمادة ${data.subject} مع ${teacherName}.`,
        bookingId: bookingRef.id,
        studentUid,
        createdBy: studentUid,
        createdAt: serverTimestamp(),
        readBy: []
      }).catch(error => console.warn('تم حفظ الحجز، وتعذر إرسال إشعار الإدارة.', error));
    }
    pendingRef = null;
    resetBooking(currentUser);
    switchStep(0, false);
    showStatus('✅ الطلب اتبعت. تابع حالة الطلب والموعد في «حجوزاتي».', 'success');
    const trackLink = document.createElement('a');
    trackLink.href = '#my-bookings';
    trackLink.textContent = 'افتح حجوزاتي';
    statusBox.append(' ', trackLink);
    statusBox.tabIndex = -1;
    statusBox.focus();
  } catch (error) {
    if (request !== session) return;
    console.error('تعذر إرسال طلب الحجز', error);
    showStatus('تعذر إرسال الطلب. بياناتك لسه موجودة، جرّب الإرسال تاني.', 'error');
  } finally {
    if (request === session) {
      bookingSubmitting = false;
      back.disabled = false;
      next.disabled = false;
    }
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (bookingSubmitting || !currentUser) return;
  showStatus('');
  const data = selections();
  if (step < steps.length - 1) {
    if (!validateStep(step, data, true)) return;
    if (step === steps.length - 2) showSummary(data);
    switchStep(step + 1);
    return;
  }
  if ([0, 1, 2].some(index => !validateStep(index, data, true))) return;
  void saveBooking(data);
});
