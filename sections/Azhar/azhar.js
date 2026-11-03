import { auth, db } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
/* =========================================================
   AZHAR EDUCATION PAGE — BEHAVIOR
   Organized in 3 independent parts:
   1) Accordion (Section 1)
   2) CTA smooth scroll (Section 2)
   3) Educational flow: stage -> grade -> resource -> search (Section 3)
========================================================= */

/* ---------------------------------------------------------
/* ---------------------------------------------------------
   1) ACCORDION
--------------------------------------------------------- */

// افتح كل العناصر عند تحميل الصفحة
document.querySelectorAll(".acc-item").forEach(function (item) {
  item.classList.add("open");
});

// كل عنصر يفتح ويقفل لوحده
document.querySelectorAll(".acc-trigger").forEach(function (trigger) {
  trigger.addEventListener("click", function () {
    const item = trigger.closest(".acc-item");
    item.classList.toggle("open");
  });
});

/* ---------------------------------------------------------
   2) CTA SCROLL
--------------------------------------------------------- */
let currentUser = null;

onAuthStateChanged(auth, (u) => {
  currentUser = u;
});

function requireLogin(message) {
  if (currentUser) return true;
  alert(message || "يجب تسجيل الدخول أولاً.");
  try {
    const target = location.pathname.includes("/sections/Azhar/")
      ? "../sections/Azhar/azhar.html"
      : "../sections/library.html";
    sessionStorage.setItem("redirectAfterLogin", target);
  } catch (e) {}
  window.location.href = "../../login/index.html";
  return false;
}

document.getElementById("ctaStart").addEventListener("click", function () {
  // تصفّح قائمة الكتب مجاني، وتبقى الحماية على زر الفتح / التحميل.
  document.getElementById("flowSection").scrollIntoView({ behavior: "smooth" });
});

/* ---------------------------------------------------------
   3) EDUCATIONAL FLOW DATA
   Edit this object to add/rename grades or resource content.
--------------------------------------------------------- */
const GRADES = {
  prep: {
    label: "القسم الإعدادي",
    items: [
      { id: "prep1", name: "الصف الأول الإعدادي" },
      { id: "prep2", name: "الصف الثاني الإعدادي" },
      { id: "prep3", name: "الصف الثالث الإعدادي" },
    ],
  },
  sec: {
    label: "القسم الثانوي",
    items: [
      { id: "sec1", name: "الصف الأول الثانوي" },
      { id: "sec2", name: "الصف الثاني الثانوي" },
      { id: "sec3", name: "الصف الثالث الثانوي" },
    ],
  },
};

