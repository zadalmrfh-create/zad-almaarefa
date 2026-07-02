/* =========================================================
   ARABIC SECTION — LESSONS DATA
   أضف أو عدل الدروس من هنا فقط
========================================================= */

const QURAN_DATA = {
  hifz: {
    title: "تأسيس القراءة والكتابة والإملاء",

    description: `
      <h3>📖 نبذة عن القسم</h3>
      <p>
        يهتم هذا القسم بتأسيس الطالب في مهارات القراءة والكتابة والإملاء
        بطريقة علمية متدرجة، مع مراعاة الفروق الفردية بين الطلاب، وتقديم
        تدريبات عملية تساعد على إتقان أساسيات اللغة العربية ومعالجة صعوبات
        التعلم.
      </p>
    `,

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
    title: "الخط العربي",

    description: `
      <h3>✒️ نبذة عن القسم</h3>
      <p>
        يقدم هذا القسم أساسيات الخط العربي بأنواعه المختلفة، مع تدريبات
        عملية تساعد على تحسين الكتابة وإتقان قواعد الخط خطوة بخطوة، سواء
        للمبتدئين أو لمن يرغب في تطوير مستواه.
      </p>
    `,

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
        fileType: "image",
        meta: "الجزء الأول",
        source: "Google Drive",
        downloadUrl:
          "https://www.bing.com/ck/a?!&&p=9db8be61a477784e0aea103cae27ea8ed34cb15cf720b8ae8b566b17630af84aJmltdHM9MTc4MTc0MDgwMA&ptn=3&ver=2&hsh=4&fclid=1fed9cb7-9fe3-6403-2de3-8af79e9f655f&u=a1aHR0cHM6Ly93d3cuc2h1dHRlcnN0b2NrLmNvbS9zZWFyY2gvJUQ4JUE3JUQ5JTg0JUQ5JTgyJUQ5JTg1JUQ4JUIxP21zb2NraWQ9MWZlZDljYjc5ZmUzNjQwMzJkZTM4YWY3OWU5ZjY1NWY&ntb=1",
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
    title: "النحو",

    description: `
      <h3>📚 نبذة عن القسم</h3>
      <p>
        يهدف قسم النحو إلى تبسيط قواعد اللغة العربية وشرحها بأسلوب سهل
        وتطبيقي، مع تدريبات تساعد الطالب على فهم الإعراب وإتقان بناء
        الجمل واستخدام القواعد بصورة صحيحة.
      </p>
    `,

    lessons: [],
  },

  tafsir: {
    title: "الصرف",

    description: `
      <h3>📝 نبذة عن القسم</h3>
      <p>
        يهتم هذا القسم بدراسة علم الصرف، وأوزان الكلمات، واشتقاقاتها،
        والتغيرات التي تطرأ عليها، مما يساعد الطالب على فهم بنية الكلمة
        العربية واستخدامها استخدامًا صحيحًا.
      </p>
    `,

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
    title: "البلاغة",

    description: `
      <h3>✨ نبذة عن القسم</h3>
      <p>
        يقدم هذا القسم علوم البلاغة الثلاثة: البيان، والمعاني، والبديع،
        بطريقة مبسطة مع أمثلة من القرآن الكريم والشعر العربي؛ لتنمية
        الذوق اللغوي وفهم أسرار التعبير العربي.
      </p>
    `,

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

  adb: {
    title: "الأدب والنصوص",

    description: `
      <h3>📖 نبذة عن القسم</h3>
      <p>
        يضم هذا القسم مختارات من الأدب العربي قديمه وحديثه، مع شروح
        وتحليلات للنصوص الأدبية، تساعد الطالب على تنمية مهارات القراءة،
        والتذوق الأدبي، وفهم أساليب كبار الأدباء والشعراء.
      </p>
    `,

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
};