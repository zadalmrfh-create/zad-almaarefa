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
        name: "كراسة الخط العربي 1",
        level: "إعدادي",
        link: "https://drive.google.com/file/d/1qoWwrk4NeQ6GNY4KfS1cXLXupLxkPYTF/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 2",
        level: "إعدادي",
        link: "https://drive.google.com/file/d/1-o-K_VMW8GYMeabUcmGGZhi3cYThVrVw/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 3",
        level: "إعدادي",
        link: "https://drive.google.com/file/d/1uj35_tceS-W7oBgGP-KRRti1Js6bD1ia/view?usp=drivesdk",
      }
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
        name: "كراسة الخط العربي 1",
        level: "إعدادي",
        link: "https://drive.google.com/file/d/1qoWwrk4NeQ6GNY4KfS1cXLXupLxkPYTF/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 2",
        level: "إعدادي",
        link: "https://drive.google.com/file/d/1-o-K_VMW8GYMeabUcmGGZhi3cYThVrVw/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 3",
        level: "إعدادي",
        link: "https://drive.google.com/file/d/1uj35_tceS-W7oBgGP-KRRti1Js6bD1ia/view?usp=drivesdk",
      }
    ],
    exams: [],
  },
  prep3: {
    library: [
      {
        name: "كراسة الخط العربي 1",
        level: "إعدادي",
        link: "https://drive.google.com/file/d/1qoWwrk4NeQ6GNY4KfS1cXLXupLxkPYTF/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 2",
        level: "إعدادي",
        link: "https://drive.google.com/file/d/1-o-K_VMW8GYMeabUcmGGZhi3cYThVrVw/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 3",
        level: "إعدادي",
        link: "https://drive.google.com/file/d/1uj35_tceS-W7oBgGP-KRRti1Js6bD1ia/view?usp=drivesdk",
      }
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
        name: "كراسة الخط العربي 1",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1qoWwrk4NeQ6GNY4KfS1cXLXupLxkPYTF/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 2",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1-o-K_VMW8GYMeabUcmGGZhi3cYThVrVw/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 3",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1uj35_tceS-W7oBgGP-KRRti1Js6bD1ia/view?usp=drivesdk",
      },
      {
        name: "المرشد – بلاغة",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1pXucpoq2AFaGeQ7J97yqZEvecXh0GFrd/view?usp=drivesdk",
      },
      {
        name: "المرشد – حديث",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1-TrFsxzne3L8Nhx6Ce9vNebqtUpa510B/view?usp=drivesdk",
      },
      {
        name: "ملخص بلاغة",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1BvmOxdHLK3X8OjDlZyso-qTiaPuurYDm/view?usp=drivesdk",
      },
      {
        name: "الفلسفة والمنطق",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1-gVXvVRaWPXN_FD4eNk3e4Ctxi0tMylb/view?usp=drivesdk",
      },
      {
        name: "بلاغة سلاح الأزهري",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/12PE-Av0f1RlZnjwOa-h9Q3UlgINknUy9/view?usp=drivesdk",
      },
      {
        name: "المرشد – إنشاء",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1XYa2wPndygmwhrJHtpdwC2a4arIzBuZ6/view?usp=drivesdk",
      },
      {
        name: "المرشد – توحيد",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/10IZdVEnImYEALdfGvSqteG5ZWE2QrED1/view?usp=drivesdk",
      },
      {
        name: "المرشد – فقه حنفي",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1-CcqhKNtf_uqzEdLhcMV49DdelZxTQ-p/view?usp=drivesdk",
      },
      {
        name: "المنطق",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1mT8AdXIe3cpSi7zDip8qz2GYt3ezkCmY/view?usp=drivesdk",
      },
      {
        name: "المرشد – صرف",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1lMnZqztmwscoSEnJtJozDtzV1wsKMEQ-/view?usp=drivesdk",
      },
      {
        name: "المرشد – نحو",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1maPTZuaOIbg20s_aYv50sTKCSCfkd1hR/view?usp=drivesdk",
      },
      {
        name: "ملخص رياضيات أولى ثانوي",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1Ed-Z58tekYzBKlBzfyn6AiysYJlc9C5w/view",
      },
      {
        name: "امتحانات هندسة أزهر",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1R5w7QMqlvnM0nHNuZ56R1jKBbUFVvbaR/view?usp=drivesdk",
      },
      {
        name: "مذكرة الثقافة الإسلامية",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1unpeTqxJqjReBfpkI4sTI3jfsipfSCD8/view?usp=drivesdk",
      },
      {
        name: "مذكرة التوحيد",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1oLNgveGbnWDCqrwepXMO98nojad4UYt0/view?usp=drivesdk",
      },
      {
        name: "مذكرة التفسير",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1rP9NNNgaRAyilisnQ8MdSvU4L4b1CRXI/view?usp=drivesdk",
      },
      {
        name: "مذكرة الفقه الشافعي",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1NaZDvzh-eE0RitAsb61Rv3UmvLgWGtms/view?usp=drivesdk",
      },
      {
        name: "كتاب فلسفة ومنطق – الامتحان",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1fv3_nLOJfjxcccyXrhyVPITbgw1kVE65/view?usp=drivesdk",
      },
      {
        name: "المرشد – تاريخ",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1z1Ve8cbUQFsy3hOCy5tIp9UzIrO_lCwx/view?usp=drive_link",
      },
      {
        name: "كتاب الفلسفة والمنطق – الوزارة",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1lk63FLv9difNd0Yf-G0sCHqiurcNwTXz/view?usp=drive_link",
      },
      {
        name: "المرشد – تفسير",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1yeTqhmDpNhQD_ui6-F0Pam6cCQkvvCDB/view?usp=drivesdk",
      },
      {
        name: "المرشد – أدب ومطالعة ونصوص وإنشاء",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/142NxGArN8Rr1h1GRqYkb8w-O3D5tnzW2/view?usp=drivesdk",
      },
      {
        name: "المرشد – فقه مالكي",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1XRZOLTF1on5adiDW3TPVCtp-ePvkKzVg/view?usp=drive_link",
      },
      {
        name: "قوانين العلوم المتكاملة",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1Zl5lnK2e9IzR_3uyuH_WWvKE52QTO804/view?usp=drivesdk",
      },
      {
        name: "ملخص العلوم المتكاملة – الدروس الأولى",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1ZtlsM1g8zHlt0XqA_fvlLJTztxODlJiu/view?usp=drivesdk",
      },
      {
        name: "ملخص العلوم المتكاملة الشامل",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1uRVygzrI6I5_rPkYWaMsiJZrP6v6cyil/view?usp=drivesdk",
      },
      {
        name: "ملخص الأدب والنصوص والمطالعة",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1MQDiaWBsmCJDhdOoKqaFmT2FXsBMj-Tg/view?usp=drivesdk",
      },
      {
        name: "ملخص الصرف المبسط",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1lMnZqztmwscoSEnJtJozDtzV1wsKMEQ-/view?usp=drivesdk",
      },
      {
        name: "إجابات المعاصر – رياضيات",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1JLKN5t3YCBli-Qw2Pj86cRPs2-LgXSgv/view",
      },
      {
        name: "ملخص التاريخ",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1Ry91T_uYodmPk1gUmMvj7HDVnxlVGx88/view?usp=drivesdk",
      },
      {
        name: "ملخص جرامر الإنجليزية",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1EL-w1upI_yc3O_rrMN7SYHwQWl6J6PD1/view?usp=drivesdk",
      },
      {
        name: "ملخص البلاغة المركز",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1AedRSDBmUXTnWMlLDSE5G-CU7bue2Ppg/view?usp=drivesdk",
      },
      {
        name: "ملخص الإسلاميات",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1nZXbPCHYGqeAbqkNgxrf7mwT7rPnYJqb/view?usp=drivesdk",
      },
      {
        name: "ملخص التوحيد المركز",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1WzdnRZn70UhTCX2fs6wcK3CfzGQe-ns5/view?usp=drivesdk",
      },
      {
        name: "ملخص الإنشاء في 3 ورقات",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/16qTJuegnhHUXEzmONy8b0JTErCK-9TA8/view?usp=drivesdk",
      },
      {
        name: "ملخص الفقه الشافعي",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1irfgjmgOtgObxAX7BpOGQNrADDVeC_jn/view?usp=drivesdk",
      },
      {
        name: "ملخص الحديث وعلومه",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1B5BjUIUKDWHpVE4KxtdDyu1gmK89Gym7/view?usp=drivesdk",
      },
      {
        name: "ملخص التفسير وعلومه",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1-Q0XlGHhUatV9du2AsX4zpNsVt4V-kd9/view?usp=drivesdk",
      },
      {
        name: "ملخص علوم القرآن",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1Yt3qqOKusydV-2yBJFgQCIWc6PfuqrfC/view?usp=drivesdk",
      },
      {
        name: "توقعات أسئلة الماضي في القرآن",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/17ZrcAPPhKu2gm9gDy4d6D8ZF5S1OB2fH/view?usp=drivesdk",
      }
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
        name: "كراسة الخط العربي 1",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1qoWwrk4NeQ6GNY4KfS1cXLXupLxkPYTF/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 2",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1-o-K_VMW8GYMeabUcmGGZhi3cYThVrVw/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 3",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1uj35_tceS-W7oBgGP-KRRti1Js6bD1ia/view?usp=drivesdk",
      }
    ],
    exams: [],

   video: [
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
        name: "كراسة الخط العربي 1",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1qoWwrk4NeQ6GNY4KfS1cXLXupLxkPYTF/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 2",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1-o-K_VMW8GYMeabUcmGGZhi3cYThVrVw/view?usp=drivesdk",
      },
      {
        name: "كراسة الخط العربي 3",
        level: "ثانوي",
        link: "https://drive.google.com/file/d/1uj35_tceS-W7oBgGP-KRRti1Js6bD1ia/view?usp=drivesdk",
      }
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
