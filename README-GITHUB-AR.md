# منصة زاد المعرفة — نسخة GitHub + Vercel

## لماذا Vercel؟
GitHub Pages يستضيف ملفات HTML/CSS/JS فقط، ولا يشغّل Gemini Node.js API. يمكن حفظ الكود على GitHub مع ربطه بـ Vercel لكي يعمل الموقع والشات بوت معًا.

## النشر (مرة واحدة)
1. على GitHub أنشئ مستودعًا جديدًا **Private** (لو مش عاوز الكود يبقى متاحًا للجميع).
2. ارفع **محتويات هذا المجلد** (وليس مجلدًا خارجيًا فوقها). يمكن استخدام GitHub Desktop أو Git من الكمبيوتر لتجنب حد الرفع 100 ملف في المتصفح.
3. افتح https://vercel.com/new ثم Import Git Repository واختر المستودع.
4. اترك Framework Preset = Other، و Root Directory = ./، و **لا تغيّر Output Directory**.
5. في Project Settings → Environment Variables ضع GEMINI_API_KEY و GEMINI_MODEL بنفس قيم إعدادك المحلي، **ولا ترفع ملف .env**.
6. اضغط Deploy، وجرب الصفحة الرئيسية وإرسال رسالة في الشات والبحث عن كتاب.

## مهم
- GitHub Pages وحده لن يُشغّل الشات بوت. الرابط النهائي للموقع كامل الوظائف سيكون رابط Vercel.
- الملفات العامة داخل public/؛ خادم Gemini وفهارس البحث بالخارج، غير معروضة كملفات ثابتة.
- بيانات Firebase الخاصة بالواجهة تظهر لزوار الموقع بطبيعتها؛ الحماية الفعلية يجب أن تعتمد على Firebase Security Rules وصلاحيات الإدارة.
- لا تنشر Gemini API key، ولا تضع .env في GitHub.
- لا يوجد ضمان أن جميع عمليات تسجيل الدخول وروابط التنقل تعمل قبل اختبارها على رابط النشر الحقيقي؛ اضبط Authorized Domains الخاصة بـFirebase عند الحاجة.
- الشات بوت مدعوم بنموذج GEMINI_MODEL؛ تحقق من توفره ومن حدود وتكلفة API في حسابك.
- الحدّ داخل ذاكرة السيرفر لعدد الطلبات **غير مضمون عند التوسع إلى عدة Serverless Instances**؛ يلزم حد خارجي مركزي قبل إتاحة واسعة.

## تجربة محلية
`npm install` ثم أنشئ `.env` انطلاقًا من `.env.example` ثم `npm start`، وافتح `http://localhost:3000`.
(التشغيل المحلي الأصلي في جذر المشروع، وليس داخل public.)

## أوامر رفع باستخدام Git (اختياري)
`git init`
`git add .`
`git commit -m "Deploy Zad AlMaarefa"`
`git branch -M main`
`git remote add origin https://github.com/USERNAME/REPOSITORY.git`
`git push -u origin main`
