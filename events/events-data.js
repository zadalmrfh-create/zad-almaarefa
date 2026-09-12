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
      title: "حجز الكورة في المعهد",
      date: "أكتوبر 2026",
      type: "photos",
      category: "match",
      items: [
        {
          type: "image",
          src: "https://drive.google.com/uc?export=view&id=YOUR_ID_HERE",
          caption: "صورة من الرحلة",
        },
        {
          type: "image",
          src: "https://drive.google.com/uc?export=view&id=YOUR_ID_HERE",
          caption: "صورة من الرحلة",
        },
        {
          type: "image",
          src: "https://drive.google.com/uc?export=view&id=YOUR_ID_HERE",
          caption: "صورة من الرحلة",
        },
        {
          type: "video",
          src: "https://www.youtube.com/embed/VIDEO_ID",
          caption: "مقطع فيديو",
        },
      ],
    },
    {
      title: "مسابقة حفظ القرآن",
      date: "أكتوبر 2026",
      type: "photos",
      category: "competition",
      items: [
        {
          type: "image",
          src: "https://drive.google.com/uc?export=view&id=YOUR_ID_HERE",
          caption: "صورة من الرحلة",
        },
        {
          type: "video",
          src: "https://www.youtube.com/embed/VIDEO_ID",
          caption: "مقطع فيديو",
        },
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