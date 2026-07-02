/* =========================================================
   QURAN SECTION PAGE — BEHAVIOR
   3 independent parts, same pattern as azhar.js:
   1) Accordion (Section 1)
   2) CTA smooth scroll (Section 2)
   3) Flow: choose section -> render its lessons (Section 3)
   + Search inside lessons
========================================================= */

/* ---------------------------------------------------------
   1) ACCORDION
--------------------------------------------------------- */

// افتح كل عناصر الـ Accordion عند تحميل الصفحة
document.querySelectorAll(".acc-item").forEach(function (item) {
  item.classList.add("open");
});

// كل عنصر يفتح ويقفل بشكل مستقل
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
   3) FLOW: section -> lessons
--------------------------------------------------------- */
const stepStage = document.getElementById("stepStage");
const stepLessons = document.getElementById("stepLessons");
const lessonsGrid = document.getElementById("lessonsGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const noResults = document.getElementById("noResults");

function showStep(step) {
  [stepStage, stepLessons].forEach(function (el) {
    el.classList.add("is-hidden");
  });

  step.classList.remove("is-hidden");
  step.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelectorAll(".stage-row").forEach(function (row) {
  row.addEventListener("click", function () {
    const sectionKey = row.dataset.stage;
    openLessonsStep(sectionKey);
  });
});

function openLessonsStep(sectionKey) {
  const section = QURAN_DATA[sectionKey];

  document.getElementById("lessonsLabel").textContent = section.title;
  lessonsGrid.innerHTML = "";
  emptyState.classList.add("is-hidden");

  if (section.lessons.length === 0) {
    emptyState.classList.remove("is-hidden");
  } else {
    section.lessons.forEach(function (lesson) {
      lessonsGrid.appendChild(buildLessonCard(lesson));
    });
  }

  // إعادة تهيئة السيرش عند فتح القسم
  searchInput.value = "";

  searchInput.oninput = function (e) {
    const term = e.target.value.trim().toLowerCase();

    const filtered = term
      ? section.lessons.filter(function (lesson) {
          return lesson.name.toLowerCase().includes(term);
        })
      : section.lessons;

    lessonsGrid.innerHTML = "";

    noResults.classList.toggle("is-hidden", filtered.length > 0);

    filtered.forEach(function (lesson) {
      lessonsGrid.appendChild(buildLessonCard(lesson));
    });
  };

  showStep(stepLessons);
}

function buildLessonCard(lesson) {
  const wrapper = document.createElement("div");
  wrapper.className = "lesson-card-wrapper";

  let actionLabel = "فتح الملف";

  if (lesson.fileType.toLowerCase() === "pdf") actionLabel = "⬇ تحميل الدرس";
  else if (
    lesson.fileType.toLowerCase() === "mp4" ||
    lesson.fileType.toLowerCase() === "video"
  )
    actionLabel = "▶ مشاهدة فيديو";
  else if (
    lesson.fileType.toLowerCase() === "jpg" ||
    lesson.fileType.toLowerCase() === "png" ||
    lesson.fileType.toLowerCase() === "image"
  )
    actionLabel = "🖼 فتح صورة";
  else if (
    lesson.fileType.toLowerCase() === "exam" ||
    lesson.fileType.toLowerCase() === "اختبار"
  )
    actionLabel = "📝 فتح الاختبار";
  else if (
    lesson.fileType.toLowerCase() === "mp3" ||
    lesson.fileType.toLowerCase() === "audio"
  )
    actionLabel = "🎧 استماع للصوت";

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