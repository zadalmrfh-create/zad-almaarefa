/* =========================================================
   QURAN SECTION PAGE — BEHAVIOR
   1) Accordion
   2) CTA Scroll
   3) Flow: Sections → Lessons
   4) Search
   5) Filters
========================================================= */

/* ---------------------------------------------------------
   1) ACCORDION
--------------------------------------------------------- */

// افتح جميع العناصر عند تحميل الصفحة
document.querySelectorAll(".acc-item").forEach(function (item) {
  item.classList.add("open");
});

// فتح وغلق كل عنصر بشكل مستقل
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
   3) FLOW
--------------------------------------------------------- */

const stepStage = document.getElementById("stepStage");
const stepLessons = document.getElementById("stepLessons");

const lessonsGrid = document.getElementById("lessonsGrid");
const emptyState = document.getElementById("emptyState");

const searchInput = document.getElementById("searchInput");
const noResults = document.getElementById("noResults");

const lessonsLabel = document.getElementById("lessonsLabel");
const sectionDescription = document.getElementById("sectionDescription");

const filterBar = document.getElementById("filterBar");

let currentFilter = "all";

/* ---------- Show Step ---------- */

function showStep(step) {
  [stepStage, stepLessons].forEach(function (el) {
    el.classList.add("is-hidden");
  });

  step.classList.remove("is-hidden");

  step.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

/* ---------- Open Section ---------- */

document.querySelectorAll(".stage-row").forEach(function (row) {
  row.addEventListener("click", function () {
    openLessonsStep(row.dataset.stage);
  });
});

function openLessonsStep(sectionKey) {
  const section = QURAN_DATA[sectionKey];

  lessonsLabel.textContent = section.title;

  // وصف القسم
  sectionDescription.innerHTML = section.description || "";

  lessonsGrid.innerHTML = "";

  emptyState.classList.add("is-hidden");
  noResults.classList.add("is-hidden");

  if (section.lessons.length === 0) {
    emptyState.classList.remove("is-hidden");
    filterBar.innerHTML = "";
  }

  currentFilter = "all";

  function renderLessons() {
    const term = searchInput.value.trim().toLowerCase();

    const filtered = section.lessons.filter(function (lesson) {
      const matchesSearch = lesson.name.toLowerCase().includes(term);

      const matchesFilter =
        currentFilter === "all" ||
        normalizeType(lesson.fileType) === currentFilter;

      return matchesSearch && matchesFilter;
    });

    lessonsGrid.innerHTML = "";

    noResults.classList.toggle("is-hidden", filtered.length > 0);

    filtered.forEach(function (lesson) {
      lessonsGrid.appendChild(buildLessonCard(lesson));
    });
  }

  createFilters(section, renderLessons);

  searchInput.value = "";
  searchInput.oninput = renderLessons;

  renderLessons();

  showStep(stepLessons);
}

/* ---------------------------------------------------------
   FILTERS
--------------------------------------------------------- */

function normalizeType(type) {
  const t = String(type).toLowerCase();

  if (t === "pdf") return "pdf";

  if (t === "mp3" || t === "audio") {
    return "audio";
  }

  if (t === "mp4" || t === "video") {
    return "video";
  }

  if (t === "jpg" || t === "jpeg" || t === "png" || t === "image") {
    return "image";
  }

  if (t === "exam") {
    return "exam";
  }

  if (t === "book") {
    return "book";
  }

  return t;
}

function getFilterLabel(type) {
  const labels = {
    all: "✨ الكل",
    pdf: "📄 PDF",
    image: "🖼 صور",
    video: "🎥 فيديوهات",
    audio: "🎵 صوت",
    exam: "📝 اختبار",
    book: "📚 كتب",
  };

  return labels[type] || type;
}

function createFilters(section, renderCallback) {
  filterBar.innerHTML = "";

  const types = [
    ...new Set(
      section.lessons.map(function (lesson) {
        return normalizeType(lesson.fileType);
      }),
    ),
  ];

  const filters = ["all", ...types];

  filters.forEach(function (type) {
    const btn = document.createElement("button");

    btn.className = "filter-btn" + (type === "all" ? " active" : "");

    btn.textContent = getFilterLabel(type);

    btn.addEventListener("click", function () {
      document.querySelectorAll(".filter-btn").forEach(function (b) {
        b.classList.remove("active");
      });

      btn.classList.add("active");

      currentFilter = type;

      renderCallback();
    });

    filterBar.appendChild(btn);
  });
}

/* ---------------------------------------------------------
   Lesson Card
--------------------------------------------------------- */

function buildLessonCard(lesson) {
  const wrapper = document.createElement("div");

  wrapper.className = "lesson-card-wrapper";

  let actionLabel = "فتح الملف";

  switch (lesson.fileType.toLowerCase()) {
    case "pdf":
      actionLabel = "⬇ تحميل الدرس";
      break;

    case "mp4":
    case "video":
      actionLabel = "▶ مشاهدة الفيديو";
      break;

    case "jpg":
    case "png":
    case "image":
      actionLabel = "🖼 فتح الصورة";
      break;

    case "exam":
    case "اختبار":
      actionLabel = "📝 فتح الاختبار";
      break;

    case "mp3":
    case "audio":
      actionLabel = "🎧 استماع للصوت";
      break;
  }

  wrapper.innerHTML =
    '<div class="lesson-card">' +
    '<div class="lesson-info">' +
    '<div class="lesson-name">' +
    lesson.name +
    "</div>" +
    '<div class="lesson-meta">' +
    "<span>" +
    lesson.fileType +
    "</span>" +
    "<span>" +
    lesson.meta +
    "</span>" +
    "</div>" +
    '<div class="lesson-source">' +
    lesson.source +
    "</div>" +
    "</div>" +
    '<div class="lesson-icon">📖</div>' +
    "</div>" +
    '<a href="' +
    lesson.downloadUrl +
    '" class="download-btn" target="_blank">' +
    actionLabel +
    "</a>";

  return wrapper;
}

/* ---------------------------------------------------------
   BACK BUTTON
--------------------------------------------------------- */

document.querySelectorAll(".step-back").forEach(function (btn) {
  btn.addEventListener("click", function () {
    if (btn.dataset.back === "stage") {
      showStep(stepStage);
    }
  });
});
