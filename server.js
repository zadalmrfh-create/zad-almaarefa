import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicLibrarySearch, libraryMetadataContext } from "./server/library-search.js";

const app = express();
app.use(express.json({ limit: "24kb" }));
app.disable("x-powered-by");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// فهرسة النصوص مباشرة جوه الكود لضمان استقرار بيئة Serverless بنسبة 100%
const ALL_BOOKS_PARAGRAPHS = [
  {
    book: "الفقه الأزهري",
    text: "أركان الإسلام خمسة: شهادة أن لا إله إلا الله وأن محمداً رسول الله، وإقام الصلاة، وإيتاء الزكاة، وصوم رمضان، وحج البيت لمن استطاع إليه سبيلاً."
  },
  {
    book: "العقيدة الإسلامية",
    text: "أركان الإيمان ستة وهي: أن تؤمن بالله، وملائكته، وكتبه، ورسله، واليوم الآخر، وتؤمن بالقدر خيره وشره من الله تعالى."
  },
  {
    book: "السيرة النبوية",
    text: "ولد النبي صلى الله عليه وسلم في مكة المكرمة في عام الفيل، وتوفي في المدينة المنورة بعد أن بلغ الرسالة وأدى الأمانة."
  }
  // يمكنك إضافة أي فقرات هامة ومباشرة هنا يدوياً لزيادة دقة الإجابات الشرعية
];

function getRelevantContext(userQuery, maxParagraphs = 5) {
  const keywords = userQuery
    .toLowerCase()
    .split(" ")
    .filter((w) => w.length > 2);
  if (keywords.length === 0) return "";

  const scored = ALL_BOOKS_PARAGRAPHS.map((p) => {
    let score = 0;
    keywords.forEach((kw) => {
      if (p.text.toLowerCase().includes(kw)) score++;
    });
    return { ...p, score };
  })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  const topParagraphs = scored.slice(0, maxParagraphs);

  if (topParagraphs.length === 0)
    return "ملاحظة: لم يتم العثور على نصوص متطابقة مباشرة في الكتب، أجب بناءً على معرفتك الأزهرية العامة الموثوقة.";

  return topParagraphs
    .map((p) => `[مصدر من كتاب: ${p.book}]\n${p.text}`)
    .join("\n\n");
}

// Real catalogue extracted from sections/library.html during package build.
const directory = path.dirname(fileURLToPath(import.meta.url));
const libraryCatalog = JSON.parse(fs.readFileSync(path.join(directory, "library-catalog.json"), "utf8"));
const summaryDocuments = JSON.parse(fs.readFileSync(path.join(directory, "summary-text-index.json"), "utf8"));
// Public projection contains metadata and internal access gates only; never raw files or excerpts.
const publicLibrary = createPublicLibrarySearch(libraryCatalog, summaryDocuments);
const searchLibrary = publicLibrary.searchLibrary;
const searchSummaries = publicLibrary.searchSummaries;
app.get("/api/library-search", (req,res)=>{
 const query=String(req.query.q||"").slice(0,180);
 res.set("Cache-Control","no-store");
 res.json({results:searchLibrary(query,8), excerpts:searchSummaries(query,3), total:publicLibrary.total});
});
const SERVICE_INFO = `خدمات وروابط رسمية داخل المنصة (لا تدّعِ تنفيذ الخدمة):
- المكتبة: sections/library.html — الامتحانات الإلكترونية وأقسامها
- متجر الكتب والملخصات: store/index.html#catalog — عناوين المحتوى وبياناته
- حجز الحصص: /sections/booking/index.html
- التسجيل: /login/register.html
- تسجيل الدخول: /login/index.html
- التعليم الأزهري: /sections/Azhar/azhar.html
- القرآن الكريم: /sections/Quran/quran.html
- اللغة العربية: /sections/Arabic/arabic.html
- العلوم الشرعية: /sections/Sharia/sharia.html
- التزكية: /sections/Tazkea/tazkea.html
- الخدمات: /sections/services/services.html
نوع الوصول إلى كل محتوى يظهر عند فتح صفحته. نتائج البحث عناوين وبيانات وصفية فقط، وروابطها تمر عبر بوابات المنصة. لا تفترض أن المحتوى مجاني أو متاح لكل حساب، ولا تخمّن أسعارًا أو اشتراكات أو حالة تفعيل.`;

