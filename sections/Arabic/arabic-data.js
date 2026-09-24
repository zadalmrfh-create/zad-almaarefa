/* =========================================================
   قسم اللغة العربية — محتوى تعليمي فعلي
   المحتوى هنا تأسيسي وتطبيقي، وليس ادعاءً بأنه كتاب مقرر لسنة دراسية بعينها.
========================================================= */

const QURAN_DATA = {
  s1: {
    title: "تأسيس القراءة والكتابة والإملاء",
    description: `
      <h3>✏️ عن القسم</h3>
      <p>مسار تأسيسي يبدأ من أساسيات القراءة والكتابة، ثم ينتقل إلى قواعد الإملاء الأكثر استخدامًا، مع أمثلة وتدريبات قصيرة بعد كل موضوع.</p>
      <p><strong>هدف المسار:</strong> أن يقرأ الطالب الكلمات والجمل بصورة صحيحة، ويكتبها كتابة سليمة، ويكتشف الأخطاء الإملائية الشائعة.</p>
    `,
    lessons: [
      {name:"الحروف العربية وأصواتها",fileType:"درس",meta:"تأسيس",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s1&lesson=1"},
      {name:"الحركات القصيرة والمدود",fileType:"درس",meta:"قراءة",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s1&lesson=2"},
      {name:"السكون والشدة والتنوين",fileType:"درس",meta:"قراءة وإملاء",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s1&lesson=3"},
      {name:"اللام الشمسية واللام القمرية",fileType:"درس",meta:"قراءة",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s1&lesson=4"},
      {name:"التاء المفتوحة والتاء المربوطة والهاء",fileType:"درس",meta:"إملاء",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s1&lesson=5"},
      {name:"الهمزة في أول الكلمة",fileType:"درس",meta:"إملاء",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s1&lesson=6"},
      {name:"الهمزة المتوسطة",fileType:"درس",meta:"إملاء",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s1&lesson=7"},
      {name:"الهمزة المتطرفة",fileType:"درس",meta:"إملاء",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s1&lesson=8"},
      {name:"الألف اللينة وعلامات الترقيم",fileType:"درس",meta:"إملاء وكتابة",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s1&lesson=9"}
    ]
  },
  s2: {
    title: "الخط العربي",
    description: `
      <h3>🖋️ عن القسم</h3>
      <p>مسار عملي لتحسين شكل الكتابة العربية، يبدأ بوضعية الكتابة ومسكة القلم، ثم أشكال الحروف واتصالها، وينتهي بتطبيقات على الكلمات والجمل.</p>
    `,
    lessons: [
      {name:"مسكة القلم ووضعية الجلوس",fileType:"درس",meta:"أساسيات",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s2&lesson=1"},
      {name:"خط النسخ: أشكال الحروف الأساسية",fileType:"درس",meta:"خط النسخ",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s2&lesson=2"},
      {name:"الحروف التي لا تتصل بما بعدها",fileType:"درس",meta:"تطبيق",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s2&lesson=3"},
      {name:"اتصال الحروف وتكوين الكلمات",fileType:"درس",meta:"تطبيق",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s2&lesson=4"},
      {name:"كتابة الجمل والمسافات بين الكلمات",fileType:"درس",meta:"تطبيق",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s2&lesson=5"},
      {name:"تدريبات تحسين الخط خطوة بخطوة",fileType:"درس",meta:"تدريب",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s2&lesson=6"}
    ]
  },
  s7: {
    title: "الخطابة والإلقاء",
    description: `
      <h3>🎙️ عن القسم</h3>
      <p>مسار تدريبي يساعد الطالب على إعداد كلام مرتب وإلقائه بوضوح وثقة، مع الاهتمام بالصوت والوقفات والتنغيم ولغة الجسد.</p>
    `,
    lessons: [
      {name:"ما الخطابة؟ وما صفات الكلام الجيد؟",fileType:"درس",meta:"مقدمة",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s7&lesson=1"},
      {name:"بناء الخطبة: مقدمة وعرض وخاتمة",fileType:"درس",meta:"إعداد",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s7&lesson=2"},
      {name:"التحكم في الصوت والسرعة",fileType:"درس",meta:"إلقاء",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s7&lesson=3"},
      {name:"الوقفات والتنغيم والتأكيد",fileType:"درس",meta:"إلقاء",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s7&lesson=4"},
      {name:"لغة الجسد والتواصل مع الجمهور",fileType:"درس",meta:"إلقاء",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s7&lesson=5"},
      {name:"تطبيق: إعداد وإلقاء كلمة قصيرة",fileType:"تدريب",meta:"تطبيق عملي",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s7&lesson=6"}
    ]
  },
  s8: {
    title: "تعليم اللغة العربية لغير الناطقين بها",
    description: `
      <h3>🌍 عن المسار</h3>
      <p>مسار تدريجي يبدأ بالمفردات والجمل اليومية، ثم ينتقل إلى القراءة والكتابة والمحادثة والاستماع. يمكن للمتعلم السير فيه من المستوى المبتدئ إلى المتوسط.</p>
    `,
    lessons: [
      {name:"المستوى الأول: التحية والتعارف",fileType:"درس",meta:"مبتدئ",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s8&lesson=1"},
      {name:"المستوى الأول: الأرقام والأيام والوقت",fileType:"درس",meta:"مبتدئ",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s8&lesson=2"},
      {name:"المستوى الأول: الأسرة والأشياء اليومية",fileType:"درس",meta:"مبتدئ",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s8&lesson=3"},
      {name:"المستوى الأول: تكوين الجملة الاسمية البسيطة",fileType:"درس",meta:"مبتدئ",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s8&lesson=4"},
      {name:"المستوى الثاني: الأفعال والجمل اليومية",fileType:"درس",meta:"متوسط",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s8&lesson=5"},
      {name:"المستوى الثاني: السؤال والجواب في المواقف اليومية",fileType:"درس",meta:"محادثة",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s8&lesson=6"},
      {name:"المستوى الثاني: قراءة فقرة قصيرة وفهمها",fileType:"درس",meta:"قراءة",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s8&lesson=7"},
      {name:"المستوى الثاني: كتابة فقرة عن النفس",fileType:"تدريب",meta:"كتابة",source:"زاد المعرفة",downloadUrl:"lesson.html?section=s8&lesson=8"}
    ]
  }
};
