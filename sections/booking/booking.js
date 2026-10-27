import { auth, db } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let currentUser = null;
let activeTeachers = [];
let assignedTeacher = { uid: null, name: "ضياء الدين نبيل" };

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) await loadBookingTeachers();
  else updateAssignedTeacher();
});

function requireLogin(message) {
  if (currentUser) return true;
  alert(message || "يجب تسجيل الدخول أولاً لحجز حصتك.");
  window.location.href = "../../login/index.html";
  return false;
}

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
    "العلوم الشرعية", "التعليم الأزهري", "اللغة الإنجليزية",
    "العلوم", "البرمجة وتكنولوجيا المعلومات"
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
if (initialSection && [...sectionSelect.options].some(o => o.value === initialSection)) sectionSelect.value = initialSection;
const initialSubject = params.get('subject');
if (initialSubject && subjectInput) subjectInput.value = initialSubject;

function normalizeArabic(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}
function detectTeacherAssignment() {
  const canonicalSection = canonicalBookingSelection("section");
  const combined = normalizeArabic(`${canonicalSection} ${subjectInput?.value || ""}`);

  if (combined.includes("برمج") || combined.includes("تكنولوجيا المعلومات")) {
    return {
      key: "programming",
      targetName: "مالك سامح",
      hint: "تم اختيار مالك سامح تلقائيًا لأن المادة/القسم برمجة أو تكنولوجيا معلومات."
    };
  }

  if (combined.includes("انجليز") || combined.includes("english") || combined.includes("اللغه الانجليزيه") || combined.includes("اللغة الإنجليزية")) {
    return {
      key: "english",
      targetName: "علي عبد الحميد",
      hint: "تم اختيار الأستاذ علي عبد الحميد تلقائيًا لأن المادة/القسم لغة إنجليزية."
    };
  }

  // Chemistry is offered by Mohamed Khaled Mahmoud (secondary stage).
  // Keep general science assigned to Fatma Ashraf as before.
  if (normalizeArabic(subjectInput?.value || "").includes("كيمياء")
      || normalizeArabic(subjectInput?.value || "").includes("chemistry")) {
    return {
      key: "chemistry",
      targetName: "محمد خالد محمود",
      hint: "تم اختيار الأستاذ محمد خالد محمود تلقائيًا لمادة الكيمياء (المرحلة الثانوية)."
    };
  }

  if (normalizeArabic(canonicalSection) === normalizeArabic("العلوم") || (!canonicalSection && normalizeArabic(subjectInput?.value || "") === normalizeArabic("العلوم"))) {
    return {
      key: "science",
      targetName: "فاطمة أشرف",
      hint: "تم اختيار الأستاذة فاطمة أشرف تلقائيًا لأن المادة/القسم علوم."
    };
  }

  return {
    key: "default",
    targetName: "ضياء الدين نبيل",
    hint: "تم اختيار ضياء الدين نبيل تلقائيًا لهذه المادة."
  };
}
function matchesTeacher(teacher, assignmentKey) {
  const n = normalizeArabic(teacher.name);
  if (assignmentKey === "programming") return n.includes("مالك") && n.includes("سامح");
  if (assignmentKey === "english") return n.includes("علي") && n.includes("عبد") && n.includes("الحميد");
  if (assignmentKey === "science") return n.includes("فاطمه") && n.includes("اشرف");
  if (assignmentKey === "chemistry") return n.includes("محمد") && n.includes("خالد") && n.includes("محمود");
  return n.includes("ضياء") && (n.includes("نبيل") || n.includes("الدين"));
}
function updateAssignedTeacher() {
  const assignment = detectTeacherAssignment();
  const found = activeTeachers.find(t => matchesTeacher(t, assignment.key));
  assignedTeacher = { uid: found?.uid || null, name: assignment.targetName };

  if (teacherSelect) {
    teacherSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = assignedTeacher.uid || "";
    option.textContent = assignedTeacher.name;
    option.selected = true;
    teacherSelect.appendChild(option);
  }
  if (teacherAutoHint) {
    teacherAutoHint.textContent = assignment.hint;
  }
}