const requestWindows = new Map();
function limitChat(req, res, next) {
  const now = Date.now(), ip = req.ip || "local";
  for (const [key, value] of requestWindows) if (value.expires < now) requestWindows.delete(key);
  const entry = requestWindows.get(ip) || { count: 0, expires: now + 60000 };
  if (entry.count >= 12) return res.status(429).json({ error: "طلبات كثيرة في وقت قصير؛ حاول بعد دقيقة." });
  entry.count++; requestWindows.set(ip, entry); next();
}
app.post("/api/chat", limitChat, async (req, res) => {
  const message = req.body?.message;
  const rawHistory = req.body?.history;
  const history = Array.isArray(rawHistory) ? rawHistory.slice(-10).filter(item =>
    item && ["user", "model"].includes(item.role) && typeof item.text === "string" && item.text.length <= 14000
  ) : [];
  if (history.reduce((sum, item) => sum + item.text.length, 0) > 25000) {
    return res.status(400).json({ error: "المحادثة طويلة؛ افتح محادثة جديدة." });
  }
  if (typeof message !== "string" || !message.trim() || message.length > 2000) {
    return res.status(400).json({ error: "اكتب سؤالًا لا يزيد عن 2000 حرف." });
  }
  if (!ai) return res.status(503).json({ error: "مفتاح Gemini غير مضبوط في ملف .env على السيرفر." });

  try {
    const relevantContext = getRelevantContext(message);
    const booksFound = searchLibrary(message,5);
    const excerpts = searchSummaries(message,2);
    const catalogueContext = libraryMetadataContext(booksFound) || "لا توجد نتائج مؤكدة لهذا السؤال في فهرس الكتب.";
    const excerptContext = libraryMetadataContext(excerpts) || "لا توجد عناوين ملخصات مطابقة في الفهرس. لا تتوفر نصوص الملخصات ضمن هذا السياق.";

    const systemInstruction = `أنت مساعد زاد المعرفة التعليمي. تحدث بالعربية بأسلوب بسيط، محترم، ومناسب للطلاب. ساعد في فهم الدروس وفي إعداد ملخصات قصيرة وأسئلة تدريبية مع خطوات الحل. لا تقدم إجابات واثقة إذا كنت غير متأكد، ولا تخترع مراجع أو صفحات كتب أو روابط.
عند السؤال عن أقسام المنصة أو التسجيل أو الحجز استخدم فقط الروابط الرسمية الواردة في معلومات الخدمات. عند السؤال عن الكتب استخدم فقط نتائج الفهرس المقدمة، ولا تخترع روابط. لو لم يوجد تطابق بيّن ذلك. عند طلب تدريب أو اختبار قصير اعرض السؤال وانتظر إجابة الطالب ثم صححها. عند الطلب العام للشرح استخدم خطوات وتطبيقًا ثم سؤال تحقق. إذا وصلت فقرات مرجعية بالأسفل فاذكر أنها مقتطفات محدودة وليست بحثًا في مكتبة المنصة بالكامل. إذا لم تكفِ فأوضح أن الإجابة مبنية على المعرفة العامة وقد تحتاج مراجعة الكتاب. لا تدّعِ الوصول إلى ملفات الطلاب أو بيانات الحسابات أو تفعيل الحجوزات. لا تطلب بيانات شخصية أو كلمات سر. في المسائل الشرعية الدقيقة بيّن وجود اختلاف علمي إن لزم. نسّق الرد بفقرات قصيرة ونقاط واضحة عند الحاجة.`;
    const contents = [
      ...history.map(item => ({ role: item.role, parts: [{ text: item.text }] })),
      { role: "user", parts: [{ text: `مقتطفات مرجعية محدودة (إن وجدت):\n${relevantContext}\n\nمعلومات خدمات المنصة:\n${SERVICE_INFO}\n\nنتائج فهرس الكتب الحقيقية:\n${catalogueContext}\n\nعناوين الملخصات وبوابات الوصول فقط (بدون محتوى الملفات):\n${excerptContext}\n\nسؤال الطالب: ${message}` }] }
    ];
    const request = {
      model: GEMINI_MODEL,
      contents,
      config: { systemInstruction, maxOutputTokens: 1600, temperature: 0.5 }
    };

    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await ai.models.generateContent(request);
        break;
      } catch (error) {
        if (![429, 500, 502, 503, 504].includes(error.status) || attempt === 2) throw error;
        await sleep(1000 * (2 ** attempt));
      }
    }
    res.json({ reply: response.text || "لم يصل رد من Gemini، حاول مرة أخرى.", sources:booksFound.slice(0,4), excerpts:excerpts.map(({title,url})=>({title,url})) });
  } catch (error) {
    console.error("Gemini API Error:", error.status, String(error.message).slice(0, 350));
    const status = error.status;
    const errorText = status === 400 || status === 401
      ? "مفتاح Gemini غير صحيح أو الطلب غير مقبول. راجع إعدادات المفتاح."
      : status === 404
        ? `النموذج ${GEMINI_MODEL} غير متاح لهذا المفتاح. غيّر GEMINI_MODEL في .env.`
        : status === 429
          ? "وصلت لحد الاستخدام المسموح من Gemini. حاول لاحقًا."
          : status === 503
            ? "خدمة Gemini مشغولة حاليًا. حاول بعد شوية."
            : "تعذر الحصول على رد من Gemini حاليًا.";
    res.status([400,401,404,429,503].includes(status) ? status : 502).json({ error: errorText });
  }
});

export default app;