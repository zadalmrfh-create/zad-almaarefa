import {db,auth} from '../../firebase-config.js';
import {isAdminAccount} from '../admin-preview-core.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,getDocs} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clean = value => String(value ?? '').trim();
const stars = count => '★'.repeat(Math.max(0, Math.min(5, count))) + '☆'.repeat(Math.max(0, 5 - count));
const labelMap = {
  coverage:{yes:'نعم، تم شرح المقرر',partial:'تم شرح جزء منه',no:'لم يُشرح المقرر',unsure:'لا يعرف المقرر'},
  duration:{short:'قصيرة',suitable:'مناسبة',long:'طويلة'},
  clarity:{clear:'واضح جدًا',somewhat:'واضح إلى حد ما',unclear:'يحتاج توضيح'},
  interaction:{yes:'نعم',somewhat:'إلى حد ما',no:'لا'}
};
const label = (key,value) => labelMap[key]?.[value] || 'لم يُحدد';
const logoURL = new URL('../../images/logo.png', import.meta.url).href;
const publicHomeURL = new URL('../../index.html', import.meta.url).href;
let reviews = [];

// نسخة المشاركة متعمدة عدم احتوائها على اسم الطالب أو معرّفه أو تاريخه الدقيق.
// تنبيه: قد يكتب الطالب بيانات تعرف به في التعليق نفسه؛ راجع التعليق قبل إرساله.
function sharedReview(review) {
  const subject = clean(review.subject) || 'محاضرة';
  const teacher = clean(review.teacherName) || 'المعلم';
  const detail = [
    ['📘 شرح المقرر', label('coverage',review.coverage)],
    ['⏱️ مدة الحصة', label('duration',review.duration)],
    ['💡 وضوح الشرح', label('clarity',review.clarity)],
    ['🙋 التفاعل', label('interaction',review.interaction)]
  ];
  const note = clean(review.comment);
  const text = [
    '🌟 تقييم محاضرة | منصة زاد المعرفة التعليمية',
    '',
    '👨‍🏫 المعلم: ' + teacher,
    '📚 المادة: ' + subject,
    '⭐ التقييم العام: ' + stars(review.stars) + ' (' + review.stars + '/5)',
    ...detail.map(([key,value]) => key + ': ' + value),
    ...(note ? ['', '📝 ملاحظة أو اقتراح: ' + note] : []),
    '',
    '🔒 تم إخفاء اسم الطالب حفاظًا على خصوصيته.'
  ].join('\n');
  return {subject,teacher,detail,note,text};
}

function render() {
  const box = $('lectureRatingsList'), stats = $('lectureRatingsByTeacher');
  const select = $('lectureRatingsTeacher'), summary = $('lectureRatingsSummary');
  if (!box) return;
  const teachers = [...new Set(reviews.map(x => x.teacherName || 'غير محدد'))].sort((a,b)=>a.localeCompare(b,'ar'));
  const old = select?.value || 'all';
  if (select) {
    select.replaceChildren(new Option('جميع المعلمين','all'), ...teachers.map(t => new Option(t,t)));
    select.value = teachers.includes(old) ? old : 'all';
  }
  const chosen = select?.value || 'all';
  const shown = chosen === 'all' ? reviews : reviews.filter(x => (x.teacherName || 'غير محدد') === chosen);
  const avg = list => list.length ? (list.reduce((sum,x) => sum + x.stars,0) / list.length).toFixed(1) : '—';
  if (summary) summary.textContent = `${shown.length} تقييم • المتوسط ${avg(shown)} / 5`;
  if (stats) stats.innerHTML = teachers.map(t => {
    const list = reviews.filter(x => (x.teacherName || 'غير محدد') === t);
    return `<div style="padding:15px;border:1px solid #677088;border-radius:12px;background:#17233a"><strong>${escapeHTML(t)}</strong><p style="color:#e9c85b">⭐ ${avg(list)} / 5</p><small>${list.length} تقييم</small></div>`;
  }).join('');
  box.innerHTML = shown.length ? shown.map(x => `
    <article class="zad-lecture-rating-card" data-review-id="${escapeHTML(x.id)}">
      <strong>${escapeHTML(x.studentName || 'طالب')}</strong> — ${escapeHTML(x.subject || 'محاضرة')}
      <p style="color:#bfc7d7">${escapeHTML(x.lessonDate || '')} • ${escapeHTML(x.teacherName || 'المعلم')}</p>
      <p style="color:#f0cb6c">${stars(x.stars)} (${x.stars}/5)</p>
      <p>📘 شرح المقرر: ${escapeHTML(label('coverage',x.coverage))}</p>
      <p>⏱️ مدة الحصة: ${escapeHTML(label('duration',x.duration))}</p>
      <p>💡 وضوح الشرح: ${escapeHTML(label('clarity',x.clarity))}</p>
      <p>🙋 التفاعل: ${escapeHTML(label('interaction',x.interaction))}</p>
      ${x.comment ? `<p style="white-space:pre-wrap">📝 اقتراح الطالب: ${escapeHTML(x.comment)}</p>` : ''}
      <div class="zad-lecture-share-wrap">
        <button type="button" class="zad-lecture-share-toggle" data-lecture-action="toggle" aria-expanded="false" aria-label="خيارات مشاركة التقييم">📤 مشاركة هذا التقييم</button>
        <div class="zad-lecture-share-panel" hidden>
          <div class="zad-lecture-share-buttons">
            <button type="button" class="zad-share-whatsapp" data-lecture-action="whatsapp">🟢 واتساب</button>
            <button type="button" class="zad-share-telegram" data-lecture-action="telegram">✈️ تليجرام</button>
            <button type="button" data-lecture-action="copy">📋 نسخ التقييم</button>
            <button type="button" data-lecture-action="pdf">📄 حفظ PDF / طباعة</button>
            ${navigator.share ? '<button type="button" data-lecture-action="native">🔗 مشاركة أخرى</button>' : ''}
          </div>
          <p class="zad-lecture-share-privacy">🔒 نسخة المشاركة بدون اسم الطالب. راجع نص الملاحظة قبل مشاركتها للتأكد من خلوها من بيانات تكشف هويته.</p>
          <p class="zad-lecture-share-status" role="status" aria-live="polite"></p>
        </div>
      </div>
    </article>`).join('') : '<p>لا توجد تقييمات مسجلة حتى الآن.</p>';
}

