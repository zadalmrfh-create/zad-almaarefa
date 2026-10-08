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

const params = new URLSearchParams(window.location.search);
const initialSection = params.get("section");
if (initialSection && [...sectionSelect.options].some(o => o.value === initialSection)) sectionSelect.value = initialSection;

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
function isProgrammingChoice() {
  const combined = normalizeArabic(`${sectionSelect?.value || ""} ${subjectInput?.value || ""}`);
  return combined.includes("برمج");
}
function matchesTeacher(teacher, programming) {
  const n = normalizeArabic(teacher.name);
  return programming ? (n.includes("مالك") && n.includes("سامح")) : (n.includes("ضياء") && n.includes("نبيل"));
}
function updateAssignedTeacher() {
  const programming = isProgrammingChoice();
  const targetName = programming ? "مالك سامح" : "ضياء الدين نبيل";
  const found = activeTeachers.find(t => matchesTeacher(t, programming));
  assignedTeacher = { uid: found?.uid || null, name: targetName };

  if (teacherSelect) {
    teacherSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = assignedTeacher.uid || "";
    option.textContent = assignedTeacher.name;
    option.selected = true;
    teacherSelect.appendChild(option);
  }
  if (teacherAutoHint) {
    teacherAutoHint.textContent = programming
      ? "تم اختيار مالك سامح تلقائيًا لأن المادة/القسم برمجة."
      : "تم اختيار ضياء الدين نبيل تلقائيًا لهذه المادة.";
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

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!requireLogin()) return;

  updateAssignedTeacher();
  const data = Object.fromEntries(new FormData(form).entries());

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

    statusBox.innerHTML = `<strong>✅ تم استلام طلب الحجز</strong><br>الحالة: <b>في انتظار التأكيد</b><br>المعلم المحدد: ${assignedTeacher.name}<br><small>يمكنك متابعة حالة الطلب من لوحة حسابك.</small>`;
    statusBox.className = "booking-status success";
    form.reset();
    if (initialSection && [...sectionSelect.options].some(o => o.value === initialSection)) sectionSelect.value = initialSection;
    updateAssignedTeacher();
  } catch (error) {
    console.error(error);
    statusBox.textContent = "تعذر إرسال الطلب: " + (error.code || error.message);
    statusBox.className = "booking-status error";
  }
});
