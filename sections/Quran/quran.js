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
  row.addEventListener("click", function (event) {
    // الروابط المستقلة تفتح مباشرة في تبويب جديد. هذا أكثر موثوقية من الاعتماد على popup بعد أحداث أخرى.
    const pages = {
      s1: "quran-hifz.html",
      s3: "quran-qiraat.html",
      s4: "quran-tafsir.html",
      s5: "quran-tadabbur.html"
    };
    const page = pages[row.dataset.stage];
    if (page) {
      event.preventDefault();
      window.open(page, "_blank");
      return;
    }
    openLessonsStep(row.dataset.stage);
  });
});

function openLessonsStep(sectionKey) {
  const section = QURAN_DATA[sectionKey];

  // s2 is the real Quran reader.
  if (sectionKey === "s2") {
    window.open("quran-reader.html", "_blank", "noopener,noreferrer");
    return;
  }

  document.getElementById("quranReader").classList.add("is-hidden");
  document.querySelector("#stepLessons .search-bar").style.display = "";
  filterBar.style.display = "";
  lessonsGrid.style.display = "";
  noResults.classList.remove("is-hidden");
  lessonsLabel.textContent = section.title;
  sectionDescription.innerHTML = section.description || "";
  lessonsGrid.innerHTML = "";

  const allItems = [
    ...(section.lessons || []),
    ...((section.plans || []).map(plan => ({
      name: `خطة حفظ ${plan.name}`,
      fileType: "خطة",
      meta: `صفحات ${plan.start}–${plan.end} | 7 أيام`,
      source: "خطة مقترحة داخل المنصة",
      icon: "📋",
      plan
    })))
  ];

  emptyState.classList.add("is-hidden");
  noResults.classList.add("is-hidden");
  currentFilter = "all";

  if (!allItems.length) {
    emptyState.classList.remove("is-hidden");
    filterBar.innerHTML = "";
  }

  function renderLessons() {
    const term = searchInput.value.trim().toLowerCase();
    const filtered = allItems.filter(function (item) {
      const matchesSearch = item.name.toLowerCase().includes(term) || String(item.meta || "").toLowerCase().includes(term);
      const matchesFilter = currentFilter === "all" || normalizeType(item.fileType) === currentFilter;
      return matchesSearch && matchesFilter;
    });

    lessonsGrid.innerHTML = "";
    noResults.classList.toggle("is-hidden", filtered.length > 0);
    filtered.forEach(function (item) {
      lessonsGrid.appendChild(buildLessonCard(item));
    });
  }

  createFilters({ lessons: allItems }, renderLessons);
  searchInput.value = "";
  searchInput.oninput = renderLessons;
  renderLessons();
  showStep(stepLessons);
}

/* فتح القسم المطلوب تلقائيًا عند فتح الرابط في تبويب جديد */
const initialSection = new URLSearchParams(window.location.search).get("section");
if (initialSection && QURAN_DATA[initialSection]) {
  window.addEventListener("DOMContentLoaded", function () {
    openLessonsStep(initialSection);
  });
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
    lesson: "📖 دروس التجويد",
    plan: "📋 خطط الحفظ",
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

  const isPlan = lesson.fileType === "خطة";
  const actionLabel = isPlan ? "📋 عرض خطة الحفظ" : "📖 ابدأ الدرس";
  const icon = lesson.icon || (isPlan ? "📋" : "📖");

  wrapper.innerHTML =
    '<div class="lesson-card">' +
      '<div class="lesson-info">' +
        '<div class="lesson-name">' + lesson.name + '</div>' +
        '<div class="lesson-meta"><span>' + lesson.fileType + '</span><span>' + lesson.meta + '</span></div>' +
        '<div class="lesson-source">' + lesson.source + '</div>' +
      '</div>' +
      '<div class="lesson-icon">' + icon + '</div>' +
    '</div>' +
    '<button type="button" class="download-btn lesson-open-btn">' + actionLabel + '</button>';

  wrapper.querySelector(".lesson-open-btn").addEventListener("click", function () {
    if (isPlan) openHifzPlan(lesson.plan);
    else openLessonContent(lesson);
  });

  return wrapper;
}

