import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const panel = $('ueAdminAttempts');
const status = $('ueAdminStatus');
const section = $('unitOneExamsAdmin');
const norm = value => String(value ?? '').trim().toLowerCase()
  .replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا')
  .replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ');
const css = 'border:1px solid #a68b4c;border-radius:9px;background:#101e35;color:#fff;padding:9px;max-width:100%';
let examMap = Object.create(null);
let attempts = [];
let selectedId = null;
let adminReady = false;
let initError = '';

function correct(q,answer) {
  if (q.type === 'mcq') return Number.isInteger(answer) && answer === q.answer;
  if (q.type === 'tf') return typeof answer === 'boolean' && answer === q.answer;
  if (q.type === 'fill') return norm(answer) !== '' && (q.answers || []).some(value => norm(value) === norm(answer));
  return false;
}
function scoreObjective(exam,answers) {
  return exam.questions.reduce((sum,q,i) => sum + (q.type !== 'essay' && correct(q,answers[i]) ? 1 : 0),0);
}
function node(tag,text,style) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (style) el.style.cssText = style;
  return el;
}
function render() {
  if (!panel) return;
  panel.replaceChildren();
  const matching = selectedId ? attempts.filter(a => a.id === selectedId) : attempts;
  if (selectedId) {
    const back = node('button','↩ عرض جميع محاولات الطلاب');
    back.type = 'button'; back.className='btn';
    back.onclick = () => { selectedId=null; render(); };
    panel.appendChild(back);
  }
  if (!matching.length) {
    panel.appendChild(node('p',selectedId
      ? 'لم يتم العثور على هذه المحاولة. ربما تم حذفها أو لا تملك صلاحية قراءتها.'
      : 'لا توجد محاولات مسجلة حتى الآن.'));
    return;
  }
  for (const {id,data} of matching) {
    const exam = examMap[data.examId];
    if (!exam) {
      panel.appendChild(node('p','تعذر تحميل أسئلة الامتحان لهذه المحاولة: '+String(data.examId)));
      continue;
    }
    const answers = Array.isArray(data.answers) ? data.answers : [];
    const essays = exam.questions.map((q,i)=>({q,i})).filter(entry=>entry.q.type==='essay');
    const auto = scoreObjective(exam,answers);
    const graded = Array.isArray(data.essayMarks) && data.essayMarks.length===essays.length
      && Number.isInteger(data.finalScore);
    const approvedObjective = Number.isInteger(data.autoScoreOverride) ? data.autoScoreOverride : auto;
    const item = node('article');
    item.dataset.attemptId=id;
    item.style.cssText='padding:18px;margin:12px 0;border:2px solid #cfab45;border-radius:14px;background:#162943;color:#f3eadc;scroll-margin-top:135px';
    item.appendChild(node('h3',(data.studentName||data.studentUid||'طالب')+' — '+exam.title));
    item.appendChild(node('p',`رقم المحاولة: ${id} · الدرجة الموضوعية: ${auto}/26 · ${graded
      ? 'المقالي: '+data.essayMarks.reduce((a,b)=>a+b,0)+'/'+essays.length+' — النهائي: '+data.finalScore+'/30'
      : 'المقالي لم يُصحح بعد'}`));
    const fillDetails=node('details');
    fillDetails.appendChild(node('summary','📖 مراجعة إجابات أكمل والتصحيح الآلي'));
    exam.questions.forEach((q,i)=>{
      if (q.type==='fill') fillDetails.appendChild(node('p',
        `س${i+1}: ${q.text}\nإجابة الطالب: ${answers[i] ?? '—'}\nالمقبول: ${(q.answers||[]).join(' / ')}`,
        'padding:8px;background:#233957;white-space:pre-wrap;border-radius:8px'));
    });
    item.appendChild(fillDetails);
    const autoLabel=node('label','الدرجة الموضوعية بعد المراجعة (0–26): ');
    autoLabel.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:15px 0;font-weight:700';
    const autoInput=node('input');
    autoInput.type='number';autoInput.min='0';autoInput.max='26';autoInput.step='1';
    autoInput.value=String(approvedObjective);autoInput.style.cssText=css+';width:90px';
    autoLabel.appendChild(autoInput);item.appendChild(autoLabel);
    const area=node('div');area.style.cssText='display:grid;gap:11px';
    essays.forEach(({q,i},n)=>{
      const row=node('div');row.style.cssText='padding:13px;background:#233957;border:1px solid #4d6482;border-radius:10px';
      row.appendChild(node('strong',`السؤال ${i+1}: ${q.text}`));
      row.appendChild(node('p','إجابة الطالب: '+(answers[i] || '— لم يُجب —'),'white-space:pre-wrap;line-height:1.75'));
      row.appendChild(node('small','معايير التصحيح: '+(q.rubric||'يراجعه المعلم')));
      const label=node('label','درجة السؤال: ');label.style.cssText='display:flex;align-items:center;gap:10px;margin-top:10px';
      const select=node('select');select.style.cssText=css;select.dataset.essayIndex=String(n);
      for(const value of [0,1]){
        const option=node('option',`${value} / 1`);option.value=String(value);select.appendChild(option);
      }
      select.value=graded?String(data.essayMarks[n]):'0';
      label.appendChild(select);row.appendChild(label);area.appendChild(row);
    });
    item.appendChild(area);
    const localStatus=node('p','');localStatus.setAttribute('role','status');localStatus.style.color='#f3d675';
    const save=node('button','✅ حفظ واعتماد تصحيح المقالي');save.type='button';save.className='btn gold';
    save.style.marginTop='14px';
    save.onclick=async()=>{
      if (essays.length!==4 || exam.questions.length!==30) {
        localStatus.textContent='لا يمكن اعتماد تصحيح امتحان به عدد أسئلة غير مطابق.';return;
      }
      const points=[...area.querySelectorAll('select[data-essay-index]')].map(el=>Number(el.value));
      const objective=Number(autoInput.value);
      if (autoInput.value.trim()==='' || !Number.isInteger(objective) || objective<0 || objective>26
          || points.length!==4 || points.some(p=>p!==0 && p!==1)) {
        localStatus.textContent='راجع درجات الأسئلة: الموضوعي من 0 إلى 26، وكل مقالي 0 أو 1.';
        return;
      }
      if(!window.confirm(`هل تعتمد نتيجة ${(data.studentName||'الطالب')} بمجموع ${objective+points.reduce((a,b)=>a+b,0)} من 30؟`)) return;
      save.disabled=true;localStatus.textContent='جارٍ حفظ التصحيح في Firebase...';
      try {
        if(!auth.currentUser)throw Error('سجّل الدخول بحساب الأدمن أولًا');
        await updateDoc(doc(db,'unitOneExamAttempts',id),{
          essayMarks:points,autoScoreOverride:objective,autoScore:auto,
          finalScore:objective+points.reduce((a,b)=>a+b,0),
          reviewedBy:auth.currentUser.uid,reviewedAt:serverTimestamp()
        });
        localStatus.textContent='تم حفظ التصحيح بنجاح.';
        status.textContent='✅ تم اعتماد نتيجة الطالب. تم تحديث النتائج.';
        await load();
      } catch(error) {
        localStatus.textContent='تعذر حفظ الدرجات: '+(error.code||error.message);
        status.textContent=localStatus.textContent;
      } finally {save.disabled=false;}
    };
    item.append(save,localStatus);panel.appendChild(item);
  }
}
async function load(){
  if(!status || !panel)return;
  if(!adminReady){status.textContent=initError||'جارٍ التحقق من صلاحية الإدارة...';return;}
  status.textContent='جارٍ تحميل محاولات الامتحانات...';
  try {
    const snapshot=await getDocs(collection(db,'unitOneExamAttempts'));
    attempts=snapshot.docs.map(d=>({id:d.id,data:d.data()}))
      .sort((a,b)=>(b.data.createdAt?.seconds||0)-(a.data.createdAt?.seconds||0));
    status.textContent=`المحاولات المسجلة: ${attempts.length}${selectedId?' — تصحيح المحاولة المحددة':''}`;
    render();
    if(selectedId){
      // Wait until the admin exam tab is visible before scrolling to the matching editor.
      window.requestAnimationFrame(()=>{
        const target=[...panel.querySelectorAll('[data-attempt-id]')].find(el=>el.dataset.attemptId===selectedId);
        (target||section)?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    }
  } catch(error){
    status.textContent='تعذر تحميل المحاولات: '+(error.code||error.message);
    panel.textContent='تعذر تحميل البيانات. راجع قواعد Firestore وصلاحية الأدمن.';
  }
}
async function authorized(user){
  if(user.email?.toLowerCase()==='maleksameh121@gmail.com')return true;
  try{if((await getDoc(doc(db,'admins',user.uid))).exists())return true;}catch{}
  try{if((await getDoc(doc(db,'users',user.uid))).data()?.role==='admin')return true;}catch{}
  return false;
}
onAuthStateChanged(auth,async user=>{
  adminReady=false;
  if(!user){initError='سجّل الدخول بحساب الإدارة.';if(status)status.textContent=initError;return;}
  if(!await authorized(user)){initError='هذه الصفحة متاحة للأدمن فقط.';if(status)status.textContent=initError;return;}
  try {
    const response=await fetch('../../exams/unit1/bank.json',{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const bank=await response.json();
    examMap=Object.fromEntries([...(bank.exams||[]),...(bank.legacyExams||[])].map(exam=>[exam.id,exam]));
    adminReady=true;initError='';await load();
  } catch(error){initError='تعذر تهيئة التصحيح: '+error.message;if(status)status.textContent=initError;}
});
$('ueAdminReload')?.addEventListener('click',()=>{selectedId=null;load()});
window.addEventListener('zad:unit-one-reload',()=>{if(auth.currentUser)load()});
window.addEventListener('zad:unit-one-review',event=>{
  selectedId=String(event.detail?.attemptId||'');
  window.dispatchEvent(new CustomEvent('zad:open-admin-tab',{detail:{tab:'exams'}}));
  if (!selectedId){if(status)status.textContent='لم يتم تحديد محاولة للتصحيح.';return;}
  if(!adminReady && status)status.textContent=initError||'جارٍ تهيئة تصحيح المقالي...';
  load();
});
