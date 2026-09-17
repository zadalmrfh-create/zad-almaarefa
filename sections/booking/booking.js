import { auth, db } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, user => {
  currentUser = user;
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

const params = new URLSearchParams(window.location.search);
const initialSection = params.get("section");
if (initialSection && [...sectionSelect.options].some(o => o.value === initialSection)) {
  sectionSelect.value = initialSection;
}

async function loadBookingTeachers() {
  if (!teacherSelect) return;
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.role === "teacher" && data.status === "active") {
        const option = document.createElement("option");
        option.value = docSnap.id;
        option.textContent = data.fullName || data.name || data.email || "معلم";
        option.dataset.name = option.textContent;
        teacherSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.warn("تعذر تحميل المعلمين:", error);
  }
}
loadBookingTeachers();

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!requireLogin()) return;

  const data = Object.fromEntries(new FormData(form).entries());

  if (data.preferredDay1 === data.preferredDay2) {
    statusBox.textContent = "اختر يومين مختلفين للحصة.";
    statusBox.className = "booking-status error";
    return;
  }

  const teacherOption = teacherSelect?.selectedOptions?.[0];

  const payload = {
    ...data,
    teacherUid: data.teacherUid || null,
    teacherName: teacherOption?.dataset.name || null,
    studentUid: currentUser?.uid || null,
    status: "جديد",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    source: "booking",
    bookingVersion: 2
  };

  try {
    const bookingRef = await addDoc(collection(db, "bookings"), payload);

    await addDoc(collection(db, "notifications"), {
      audience: "admin",
      targetRole: "admin",
      type: "booking",
      title: "📅 طلب حجز حصة جديد",
      message: `الطالب ${data.fullName || "غير معروف"} أرسل طلب حجز في قسم ${data.section || "غير محدد"} لمجال ${data.subject || "غير محدد"}.`,
      bookingId: bookingRef.id,
      studentUid: currentUser?.uid || null,
      createdBy: currentUser?.uid || null,
      createdAt: serverTimestamp(),
      readBy: []
    });

    statusBox.textContent = "تم إرسال طلبك بنجاح، وسيتم التواصل معك لتأكيد الموعد.";
    statusBox.className = "booking-status success";
    form.reset();

    if (initialSection && [...sectionSelect.options].some(o => o.value === initialSection)) {
      sectionSelect.value = initialSection;
    }
  } catch (error) {
    console.error(error);
    statusBox.textContent = "تعذر إرسال الطلب: " + (error.code || error.message);
    statusBox.className = "booking-status error";
  }
});
