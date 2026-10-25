import { printableExamResult } from './certificates-admin.js';
import { printUnitExamAnswers, printCodeExamAnswers } from './exam-answer-report.js';
import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, getDoc, doc, onSnapshot, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const box = document.getElementById('codeExamResultsList');
const make = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent=text; if(cls)e.className=cls; return e; };
const norm = t => String(t??'').trim().toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ');
const state={code:[],units:[],bank:new Map(),codeError:'',unitError:'',ready:false};
let unsubs=[];
const dateText=t=>{try{return t?.toDate?.().toLocaleString('ar-EG')||'—'}catch{return '—'}};
const ordered=(a,b)=>(b.data.createdAt?.seconds||0)-(a.data.createdAt?.seconds||0);
function gradeFromPercent(p){return p>=90?'ممتاز':p>=80?'جيد جدًا':p>=65?'جيد':'تقدير مشاركة'}
function action(label,fn,cls=''){const b=make('button',label,cls);b.type='button';b.onclick=fn;return b;}
function renderCode(entry){
  const {id,data:x}=entry;
  const row=make('article',undefined,'zad-exam-result-row');
  row.append(make('strong',(x.studentName||'طالب')+' — '+(x.examTitle||'امتحان')));
  row.append(make('div',`${x.score??0} من ${x.total??0} (${x.percent??0}%)${x.excellent?' — ممتاز 🏅':''} · نتيجة آلية غير معتمدة · ${dateText(x.createdAt)}`));
  const actions=make('div',undefined,'zad-result-actions');
  const pre=make('pre',x.answers||'لم تتوفر بيانات الإجابات من كود الامتحان.');pre.hidden=true;pre.style.whiteSpace='pre-wrap';
  const show=action('عرض الإجابات',()=>{pre.hidden=!pre.hidden;show.textContent=pre.hidden?'عرض الإجابات':'إخفاء الإجابات'});
  const pct=Number(x.percent ?? (Number(x.total)>0?Number(x.score)/Number(x.total)*100:0));
  const certData={studentUid:x.studentUid||'',studentName:x.studentName||'الطالب',title:x.examTitle||'الامتحان',grade:gradeFromPercent(pct),description:`تقديرًا لمشاركته في ${x.examTitle||'الامتحان'}، وحصوله على ${x.score??0} من ${x.total??0} (${Math.round(pct)}%).`,issueDate:new Date().toLocaleDateString('ar-EG'),signature:''};
  const cert=action('🖨️ طباعة الشهادة',()=>printableExamResult(certData),'zad-result-print-certificate btn gold');
  const edit=action('✏️ تعديل الشهادة',()=>window.dispatchEvent(new CustomEvent('zad:certificate-from-exam',{detail:certData})),'zad-result-edit-certificate btn');
  const status=make('span',undefined,'zad-delete-status');status.setAttribute('role','status');
  const del=action('🗑️ حذف النتيجة',async()=>{
    if(!confirm(`حذف نتيجة ${x.studentName||'الطالب'} — ${x.examTitle||'الامتحان'} نهائيًا؟`))return;
    del.disabled=true;status.textContent='جارٍ الحذف...';
    try{await deleteDoc(doc(db,'codeExamResults',id))}catch(e){del.disabled=false;status.textContent='تعذر الحذف: '+(e.code||e.message)}
  },'zad-delete-result');
  actions.append(show,action('🖨️ طباعة تقرير الإجابات',()=>printCodeExamAnswers(x),'zad-print-answer-report btn'),cert,edit,del,status);row.append(actions,pre);return row;
}
function correct(q){if(!q)return '—';if(q.type==='mcq')return q.options?.[q.answer]??'—';if(q.type==='tf')return q.answer?'صح':'خطأ';if(q.type==='fill')return (q.answers||[]).join(' / ');return 'يصحّحه الأدمن'}
function provided(q,a){if(a===null||a===undefined||a==='')return '— لم يُجب —';if(q?.type==='mcq')return q.options?.[a]??'—';if(q?.type==='tf')return a?'صح':'خطأ';return String(a)}
function computeAuto(exam,answers){return exam.questions.reduce((sum,q,i)=>{
  const a=answers[i];if(q.type==='mcq')return sum+(Number.isInteger(a)&&a===q.answer?1:0);
  if(q.type==='tf')return sum+(typeof a==='boolean'&&a===q.answer?1:0);
  if(q.type==='fill')return sum+((q.answers||[]).some(z=>norm(a)!==''&&norm(z)===norm(a))?1:0);
  return sum;
},0)}
function renderUnit(entry){
  const {id,data:x}=entry;
  const exam=state.bank.get(x.examId),row=make('article',undefined,'zad-exam-result-row zad-unit-one-result');
  const name=x.studentName||x.studentUid||'طالب';
  row.append(make('strong',name+' — '+(exam?.title||'امتحان الوحدة الأولى: '+x.examId)));
  const graded=Array.isArray(x.essayMarks)&&x.essayMarks.length===4&&Number.isInteger(x.finalScore)&&x.finalScore>=0&&x.finalScore<=30;
  const auto=exam?computeAuto(exam,x.answers||[]):null;
  const approvedAuto=Number.isInteger(x.autoScoreOverride)?x.autoScoreOverride:auto;
  const line=graded?`✅ النتيجة النهائية المعتمدة: ${x.finalScore} من 30 (${Math.round(x.finalScore/30*100)}%) — ${gradeFromPercent(x.finalScore/30*100)}`:
    `⏳ الدرجة الموضوعية المبدئية: ${auto??'—'} من 26 — 4 درجات مقالية بانتظار مراجعة الأدمن`;
  row.append(make('div',line+' · تاريخ التسليم: '+dateText(x.createdAt)));
  const actions=make('div',undefined,'zad-result-actions');
  const details=make('div',undefined,'zad-unit-one-answers');details.hidden=true;
  if(exam){
    exam.questions.forEach((q,i)=>{
      const p=make('div',`س${i+1} (${q.type==='essay'?'مقالي':q.type==='mcq'?'اختر':q.type==='tf'?'صح وخطأ':'أكمل'}): ${q.text}\nإجابة الطالب: ${provided(q,x.answers?.[i])}\n${q.type==='essay'?'ملاحظات التصحيح: '+q.rubric:'الإجابة الصحيحة: '+correct(q)}`);
      p.style.cssText='padding:10px;margin:6px 0;background:#122039;border:1px solid #405472;border-radius:8px;white-space:pre-wrap;line-height:1.7';details.append(p);
    });
  }else details.append(make('p','تعذر تحميل تفاصيل الأسئلة، لكن بيانات المحاولة محفوظة.'));
  const show=action('📖 عرض الإجابات',()=>{details.hidden=!details.hidden;show.textContent=details.hidden?'📖 عرض الإجابات':'إخفاء الإجابات'});
  // Open the editor for this exact attempt, not the generic list in a hidden tab.
  const review=action(graded?'✏️ مراجعة التصحيح':'📝 تصحيح المقالي',()=>{
    window.dispatchEvent(new CustomEvent('zad:unit-one-review',{
      detail:{attemptId:id,studentName:name,examId:x.examId}
    }));
  },'btn');
  actions.append(show,action('🖨️ طباعة تقرير الإجابات',()=>printUnitExamAnswers(exam,{...x,examId:x.examId}),'zad-print-answer-report btn'),review);
  if(graded){
    const pct=x.finalScore/30*100;
    const certData={studentUid:x.studentUid||'',studentName:name,title:exam?.title||'امتحان الوحدة الأولى',grade:gradeFromPercent(pct),description:`تقديرًا للحصول على ${x.finalScore} من 30 (${Math.round(pct)}%) في ${exam?.title||'امتحان الوحدة الأولى'}.`,issueDate:new Date().toLocaleDateString('ar-EG'),signature:''};
    actions.append(action('🖨️ طباعة الشهادة',()=>printableExamResult(certData),'zad-result-print-certificate btn gold'));
    actions.append(action('✏️ تعديل الشهادة',()=>window.dispatchEvent(new CustomEvent('zad:certificate-from-exam',{detail:certData})),'zad-result-edit-certificate btn'));
  }
  const status=make('span',undefined,'zad-delete-status');status.setAttribute('role','status');
  const del=action('🗑️ حذف النتيجة',async()=>{
    if(!confirm(`حذف محاولة ${name} في ${exam?.title||x.examId} نهائيًا؟\nسيسمح هذا للطالب بإعادة أداء الامتحان.`))return;
    del.disabled=true;status.textContent='جارٍ الحذف...';
    try{await deleteDoc(doc(db,'unitOneExamAttempts',id));window.dispatchEvent(new Event('zad:unit-one-reload'));}
    catch(e){del.disabled=false;status.textContent='تعذر الحذف: '+(e.code||e.message)}
  },'zad-delete-result');
  actions.append(del,status);row.append(actions,details);return row;
}
function render(){
  if(!box)return;
  box.replaceChildren();
  const head=make('p',`نتائج الامتحانات بالكود: ${state.code.length} | نتائج امتحانات الوحدة الأولى التسعة: ${state.units.length} | الإجمالي: ${state.code.length+state.units.length}`);
  head.style.color='#ffdf80';box.append(head);
  if(state.codeError||state.unitError){const errors=make('p',[state.codeError&&'نتائج الأكواد: '+state.codeError,state.unitError&&'نتائج الوحدة الأولى: '+state.unitError].filter(Boolean).join(' | '));errors.style.color='#ffac96';box.append(errors);}
  const all=[...state.code.map(x=>({...x,kind:'code'})),...state.units.map(x=>({...x,kind:'unit'}))].sort(ordered);
  if(!all.length){box.append(make('p',state.codeError||state.unitError?'لا توجد بيانات متاحة من المصادر التي أمكن قراءتها.':'لا توجد نتائج محفوظة بعد.'));return;}
  for(const e of all)box.append(e.kind==='unit'?renderUnit(e):renderCode(e));
}
function watch(user){
  for(const u of unsubs)u();unsubs=[];state.code=[];state.units=[];state.codeError='';state.unitError='';render();
  unsubs.push(onSnapshot(collection(db,'codeExamResults'),s=>{state.code=s.docs.map(d=>({id:d.id,data:d.data()}));state.codeError='';render()},e=>{state.codeError=e.code||e.message;render()}));
  unsubs.push(onSnapshot(collection(db,'unitOneExamAttempts'),s=>{state.units=s.docs.map(d=>({id:d.id,data:d.data()}));state.unitError='';render()},e=>{state.unitError=e.code||e.message;render()}));
}
async function authorized(u){
  if(u.email?.toLowerCase()==='maleksameh121@gmail.com')return true;
  try{if((await getDoc(doc(db,'admins',u.uid))).exists())return true}catch{}
  try{if((await getDoc(doc(db,'users',u.uid))).data()?.role==='admin')return true}catch{}
  return false;
}
onAuthStateChanged(auth,async user=>{
  for(const u of unsubs)u();unsubs=[];
  if(!user){if(box)box.textContent='سجّل دخولك كمشرف.';return;}
  if(!await authorized(user)){if(box)box.textContent='يتطلب صلاحية الأدمن.';return;}
  try{const res=await fetch('../../exams/unit1/bank.json',{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);const data=await res.json();state.bank=new Map([...data.exams,...(data.legacyExams||[])].map(e=>[e.id,e]));}
  catch(e){state.bank=new Map();state.unitError='تعذر قراءة أسئلة الامتحانات: '+e.message;}
  watch(user);
});
