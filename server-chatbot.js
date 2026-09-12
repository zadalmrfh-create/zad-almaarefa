import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});
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

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "المحتوى فارغ" });

  try {
    const relevantContext = getRelevantContext(message);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Instructions: أنت مساعد ذكي لمنصة زاد المعرفة التعليمية الأزهرية. وظيفتك الإجابة على أسئلة الطلاب في المواد الشرعية والعربية بأسلوب وقور، فصيح، ومبسط يناسب طلاب العلم الأزهريين ومستخرج بدقة من الفقرات المرفقة المأخوذة من كتب المنهج. إذا لم تجد الإجابة في الفقرات المتاحة، استخدم علمك الشرعي العام للإجابة بدقة وبمنهج أزهري رصين.\n\n📚 الفقرات المستخرجة من كتب المنهج ذات الصلة بسؤال الطالب:\n${relevantContext}\n\nسؤال الطالب الحالي: ${message}`,
            },
          ],
        },
      ],
    });

    res.json({ reply: response.text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "واجهت مشكلة في معالجة الرد." });
  }
});

export default app;