function ensureQuranContentModal() {
  let modal = document.getElementById("quranContentModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "quranContentModal";
  modal.className = "quran-content-modal is-hidden";
  modal.innerHTML = `
    <div class="quran-content-backdrop" data-close-quran-modal></div>
    <article class="quran-content-dialog" role="dialog" aria-modal="true" aria-labelledby="quranContentTitle">
      <button type="button" class="quran-modal-close" data-close-quran-modal aria-label="إغلاق">×</button>
      <div class="quran-content-kicker">زاد المعرفة — قسم القرآن الكريم</div>
      <h3 id="quranContentTitle"></h3>
      <div id="quranContentBody" class="quran-content-body"></div>
    </article>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close-quran-modal]").forEach(btn => btn.addEventListener("click", () => modal.classList.add("is-hidden")));
  document.addEventListener("keydown", e => { if (e.key === "Escape") modal.classList.add("is-hidden"); });
  return modal;
}

function openLessonContent(lesson) {
  const modal = ensureQuranContentModal();
  modal.querySelector("#quranContentTitle").textContent = lesson.name;
  modal.querySelector("#quranContentBody").innerHTML = `
    ${lesson.content || "<p>سيتم إضافة محتوى الدرس هنا.</p>"}
    <div class="quran-study-tip"><strong>💡 طريقة المذاكرة:</strong> اقرأ الشرح، طبّق الأمثلة من المصحف، ثم أعد قراءة الصفحة بصوت مسموع ودوّن المواضع التي تحتاج مراجعة مع المعلم.</div>`;
  modal.classList.remove("is-hidden");
}

function openHifzPlan(plan) {
  const modal = ensureQuranContentModal();
  const totalPages = plan.end - plan.start + 1;
  const daily = Math.ceil(totalPages / 5);
  const days = [1,2,3,4,5].map((day, i) => {
    const a = plan.start + i * daily;
    const b = Math.min(plan.end, a + daily - 1);
    return `<li><strong>اليوم ${day}:</strong> حفظ الصفحات ${a}–${b}</li>`;
  });
  modal.querySelector("#quranContentTitle").textContent = `خطة حفظ ${plan.name}`;
  modal.querySelector("#quranContentBody").innerHTML = `
    <div class="hifz-plan-summary"><strong>نطاق الجزء:</strong> الصفحات ${plan.start}–${plan.end} في مصحف المدينة (604 صفحة).</div>
    <h4>📅 البرنامج الأسبوعي</h4>
    <ol>${days.join("")}</ol>
    <ul>
      <li><strong>اليوم 6:</strong> تسميع كامل ما تم حفظه وربط بدايات المقاطع.</li>
      <li><strong>اليوم 7:</strong> مراجعة الجزء كاملًا، وتصحيح الأخطاء، وتخفيف الحفظ الجديد إذا احتاج الطالب إلى تثبيت أكثر.</li>
    </ul>
    <div class="quran-study-tip"><strong>تنبيه:</strong> هذه خطة مرنة وليست مقدارًا شرعيًا لازمًا؛ يضبط الطالب الكمية وفق قدرته، مع أولوية الإتقان والمراجعة. ${QURAN_DATA.s1.planNote}</div>`;
  modal.classList.remove("is-hidden");
}


/* ---------------------------------------------------------
   REAL QURAN READER — 604 PAGE MADINAH MUSHAF
--------------------------------------------------------- */
const QURAN_PAGE_BASE = "https://equran.me/assets/images/pages/";
const QURAN_PAGE_TOTAL = 604;
const QURAN_LAST_PAGE_KEY = "zad_quran_last_page";
const QURAN_FAV_KEY = "zad_quran_favorite_pages";
let currentQuranPage = Number(localStorage.getItem(QURAN_LAST_PAGE_KEY) || 1);
let quranCurrentSurah = 1;
let quranReciters = [];

const quranReader = document.getElementById("quranReader");
const mushafPageImage = document.getElementById("mushafPageImage");
const quranPageInput = document.getElementById("quranPageInput");
const mushafPageInfo = document.getElementById("mushafPageInfo");
const quranSurahSelect = document.getElementById("quranSurahSelect");
const quranReciterSelect = document.getElementById("quranReciterSelect");
const quranAudio = document.getElementById("quranAudio");
const audioStatus = document.getElementById("audioStatus");
const quranFeaturePanel = document.getElementById("quranFeaturePanel");

function openRealQuranReader(section) {
  lessonsLabel.textContent = "قراءة القرآن برواية حفص عن عاصم";
  sectionDescription.innerHTML = `
    <div class="quran-intro-box">
      <h3>📖 المصحف الشريف</h3>
      <p>مصحف المدينة في 604 صفحة، مع الاستماع للقراء، البحث، الترجمة، التفسير، العلامات والمفضلة.</p>
    </div>`;
  quranReader.classList.remove("is-hidden");
  document.querySelector("#stepLessons .search-bar").style.display = "none";
  filterBar.style.display = "none";
  lessonsGrid.style.display = "none";
  noResults.classList.add("is-hidden");
  emptyState.classList.add("is-hidden");
  showStep(stepLessons);
  loadQuranReader();
}

async function loadQuranReader() {
  renderQuranPage(currentQuranPage);
  populateSurahs();
  await loadRequestedReciters();
}

function renderQuranPage(page) {
  page = Math.max(1, Math.min(QURAN_PAGE_TOTAL, Number(page) || 1));
  currentQuranPage = page;
  quranPageInput.value = page;
  mushafPageInfo.textContent = `الصفحة ${page} من ${QURAN_PAGE_TOTAL}`;
  mushafPageImage.src = `${QURAN_PAGE_BASE}${String(page).padStart(4, "0")}.jpg`;
  mushafPageImage.alt = `صفحة المصحف رقم ${page}`;
  localStorage.setItem(QURAN_LAST_PAGE_KEY, String(page));
  updateFavoriteButton();
}

function populateSurahs() {
  if (quranSurahSelect.options.length > 1) return;
  const names = [
    "الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"
  ];
  names.forEach((name, i) => {
    const option = document.createElement("option");
    option.value = i + 1;
    option.textContent = `${String(i + 1).padStart(3,"0")} — سورة ${name}`;
    quranSurahSelect.appendChild(option);
  });
}

async function loadRequestedReciters() {
  try {
    const response = await fetch("https://www.mp3quran.net/api/v3/reciters?language=ar");
    const data = await response.json();
    const wanted = [
      "ياسر الدوسري","محمود خليل الحصري","محمد صديق المنشاوي","عبدالباسط عبدالصمد","عبد الباسط عبدالصمد","محمد الطبلاوي","أحمد نعينع","أحمد علي العجمي","محمد جبريل","ماهر المعيقلي","عبدالرحمن السديس","مشاري العفاسي","محمد أيوب"
    ];
    quranReciters = (data.reciters || []).filter(r => wanted.some(w => normalizeArabic(r.name).includes(normalizeArabic(w))));
    quranReciterSelect.innerHTML = `<option value="">اختر القارئ</option>`;
    quranReciters.forEach(r => {
      (r.moshaf || []).forEach(m => {
        const option = document.createElement("option");
        option.value = JSON.stringify({server:m.server, name:r.name, moshaf:m.name, list:m.surah_list || ""});
        option.textContent = `${r.name} — ${m.name}`;
        quranReciterSelect.appendChild(option);
      });
    });
    if (quranReciterSelect.options.length === 1) throw new Error("لم يتم العثور على القراء");
  } catch (error) {
    quranReciterSelect.innerHTML = `<option value="">تعذر تحميل قائمة القراء — حاول تحديث الصفحة</option>`;
    audioStatus.textContent = "يمكن للمصحف العمل، لكن قائمة التلاوات تحتاج اتصالًا بمكتبة القراء.";
  }
}

function normalizeArabic(value) {
  return String(value || "").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/عبد الباسط/g,"عبدالباسط").replace(/[\u064B-\u065F]/g,"").trim();
}

function getSelectedReciter() {
  if (!quranReciterSelect.value) return null;
  try { return JSON.parse(quranReciterSelect.value); } catch { return null; }
}

function getSurahForPage(page) {
  // Accurate enough for quick navigation; the exact Mushaf image remains authoritative.
  // The full surah start pages for the 604-page Madinah Mushaf.
  const starts = [1,2,50,77,106,128,151,177,187,208,221,235,249,255,262,267,282,293,305,312,322,332,342,350,359,367,377,385,396,404,411,415,418,428,434,440,446,453,458,467,477,483,489,496,499,502,507,511,515,518,520,523,526,528,531,534,537,541,544,546,549,551,553,554,556,558,560,562,564,566,568,570,572,574,575,577,578,580,582,583,585,586,587,589,590,591,592,594,595,596,597,598,599,600,601,601,602,602,603,603,603,604,604,604,604,604,604,604,604,604,604,604,604,604,604];
  let surah = 1;
  for (let i=0;i<starts.length;i++) if (starts[i] <= page) surah=i+1;
  return surah;
}

function playSelectedSurah() {
  const reciter = getSelectedReciter();
  if (!reciter) { audioStatus.textContent = "اختر قارئًا أولًا."; return; }
  const surah = quranCurrentSurah || getSurahForPage(currentQuranPage);
  const list = String(reciter.list || "").split(",").map(Number);
  if (list.length && !list.includes(surah)) {
    audioStatus.textContent = `هذه السورة غير متاحة في رواية ${reciter.moshaf}. اختر رواية/مصحفًا آخر للقارئ.`;
    return;
  }
  const file = String(surah).padStart(3,"0") + ".mp3";
  quranAudio.src = `${reciter.server}${file}`;
  quranAudio.play().catch(() => {});
  audioStatus.textContent = `${reciter.name} — ${reciter.moshaf} — سورة رقم ${surah}`;
}

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(QURAN_FAV_KEY) || "[]"); } catch { return []; }
}
function toggleFavorite() {
  const favorites = getFavorites();
  const idx = favorites.indexOf(currentQuranPage);
  if (idx >= 0) favorites.splice(idx,1); else favorites.push(currentQuranPage);
  localStorage.setItem(QURAN_FAV_KEY, JSON.stringify(favorites));
  updateFavoriteButton();
}
function updateFavoriteButton() {
  const fav = getFavorites().includes(currentQuranPage);
  const btn = document.getElementById("quranFav");
  btn.classList.toggle("active", fav);
  btn.textContent = fav ? "♥" : "♡";
}

async function searchQuran() {
  const input = document.getElementById("quranSearchInput");
  const box = document.getElementById("quranSearchResults");
  const query = input.value.trim();
  if (!query) return;
  box.classList.remove("is-hidden");
  box.innerHTML = "<div class='quran-result'>جاري البحث...</div>";
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(query)}/all/ar`);
    const json = await res.json();
    const matches = json?.data?.matches || [];
    box.innerHTML = matches.slice(0,20).map(m => `<div class="quran-result" data-page="${m.page}"><strong>${m.surah?.name || "سورة"} — آية ${m.numberInSurah}</strong><span>${m.text}</span></div>`).join("") || "<div class='quran-result'>لا توجد نتائج.</div>";
    box.querySelectorAll(".quran-result[data-page]").forEach(el => el.addEventListener("click", () => { renderQuranPage(Number(el.dataset.page)); box.classList.add("is-hidden"); }));
  } catch (e) {
    box.innerHTML = "<div class='quran-result'>تعذر تنفيذ البحث الآن. جرّب مرة أخرى مع اتصال إنترنت مستقر.</div>";
  }
}

