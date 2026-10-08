import { auth, db } from "../../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { trackBookDownload } from "../book-download-tracker.js";
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
  if (!requireLogin("يجب تسجيل الدخول أولاً لبدء التعلم.")) return;
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
    link: "https://drive.google.com/file/d/1dq4D5q_yfrAeaiLKzO42rbvemd9r99pP/view?usp=drive_link",
},
{
    name: "الامتحان لغة عربية الصف الأول الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/17LhcQFPzQEFs7YD6xhWGGwyWT7guCNC4/view?usp=drive_link",
},
{
    name: "الامتحان علوم الصف الأول الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1ZZav3mb4OZplWqbtJwkiXPV1GPfdzTW1/view?usp=drive_link",
},
{
    name: "ملزمة التكنولوجيا الصف الأول الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1WWVeJjAa8Bs-zu_zM4UTqR_VbZqDoe12/view?usp=drive_link",
},
{
    name: "الامتحان دراسات الصف الأول الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1j37XpQaXAA-Oesjtb6HydVuzdQ-C2s5q/view?usp=drive_link",
},
{
    name: "المعاصر لغة إنجليزية الصف الأول الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1Yi0-eJTPlRHKzc8XPpr1HdEF9xdXpaAp/view?usp=drive_link",
},
    ],
    /*exams: [
      {
        name: " book 1",
        level: "إعدادي",
        link: "https://www.lkhibra.ma/books/clean-code.pdf",
      },
      {
        name: " book 1",
        level: "إعدادي",
        link: "https://www.lkhibra.ma/books/clean-code.pdf",
      },
    ],
    */
  },
  prep2: {
    library: [
{
    name: "الامتحان علوم الصف الثاني الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1fzqBSuqsttawdBdPvDmQEjp2oVxyqr1H/view?usp=drive_link",
},
{
    name: "الامتحان دراسات الصف الثاني الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1i7PeWXHbWRjJrYMGZdvIZRTx4hVDRuA3/view?usp=drive_link",
},
{
    name: "المعاصر رياضيات الصف الثاني الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1ocsDfpmNOEvZRlBI1m9aB3JSBi4Fu6gw/view?usp=drive_link",
},
{
    name: "المعاصر لغة إنجليزية الصف الثاني الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1K8xYLeviKBguJFasa7kO_TJF34MBB1Vq/view?usp=drive_link",
},
    ],
    exams: [],
  },
  prep3: {
    library: [
{
    name: "المعاصر رياضيات الصف الثالث الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1zIJ4svOF4IsT_PBRQWlmfcCBWjxagyz0/view?usp=drive_link",
},
{
    name: "المعاصر لغة إنجليزية الصف الثالث الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1hVWPWByO5nRULxBDCZWDZzi7G6oHSzko/view?usp=drive_link",
},
{
    name: "الامتحان لغة عربية الصف الثالث الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1ORwHbtyzX-zyuJSGRf9WYbLaapgbMYpH/view?usp=drive_link",
},
{
    name: "الامتحان علوم الصف الثالث الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1Mc1Q6G1soGxmeOZRHznYNuWyPnT-aPRn/view?usp=drive_link",
},
{
    name: "الامتحان دراسات الصف الثالث الإعدادي",
    level: "إعدادي",
    link: "https://drive.google.com/file/d/1rD0WGymogkXApO5HqZnNd4Jfm5U_I1Nx/view?usp=drive_link",
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
  link: "https://mega.nz/file/rzwmnbTK#WR9CtqCSCibctDOA02eKI-sCW3MrwlOMCAk7dZIxC_c",
},
{
  name: "المرشد توحيد الصف الأول الثانوي",
  level: "1ث",
  link: "https://mega.nz/file/f35yEa4B#FUDYLKUD6n88miqZSPDjoF8XREWWDRtgLKxkVHAVZ1U",
},
{
  name: "المرشد حديث الصف الأول الثانوي",
  level: "1ث",
  link: "https://mega.nz/file/2nRQEZDC#xf7BAdsXi9Xzmz5mbi6N0RvZU_0ZSqgDhDskiShDSOg",
},
{
  name: "المرشد نحو الصف الأول الثانوي",
  level: "1ث",
  link: "https://mega.nz/file/6iwHzCqQ#wZbEYdJRAa0bIlF5EGQpJ9TRU1tnWd9DQNU8AMuHVs0",
},
{
  name: "الأضواء عربي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1qhnfoVw74K7FDGgRscfQXy759NnVcLtY/view?usp=drive_link",
},
{
  name: "فرنساوي ميرسي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1rrz6KarNnOB3L3Jfa109wauuTs0jvLyA/view?usp=drive_link",
},
{
  name: "الأضواء عربي مراجعة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1ltZjpsRV64ALz5Bpse9LsS4y2Bcee3UW/view?usp=drive_link",
},
{
  name: "الأضواء عربي تقييمات الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1CpThgg4fCOEmVDCvZmh_HbSAmW-2Sjm7/view?usp=drive_link",
},
{
  name: "ملحق الأضواء علوم متكاملة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1H-2ICFsvfkTKesoMxOanAl3Rx3DhCstu/view?usp=drive_link",
},
{
  name: "كتاب عربي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/13DW55NjOF5I8dNBd35M46UUXp0yKR9Cx/view?usp=drive_link",
},
{
  name: "الامتحان عربي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1KnXeBlg55WYaYhhifuTcmJ1Dpd5S9I1b/view?usp=drive_link",
},
{
  name: "الأضواء علوم متكاملة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1PsgEAkU7C9Uwwbi7XegOdqE2UgeYt_cH/view?usp=drive_link",
},
{
  name: "العمالقة إنجليزي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1aiq0yHIilTl4EY-F-FqGjhTL08Cxhqtl/view?usp=drive_link",
},
{
  name: "فلسفة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1btrNcUge5sb2RnhDMDahXMbO5qiPBqGC/view?usp=drive_link",
},
{
  name: "ملحق 1 جبر الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1REL1is1xLiD5lhbOljdUY3pRUNizDolD/view?usp=drive_link",
},
{
  name: "الامتحان علوم متكاملة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1XsIqMqrHe1k-gDjwJU9snZcRec0-hsXy/view?usp=drive_link",
},
{
  name: "التفوق علوم متكاملة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1OBBXrnd-Nt48C7Dd-OEWXy7ME8-rWr0Y/view?usp=drive_link",
},
{
  name: "المعاصر رياضيات الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1cm_QDWab7zlJqqbqdlLwHC8UFtFXqrjK/view?usp=drive_link",
},
{
  name: "ملحق الامتحان عربي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1kSk392Y9f7EBeeXGtv-nFXzVML8xZ9lx/view?usp=drive_link",
},
{
  name: "المعاصر رياضيات الإجابات الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1416D3A5CmMiA1trCwtugp6jSHC7yTs4o/view?usp=drive_link",
},
{
  name: "المعاصر رياضيات الامتحانات الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1VTV0M1u6MUagu_qN-jp_y78e0nJbLKlH/view?usp=drive_link",
},
{
  name: "المعاصر إنجليزي الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1Y_uI-TxZgBKdGD-xggXwBAFDSAQIUix1/view?usp=drive_link",
},
{
  name: "جيم الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1LEHlWj9BFpSmns4oa2C__Duj6b-TlRZh/view?usp=drive_link",
},
{
  name: "مذكرة الامتحان علوم متكاملة الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1xANfNeRQywstGSY44PZoPcewkURemoa3/view?usp=drive_link",
},
{
  name: "مذكرة الامتحان علوم متكاملة الصف الأول الثانوي الترم الأول 2027 (1)",
  level: "1ث",
  link: "https://drive.google.com/file/d/160pd-gWKZPJNFPC13fMoITflbO_Xh_vC/view?usp=drive_link",
},
{
  name: "تاريخ الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1kUveRazC3SicFQdwFcsjjJVjAdwJdOQT/view?usp=drive_link",
},
{
  name: "ملحق 2 جيم الصف الأول الثانوي الترم الأول 2027",
  level: "1ث",
  link: "https://drive.google.com/file/d/1JAAitPtVWADKM5wLBqHhX-FtCAz0pM0A/view?usp=drive_link",
},
    
    // كتب مضافة بتاريخ 2026-10-06
{
  name: "المرشد أدب ونصوص الصف الأول الثانوي ترم أول 2026",
  level: "1ث",
  link: "https://mega.nz/file/vvhQmAoY#ehm6Fpy5_hMkcuqPRkkLjPPULwjb9Oa0A_udH3QmM7k",
},
{
  name: "سلاح الأزهري فقه شافعي الصف الأول الثانوي 2026",
  level: "1ث",
  link: "https://mega.nz/file/umZThA7B#fDFJW_55o4yNMXNuau_moxqA1kzgwHpgprrduWJgL84",
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
  link: "https://drive.google.com/file/d/1ihoqInpKCQN-1USJUNR06RAHYERYA7Pj/view?usp=drive_link",
},
{
  name: "العروض والقافية ج2",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/126brxtdcY4sw2oA2fxpogb2JXImfKI2F/view?usp=drive_link",
},
{
  name: "المرشد رياضيات ج2 - بحتة وتطبيقية - ترم أول",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1qXqpgiUL8SpC4_9873ZI0Ohz8xBv4S5j/view?usp=drive_link",
},
{
  name: "المرشد فيزياء 2 ثانوي - ترم 1 - بنك إلكتروني",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1o0GVlpd0WX8xAwcr2wWL_IqnxJ2ijqfq/view?usp=drive_link",
},
{
  name: "المطالعة والإنشاء ج2",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1SpbmDctxGkWSexFPMxatRHuDkXPhlriH/view?usp=drive_link",
},
{
  name: "الامتحان علم نفس ج2 ترم أول 2026",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1o1xTTi7dKXEDRwCKrw1zgZZR-gvH74cV/view?usp=drive_link",
},
{
  name: "المرشد كيمياء 2 ثانوي - ترم 1 - بنك إلكتروني",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1DrvCOFxdFo7uQX52RnNiXaBhCKhju31F/view?usp=drive_link",
},
{
  name: "امتحان كيمياء 2 ث 2026",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1DzrHo5F8d5dLlk9PTa0q5_6OkdTz3e_x/view?usp=drive_link",
},
{
  name: "الامتحان فيزياء 2 ثانوي ترم 1 - بنك إلكتروني",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1D0ML3_cW58FLOhJHI4JY3cHtu8hrWWpx/view?usp=drive_link",
},
{
  name: "المرشد تفسير ج2 2026 ترم أول للعلوم الشرعية",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1_cWDHvuFTN-3VtR2MLLnj4JD5xgCayG8/view?usp=drive_link",
},
{
  name: "المرشد فقه مالكي ج2 2026 للعلوم الشرعية",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1ZQEc4iFBP0PtOo4Zqs-xo1n1azXS7zlF/view?usp=drive_link",
},
{
  name: "المعاصر لغة إنجليزية 2 ثانوي ج2 ترم 1 - بنك إلكتروني",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1FbGw1JHauDI5gavVEA4xSCWw1FEVYZll/view?usp=drive_link",
},
{
  name: "المتفوقون الامتحان جغرافيا ج2 ترم أول 2026",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1kKxfDYo8kbruJKzHF9NCmpXOQ_GMoQkM/view?usp=drive_link",
},
{
  name: "المتفوقون الامتحانات تاريخ ج2 ترم أول 2026",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/16INt48lGDUKF2xf2uxqnv53W6FxR0lAS/view?usp=drive_link",
},
{
  name: "برافو لغة فرنسية 2 ثانوي - ترم 1 - بنك إلكتروني",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1J8SMBKu5ctexcVYgbEsi7RPZQ9i5PvX-/view?usp=drive_link",
},
{
  name: "كتاب المرشد فقه حنفي ثانية ثانوي 2026",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1wahrwIUBgIJi5D_NGt3Rsh4aJB8Aekbz/view?usp=drive_link",
},
{
    name: "المرشد صرف الصف الثاني الثانوي",
    level: "ثانوي",
    link: "https://drive.google.com/file/d/1rIplobAzBr1biVtWAIlEixHQqy65AZ8Y/view?usp=drivesdk",
},
{
    name: "المرشد نحو الصف الثاني الثانوي",
    level: "ثانوي",
    link: "https://drive.google.com/file/d/1McNFaKF35dJT0JhJrVtSpBNPgQD2rS3M/view?usp=drivesdk",
},
{
    name: "المرشد أدب ونصوص الصف الثاني الثانوي",
    level: "ثانوي",
    link: "https://drive.google.com/file/d/1XZq0ojVX0DdMdIdxP71z7Kme4_an0Zoh/view?usp=drivesdk",
},

    
{
  name: "كتاب التوحيد الصف الثاني الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/12tnHpw5SYIURnlk5FuLb-mCQIcrcIOBh/view?usp=drive_link",
},
{
  name: "كتاب الحديث الصف الثاني الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/10fb9EuCsFonyb4Kg1A6zuTDjBP_MSigw/view?usp=drive_link",
},
    // كتب مضافة بتاريخ 2026-10-06
{
  name: "كتاب مندليف كيمياء أسئلة تانية ثانوي ترم أول 2023",
  level: "2ث",
  link: "https://mega.nz/file/ijoyWA7C#0ngKA0aZp-CYj2vfHxbk3vmpO4P3HiGmcV8TyjMTJfg",
},
{
  name: "إجابات المعاصر رياضيات 2ث بكالوريا 2027",
  level: "2ث",
  link: "https://mega.nz/file/T2oXia7B#8z1p6Gmnfn9ShM35KeGU_h8nEplnJgkv_Pl62Fue3xY",
},
{
  name: "المذكرة النهائية لتانية عام (مش بكالوريا)",
  level: "2ث",
  link: "https://mega.nz/file/y3oRRJyK#L9PajE8mv3DA0MKFSKcIUMCdfAj0DXPMxY5V4L6zKSY",
},
{
  name: "كتاب التدريبات محمد صلاح 2 بكالوريا 2027",
  level: "2ث",
  link: "https://mega.nz/file/qvYlCYbS#Ptr0EQmWC0PWJB5t9JVw1xlSfnHnGQEFwDUCR6PXdLE",
},
{
  name: "محمد صلاح روائع الأدب 2 بكالوريا 2027",
  level: "2ث",
  link: "https://mega.nz/file/ymAXCZ7Z#R8glPkbztKxODcZYQyqnoK55c3ogqv8UmujX365JbSQ",
},
{
  name: "محمد صلاح شرح الجزء الأول 2 بكالوريا 2027",
  level: "2ث",
  link: "https://mega.nz/file/b75TjZrR#PIvu2WfJAArRDi8ZTXZcCjrxC1FMadhXvCJI0dAB6HI",
},
{
  name: "محمد صلاح شرح الجزء الثاني 2 بكالوريا 2027",
  level: "2ث",
  link: "https://mega.nz/file/aqYA2RaD#X-rpnCQBoLmlj6TFDduJZoAvAe0yCPFqY8ynoodwR7A",
},
{
  name: "محمد صلاح طلع الأديب 2 بكالوريا 2027",
  level: "2ث",
  link: "https://mega.nz/file/O2ZVCZoS#NDxCWTaJLf-mluL0qxeKH6ySmQnV8KcoEKvXWS4xuKk",
},
{
  name: "محمد صلاح قاف ثاء 2 بكالوريا 2027",
  level: "2ث",
  link: "https://mega.nz/file/GzYBnBQY#9cH5O7FTmb7AVIOWpUcfZzrutNS10X4RFBEdY_vKqYw",
},
{
  name: "محمد صلاح كتالوج 2 بكالوريا 2027",
  level: "2ث",
  link: "https://mega.nz/file/2vQ1ELhQ#nqlD9cV38gSFR3T3PGMEPqnFvIXU9bXRjf20KLoQJD4",
},
{
  name: "سلاح الأزهري حديث تانية ثانوي",
  level: "2ث",
  link: "https://drive.google.com/file/d/1dhSQW2ylHgPrukXXgvKYiY8eVie0ggjt/view?usp=drivesdk",
},
{
  name: "سلاح الأزهري تفسير الجزء العلمي تانية ثانوي",
  level: "2ث",
  link: "https://drive.google.com/file/d/1ZDwplO-3Ove3gOZpQbyh3OGo7_WvdVvF/view?usp=drivesdk",
},
{
  name: "سلاح الأزهري تفسير الجزء الأدبي تانية ثانوي",
  level: "2ث",
  link: "https://drive.google.com/file/d/1Hk2yvGCPGA-WKInaG4C9tdyUzkAqHvXn/view?usp=drivesdk",
},
{
  name: "سلاح الأزهري توحيد تانية ثانوي",
  level: "2ث",
  link: "https://drive.google.com/file/d/1W8qB0rR8phgzp5MutriRLVG6b9psJ4QJ/view?usp=drivesdk",
},
{
  name: "سلاح الأزهري صرف تانية ثانوي",
  level: "2ث",
  link: "https://drive.google.com/file/d/1duJz3E4kZ5vAb5BphQeziw-B-7fMjXXt/view?usp=drivesdk",
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
  link: "https://drive.google.com/file/d/1ryem3Z6CxtRe4-7TzIOJebzJpq_loa9r/view?usp=drivesdk",
},

{
  name: "فيزياء أسئلة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1Z_AeuxCts0riMDDeK4qGAsfVkG6LEk2e/view?usp=drivesdk",
},

{
  name: "فيزياء إجابات الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1xUYf4EGYiewwLPCgw1qaajC0BIegI-zr/view?usp=drivesdk",
},

{
  name: "جغرافيا جزء المراجعة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1sJrklZEP5YwxC4eFp6RDx0jmjg7774Eu/view?usp=drivesdk",
},

{
  name: "جغرافيا جزء الأسئلة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1aKlyfGqF8IL-_c1bHzaU0HU-yV-VDzES/view?usp=drivesdk",
},

{
  name: "جغرافيا جزء الشرح الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1XX0QXMqwYF7ig1fM3sCbXuhOlh3RAJQg/view?usp=drivesdk",
},

{
  name: "أحياء شرح الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1XCYsg0r5sQGQy0NWL5txNS9Ms786WCco/view?usp=drivesdk",
},

{
  name: "أحياء أسئلة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/14NJ9ESSZadCv3Nq2MihHMPXYU_UGYkSR/view?usp=drivesdk",
},

{
  name: "أحياء إجابات الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1SQn5d9HHQBWjz-uVrEervIyvgiUBMLWG/view?usp=drivesdk",
},

{
  name: "ملحق رياضة بحتة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/18Vj7F1PUWEhTVusTCRgURtmwV9Wf5x7n/view?usp=drivesdk",
},

{
  name: "ملحق رياضة تطبيقية الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1XmmozfOy2_YKJv9zZqGYPqy3MyhewvfR/view?usp=drivesdk",
},

{
  name: "رياضة تطبيقية الجزء الأول الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1VWSPmghAp6amd9yuKFAWd1sNf-9jfFK_/view?usp=drivesdk",
},

{
  name: "رياضة تطبيقية الجزء الثاني الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1cPv8rkFuWmQLea70MLQDshBwO3_aw0Wg/view?usp=drivesdk",
},

{
  name: "رياضة بحتة الجزء الأول الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/16b8MzyjuSVvKJImSHsMgL2jHgM4B6Hid/view?usp=drivesdk",
},

{
  name: "رياضة بحتة الجزء الثاني الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1KdUI0zM3XM9yrbdBGFUZkEOdZsdMx6iq/view?usp=drivesdk",
},

{
  name: "إنجليزي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/15-KD_4pYTENe0XNYqZ6XQa-1lKzem5vH/view?usp=drivesdk",
},

{
  name: "المرشد بلاغة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1e5OBbCevs2rq9LHzswlL5Vl8xNJuggRh/view?usp=drivesdk",
},

{
  name: "بوكليت المرشد بلاغة الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1uwHL9R9mB717JJGmICMjIRVRn6uERbwY/view?usp=drivesdk",
},

{
  name: "المرشد أدب ونصوص الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/12RZoZLrc7IGDDWMyN5bb5pViToVia5vH/view?usp=drivesdk",
},

{
  name: "بوكليت أدب ونصوص الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1sLLScAFpqRHNGny4v4G1bsMCq3Pj0tj0/view?usp=drivesdk",
},

{
  name: "المرشد نحو الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1iZgv-qr1nxMleP7CdW0zajS5m1TftbeZ/view?usp=drivesdk",
},

{
  name: "بوكليت المرشد نحو الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1BzW9yvFHnzT30SxrbBsc_ijTzSoAD1UQ/view?usp=drivesdk",
},

{
  name: "المرشد تفسير الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1x5Z_ImjQbQgF9VxTNgKJMmIpH2IBtAbe/view?usp=drivesdk",
},

{
  name: "المرشد صرف الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1BGoKxDyH0rcVShAIQ02t6_wHuVpJ-Yz8/view?usp=sharing",
},

{
  name: "بوكليت صرف الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/116dQrxV9CMN21GLbfg8LI-jzR4o8x1Eo/view?usp=drivesdk",
},

{
  name: "توحيد بوكليت الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1LtWQGEX2EbVqS5Gc4lg_yS2TGA4fB0T9/view?usp=drivesdk",
},

{
  name: "المرشد توحيد الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1LtWQGEX2EbVqS5Gc4lg_yS2TGA4fB0T9/view?usp=sharing",
},

{
  name: "بوكليت فقه مالكي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1glJa9fixkWw6fRjUBHE65oa8fHniaUEy/view?usp=drivesdk",
},

{
  name: "المرشد فقه مالكي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1iapB4zFilAHZ43Kr_bKaYa9eQZKRNwSa/view?usp=drivesdk",
},

{
  name: "بوكليت فقه حنفي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1k4t-4ZkcaR3J52YszdYt5NrLtUxZT1KJ/view?usp=drivesdk",
},

{
  name: "المرشد فقه حنفي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1k4t-4ZkcaR3J52YszdYt5NrLtUxZT1KJ/view?usp=drivesdk",
},

{
  name: "بوكليت حديث الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1JsXIogFUODI7xmqbREnh8i5IirWuvs83/view?usp=drivesdk",
},

{
  name: "المرشد حديث الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1SybW7j_NoCUsql5e8WYTl59xtLbNzuOC/view?usp=drivesdk",
},

{
  name: "فقه شافعي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1swkx5QuwACycN1-Azvh8li7yYFM8jquE/view?usp=drivesdk",
},

{
  name: "بوكليت فقه شافعي الصف الثالث الثانوي",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1ti2q5g9jP-ukEob7MI4X8bFUw1hnH59B/view?usp=drivesdk",
},
    
    // كتب مضافة بتاريخ 2026-10-06
{
  name: "أحياء كراسة الذهبي الصف الثالث الثانوي 2026",
  level: "3ث",
  link: "https://mega.nz/file/Cip0BDjI#0g1ovANQp8iVyW_JngNzR_tz2kp7k4iKAFcofZGLOKE",
},
{
  name: "الطيب كيمياء الصف الثالث الثانوي 2027",
  level: "3ث",
  link: "https://mega.nz/file/a7JFFTLT#XuYWxry0gMDIJF0v9ByLUCZkNp_Hd_BDs5DwYfTXDy0",
},
{
  name: "الطيب كيمياء الصف الثالث الثانوي إجابات 2027",
  level: "3ث",
  link: "https://mega.nz/file/i2pA2b7I#umgbZ5gEnnn_nbFOn23YSH-OuMrUDCPRZDkoF5Uje9I",
},
{
  name: "بوكلت سلاح الأزهري النحو الصف الثالث الثانوي 2026",
  level: "3ث",
  link: "https://mega.nz/file/b7pVESjT#9banVppcOfLgWAUkYG_p1X7TJKS4bKfRd5cMPlEI8cY",
},
{
  name: "سلاح الأزهري توحيد الصف الثالث الثانوي 2026",
  level: "3ث",
  link: "https://mega.nz/file/GzhXWb6B#iqqXoAYDXOSxJ2RN2r0vJzOvyO3Ixb4VRXIYM2cTxNU",
},
{
  name: "سلاح الأزهري فقه شافعي الصف الثالث الثانوي 2026",
  level: "3ث",
  link: "https://mega.nz/file/ejYG0ZiC#XkAY94gny5EbstpgaEpb5u28eNb7yfOZSlHRlLBYJdw",
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

await loadAdminAzharBooks();

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

    card.innerHTML = `
      <div class="result-header">${subject.name}</div>
      <div class="result-meta">
        <span class="meta-icon">🎓 ${subject.level}</span>
      </div>
      <div class="result-footer">
        <button class="download-btn protected-download">
          ${actionLabel}
        </button>
      </div>
    `;

    const downloadBtn = card.querySelector(".protected-download");
    downloadBtn.addEventListener("click", function () {
      if (state.resource === "library") {
        if (!requireLogin("الكتب مجانية وبدون اشتراك، لكن يجب تسجيل الدخول أولاً حتى يتم تسجيل التحميل باسمك.")) {
          try { sessionStorage.setItem("redirectAfterLogin", "../sections/Azhar/azhar.html"); } catch (e) {}
          return;
        }

        trackBookDownload({
          title: subject.name,
          url: subject.link,
          source: "azhar",
          sourceLabel: "مكتبة التعليم الأزهري",
          grade: state.grade?.name || subject.level || "",
          category: subject.level || ""
        }).catch((error) => console.warn("تعذر تسجيل تحميل الكتاب:", error));
      } else if (!requireLogin("يجب تسجيل الدخول أولاً للوصول إلى هذا المحتوى.")) {
        return;
      }

      window.open(subject.link, "_blank", "noopener,noreferrer");
    });

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
