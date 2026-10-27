import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, doc, getDoc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const state = { items: [], editing: null };
let certificateAdminAuthorized = false;
const safe = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function reset() {
  state.editing = null;
  $('certificateAdminForm').reset();
  $('certificateSubmit').textContent = 'إصدار الشهادة';
  $('certificateCancel').hidden = true;
}

export function printable(x) {
  if (!certificateAdminAuthorized || !auth.currentUser) { alert('طباعة الشهادات متاحة للإدارة فقط.'); return; }
  const w = window.open('', '_blank');
  if (!w) {
    alert('اسمح بفتح نافذة الطباعة لعرض الشهادة.');
    return;
  }

  // All certificates issued by the admin, including exam result certificates,
  // share this single editable print layout. The artwork intentionally has
  // no student details or handwritten signature baked into the image.
  const templateUrl = new URL('../../images/certificates/zad-certificate-gold-blank.webp', import.meta.url).href;
  const studentName = safe(x.studentName || 'اسم الطالب');
  const title = safe(x.title || 'التميز الدراسي');
  const grade = safe(x.grade || 'ممتاز');
  const rawDescription = String(x.description || '').trim();
  // Results often store a complete sentence that repeats exam name and grade.
  // Extract the actual score instead; preserve custom admin-written messages.
  const matchScore = rawDescription.match(/\d+\s+من\s+\d+(?:\s*\(\s*\d+(?:[.,]\d+)?\s*%\s*\))?/);
  const description = rawDescription && !/تقدير[اًاً]*\s+(?:للمشاركة|لمشاركته|للحصول)|حصوله\s+على/.test(rawDescription)
    ? safe(rawDescription)
    : matchScore ? 'الدرجة: ' + safe(matchScore[0]) : '';
  const issueDate = safe(x.issueDate || new Date().toLocaleDateString('ar-EG'));
  // The teacher signature field is replaced by the platform's official stamp.
  const stampLogoUrl = new URL('../../images/logo.png', import.meta.url).href;

  w.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>شهادة تفوق - زاد المعرفة - ${studentName}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html,body { margin:0; padding:0; font-family:Tahoma,Arial,sans-serif; }
  body { color:#081b40; background:#122139; }
  .certificate-page {
    display:block; position:relative; width:297mm; height:210mm;
    margin:0 auto; overflow:hidden; isolation:isolate; container-type:inline-size;
    background:#fbf4e6; direction:rtl; text-align:center;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .certificate-art {
    position:absolute; inset:0; z-index:0; display:block;
    width:100%;height:100%; object-fit:fill;pointer-events:none;
  }
  .intro,.student-name,.divider,.achievement,.description,.blessing,.official-stamp,.issue-date {
    position:absolute;z-index:1;
  }
  .intro {
    top:42.3%;right:15%;left:15%;font-size:2.58cqw;
    font-weight:750;line-height:1.5;white-space:normal;
  }
  .student-name {
    top:47.4%;right:12%;left:12%;font-size:5.4cqw;
    font-weight:900;line-height:1.25;overflow-wrap:anywhere;
    color:#071b43;
  }
  .divider {
    top:57.1%;right:25%;left:25%;height:1.6px;
    background:linear-gradient(90deg,transparent,#b9821a 15%,#e7c058 50%,#b9821a 85%,transparent);
  }
  .achievement {
    top:60%;right:11%;left:11%;font-size:2.35cqw;
    font-weight:750;line-height:1.21;
  }
  .achievement .gold {font-size:2.8cqw;color:#a77516;font-weight:900;}
  .description {
    top:69.7%;right:15%;left:15%;min-height:1.3em;
    font-size:1.95cqw;font-weight:650;line-height:1.38;
  }
  .blessing {
    top:73.4%;right:23%;left:23%;font-size:2.15cqw;
    font-weight:750;line-height:1.35;
  }
  .official-stamp {
    position:absolute;z-index:1;bottom:5.4%;left:20.5%;width:11.5cqw;aspect-ratio:1;
    color:#0b2854;transform:rotate(-7deg);
  }
  .official-stamp .stamp-ring {
    position:relative;width:100%;height:100%;border:0.55cqw double #b9821a;border-radius:50%;
    background:rgba(255,250,236,.9);display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:0.18cqw;padding:1.05cqw;
    box-shadow:inset 0 0 0 0.3cqw #0b2854,0 0.2cqw 0.4cqw #0002;
  }
  .official-stamp .stamp-ring::before {
    content:"";position:absolute;inset:0.72cqw;border:0.18cqw dashed #b9821a;border-radius:50%;
  }
  .official-stamp img {
    position:relative;z-index:1;width:46%;height:46%;object-fit:contain;border-radius:50%;mix-blend-mode:multiply;
  }
  .official-stamp .stamp-name {position:relative;z-index:1;font-size:1.08cqw;font-weight:900;line-height:1.1;white-space:nowrap;}
  .official-stamp .stamp-subtitle {position:relative;z-index:1;font-size:0.7cqw;font-weight:800;line-height:1.1;white-space:nowrap;}
  .issue-date {
    bottom:9.2%;right:16%;width:22%;font-size:2.18cqw;
    font-weight:700;line-height:1.45;color:#071b43;
  }
  .issue-date strong {font-size:2.45cqw;display:block;direction:ltr;unicode-bidi:isolate;}
  @media screen {
    body {padding:12px;overflow-x:auto;}
    .certificate-page {box-shadow:0 12px 36px #0007;}
  }
  @media print {
    html,body { width:297mm!important;height:210mm!important;margin:0!important;padding:0!important;overflow:hidden!important;background:white!important; }
    .certificate-page {margin:0!important;box-shadow:none!important;page-break-before:avoid;page-break-after:avoid;break-inside:avoid;}
  }
</style>
</head>
<body>
  <main class="certificate-page" aria-label="شهادة تفوق للطالب ${studentName}">
    <img class="certificate-art" src="${safe(templateUrl)}" alt="إطار كحلي وذهبي بزخارف إسلامية وشعار زاد المعرفة وعنوان شهادة تفوق">
    <div class="intro">تمنح أكاديمية زاد المعرفة هذه الشهادة إلى الطالب</div>
    <div class="student-name">${studentName}</div>
    <div class="divider"></div>
    <div class="achievement">لحصوله على تقدير <span class="gold">${grade}</span><br>في ${title}</div>
    ${description ? `<div class="description">${description}</div>` : ''}
    <div class="blessing">نسأل الله له دوام التوفيق والنجاح</div>
    <div class="official-stamp" aria-label="ختم زاد المعرفة"><div class="stamp-ring"><img src="${safe(stampLogoUrl)}" alt="شعار أكاديمية زاد المعرفة"><span class="stamp-name">زاد المعرفة</span><span class="stamp-subtitle">الختم الرسمي للأكاديمية</span></div></div>
    <div class="issue-date">تاريخ الإصدار<strong>${issueDate}</strong></div>
  </main>
<script>
  (function(){
    var done=false;
    function printOnce(){
      if(done)return;done=true;
      Promise.resolve(document.fonts && document.fonts.ready).then(function(){
        setTimeout(function(){window.focus();window.print();},180);
      });
    }
    var art=document.querySelector('.certificate-art');
    if(art.complete)printOnce();
    else {art.addEventListener('load',printOnce,{once:true});art.addEventListener('error',printOnce,{once:true});}
  })();
</script>
</body>
</html>`);
  w.document.close();
}

// All administrator-issued certificates, including certificates printed from exam results,
// use the same official Zad Al-Maarefa stamp.
export function printableExamResult(result) {
  if (!certificateAdminAuthorized || !auth.currentUser) { alert('إصدار الشهادات متاح للإدارة فقط.'); return; }
  printable(result);
}

const form = $('certificateAdminForm'), list = $('certificateAdminList'), status = $('certificateAdminStatus');

form?.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  for (const k of Object.keys(data)) data[k] = String(data[k]).trim();
  if (!certificateAdminAuthorized) { status.textContent = 'الإدارة فقط يمكنها إصدار شهادة.'; return; }
  if (!data.studentUid || !data.studentName || !data.title) {
    status.textContent = 'أدخل حساب الطالب واسمه وسبب التكريم.';
    return;
  }
  const btn = $('certificateSubmit');
  btn.disabled = true;
  status.textContent = 'جارٍ الحفظ...';
  try {
    if (state.editing) await updateDoc(doc(db, 'certificates', state.editing), { ...data, updatedAt: serverTimestamp() });
    else await addDoc(collection(db, 'certificates'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), issuedBy: auth.currentUser.uid });
    status.textContent = '✅ تم حفظ الشهادة.';
    reset();
  } catch (error) {
    status.textContent = 'تعذر الحفظ: ' + (error.code || error.message);
  } finally {
    btn.disabled = false;
  }
});

$('certificatePrintPreview')?.addEventListener('click', () => {
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));
  if (!String(data.studentName || '').trim() || !String(data.title || '').trim()) {
    status.textContent = 'اكتب اسم الطالب واسم الامتحان أولًا لمعاينة الشهادة.';
    return;
  }
  printable(data);
});

$('certificateCancel')?.addEventListener('click', reset);

function render() {
  list.replaceChildren();
  if (!state.items.length) {
    list.textContent = 'لا توجد شهادات أصدرتها الإدارة بعد.';
    return;
  }
  for (const x of state.items) {
    const row = document.createElement('article');
    row.style.cssText = 'border:1px solid #475569;border-radius:15px;padding:15px;margin-top:12px';
    const name = document.createElement('div');
    name.textContent = `${x.studentName || 'طالب'} — ${x.title || 'شهادة'} — ${x.grade || 'ممتاز'}`;
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px';
    for (const [label, handle] of [
      ['✏️ تعديل', () => {
        state.editing = x.id;
        for (const el of form.elements) {
          if (el.name) el.value = x[el.name] ?? '';
        }
        $('certificateSubmit').textContent = 'حفظ التعديل';
        $('certificateCancel').hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }],
      ['🖨️ طباعة', () => printable(x)],
      ['🗑️ حذف', async () => {
        if (!confirm('حذف شهادة الطالب نهائيًا؟')) return;
        try { await deleteDoc(doc(db, 'certificates', x.id)); }
        catch (error) { alert('تعذر الحذف: ' + error.message); }
      }]
    ]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.className = 'btn';
      b.onclick = handle;
      actions.append(b);
    }
    row.append(name, actions);
    list.append(row);
  }
}

let unsub;
onAuthStateChanged(auth, async user => {
  unsub?.();
  certificateAdminAuthorized = false;
  if (!user) {
    status.textContent = 'يجب تسجيل الدخول كأدمن.';
    return;
  }
  try {
    const admin = await getDoc(doc(db, 'admins', user.uid));
    const roleDoc = admin.exists() ? null : await getDoc(doc(db, 'users', user.uid));
    if (!admin.exists() && roleDoc?.data()?.role !== 'admin' && !(user.email?.toLowerCase() === 'maleksameh121@gmail.com' && user.emailVerified)) {
      status.textContent = 'ليس لديك صلاحية إصدار شهادات.';
      return;
    }
    certificateAdminAuthorized = true;
    unsub = onSnapshot(collection(db, 'certificates'), snap => {
      state.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    }, e => status.textContent = 'تعذر تحميل الشهادات: ' + (e.code || e.message));
  } catch (e) {
    status.textContent = 'تعذر التحقق من صلاحيات الأدمن: ' + e.message;
  }
});

window.addEventListener('zad:certificate-from-exam', event => {
  const x = event.detail || {};
  if (!form || !certificateAdminAuthorized) return;
  window.dispatchEvent(new CustomEvent('zad:open-admin-tab', {detail:{tab:'exams'}}));
  reset();
  for (const el of form.elements) {
    if (el.name && Object.prototype.hasOwnProperty.call(x, el.name)) el.value = x[el.name] ?? '';
  }
  const message = $('certificateAdminStatus');
  if (message) message.textContent = 'تم تجهيز بيانات الشهادة من نتيجة الامتحان. يمكنك تعديلها ثم إصدار الشهادة وحفظها.';
  requestAnimationFrame(() => document.getElementById('adminCertificatesSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  form.querySelector('[name=studentName]')?.focus({preventScroll:true});
});