async function showQuranTranslation() {
  quranFeaturePanel.classList.remove("is-hidden");
  quranFeaturePanel.innerHTML = "<strong>🌍 جاري تحميل العربية + English...</strong>";
  try {
    const [arRes, enRes] = await Promise.all([
      fetch(`https://api.alquran.cloud/v1/page/${currentQuranPage}/quran-uthmani`),
      fetch(`https://api.alquran.cloud/v1/page/${currentQuranPage}/en.sahih`)
    ]);
    const ar = await arRes.json(), en = await enRes.json();
    const aa = ar?.data?.ayahs || [], ee = en?.data?.ayahs || [];
    const rows = aa.map((a,i) => `<div style="margin-bottom:16px"><strong>${a.numberInSurah ? `آية ${a.numberInSurah}` : a.number}</strong><div style="font-size:20px;line-height:2">${a.text}</div><div dir="ltr" style="margin-top:5px;color:#665f54">${ee[i]?.text || ""}</div></div>`).join("");
    quranFeaturePanel.innerHTML = rows || "لم تصل بيانات الترجمة.";
  } catch(e) { quranFeaturePanel.innerHTML = "تعذر تحميل الترجمة الآن."; }
}

function showTafsirLinks() {
  quranFeaturePanel.classList.remove("is-hidden");
  const surah = getSurahForPage(currentQuranPage);
  quranFeaturePanel.innerHTML = `<strong>📚 التفاسير</strong><p>من هنا تقدر تفتح التفسير للآيات الموجودة في الصفحة. اختر الآية من نتائج الترجمة/البحث لعرضها بالتفصيل.</p><div class="tafsir-links"><a target="_blank" rel="noopener" href="https://quran.com/${surah}/tafsirs">التفاسير على Quran.com</a></div><p style="font-size:12px;color:#888">يشمل الموقع تفاسير متعددة، وسنربط النصوص داخل المنصة مباشرة في مرحلة ربط مصدر التفسير النهائي.</p>`;
}

