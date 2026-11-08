امتحان العلوم المتكاملة الأزهري: الماء وخصائصه الكيميائية - نموذج 2

الرابط: sections/tests/water-science-exam.html
أضيف كارت الامتحان في sections/tests/code-exams.html
يعتمد على firebase-config.js الحالي وتسجيل الدخول نفسه.
التصحيح: 10 درجات اختياري + 4 إكمال تلقائي (مع مراجعة صيغ الإجابات) + 6 درجات مقالي ومسائل يدويًا.
إجابات الطلاب تحفظ في مجموعة Firestore: zad_exam_submissions
الإدارة تدخل إلى صفحة الامتحان بحساب ADMIN_EMAIL الموجود في firebase-config.js، ثم تضغط عرض إجابات الطلاب وتصحح وتطبع التقرير.

مهم: يجب إعداد Firestore Security Rules للمجموعة الجديدة قبل النشر.
قواعد نموذجية (ادمجها مع قواعد مشروعك ولا تستبدل ملف القواعد كاملًا):
match /zad_exam_submissions/{id} {
  allow create: if request.auth != null && request.resource.data.studentUid == request.auth.uid && request.resource.data.autoScore is number && request.resource.data.status == 'pending_review';
  allow read, update: if request.auth != null && request.auth.token.email == 'maleksameh121@gmail.com';
  allow delete: if false;
}
تحذير: هذا المثال لا يحمي سلامة الدرجة الآلية من التلاعب في المتصفح؛ قبل الاعتماد الرسمي للدرجات انقل حساب التصحيح والتحقق إلى Cloud Functions/خادم موثوق، واستخدم قواعد تحقق أكثر صرامة.
كما أن إكمال السؤال الأول قد يحتاج مراجعة بسبب صياغة المصدر.
لا تغير قواعد Firestore الحالية بالكامل؛ ادمج المقطع بعناية.
