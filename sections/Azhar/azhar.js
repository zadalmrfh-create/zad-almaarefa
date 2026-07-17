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
        name: " book 1",
        level: "إعدادي",
        link: "https://www.lkhibra.ma/books/clean-code.pdf",
      },
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
    exams: [
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
  },
  prep2: {
    library: [
      {
        name: " book 1",
        level: "إعدادي",
        link: "https://www.lkhibra.ma/books/clean-code.pdf",
      },
    ],
    exams: [],
  },
  prep3: {
    library: [
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
        name: " book 1",
        level: "إعدادي",
        link: "https://www.lkhibra.ma/books/clean-code.pdf",
      },
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
      {
        name: " book 1",
        level: "إعدادي",
        link: "https://www.lkhibra.ma/books/clean-code.pdf",
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
        name: " book 1",
        level: "إعدادي",
        link: "https://www.lkhibra.ma/books/clean-code.pdf",
      },
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
      {
        name: " book 1",
        level: "إعدادي",
        link: "https://www.lkhibra.ma/books/clean-code.pdf",
      },
    ],
    exams: [],

    Video: [
      {
        name: "امتحان نحوss ثاني ثانوي",
        level: "ثانوي",
        link: "https://drive.gssoogle.com/...",
      },
    ],
  },
  sec3: {
    library: [
      {
        name: "فقه الصف الثالث",
        level: "ثانوي",
        link: "https://drive.google.com/...",
      },
      {
        name: "تفسير الصف الثالث",
        level: "ثانوي",
        link: "https://drive.google.com/...",
      },
      {
        name: "صرف الصف الثالث",
        level: "ثانوي",
        link: "https://drive.google.com/...",
      },
    ],
    exams: [
      {
        name: "امتحان فقه ثالث ثانوي",
        level: "ثانوي",
        link: "https://drive.google.com/...",
      },
      {
        name: "امتحان تفسير ثالث ثانوي",
        level: "ثانوي",
        link: "https://drive.google.com/...",
      },
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
