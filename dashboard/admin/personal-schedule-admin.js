import {auth,db} from '../../firebase-config.js';
import {guard} from '../dashboard.js';
import {collection,doc,getDocs,onSnapshot,query,where,orderBy,setDoc,updateDoc,serverTimestamp}
  from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {personalLessonCollection,personalLessonData} from '../student-schedule-core.js?v=20261122-schedule';

const $ = id => document.getElementById(id);
const selection = $('personalScheduleStudent');
const form = $('personalScheduleForm');
const status = $('personalScheduleStatus');
const list = $('personalScheduleList');
const save = $('personalScheduleSave');
const cancel = $('personalScheduleCancel');
const field = name => form.elements.namedItem(name);
const clock = new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'});
let owner = '', generation = 0, busy = false;
let stop = () => {};
let entry = null, draft = null;

function node(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}
function reset() {
  form.reset();
  entry = null;
  draft = null;
  save.textContent = 'أضف الحصة';
  cancel.hidden = true;
}
function button(label, action) {
  const b = node('button', label);
  b.className = 'btn';
  b.type = 'button';
  b.addEventListener('click',action);
  return b;
}
function payload(data) {
  const values = personalLessonData(data);
  return {...values, updatedAt:serverTimestamp()};
}

function display(entries, request) {
  if(request !== generation || auth.currentUser?.uid !== owner)return;
  list.replaceChildren();
  const visible = entries.filter(item => !item.data().deleted);
  if (!visible.length) { list.append(node('p','مفيش حصص خاصة مسجّلة للطالب.')); return; }
  const ul = node('ul','');
  ul.className = 'zad-today-list';
  for (const item of visible) {
    const data = item.data();
    const title = node('div','');
    const time = new Date(data.date + ':00Z');
    const when = Number.isFinite(time.getTime()) ? clock.format(time) + ' بتوقيت القاهرة' : 'موعد غير محدد';
    title.append(node('strong',data.title || 'حصة'),node('small',[when,data.subject,data.teacherName].filter(Boolean).join(' · ')));
    const actions = node('div','');
    actions.className = 'actions';
    actions.append(button('تعديل',() => {
      if (busy || request !== generation)return;
      for (const key of ['title','subject','teacherName','date','meetUrl']) field(key).value = data[key] || '';
      entry = item.ref;
      save.textContent = 'احفظ التعديل';
      cancel.hidden = false;
      field('title').focus();
      status.textContent = 'بتعدّل الحصة المحددة.';
    }),button('إلغاء الحصة',async () => {
      if (busy || request !== generation || auth.currentUser?.uid!==owner)return;
      if (!confirm('تلغي الحصة دي من جدول الطالب؟'))return;
      try {
        await updateDoc(item.ref,{deleted:true,updatedAt:serverTimestamp()});
        if(request === generation) {
          if(entry?.id === item.id) reset();
          status.textContent = 'الحصة اتشالت من جدول الطالب.';
        }
      } catch(error) {
        if(request===generation)status.textContent = 'تعذر إلغاء الحصة: ' + (error.code || error.message);
      }
    }));
    const li = node('li','');
    li.append(title,actions);
    ul.append(li);
  }
  list.append(ul);
}

function watchStudent() {
  stop();
  reset();
  const request = ++generation;
  const uid = selection.value;
  form.hidden = !uid;
  list.replaceChildren();
  status.textContent = uid ? 'جارٍ تحميل جدول الطالب…' : 'اختار حساب طالب لعرض جدوله.';
  if (!uid) return;
  stop = onSnapshot(query(collection(db,...personalLessonCollection(uid)),orderBy('date')),snapshot=>{
    display(snapshot.docs,request);
    if (request===generation && status.textContent==='جارٍ تحميل جدول الطالب…') status.textContent='';
  },error=>{
    if(request!==generation)return;
    status.textContent='تعذر تحميل الجدول: '+(error.code || error.message);
    list.replaceChildren();
  });
}

selection.addEventListener('change',watchStudent);
cancel.addEventListener('click',reset);
form.addEventListener('submit',async event => {
  event.preventDefault();
  const uid = selection.value, request = generation;
  if (busy || !uid || auth.currentUser?.uid !== owner)return;
  let data;
  try { data = payload(Object.fromEntries(new FormData(form))); }
  catch(error) { status.textContent=error.message;return; }
  const target = entry || draft || doc(collection(db,...personalLessonCollection(uid)));
  if (!entry) draft = target;
  busy = true;
  selection.disabled = save.disabled = cancel.disabled = true;
  status.textContent = 'جارٍ حفظ الحصة…';
  try {
    if (entry) await updateDoc(target,data);
    else await setDoc(target,{...data,createdAt:serverTimestamp(),deleted:false});
    if(request!==generation)return;
    reset();
    status.textContent = 'تم حفظ الحصة في جدول الطالب.';
  } catch(error) {
    if(request===generation)status.textContent = 'تعذر حفظ الحصة: ' + (error.code || error.message);
  } finally {
    busy = false;
    selection.disabled = save.disabled = cancel.disabled = false;
  }
});

async function loadStudents() {
  const uid=owner;
  try {
    const snapshot=await getDocs(query(collection(db,'users'),where('role','==','student')));
    if(!uid || uid!==auth.currentUser?.uid)return;
    const rows=snapshot.docs.map(item=>({uid:item.id,data:item.data()})).sort((a,b)=>
      String(a.data.fullName||a.data.name||a.data.email||'').localeCompare(b.data.fullName||b.data.name||b.data.email||'', 'ar'));
    const options=rows.map(({uid,data})=>new Option(
      [data.fullName||data.name||'طالب',data.grade||data.studyGrade,data.email].filter(Boolean).join(' · '),uid));
    selection.replaceChildren(new Option('اختر الطالب',''),...options);
    selection.disabled=!options.length;
    status.textContent=options.length?'اختار حساب طالب لعرض جدوله.':'مفيش حسابات طلاب مسجّلة.';
  } catch(error) {
    if(uid===auth.currentUser?.uid)status.textContent='تعذر تحميل الطلاب: '+(error.code||error.message);
  }
}
guard('admin', () => {
  owner = auth.currentUser?.uid || '';
  let loaded = false;
  const start = () => {
    if (loaded || !owner || auth.currentUser?.uid !== owner)return;
    loaded=true;
    void loadStudents();
  };
  document.querySelector('a[href="#personalScheduleManagement"]')?.addEventListener('click',start);
  document.querySelector('[data-admin-tab="studentSchedule"]')?.addEventListener('click',start);
  window.addEventListener('zad:open-admin-tab',event=>{if(event.detail?.tab==='studentSchedule')start();});
  if (!document.getElementById('zad-admin-panel-studentSchedule')?.hidden)start();
});