function openShare(url) {
  // لا تُدرج روابط لوحة الأدمن أو بيانات الطالب في العنوان المشارك.
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.style.cssText = 'position:fixed;top:-9999px;opacity:0';
  document.body.append(temp);
  temp.select();
  try {
    if (!document.execCommand('copy')) throw new Error('copy-failed');
  } finally {
    temp.remove();
  }
}

function printReview(review) {
  const {subject, teacher, detail, note} = sharedReview(review);
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('المتصفح منع نافذة الطباعة؛ اسمح بالنوافذ المنبثقة لهذه الصفحة.');
  const rows = detail.map(([name,value]) => `<div class="row"><span>${escapeHTML(name)}</span><strong>${escapeHTML(value)}</strong></div>`).join('');
  const starsHTML = `<div class="rating" dir="ltr">${stars(review.stars)} <span>(${review.stars}/5)</span></div>`;
  const safeNote = note ? `<section class="comment"><h3>📝 ملاحظة أو اقتراح</h3><p>${escapeHTML(note)}</p></section>` : '';
  const markup = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>تقييم محاضرة - زاد المعرفة</title>
    <style>
      @page {size:A4;margin:17mm}
      *{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;background:#f5f5f5;color:#192437;direction:rtl}
      .toolbar{max-width:790px;margin:14px auto;display:flex;gap:12px;align-items:center;justify-content:center;font-family:inherit}
      .toolbar button{background:#173154;color:white;border:0;border-radius:10px;padding:12px 22px;font:700 15px Tahoma,Arial;cursor:pointer}
      .toolbar span{font-size:12px;color:#4b5563}
      .page{max-width:790px;min-height:980px;margin:0 auto 20px;padding:42px;background:white;border-top:10px solid #d9ae35;box-shadow:0 2px 24px #0002}
      header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:2px solid #e9dfc4;padding-bottom:22px}
      .logo{width:76px;height:76px;object-fit:contain}.brand{color:#a47d22;font-size:14px;font-weight:700}.title{font-size:27px;font-weight:800;margin:8px 0;color:#182c4c}
      .pill{border:1px solid #e2c16a;color:#6c5217;border-radius:22px;padding:7px 14px;display:inline-block;margin-top:13px;font-size:12px;background:#fff9e9}
      .info{display:flex;gap:18px;flex-wrap:wrap;margin:26px 0}.info .item{background:#f5f7fa;flex:1;min-width:160px;border-radius:12px;padding:14px}
      .item small{display:block;color:#61718a;margin-bottom:6px}.item strong{font-size:16px}
      .rating{color:#c89918;background:#fdf8e8;text-align:center;font-size:29px;font-weight:900;letter-spacing:3px;border-radius:14px;padding:22px 10px;margin:0 0 20px}
      .rating span{color:#465066;font-size:18px;letter-spacing:0}.row{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid #e9edf2;padding:15px 8px;align-items:center}
      .row span{color:#4d5970}.row strong{text-align:left;max-width:55%}
      .comment{padding:16px 18px;background:#f7f9fc;border-right:4px solid #d9ae35;border-radius:10px;margin-top:24px}
      .comment h3{font-size:17px;margin:0 0 9px}.comment p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;margin:0}
      footer{border-top:1px solid #e1e5ec;padding-top:16px;margin-top:38px;color:#647084;font-size:12px;line-height:1.8}
      @media print{body{background:white}.toolbar{display:none}.page{box-shadow:none;margin:0;padding:0;max-width:none;min-height:0;border-top-width:6px}header,.row,.comment{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      @media(max-width:600px){.page{padding:22px;min-height:0}header{gap:8px}.title{font-size:21px}.logo{width:58px;height:58px}.row{align-items:start}.row strong{max-width:60%}.toolbar{padding:10px;flex-wrap:wrap}}
    </style></head><body>
    <div class="toolbar"><button type="button" onclick="window.print()">🖨️ حفظ PDF أو طباعة</button><span>من نافذة الطباعة اختر «حفظ بتنسيق PDF»</span></div>
    <main class="page"><header><div><div class="brand">منصة زاد المعرفة التعليمية</div><h1 class="title">تقرير تقييم محاضرة</h1><span class="pill">تقييم مجهول الهوية</span></div><img class="logo" src="${escapeHTML(logoURL)}" alt="شعار زاد المعرفة"></header>
      <div class="info"><div class="item"><small>المعلم</small><strong>${escapeHTML(teacher)}</strong></div><div class="item"><small>المادة</small><strong>${escapeHTML(subject)}</strong></div></div>
      ${starsHTML}<div class="details">${rows}</div>${safeNote}
      <footer>🔒 لا يحتوي التقرير على اسم الطالب أو أي معرّفات خاصة به. يُرجى مراجعة الملاحظات المكتوبة قبل مشاركتها فقد تتضمن بيانات تعريفية كتبها الطالب بنفسه.<div>صادر من قسم تقييمات المحاضرات — منصة زاد المعرفة التعليمية.</div></footer>
    </main></body></html>`;
  popup.document.open();
  popup.document.write(markup);
  popup.document.close();
  // معاينة مستقلة مع زر للطباعة؛ لا نغلقها آليًا على الهواتف.
  popup.focus();
}

$('lectureRatingsList')?.addEventListener('click', async event => {
  const button = event.target instanceof Element ? event.target.closest('button[data-lecture-action]') : null;
  if (!button) return;
  const card = button.closest('[data-review-id]');
  if (!card) return;
  const review = reviews.find(item => item.id === card.dataset.reviewId);
  if (!review) return;
  const action = button.dataset.lectureAction;
  const panel = card.querySelector('.zad-lecture-share-panel');
  const toggle = card.querySelector('.zad-lecture-share-toggle');
  const status = card.querySelector('.zad-lecture-share-status');
  if (action === 'toggle') {
    const shouldOpen = panel.hidden;
    $('lectureRatingsList').querySelectorAll('.zad-lecture-share-panel').forEach(el => el.hidden = true);
    $('lectureRatingsList').querySelectorAll('.zad-lecture-share-toggle').forEach(el => el.setAttribute('aria-expanded','false'));
    panel.hidden = !shouldOpen;
    toggle.setAttribute('aria-expanded',String(shouldOpen));
    if (status) status.textContent = '';
    return;
  }
  const {text} = sharedReview(review);
  try {
    button.disabled = true;
    if (action === 'whatsapp') {
      openShare('https://wa.me/?text=' + encodeURIComponent(text));
      if(status) status.textContent = 'اختر الشخص أو مجموعة واتساب لإرسال التقييم.';
    } else if (action === 'telegram') {
      openShare('https://t.me/share/url?url=' + encodeURIComponent(publicHomeURL) + '&text=' + encodeURIComponent(text));
      if(status) status.textContent = 'اختر المحادثة في تليجرام لإرسال التقييم.';
    } else if (action === 'copy') {
      await copyText(text);
      if(status) status.textContent = '✅ تم نسخ نص التقييم بنجاح.';
    } else if (action === 'pdf') {
      printReview(review);
      if(status) status.textContent = '✅ فتحت معاينة التقييم. اضغط «حفظ PDF أو طباعة» ثم اختر PDF.';
    } else if (action === 'native') {
      if (!navigator.share) throw new Error('المشاركة المباشرة غير متاحة على هذا المتصفح.');
      await navigator.share({title:'تقييم محاضرة - منصة زاد المعرفة',text});
      if(status) status.textContent = 'تم فتح خيارات المشاركة.';
    }
  } catch (error) {
    if (error.name !== 'AbortError' && status) status.textContent = 'تعذّر تنفيذ المشاركة: ' + (error.message || 'حاول مرة أخرى.');
  } finally {
    button.disabled = false;
  }
});

async function load() {
  const box = $('lectureRatingsList');
  if (box) box.textContent = 'جارٍ تحميل تقييمات المحاضرات...';
  try {
    const snapshot = await getDocs(collection(db,'lectureReviews'));
    reviews = snapshot.docs.map(doc => ({...doc.data(),id:doc.id}))
      .filter(x => Number.isInteger(x.stars) && x.stars >= 1 && x.stars <= 5)
      .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    render();
  } catch (error) {
    if (box) box.textContent = 'تعذر تحميل التقييمات: ' + (error.code || error.message);
  }
}
$('lectureRatingsTeacher')?.addEventListener('change',render);
$('lectureRatingsRefresh')?.addEventListener('click',load);
onAuthStateChanged(auth,async user => {if (user && await isAdminAccount(user)) await load();});
window.addEventListener('zad:lecture-review-updated',load);
