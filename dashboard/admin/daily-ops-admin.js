import {auth,db} from '../../firebase-config.js';
import {guard} from '../dashboard.js';
import {collection,getDocs,query,where,limit} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {cairoDay,followingDay,row,timeText,csvReport,LIMITS} from './daily-ops-core.js';

const $ = id => document.getElementById(id);
const date = $('zadOpsDate'), status = $('zadOpsStatus'), list = $('zadOpsSummary');
const loadButton = $('zadOpsRefresh'), csv = $('zadOpsCSV'), print = $('zadOpsPrint');
let owner = '', items = [], selectedDay = '', request = 0;
let loaded = false, limited = false;
const esc = value => String(value ?? '').replace(/[&<>"']/g, key=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[key]));
date.value = cairoDay();

function hasAccess() { return Boolean(owner && owner === auth.currentUser?.uid); }
function reset() {
  request++;
  loaded = false;
  items = [];
  limited = false;
  loadButton.disabled = !hasAccess();
  csv.disabled = print.disabled = true;
  list.replaceChildren();
}
async function load() {
  if (!hasAccess()) return;
  reset();
  const ticket = request;
  const day = date.value;
  let until;
  try { until = followingDay(day); }
  catch { status.textContent = 'اختار تاريخًا صالحًا.'; return; }
  loadButton.disabled = true;
  status.textContent = 'جارٍ تحميل حصص التاريخ المختار…';
  try {
    const range = query(collection(db,'lessons'),where('date','>=',day),where('date','<',until),limit(LIMITS.lessons + 1));
    const snap = await getDocs(range);
    if (ticket !== request || !hasAccess())return;
    selectedDay=day;
    limited=snap.size>LIMITS.lessons;
    items=snap.docs.slice(0,LIMITS.lessons)
      .filter(d=>d.data().deleted!==true && d.data().published!==false)
      .map(d=>row('lessons',d.id,d.data()));
    for(const item of items) {
      const li=document.createElement('li');
      li.textContent=[timeText(item.when),item.title,item.detail].filter(Boolean).join(' · ');
      list.append(li);
    }
    status.textContent=limited
      ? 'العرض محدود بأول '+LIMITS.lessons+' سجلًا لهذا التاريخ.'
      : items.length ? 'عدد الحصص المعروضة: '+items.length : 'مفيش حصص في السجل العام لهذا التاريخ.';
    loaded=true;
    csv.disabled=print.disabled=false;
  } catch(error) {
    if(ticket===request && hasAccess())status.textContent='تعذر تحميل الحصص: '+(error.code || error.message);
  } finally {
    if(ticket===request)loadButton.disabled=!hasAccess();
  }
}
guard('admin',()=>{
  owner=auth.currentUser?.uid || '';
  loadButton.disabled=!hasAccess();
});
date.addEventListener('change',()=>{
  reset();
  status.textContent='اضغط عرض الحصص للتاريخ المختار.';
});
loadButton.addEventListener('click',load);
csv.addEventListener('click',()=>{
  if(!loaded || !hasAccess())return;
  const url=URL.createObjectURL(new Blob([csvReport({lessons:items})],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download='zad-lessons-'+selectedDay+'.csv';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
});
print.addEventListener('click',()=>{
  if(!loaded || !hasAccess())return;
  const popup=window.open('','_blank');
  if(!popup){status.textContent='اسمح بالنوافذ المنبثقة عشان تطبع التقرير.';return;}
  const table=items.map(item=>`<tr><td>${esc(item.title)}</td><td>${esc(timeText(item.when))}</td><td>${esc(item.detail)}</td></tr>`).join('');
  popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>جدول الحصص</title><style>body{font:15px/1.8 Tahoma,Arial;padding:22px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #888;padding:8px;text-align:start}</style><h1>زاد المعرفة · سجل مواعيد الحصص</h1><p>${esc(selectedDay)} · بتوقيت القاهرة</p>${limited?'<p>العرض محدود بعدد السجلات.</p>':''}<table><thead><tr><th>الحصة</th><th>الموعد</th><th>التفاصيل</th></tr></thead><tbody>${table||'<tr><td colspan="3">مفيش حصص في السجل لهذا التاريخ.</td></tr>'}</tbody></table></html>`);
  popup.document.close();popup.focus();popup.print();
});
$('zadDailyOpsSection').addEventListener('click',event=>{
  const b=event.target.closest('[data-zad-ops-shortcut]');
  if(!b)return;
  const targets={student:{tab:'users',sectionId:'usersManagement'},teachers:{tab:'users',sectionId:'teacherExamAccessAdmin'},attendance:{tab:'lessons',sectionId:'attendanceManagement',attendanceMode:'reports'}};
  if(targets[b.dataset.zadOpsShortcut])window.dispatchEvent(new CustomEvent('zad:open-admin-tab',{detail:targets[b.dataset.zadOpsShortcut]}));
});
