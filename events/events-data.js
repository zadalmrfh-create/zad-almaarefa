/* =========================================================
   EVENTS PAGE — DATA FILE
========================================================= */

const EVENTS_DATA = {
  /* -------------------------------------------------------
     الأحداث
  ------------------------------------------------------- */
  events: [
    {
      title: "رحلة تعليمية وترفيهية",
      category: "trip",
      icon: "🛫",
      date: "قريباً",
      time: "",
      location: "يُعلَن لاحقاً",
      description: "رحلة ترفيهية وتعليمية لأعضاء المنصة",
      status: "upcoming",
    },
    {
      title: "مباراة ودية",
      category: "match",
      icon: "⚽",
      date: "قريباً",
      time: "",
      location: "ملعب المعهد",
      description: "مباراة كرة قدم ودية بين طلاب المنصة",
      status: "upcoming",
    },
    {
      title: "مسابقة حفظ القرآن",
      category: "competition",
      icon: "🏆",
      date: "قريباً",
      time: "",
      location: "قاعة المعهد",
      description: "sdfda",
      status: "upcoming",
    },
    {
      title: "ورشة عمل: مهارات التعلم",
      category: "workshop",
      icon: "📝",
      date: "قريباً",
      time: "",
      location: "عن بُعد",
      description: "ورشة تفاعلية في مهارات الدراسة والتنظيم الذاتي",
      status: "upcoming",
    },
  ],

  /* -------------------------------------------------------
     معرض التوثيق
  ------------------------------------------------------- */
  gallery: [
    {
      title: "لقطات من أنشطة زاد المعرفة",
      date: "معرض الصور",
      type: "photos",
      category: "photos",
      items: [
        { type: "image", src: "../images/gallery/gallery-1.jpg", caption: "جانب من جلسة تعليمية" },
        { type: "image", src: "../images/gallery/gallery-2.jpg", caption: "ركن القرآن والكتب" },
        { type: "image", src: "../images/gallery/gallery-3.jpg", caption: "فعالية تكريم تعليمية" },
        { type: "image", src: "../images/gallery/gallery-4.jpg", caption: "مذاكرة ومطالعة" },
        { type: "image", src: "../images/gallery/gallery-5.jpg", caption: "أجواء علمية إسلامية" },
        { type: "image", src: "../images/gallery/gallery-6.jpg", caption: "نماذج شهادات وتكريم" },
      ],
    },
  ],

  /* -------------------------------------------------------
     الفئات للأحداث
  ------------------------------------------------------- */
  categories: {
    all: { label: "الكل", icon: "✨" },
    trip: { label: "رحلات", icon: "🛫" },
    match: { label: "مباريات", icon: "⚽" },
    competition: { label: "مسابقات", icon: "🏆" },
    workshop: { label: "ورش عمل", icon: "📝" },
    celebration: { label: "احتفالات", icon: "🎁" },
  },

  /* -------------------------------------------------------
     الفئات للمعرض
  ------------------------------------------------------- */
  galleryCategories: {
    all: { label: "الكل", icon: "✨" },
    photos: { label: "صور", icon: "📷" },
    videos: { label: "فيديوهات", icon: "🎥" },
    trip: { label: "رحلات", icon: "🛫" },
    match: { label: "مباريات", icon: "⚽" },
    competition: { label: "مسابقات", icon: "🏆" },
    workshop: { label: "ورش عمل", icon: "📝" },
  },
};