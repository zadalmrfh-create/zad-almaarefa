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
document.getElementById("ctaStart").addEventListener("click", function () {
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
  name: "كتب تاريخ 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1mqkxa7TgN5d6Z5qt1zZs9ZySw3MDnkCZ/view?usp=drivesdk",
},
{
  name: "كتب فلسفة 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/162vwXgoyAmRKcTjj1sxqzJuNOLgKhMAY/view?usp=drivesdk",
},
{
  name: "كتب لغة عربية 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1mmPDwmWmhxQCpgSpLYtls4UJrDdWh5qm/view?usp=drivesdk",
},
{
  name: "كتب رياضيات 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1wEwttMNFE_B_72kfOMjGySnCj0_KAGRL/view?usp=drivesdk",
},
{
  name: "كتب إنجليزي 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1Xe9dq-Hgx_sYhDJlz6PernGmsLlEIw-S/view?usp=drivesdk",
},
{
  name: "كتب فرنساوي 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1-rkGQn27qD2EOQSmP5IUIwm2Eal-RaR1/view?usp=drivesdk",
},
{
  name: "كتب علوم متكاملة 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1ruvmWf54DNr9WeVEjBoGpz7JJwb3wt3D/view?usp=drivesdk",
},
{
  name: "كتب نحو 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1j_fwW5OXW5uXHgNEOKQIyNMSoDUVSAmq/view?usp=drivesdk",
},
{
  name: "كتب صرف 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1V35LhkSmFXjU-GqxNx2DUZQxK1wFgE32/view?usp=drivesdk",
},
{
  name: "كتب بلاغة 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1y_AO9kYUw-Q2tk2Fy0kkHtuh9i2VRn3Z/view?usp=drivesdk",
},
{
  name: "كتب توحيد 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/18r6wAA3kUZF1df_IH6Dp64h7ZUzGtnlz/view?usp=drivesdk",
},
{
  name: "كتب حديث 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1OmEFPtSISKtQGqDYVG8I2XAcy4f95Q07/view?usp=drivesdk",
},
{
  name: "كتب تفسير 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1xes4-HYavziTnixzD7y3lcPWx0jLilEU/view?usp=drivesdk",
},
{
  name: "كتب فقه شافعي 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1_KObjwQrbyFMJmkg8h6gCSug30etbL6H/view?usp=drivesdk",
},
{
  name: "كتب فقه حنفي 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1M5UYdIsdwCt-aGQIF8tGxg1OTb03rKMq/view?usp=drivesdk",
},
{
  name: "كتب فقه مالكي 1ث",
  level: "1ث",
  link: "https://drive.google.com/file/d/1OtNdNw4ocdAQwoFLV9PJ3UWenMnBL923/view?usp=drivesdk",
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
  name: "المرشد فقه حنفي ج2 - 2025 - المرشد للعلوم الشرعية",
  level: "ثانوي",
  link: "https://drive.google.com/file/d/1F45dkDC2Y8vM3yrORf0GER0KGGomz3NG/view?usp=drive_link",
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

    ],
    exams: [],

  video: [ ],
  },
  sec3: {
    library: [

    ],
    exams: [

    ],
  },
};

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
        <button class="download-btn" onclick="window.open('${subject.link}', '_blank')">
          ${actionLabel}
        </button>
      </div>
    `;

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
