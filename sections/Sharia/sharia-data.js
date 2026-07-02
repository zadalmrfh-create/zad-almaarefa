/* =========================================================
   QURAN SECTION — LESSONS DATA
   This is the ONLY place you add or edit lessons.
   Each section key holds its OWN lesson list.

   Section keys:
     hifz      → حفظ وتعليم القرآن بالتجويد
     hafs      → القراءة برواية حفص عن عاصم
     qiraat    → القراءات العشر المتواترة
     tafsir    → كتب التفسير وعلوم القرآن
     tadabbur  → محاضرات في تدبر القرآن

   To add a lesson: copy a {...} block inside the right
   section's array and edit the fields.
========================================================= */

const QURAN_DATA = {
  hifz: {
    title: "حفظ وتعليم القرآن بالتجويد",
    lessons: [
      {
        name: "أحكام النون الساكنة والتنوين",
        fileType: "PDF",
        meta: "الجزء الأول",
        source: "Google Drive",
        downloadUrl: "#",
      },
      {
        name: "خطة حفظ جزء عمّ",
        fileType: "PDF",
        meta: "خطة أسبوعية",
        source: "Google Drive",
        downloadUrl: "#",
      },
    ],
  },

  hafs: {
    title: "القراءة برواية حفص عن عاصم",
    lessons: [
      {
        name: "مقدمة في رواية حفص عن عاصم",
        fileType: "MP3",
        meta: "تسجيل صوتي",
        source: "Google Drive",
        downloadUrl: "#",
      },
      {
        name: "خطة حفظ جزء عم",
        fileType: "PDF",
        meta: "خطة أسبوعية",
        source: "Google Drive",
        downloadUrl: "#",
      },
      {
        name: "أحكام النون الساكنة",
        fileType: "Video",
        meta: "الجزء الأول",
        source: "Google Drive",
        downloadUrl: "#",
      },
      {
        name: "اختبار تجويد",
        fileType: "Exam",
        meta: "اختبار تدريبي",
        source: "Google Drive",
        downloadUrl: "#",
      },
    ],
  },

  qiraat: {
    title: "القراءات العشر المتواترة",
    lessons: [],
  },

  tafsir: {
    title: "كتب التفسير وعلوم القرآن",
    lessons: [
      {
        name: "مقدمة في علم التفسير",
        fileType: "PDF",
        meta: "علوم القرآن",
        source: "Google Drive",
        downloadUrl: "#",
      },
      {
        name: "تفسير سورة البقرة - الجزء الأول",
        fileType: "PDF",
        meta: "تفسير",
        source: "Google Drive",
        downloadUrl: "#",
      },
    ],
  },

  tadabbur: {
    title: "محاضرات في تدبر القرآن الكريم",
    lessons: [
      {
        name: "محاضرة: التدبر في آيات الصبر",
        fileType: "MP4",
        meta: "محاضرة مرئية",
        source: "Google Drive",
        downloadUrl: "#",
      },
    ],
  },
};