function showBookmarks() {
  quranFeaturePanel.classList.remove("is-hidden");
  const favs = getFavorites().sort((a,b)=>a-b);
  quranFeaturePanel.innerHTML = `<strong>🔖 صفحاتك المحفوظة</strong><p>${favs.length ? favs.map(p=>`<button class="mushaf-btn" data-fav-page="${p}">صفحة ${p}</button>`).join(" ") : "لا توجد صفحات محفوظة بعد."}</p>`;
  quranFeaturePanel.querySelectorAll("[data-fav-page]").forEach(b=>b.addEventListener("click",()=>renderQuranPage(Number(b.dataset.favPage))));
}

function shareQuranPage() {
  const url = `${location.href.split("#")[0]}#quran-page-${currentQuranPage}`;
  if (navigator.share) navigator.share({title:"مصحف زاد المعرفة",text:`صفحة ${currentQuranPage} من المصحف`,url}).catch(()=>{});
  else { navigator.clipboard?.writeText(url); quranFeaturePanel.classList.remove("is-hidden"); quranFeaturePanel.textContent="تم نسخ رابط الصفحة."; }
}

document.getElementById("quranPrev").addEventListener("click",()=>renderQuranPage(currentQuranPage-1));
document.getElementById("quranNext").addEventListener("click",()=>renderQuranPage(currentQuranPage+1));
document.getElementById("quranPageInput").addEventListener("change",e=>renderQuranPage(e.target.value));
document.getElementById("quranLastPage").addEventListener("click",()=>renderQuranPage(Number(localStorage.getItem(QURAN_LAST_PAGE_KEY)||1)));
document.getElementById("quranBookmark").addEventListener("click",toggleFavorite);
document.getElementById("quranFav").addEventListener("click",toggleFavorite);
document.getElementById("quranSearchBtn").addEventListener("click",searchQuran);
document.getElementById("quranSearchInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchQuran();});
document.getElementById("audioPlaySurah").addEventListener("click",playSelectedSurah);
document.getElementById("audioStop").addEventListener("click",()=>{quranAudio.pause();quranAudio.currentTime=0;});
quranSurahSelect.addEventListener("change", async e=>{
  quranCurrentSurah = Number(e.target.value)||1;
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${quranCurrentSurah}/quran-uthmani`);
    const json = await res.json();
    const page = json?.data?.ayahs?.[0]?.page;
    if (page) renderQuranPage(page);
  } catch(e) { audioStatus.textContent = "تعذر تحديد بداية السورة الآن."; }
});
quranReciterSelect.addEventListener("change",()=>{ audioStatus.textContent = getSelectedReciter() ? `تم اختيار ${getSelectedReciter().name}` : "اختر قارئًا."; });

document.querySelectorAll("[data-quran-feature]").forEach(btn=>btn.addEventListener("click",()=>{
  const feature=btn.dataset.quranFeature;
  if(feature==="translation") showQuranTranslation();
  if(feature==="tafsir") showTafsirLinks();
  if(feature==="bookmarks") showBookmarks();
  if(feature==="share") shareQuranPage();
}));

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
