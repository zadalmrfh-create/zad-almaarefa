import {loadOriginalExamHtml,recoverExamQuestionLabels,recoverExamAutomaticAnswerKey,downloadExamSource} from './code-exam-source-import.js';
import { printableExamResult } from './certificates-admin.js';
import { printUnitExamAnswers, printCodeExamAnswers, parseCodeAnswers } from './exam-answer-report.js';
import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, getDoc, doc, onSnapshot, deleteDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const box = document.getElementById('codeExamResultsList');
const make = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent=text; if(cls)e.className=cls; return e; };
const norm = t => String(t??'').trim().toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ');
const state={code:[],units:[],bank:new Map(),codeError:'',unitError:'',ready:false};
let unsubs=[];
const dateText=t=>{try{return t?.toDate?.().toLocaleString('ar-EG')||'—'}catch{return '—'}};
const ordered=(a,b)=>(b.data.createdAt?.seconds||0)-(a.data.createdAt?.seconds||0);
function gradeFromPercent(p){return p>=90?'ممتاز':p>=80?'جيد جدًا':p>=65?'جيد':'تقدير مشاركة'}
function action(label,fn,cls=''){const b=make('button',label,cls);b.type='button';b.onclick=fn;return b;}

const answerKeyCache=new Map();
async function fetchCodeAnswerKey(examId,refresh=false){
  if(!examId)return null;
  if(!refresh && answerKeyCache.has(examId))return answerKeyCache.get(examId);
  const snap=await getDoc(doc(db,'codeExamAnswerKeys',examId));
  let key=snap.exists()?snap.data():null;
  // The administrator should not have to type a key for every HTML exam.
  // When no manual key exists, read explicit solutions from the saved exam source.
  if(!key?.items?.some(item=>String(item.correctAnswer||'').trim())){
    try{
      const source=await loadOriginalExamHtml(examId);
      const recovered=recoverExamAutomaticAnswerKey(source);
      if(recovered.length)key={items:recovered,source:'auto-extracted'};
    }catch(error){console.info('لم يمكن استخراج المفتاح آليًا لهذا الامتحان:',error.message);}
  }
  answerKeyCache.set(examId,key);return key;
}
function buildField(title,value='',kind='textarea'){
  const label=document.createElement('label');label.className='zad-key-field';
  const caption=make('span',title);label.append(caption);
  const input=document.createElement(kind==='select'?'select':'textarea');
  if(kind==='select'){
    [['text','قصير / أكمل'],['mcq','اختيار من متعدد'],['tf','صح / خطأ'],['essay','مقالي (تصحيح بشري)']].forEach(([val,txt])=>{
      const option=document.createElement('option');option.value=val;option.textContent=txt;input.append(option);
    });input.value=['text','mcq','tf','essay'].includes(value)?value:(value==='checkbox'||value==='radio'||value==='select'?'mcq':value==='textarea'?'essay':'text');
  }else{input.value=String(value||'');input.rows=kind==='textarea'?2:1;}
  label.append(input);return {label,input};
}
async function editCodeAnswerKey(result){
  if(!result.examId){alert('النتيجة القديمة لا تحتوي على معرّف الامتحان.');return;}
  let key;
  try{key=await fetchCodeAnswerKey(result.examId,true)}catch(error){alert('تعذر تحميل مفتاح التصحيح: '+(error.code||error.message));return;}
  const saved=parseCodeAnswers(result.answers);
  const items=Array.isArray(key?.items)?key.items:[];
  const indexed=new Map(items.map(item=>[Number(item.number),item]));
  const defaults=new Map(saved.map(item=>[Number(item.number),item]));
  const numbers=[...new Set([...indexed.keys(),...defaults.keys()])].filter(Number.isInteger).sort((a,b)=>a-b);
  if(!numbers.length)numbers.push(1);
  const modal=document.createElement('div');modal.className='zad-answer-key-backdrop';
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','مفتاح الإجابات');
  const panel=document.createElement('section');panel.className='zad-answer-key-modal';
  const head=make('div',undefined,'zad-answer-key-head');
  const h=make('h2','📝 مفتاح الإجابات المعتمد');
  const close=action('✕ إغلاق',()=>modal.remove(),'btn');head.append(h,close);panel.append(head);
  panel.append(make('p','الامتحان: '+(result.examTitle||result.examId)));
  panel.append(make('p',key?.source==='auto-extracted'?
    'تم اكتشاف إجابات من كود الامتحان تلقائيًا. المعاينة أدناه للمراجعة، وليست مفتاحًا معتمدًا بعد. لا تحتاج إلى حفظ شيء لتظهر هذه الإجابات في التقرير.':
    'المفتاح اليدوي اختياري عند تعذر اكتشاف الإجابات داخل الكود. اكتب الإجابة الصحيحة إن لم تكن موجودة تلقائيًا. المقال يحتاج مراجعة بشرية.','zad-answer-key-help'));
  const entries=make('div',undefined,'zad-answer-key-list');
  const controls=[];
  function addRow(number,source={},reference={}){
    const card=make('div',undefined,'zad-answer-key-item');
    const rowTop=make('div',undefined,'zad-key-item-top');
    rowTop.append(make('strong','السؤال '+number));
    const remove=action('حذف من المفتاح',()=>{card.remove();const i=controls.findIndex(x=>x.card===card);if(i>=0)controls.splice(i,1);},'btn');rowTop.append(remove);card.append(rowTop);
    if(reference.studentAnswer){
      const hint=make('div','إجابة الطالب المسجلة: '+reference.studentAnswer,'zad-answer-key-reference');card.append(hint);
    }
    const question=buildField('نص السؤال',source.question||reference.question||'');
    const correct=buildField('الإجابة الصحيحة أو العناصر الأساسية',source.correctAnswer||'');
    const type=buildField('نوع السؤال',source.type||reference.type||'text','select');
    card.append(question.label,correct.label,type.label);entries.append(card);
    controls.push({card,number,question:question.input,correct:correct.input,type:type.input});
  }
  numbers.forEach(number=>addRow(number,indexed.get(number)||{},defaults.get(number)||{}));
  panel.append(entries);
  const tools=make('div',undefined,'zad-answer-key-tools');
  const importExam=action('📥 استيراد نصوص الأسئلة',async()=>{
    importExam.disabled=true;status.textContent='جارٍ قراءة الامتحان الأصلي من Firebase…';
    try{
      const code=await loadOriginalExamHtml(result.examId);
      const candidates=recoverExamQuestionLabels(code);
      let imported=0;
      for(const field of controls){
        if(field.question.value.trim())continue;
        // For old results the number may indicate a form-field index, not a question number.
        const found=candidates.find(item=>item.fieldNo===field.number)||candidates.find(item=>item.logicalNo===field.number);
        if(found){field.question.value=found.question;imported++;}
      }
      status.textContent=`استوردت ${imported} نص سؤال من أصل ${candidates.length} خانة معروفة. راجع تطابق أرقام الأسئلة مع الإجابات القديمة قبل حفظ المفتاح. لم تُملأ أي إجابة صحيحة تلقائيًا.`;
      if(!candidates.length)status.textContent='الأسئلة قد تكون متولدة بواسطة JavaScript. اضغط «تنزيل HTML» لمراجعة الكود الأصلي.';
    }catch(e){status.textContent='فشل استيراد الأسئلة: '+(e.code||e.message);}
    finally{importExam.disabled=false;}
  },'btn');
  const downloadExam=action('📄 تنزيل HTML الامتحان',async()=>{
    downloadExam.disabled=true;
    try{downloadExamSource(await loadOriginalExamHtml(result.examId),result.examId);status.textContent='تم تجهيز كود الامتحان للتنزيل.';}
    catch(e){status.textContent='تعذر تنزيل الكود: '+(e.code||e.message);}
    finally{downloadExam.disabled=false;}
  },'btn');
  tools.append(importExam,downloadExam);

  tools.append(action('➕ إضافة سؤال',()=>addRow(Math.max(0,...controls.map(x=>x.number))+1),'btn'));
  const status=make('p','','zad-answer-key-status');status.setAttribute('role','status');
  const save=action('💾 حفظ مفتاح الإجابات',async()=>{
    const data=controls.map(({number,question,correct,type})=>({number,question:question.value.trim().slice(0,800),correctAnswer:correct.value.trim().slice(0,1200),type:type.value}));
    if(data.some(x=>!Number.isInteger(x.number)||x.number<1)){status.textContent='رقم السؤال غير صالح.';return;}
    if(data.length>150){status.textContent='أقصى عدد 150 سؤالًا.';return;}
    save.disabled=true;status.textContent='جارٍ الحفظ…';
    try{
      await setDoc(doc(db,'codeExamAnswerKeys',result.examId),{items:data,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid,examTitle:result.examTitle||''});
      answerKeyCache.set(result.examId,{items:data});status.textContent='تم حفظ المفتاح. زر طباعة تقرير الإجابات هيعرض الآن مقارنة الطالب بالإجابة الصحيحة.';
    }catch(error){status.textContent='تعذر حفظ المفتاح: '+(error.code||error.message)}
    finally{save.disabled=false;}
  },'btn gold');
  tools.append(save);panel.append(tools,status);modal.append(panel);document.body.append(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
  close.focus();
}
async function printCodeReport(result,button){
  // Open synchronously from the click; browsers block window.open after an awaited Firestore request.
  const preview=window.open('','_blank');
  if(!preview){alert('اسمح بالنوافذ المنبثقة للموقع حتى يظهر تقرير الإجابات.');return;}
  preview.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تقرير الإجابات</title><body style="font:16px Tahoma,Arial;padding:32px">جارٍ تحميل الإجابات النموذجية وتجهيز التقرير…</body></html>');
  preview.document.close();
  button.disabled=true;const original=button.textContent;button.textContent='جارٍ تجهيز التقرير…';
  try{
    const key=await fetchCodeAnswerKey(result.examId);
    printCodeExamAnswers(result,key,preview);
  }catch(error){
    alert('تعذر تحميل الإجابات النموذجية: '+(error.code||error.message)+'\nسيظهر التقرير بالإجابات المسجلة فقط.');
    if(!preview.closed)printCodeExamAnswers(result,null,preview);
  }finally{button.disabled=false;button.textContent=original;}
}

function renderCode(entry){
  const {id,data:x}=entry;
  const row=make('article',undefined,'zad-exam-result-row');
  row.append(make('strong',(x.studentName||'طالب')+' — '+(x.examTitle||'امتحان')));
  row.append(make('div',`${x.score??0} من ${x.total??0} (${x.percent??0}%)${x.excellent?' — ممتاز 🏅':''} · تصحيح إلكتروني مبدئي · ${dateText(x.createdAt)}`));
  const actions=make('div',undefined,'zad-result-actions');
  const answers=parseCodeAnswers(x.answers);
  const pre=make('pre',answers.length?answers.map(q=>`السؤال ${q.number}: ${q.question||'نص السؤال غير محفوظ'}\nإجابة الطالب: ${q.studentAnswer||'لم يجب'}`).join('\n\n'):'لم تتوفر بيانات الإجابات من كود الامتحان.');pre.hidden=true;pre.style.whiteSpace='pre-wrap';
  const show=action('عرض الإجابات',()=>{pre.hidden=!pre.hidden;show.textContent=pre.hidden?'عرض الإجابات':'إخفاء الإجابات'});
  const pct=Number(x.percent ?? (Number(x.total)>0?Number(x.score)/Number(x.total)*100:0));
  const certData={studentUid:x.studentUid||'',studentName:x.studentName||'الطالب',title:x.examTitle||'الامتحان',grade:gradeFromPercent(pct),description:`تقديرًا لمشاركته في ${x.examTitle||'الامتحان'}، وحصوله على ${x.score??0} من ${x.total??0} (${Math.round(pct)}%).`,issueDate:new Date().toLocaleDateString('ar-EG')};
  const cert=action('🖨️ طباعة الشهادة',()=>printableExamResult(certData),'zad-result-print-certificate btn gold');
  const edit=action('✏️ تعديل الشهادة',()=>window.dispatchEvent(new CustomEvent('zad:certificate-from-exam',{detail:certData})),'zad-result-edit-certificate btn');
  const status=make('span',undefined,'zad-delete-status');status.setAttribute('role','status');
  const del=action('🗑️ حذف النتيجة',async()=>{
    if(!confirm(`حذف نتيجة ${x.studentName||'الطالب'} — ${x.examTitle||'الامتحان'} نهائيًا؟`))return;
    del.disabled=true;status.textContent='جارٍ الحذف...';
    try{await deleteDoc(doc(db,'codeExamResults',id))}catch(e){del.disabled=false;status.textContent='تعذر الحذف: '+(e.code||e.message)}
  },'zad-delete-result');
  const print=action('🖨️ طباعة تقرير الإجابات',()=>printCodeReport(x,print),'zad-print-answer-report btn');
  const editKey=action('📝 الإجابات النموذجية',()=>editCodeAnswerKey(x),'btn');
  actions.append(show,print,editKey,cert,edit,del,status);row.append(actions,pre);return row;
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
    const certData={studentUid:x.studentUid||'',studentName:name,title:exam?.title||'امتحان الوحدة الأولى',grade:gradeFromPercent(pct),description:`تقديرًا للحصول على ${x.finalScore} من 30 (${Math.round(pct)}%) في ${exam?.title||'امتحان الوحدة الأولى'}.`,issueDate:new Date().toLocaleDateString('ar-EG')};
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