// Same subject list reused for every grade for this demo.
// Replace with per-grade subjects later if needed.
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const SUBJECTS = {
  prep1: {
    library: [
   {
    name: "المعاصر رياضيات الصف الأول الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "الامتحان لغة عربية الصف الأول الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "الامتحان علوم الصف الأول الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "ملزمة التكنولوجيا الصف الأول الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "الامتحان دراسات الصف الأول الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "المعاصر لغة إنجليزية الصف الأول الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
    ],
    /*exams: [
      {
        name: " book 1",
        level: "إعدادي",
        link: "../../store/index.html",
      },
      {
        name: " book 1",
        level: "إعدادي",
        link: "../../store/index.html",
      },
    ],
    */
  },
  prep2: {
    library: [
{
    name: "الامتحان علوم الصف الثاني الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "الامتحان دراسات الصف الثاني الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "المعاصر رياضيات الصف الثاني الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "المعاصر لغة إنجليزية الصف الثاني الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
    ],
    exams: [],
  },
  prep3: {
    library: [
{
    name: "المعاصر رياضيات الصف الثالث الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "المعاصر لغة إنجليزية الصف الثالث الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "الامتحان لغة عربية الصف الثالث الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "الامتحان علوم الصف الثالث الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
{
    name: "الامتحان دراسات الصف الثالث الإعدادي",
    level: "إعدادي",
    link: "../../store/index.html",
},
    ],
    exams: [
      {
        name: "امتحان بلاغة إعدادي 3",
        level: "إعدادي",
        link: "https://drive.google.com/...",
      },
      {
        name: "امتحان حديث إعدادي 3",
        level: "إعدادي",
        link: "https://drive.google.com/...",
      },
    ],
  },
  sec1: {
    library: [
{
  name: "المرشد تفسير الصف الأول الثانوي",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "المرشد توحيد الصف الأول الثانوي",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "المرشد حديث الصف الأول الثانوي",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "المرشد نحو الصف الأول الثانوي",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "الأضواء عربي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "فرنساوي ميرسي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "الأضواء عربي مراجعة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "الأضواء عربي تقييمات الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "ملحق الأضواء علوم متكاملة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "كتاب عربي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "الامتحان عربي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "الأضواء علوم متكاملة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "العمالقة إنجليزي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "فلسفة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "ملحق 1 جبر الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "الامتحان علوم متكاملة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "التفوق علوم متكاملة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "المعاصر رياضيات الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "ملحق الامتحان عربي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "المعاصر رياضيات الإجابات الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "المعاصر رياضيات الامتحانات الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "المعاصر إنجليزي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "جيم الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "مذكرة الامتحان علوم متكاملة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "مذكرة الامتحان علوم متكاملة الصف الأول الثانوي الترم الأول 2027 (1)",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "تاريخ الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "ملحق 2 جيم الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "../../store/index.html",
},
    
    // كتب مضافة بتاريخ 2026-10-06
{
  name: "المرشد أدب ونصوص الصف الأول الثانوي ترم أول 2026",
  level: "1ث",
  link: "../../store/index.html",
},
{
  name: "سلاح الأزهري فقه شافعي الصف الأول الثانوي 2026",
  level: "1ث",
  link: "../../store/index.html",
},
],
    exams:[

    ],

    /* video: [
    {
      name: "شرح البلاغة - الدرس الأول",
      level: "ثانوي",
      link: "https://www.youtube.com/watch?v=xxxx",
    },
    {
      name: "شرح الفلسفة والمنطق",
      level: "ثانوي",
      link: "https://www.youtube.com/watch?v=yyyy",
    },
    {
      name: "شرح الحديث",
      level: "ثانوي",
      link: "https://www.youtube.com/watch?v=zzzz",
    },
  ],
  */
  },
  sec2: {
    library: [
      {
  name: "المرشد بلاغة الصف الثاني الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "العروض والقافية ج2",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "المرشد رياضيات ج2 - بحتة وتطبيقية - ترم أول",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "المرشد فيزياء 2 ثانوي - ترم 1 - بنك إلكتروني",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "المطالعة والإنشاء ج2",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "الامتحان علم نفس ج2 ترم أول 2026",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "المرشد كيمياء 2 ثانوي - ترم 1 - بنك إلكتروني",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "امتحان كيمياء 2 ث 2026",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "الامتحان فيزياء 2 ثانوي ترم 1 - بنك إلكتروني",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "المرشد تفسير ج2 2026 ترم أول للعلوم الشرعية",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "المرشد فقه مالكي ج2 2026 للعلوم الشرعية",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "المعاصر لغة إنجليزية 2 ثانوي ج2 ترم 1 - بنك إلكتروني",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "المتفوقون الامتحان جغرافيا ج2 ترم أول 2026",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "المتفوقون الامتحانات تاريخ ج2 ترم أول 2026",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "برافو لغة فرنسية 2 ثانوي - ترم 1 - بنك إلكتروني",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "كتاب المرشد فقه حنفي ثانية ثانوي 2026",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
    name: "المرشد صرف الصف الثاني الثانوي",
    level: "ثانوي",
    link: "../../store/index.html",
},
{
    name: "المرشد نحو الصف الثاني الثانوي",
    level: "ثانوي",
    link: "../../store/index.html",
},
{
    name: "المرشد أدب ونصوص الصف الثاني الثانوي",
    level: "ثانوي",
    link: "../../store/index.html",
},

    
{
  name: "كتاب التوحيد الصف الثاني الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},
{
  name: "كتاب الحديث الصف الثاني الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},
    // كتب مضافة بتاريخ 2026-10-06
{
  name: "كتاب مندليف كيمياء أسئلة تانية ثانوي ترم أول 2023",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "إجابات المعاصر رياضيات 2ث بكالوريا 2027",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "المذكرة النهائية لتانية عام (مش بكالوريا)",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "كتاب التدريبات محمد صلاح 2 بكالوريا 2027",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "محمد صلاح روائع الأدب 2 بكالوريا 2027",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "محمد صلاح شرح الجزء الأول 2 بكالوريا 2027",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "محمد صلاح شرح الجزء الثاني 2 بكالوريا 2027",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "محمد صلاح طلع الأديب 2 بكالوريا 2027",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "محمد صلاح قاف ثاء 2 بكالوريا 2027",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "محمد صلاح كتالوج 2 بكالوريا 2027",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "سلاح الأزهري حديث تانية ثانوي",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "سلاح الأزهري تفسير الجزء العلمي تانية ثانوي",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "سلاح الأزهري تفسير الجزء الأدبي تانية ثانوي",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "سلاح الأزهري توحيد تانية ثانوي",
  level: "2ث",
  link: "../../store/index.html",
},
{
  name: "سلاح الأزهري صرف تانية ثانوي",
  level: "2ث",
  link: "../../store/index.html",
},
],
    exams: [],

  video: [ ],
  },
  sec3: {
    library: [
{
  name: "فيزياء شرح الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "فيزياء أسئلة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "فيزياء إجابات الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "جغرافيا جزء المراجعة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "جغرافيا جزء الأسئلة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "جغرافيا جزء الشرح الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "أحياء شرح الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "أحياء أسئلة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "أحياء إجابات الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "ملحق رياضة بحتة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "ملحق رياضة تطبيقية الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "رياضة تطبيقية الجزء الأول الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "رياضة تطبيقية الجزء الثاني الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "رياضة بحتة الجزء الأول الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "رياضة بحتة الجزء الثاني الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "إنجليزي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "المرشد بلاغة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "بوكليت المرشد بلاغة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "المرشد أدب ونصوص الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "بوكليت أدب ونصوص الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "المرشد نحو الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "بوكليت المرشد نحو الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "المرشد تفسير الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "المرشد صرف الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "بوكليت صرف الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "توحيد بوكليت الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "المرشد توحيد الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "بوكليت فقه مالكي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "المرشد فقه مالكي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "بوكليت فقه حنفي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "المرشد فقه حنفي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "بوكليت حديث الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "المرشد حديث الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "فقه شافعي",
  level: "ثانوي",
  link: "../../store/index.html",
},

{
  name: "بوكليت فقه شافعي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "../../store/index.html",
},
    
    // كتب مضافة بتاريخ 2026-10-06
{
  name: "أحياء كراسة الذهبي الصف الثالث الثانوي 2026",
  level: "3ث",
  link: "../../store/index.html",
},
{
  name: "الطيب كيمياء الصف الثالث الثانوي 2027",
  level: "3ث",
  link: "../../store/index.html",
},
{
  name: "الطيب كيمياء الصف الثالث الثانوي إجابات 2027",
  level: "3ث",
  link: "../../store/index.html",
},
{
  name: "بوكلت سلاح الأزهري النحو الصف الثالث الثانوي 2026",
  level: "3ث",
  link: "../../store/index.html",
},
{
  name: "سلاح الأزهري توحيد الصف الثالث الثانوي 2026",
  level: "3ث",
  link: "../../store/index.html",
},
{
  name: "سلاح الأزهري فقه شافعي الصف الثالث الثانوي 2026",
  level: "3ث",
  link: "../../store/index.html",
},
],
    exams: [

    ],
  },
};

async function loadAdminAzharBooks(){
  try{
    const snap=await getDocs(collection(db,"azharBooks"));
    snap.forEach(item=>{
      const b=item.data()||{};
      if(b.visible===false || !b.title || !b.url) return;
      const grade=String(b.grade||"").trim();
      if(!SUBJECTS[grade]) SUBJECTS[grade]={library:[],exams:[]};
      SUBJECTS[grade].library=SUBJECTS[grade].library||[];
      const exists=SUBJECTS[grade].library.some(x=>x.name===b.title && x.link===b.url);
      if(exists) return;
      SUBJECTS[grade].library.push({
        name:b.title, level:b.subject||b.category||"", link:b.url, icon:b.icon||"📚"
      });
    });
  }catch(error){
    console.warn("تعذر تحميل كتب مكتبة التعليم الأزهري المضافة من لوحة الإدارة:",error);
  }
}

onAuthStateChanged(auth, user => {
  if (!user) return;
  loadAdminAzharBooks().then(() => {
    if (state.resource === 'library' && state.grade) {
      renderResults(document.getElementById('searchInput')?.value || '');
    }
  });
});

const RESOURCE_ICON = {
  library: "📖",
  exams: "📝",
  video: "🎥",
};
/* Current selection state */
const state = { stage: null, grade: null, resource: null };

/* ---------------------------------------------------------
   Step elements
--------------------------------------------------------- */
const stepStage = document.getElementById("stepStage");
const stepGrade = document.getElementById("stepGrade");
const stepResource = document.getElementById("stepResource");
const stepSearch = document.getElementById("stepSearch");

function showStep(step) {
  [stepStage, stepGrade, stepResource, stepSearch].forEach(function (el) {
    el.classList.add("is-hidden");
  });
  step.classList.remove("is-hidden");
  step.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------------------------------------------------
   STEP 1 -> 1b: stage selected, render grades
--------------------------------------------------------- */
document.querySelectorAll(".stage-card").forEach(function (card) {
  card.addEventListener("click", function () {
    state.stage = card.dataset.stage;
    renderGrades(state.stage);
    showStep(stepGrade);
  });
});

function renderGrades(stageKey) {
  const stage = GRADES[stageKey];
  document.getElementById("gradeLabel").textContent = stage.label;
  document.getElementById("gradeTitle").textContent = "اختر الصف الدراسي";

  const grid = document.getElementById("gradeGrid");
  grid.innerHTML = "";

  stage.items.forEach(function (grade, index) {
    const btn = document.createElement("button");
    btn.className = "grade-card";
    btn.dataset.gradeId = grade.id;
    btn.dataset.gradeName = grade.name;
    btn.innerHTML =
      '<div class="grade-num">' +
      (index + 1) +
      "</div>" +
      '<div class="grade-name">' +
      grade.name +
      "</div>" +
      '<div class="grade-hint">المكتبة والامتحانات</div>';
    grid.appendChild(btn);
  });

  // attach listeners to the freshly created cards
  grid.querySelectorAll(".grade-card").forEach(function (card) {
    card.addEventListener("click", function () {
      state.grade = { id: card.dataset.gradeId, name: card.dataset.gradeName };
      document.getElementById("resourceLabel").textContent = state.grade.name;
      showStep(stepResource);
    });
  });
}

/* ---------------------------------------------------------
   STEP 1b -> 2: grade selected (handled above via dynamic cards)
   STEP 2 -> 3: resource selected (library / exams)
--------------------------------------------------------- */
document.querySelectorAll(".resource-card").forEach(function (card) {
  card.addEventListener("click", function () {
    // المكتبة متاحة مباشرة، بينما الامتحانات والفيديوهات تتطلب تسجيل الدخول.
    if (card.dataset.resource !== "library" && !requireLogin("يجب تسجيل الدخول أولاً للوصول إلى هذا المحتوى.")) return;
    state.resource = card.dataset.resource;
    openSearchStep();
  });
});

function openSearchStep() {
  let sectionName = "";
  let title = "";
  let placeholder = "";

  if (state.resource === "library") {
    sectionName = "المكتبة";
    title = "بحث داخل المكتبة";
    placeholder = "ابحث داخل المكتبة...";
  } else if (state.resource === "exams") {
    sectionName = "الامتحانات";
    title = "بحث داخل الامتحانات";
    placeholder = "ابحث داخل الامتحانات...";
  } else if (state.resource === "video") {
    sectionName = "الفيديوهات";
    title = "بحث داخل الفيديوهات";
    placeholder = "ابحث داخل الفيديوهات...";
  }

  document.getElementById("searchLabel").textContent =
    state.grade.name + " — " + sectionName;

  document.getElementById("searchTitle").textContent = title;

  const input = document.getElementById("searchInput");
  input.value = "";
  input.placeholder = placeholder;

  renderResults("");
  showStep(stepSearch);
  input.focus();
}
/* ---------------------------------------------------------
   STEP 3 -> 4: live search / results
--------------------------------------------------------- */
const resultsGrid = document.getElementById("resultsGrid");
const noResultsLabel = document.getElementById("noResults");

function renderResults(query) {
  const gradeId = state.grade.id;
  const list = SUBJECTS[gradeId][state.resource] || [];
  const term = query.trim().toLowerCase();

  const filtered = term
    ? list.filter((subject) => subject.name.toLowerCase().includes(term))
    : list;

  resultsGrid.innerHTML = "";
  noResultsLabel.classList.toggle("is-hidden", filtered.length > 0);

  filtered.forEach((subject) => {
    const card = document.createElement("div");
    card.className = "result-card full";

    // لو المورد مكتبة → تحميل الكتاب
    // لو المورد امتحانات → فتح الامتحان
    const actionLabel =
      state.resource === "library" ? "تحميل الكتاب" : "فتح الامتحان";

    const isBook = state.resource === "library";
    const bookAccessHref = isBook ? "../book-access.html?" + new URLSearchParams({
      url: subject.link,
      title: subject.name,
      grade: state.grade?.name || "",
      cat: subject.level || "",
      source: "azhar"
    }).toString().replaceAll("&", "&amp;") : "";

    card.innerHTML = `
      <div class="result-header">${subject.name}</div>
      <div class="result-meta">
        <span class="meta-icon">🎓 ${subject.level}</span>
      </div>
      <div class="result-footer">
        ${isBook
          ? `<a class="download-btn protected-download" href="${bookAccessHref}">${actionLabel}</a>`
          : `<button type="button" class="download-btn protected-download">${actionLabel}</button>`}
      </div>
    `;

    if (!isBook) {
      const examButton = card.querySelector(".protected-download");
      examButton.addEventListener("click", function () {
        if (!requireLogin("يجب تسجيل الدخول أولاً للوصول إلى هذا المحتوى.")) return;
        window.location.assign(subject.link);
      });
    }

    resultsGrid.appendChild(card);
  });
}

document.getElementById("searchInput").addEventListener("input", function (e) {
  renderResults(e.target.value);
});

/* ---------------------------------------------------------
   BACK BUTTONS
--------------------------------------------------------- */
document.querySelectorAll(".step-back").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const target = btn.dataset.back;
    if (target === "stage") showStep(stepStage);
    if (target === "grade") showStep(stepGrade);
    if (target === "resource") showStep(stepResource);
  });
});
