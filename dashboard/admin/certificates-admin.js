import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, doc, getDoc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const state = { items: [], editing: null };
const safe = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function reset() {
  state.editing = null;
  $('certificateAdminForm').reset();
  $('certificateSubmit').textContent = 'إصدار الشهادة';
  $('certificateCancel').hidden = true;
}

export function printable(x) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('اسمح بفتح نافذة الطباعة');
    return;
  }

  const path = new URL('../../images/logo.png', location.href).href;
  const issueDate = safe(x.issueDate || '');
  const studentName = safe(x.studentName || '');
  const title = safe(x.title || '');
  const description = safe(x.description || 'مع أطيب التمنيات بمزيد من النجاح والتفوق');
  const grade = safe(x.grade || 'ممتاز');

  w.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>شهادة تقدير - زاد المعرفة</title>
<style>
  @page{size:A4 landscape;margin:0}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#f4efe2;font-family:Tahoma,Arial,sans-serif;color:#0d2445}
  body{width:297mm;height:210mm;overflow:hidden}
  .page{
    width:297mm;height:210mm;padding:6mm;background:
      linear-gradient(180deg,#0a2d63 0 8mm,#f8f3e8 8mm calc(100% - 8mm),#0a2d63 calc(100% - 8mm));
  }
  .frame{
    position:relative;width:100%;height:100%;background:#f8f3e8;border:3px solid #d2a63e;
    outline:2px solid #0a2d63;outline-offset:-8px;padding:14mm 16mm 12mm;text-align:center;
    overflow:hidden;
  }
  .corner{position:absolute;width:72px;height:72px;border:4px solid #d2a63e;opacity:.95}
  .corner.tl{top:10px;left:10px;border-right:none;border-bottom:none;border-radius:18px 0 0 0}
  .corner.tr{top:10px;right:10px;border-left:none;border-bottom:none;border-radius:0 18px 0 0}
  .corner.bl{bottom:10px;left:10px;border-right:none;border-top:none;border-radius:0 0 0 18px}
  .corner.br{bottom:10px;right:10px;border-left:none;border-top:none;border-radius:0 0 18px 0}
  .logo{width:32mm;height:32mm;object-fit:contain;display:block;margin:0 auto 4mm}
  .academy{font-size:19px;font-weight:700;margin:0 0 2mm;color:#0a2d63}
  .title{font-size:36px;font-weight:800;color:#0a2d63;margin:2mm 0 6mm;letter-spacing:.5px}
  .title .gold{color:#c7921a}
  .student-name{font-size:30px;font-weight:800;margin:6mm 0 5mm;color:#102b63}
  .line{width:70%;height:2px;background:linear-gradient(90deg,transparent,#d2a63e,transparent);margin:3mm auto}
  .text{font-size:18px;line-height:1.9;margin:0 auto;max-width:88%;color:#12274f}
  .highlight{font-size:20px;font-weight:800;color:#c7921a}
  .grade{font-size:21px;font-weight:800;margin-top:4mm;color:#0a2d63}
  .bottom{
    position:absolute;left:16mm;right:16mm;bottom:12mm;display:flex;justify-content:space-between;align-items:flex-end;gap:12mm;
  }
  .signature,.date-box{width:38%}
  .signature{text-align:center}
  .signature-line{border-bottom:2px solid #c9a84c;height:20mm;margin-bottom:3mm}
  .signature-label,.date-label{font-size:16px;font-weight:700;color:#0a2d63}
  .date-box{text-align:center}
  .date-value{font-size:18px;font-weight:800;margin-top:3mm}
  .stamp{
    position:absolute;left:50%;bottom:10mm;transform:translateX(-50%);
    width:34mm;height:34mm;border-radius:50%;border:4px solid #d2a63e;
    display:flex;align-items:center;justify-content:center;color:#a87709;font-weight:800;background:rgba(210,166,62,.12);
  }
  .footer-note{position:absolute;left:18mm;right:18mm;bottom:4mm;text-align:center;font-size:11px;color:#4b5563}
  @media print{button{display:none!important}}
</style>
</head>
<body>
  <div class="page">
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
      <img class="logo" src="${safe(path)}" alt="شعار زاد المعرفة">
      <p class="academy">أكاديمية زاد المعرفة</p>
      <div class="line"></div>
      <h1 class="title">شهادة <span class="gold">تفوق</span></h1>
      <p class="text">تمنح أكاديمية زاد المعرفة هذه الشهادة إلى الطالب</p>
      <div class="student-name">${studentName}</div>
      <div class="line"></div>
      <p class="text">لحصوله على <span class="highlight">${grade}</span> في <strong>${title}</strong></p>
      <p class="text">${description}</p>
      <p class="text" style="margin-top:4mm;font-weight:700">نسأل الله له دوام التوفيق والنجاح</p>

      <div class="stamp">زاد المعرفة</div>
      <div class="bottom">
        <div class="signature">
          <div class="signature-line"></div>
          <div class="signature-label">إمضاء المعلم</div>
        </div>
        <div class="date-box">
          <div class="date-label">تاريخ الإصدار</div>
          <div class="date-value">${issueDate}</div>
        </div>
      </div>
      <div class="footer-note">شهادة صادرة من إدارة المنصة، ولا تمثل اعتمادًا من جهة تعليمية حكومية.</div>
    </div>
  </div>
</body>
</html>`);

  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

const form = $('certificateAdminForm'), list = $('certificateAdminList'), status = $('certificateAdminStatus');

form?.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  for (const k of Object.keys(data)) data[k] = String(data[k]).trim();
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
  if (!user) {
    status.textContent = 'يجب تسجيل الدخول كأدمن.';
    return;
  }
  try {
    const admin = await getDoc(doc(db, 'admins', user.uid));
    if (!admin.exists() && !(user.email?.toLowerCase() === 'maleksameh121@gmail.com' && user.emailVerified)) {
      status.textContent = 'ليس لديك صلاحية إصدار شهادات.';
      return;
    }
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
  if (!form) return;
  reset();
  for (const el of form.elements) {
    if (el.name && Object.prototype.hasOwnProperty.call(x, el.name)) el.value = x[el.name] ?? '';
  }
  const message = $('certificateAdminStatus');
  if (message) message.textContent = 'تم تجهيز بيانات الشهادة من نتيجة الامتحان. يمكنك تعديلها ثم إصدار الشهادة وحفظها.';
  document.getElementById('adminCertificatesSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
