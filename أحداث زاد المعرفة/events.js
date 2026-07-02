/* =========================================================
   EVENTS PAGE — BEHAVIOR
========================================================= */

let activeCategory = "all";
let activeGalleryCat = "all";

const filterTabsEl = document.getElementById("filterTabs");
const eventsGridEl = document.getElementById("eventsGrid");
const emptyEventsEl = document.getElementById("emptyEvents");
const galleryTabsEl = document.getElementById("galleryTabs");
const galleryContentEl = document.getElementById("galleryContent");
const emptyGalleryEl = document.getElementById("emptyGallery");

/* ---------------------------------------------------------
   1) BUILD FILTER TABS (Events)
--------------------------------------------------------- */
function buildFilterTabs() {
  const cats = EVENTS_DATA.categories;
  Object.keys(cats).forEach(function (key) {
    const cat = cats[key];
    const btn = document.createElement("button");
    btn.className = "filter-tab" + (key === "all" ? " active" : "");
    btn.dataset.cat = key;
    btn.innerHTML = cat.icon + " " + cat.label;
    btn.addEventListener("click", function () {
      document
        .querySelectorAll("#filterTabs .filter-tab")
        .forEach(function (t) {
          t.classList.remove("active");
        });
      btn.classList.add("active");
      activeCategory = key;
      renderEvents(key);
    });
    filterTabsEl.appendChild(btn);
  });
}

/* ---------------------------------------------------------
   2) RENDER EVENT CARDS
--------------------------------------------------------- */
function renderEvents(categoryFilter) {
  const events = EVENTS_DATA.events;
  const filtered =
    categoryFilter === "all"
      ? events
      : events.filter((e) => e.category === categoryFilter);

  eventsGridEl.innerHTML = "";
  if (filtered.length === 0) {
    emptyEventsEl.classList.remove("is-hidden");
    return;
  }
  emptyEventsEl.classList.add("is-hidden");

  filtered.forEach(function (event) {
    const catInfo = EVENTS_DATA.categories[event.category] || {
      label: event.category,
      icon: "📌",
    };
    const card = document.createElement("div");
    card.className = "event-card";
    const timeHtml = event.time
      ? '<span class="event-detail"><span>🕐</span>' + event.time + "</span>"
      : "";
    card.innerHTML =
      '<div class="event-card-top">' +
      '<div class="event-emoji">' +
      event.icon +
      "</div>" +
      '<span class="event-badge badge-' +
      event.category +
      '">' +
      catInfo.icon +
      " " +
      catInfo.label +
      "</span>" +
      "</div>" +
      '<div class="event-body">' +
      '<h3 class="event-title">' +
      event.title +
      "</h3>" +
      '<p class="event-desc">' +
      event.description +
      "</p>" +
      '<div class="event-details">' +
      '<span class="event-detail"><span>📅</span>' +
      event.date +
      "</span>" +
      timeHtml +
      '<span class="event-detail"><span>📍</span>' +
      event.location +
      "</span>" +
      "</div>" +
      "</div>" +
      '<div class="event-card-footer">' +
      '<span class="event-status status-' +
      event.status +
      '">' +
      (event.status === "upcoming" ? "⏳ قادم" : "✅ انتهى") +
      "</span>" +
      (event.status === "upcoming"
        ? '<a href="https://wa.me/201515474939?text=عايز%20أحجز%20معاكم" target="_blank" class="whatsapp-btn">📲 احجز الآن</a>'
        : "") +
      "</div>";
    eventsGridEl.appendChild(card);
  });
}

/* ---------------------------------------------------------
   3) BUILD GALLERY FILTER TABS
--------------------------------------------------------- */
function buildGalleryTabs() {
  const cats = EVENTS_DATA.galleryCategories;
  Object.keys(cats).forEach(function (key) {
    const cat = cats[key];
    const btn = document.createElement("button");
    btn.className = "filter-tab" + (key === "all" ? " active" : "");
    btn.dataset.cat = key;
    btn.innerHTML = cat.icon + " " + cat.label;
    btn.addEventListener("click", function () {
      document
        .querySelectorAll("#galleryTabs .filter-tab")
        .forEach(function (t) {
          t.classList.remove("active");
        });
      btn.classList.add("active");
      activeGalleryCat = key;
      renderGallery(key);
    });
    galleryTabsEl.appendChild(btn);
  });
}

/* ---------------------------------------------------------
   4) RENDER GALLERY
--------------------------------------------------------- */
function renderGallery(categoryFilter = "all") {
  const gallery = EVENTS_DATA.gallery;
  const filtered =
    categoryFilter === "all"
      ? gallery
      : gallery.filter(
          (g) => g.category === categoryFilter || g.type === categoryFilter,
        );

  galleryContentEl.innerHTML = "";
  if (filtered.length === 0) {
    emptyGalleryEl.classList.remove("is-hidden");
    return;
  }
  emptyGalleryEl.classList.add("is-hidden");

  filtered.forEach(function (group) {
    const groupEl = document.createElement("div");
    groupEl.className = "gallery-group";
    const groupTitle = document.createElement("h3");
    groupTitle.className = "gallery-group-title";
    groupTitle.textContent = group.title + " (" + group.date + ")";
    groupEl.appendChild(groupTitle);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "gallery-items";

    group.items.forEach(function (item) {
      const itemEl = document.createElement("div");
      itemEl.className = "gallery-item";
      if (group.type === "photos") {
        itemEl.innerHTML =
          '<img src="' +
          item.src +
          '" alt="' +
          item.caption +
          '" class="gallery-photo" />' +
          '<p class="gallery-caption">' +
          item.caption +
          "</p>";
      } else if (group.type === "videos") {
        itemEl.innerHTML =
          '<video controls class="gallery-video">' +
          '<source src="' +
          item.src +
          '" type="video/mp4" />' +
          "Your browser does not support the video tag." +
          "</video>" +
          '<p class="gallery-caption">' +
          item.caption +
          "</p>";
      }
      itemsContainer.appendChild(itemEl);
    });

    groupEl.appendChild(itemsContainer);
    galleryContentEl.appendChild(groupEl);
  });
}

/* ---------------------------------------------------------
   INITIALIZE PAGE
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", function () {
  buildFilterTabs();
  renderEvents(activeCategory);
  buildGalleryTabs();
  renderGallery(activeGalleryCat);
});