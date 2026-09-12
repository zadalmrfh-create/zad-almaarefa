import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحميل .env من نفس مجلد server.js مباشرة، بغض النظر عن مكان تشغيل الأمر
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.6-flash";

console.log("=================================");
console.log("فحص إعدادات زاد المعرفة");
console.log(
  "GEMINI_API_KEY:",
  GEMINI_API_KEY ? "تم العثور على المفتاح" : "❌ المفتاح غير موجود"
);
console.log("MODEL:", MODEL);
console.log("Google Search: متوقف");
console.log("=================================");

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// فقرات تجريبية حاليًا؛ يمكن استبدالها لاحقًا بفهرس الكتب الكامل.
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
];

function getRelevantContext(userQuery, maxParagraphs = 5) {
  const keywords = userQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (keywords.length === 0) return "";

  return ALL_BOOKS_PARAGRAPHS
    .map((p) => {
      let score = 0;
      keywords.forEach((kw) => {
        if (p.text.toLowerCase().includes(kw)) score++;
      });
      return { ...p, score };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxParagraphs)
    .map((p) => `[مصدر من كتاب: ${p.book}]\n${p.text}`)
    .join("\n\n");
}

app.get("/api/health", (req, res) => {
  res.json({
    server: "ok",
    geminiKey: GEMINI_API_KEY ? "present" : "missing",
    model: MODEL,
    googleSearch: false
  });
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "المحتوى فارغ" });
  }

  if (!GEMINI_API_KEY || !ai) {
    return res.status(500).json({
      error: "مفتاح Gemini غير موجود. تأكد من وجود GEMINI_API_KEY داخل ملف .env ثم أعد تشغيل السيرفر."
    });
  }

  try {
    const bookContext = getRelevantContext(message);

    const prompt = `أنت مساعد زاد المعرفة التعليمية الأزهرية.

قواعد الإجابة:
1) إذا وُجدت فقرة مناسبة في الكتب المرفقة، اعتمد عليها أولًا واذكر اسم الكتاب عند الاستفادة منها.
2) إذا لم تكفِ الفقرات، استخدم معرفتك العامة الموثوقة.
3) إذا لم تكفِ الفقرات، استخدم معرفتك العامة الموثوقة فقط.
4) لا تنسب معلومة إلى الكتب إذا لم تكن موجودة فيها.
5) في الأسئلة الشرعية، قدّم جوابًا دقيقًا ومتزنًا، وميّز بوضوح بين محتوى الكتب والمعرفة العامة.
6) لا تدّعِ أنك بحثت في الإنترنت أو استخدمت مصادر خارجية.
7) أجب بالعربية الواضحة والمبسطة المناسبة للطلاب.

الفقرات المتاحة من كتب زاد المعرفة:
${bookContext || "لا توجد فقرة مطابقة مباشرة في الفهرس الحالي."}

سؤال الطالب:
${message}`;

    console.log("📩 سؤال جديد:", message);

    const interaction = await ai.interactions.create({
      model: MODEL,
      input: prompt
    });

    const reply = interaction?.output_text;

    if (!reply) {
      return res.status(500).json({
        error: "تم الاتصال بـ Gemini ولكن لم يتم استلام نص في الرد."
      });
    }

    console.log("✅ تم الحصول على رد من Gemini");

    res.json({
      reply,
      source: "books + AI"
    });
  } catch (error) {
    console.error("=================================");
    console.error("❌ GEMINI API ERROR");
    console.error("الاسم:", error?.name);
    console.error("الرسالة:", error?.message);
    console.error("الحالة:", error?.status);
    console.error("الكود:", error?.code);
    console.error("=================================");

    res.status(500).json({
      error: `Gemini Error: ${error?.message || "خطأ غير معروف"}`
    });
  }
});

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("=================================");
  console.log(`✅ زاد المعرفة يعمل على: http://localhost:${PORT}`);
  console.log(`🔎 الاختبار: http://localhost:${PORT}/api/health`);
  console.log("=================================");
});

export default app;