async function loadBookingTeachers() {
  try {
    const snap = await getDocs(query(collection(db, "users"), where("role", "==", "teacher"), where("status", "==", "active")));
    activeTeachers = snap.docs.map(docSnap => {
      const data = docSnap.data() || {};
      return { uid: docSnap.id, name: data.fullName || data.name || data.displayName || data.email || "معلم" };
    });
  } catch (error) {
    console.warn("تعذر تحميل حسابات المعلمين، سيتم حفظ اسم المعلم المحدد تلقائيًا:", error);
    activeTeachers = [];
  }
  updateAssignedTeacher();
}

sectionSelect?.addEventListener("change", updateAssignedTeacher);
subjectInput?.addEventListener("input", updateAssignedTeacher);

let bookingSubmitting = false;
form.addEventListener("submit", async event => {
  if (bookingSubmitting) { event.preventDefault(); return; }
  event.preventDefault();
  if (!requireLogin()) return;

  updateAssignedTeacher();
  const data = Object.fromEntries(new FormData(form).entries());
  // Normalize every dropdown to the Arabic database value before validation
  // and before writing to Firestore, regardless of interface language.
  for (const name of Object.keys(BOOKING_SELECT_VALUES)) {
    data[name] = canonicalBookingSelection(name);
  }
  if (Object.keys(BOOKING_SELECT_VALUES).some(name => !data[name])) {
    statusBox.textContent = "من فضلك أكمل اختيارات الحجز قبل الإرسال.";
    statusBox.className = "booking-status error";
    return;
  }
  if (!data.educationType || !["غير مرتبط بنظام تعليمي", "أزهري", "عام", "لغات"].includes(data.educationType)) {
    statusBox.textContent = "من فضلك اختر نظام التعليم أولًا.";
    statusBox.className = "booking-status error";
    form.elements.educationType?.focus();
    return;
  }

  if (data.preferredDay1 === data.preferredDay2) {
    statusBox.textContent = "اختر يومين مختلفين للحصة.";
    statusBox.className = "booking-status error";
    return;
  }

  const payload = {
    ...data,
    teacherUid: assignedTeacher.uid || null,
    teacherName: assignedTeacher.name,
    studentUid: currentUser?.uid || null,
    status: "جديد",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    source: "booking",
    bookingVersion: 3,
    autoAssignedTeacher: true
  };

  bookingSubmitting = true;
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    const bookingRef = await addDoc(collection(db, "bookings"), payload);

    // إنشاء الإشعار خطوة منفصلة حتى لا يظهر للطالب أن الحجز فشل
    // إذا تعطل الإشعار لأي سبب بعد نجاح حفظ الحجز نفسه.
    try {
      await addDoc(collection(db, "notifications"), {
        audience: "admin",
        targetRole: "admin",
        type: "booking",
        title: "📅 طلب حجز حصة جديد",
        message: `الطالب ${data.fullName || "غير معروف"} أرسل طلب حجز في قسم ${data.section || "غير محدد"} لمادة ${data.subject || "غير محدد"}. المعلم المحدد تلقائيًا: ${assignedTeacher.name}.`,
        bookingId: bookingRef.id,
        studentUid: currentUser?.uid || null,
        createdBy: currentUser?.uid || null,
        createdAt: serverTimestamp(),
        readBy: []
      });
    } catch (notificationError) {
      console.warn("تم حفظ الحجز، لكن تعذر إنشاء إشعار الإدارة:", notificationError);
    }

    statusBox.innerHTML = `<strong>✅ تم استلام طلب الحجز</strong><br>الحالة: <b>في انتظار التأكيد وتحديد الموعد</b><br>المعلم المحدد: ${assignedTeacher.name}<br><small>يمكنك متابعة حالة الطلب من لوحة حسابك.</small>`;
    statusBox.className = "booking-status success";
    form.reset();
    if (initialSection && [...sectionSelect.options].some(o => o.value === initialSection)) sectionSelect.value = initialSection;
    if (initialSubject && subjectInput) subjectInput.value = initialSubject;
    updateAssignedTeacher();
  } catch (error) {
    console.error(error);
    statusBox.textContent = "تعذر إرسال الطلب: " + (error.code || error.message);
    statusBox.className = "booking-status error";
  } finally {
    bookingSubmitting = false;
    if (submitButton) submitButton.disabled = false;
  }
});
