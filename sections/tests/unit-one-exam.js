import { auth, db } from '../../firebase-config.js';
import { examAuthReady } from './exam-auth-gate.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { printUnitExamAnswers } from '../../dashboard/admin/exam-answer-report.js';
const BADI_ID = 'badi-2bac-2026';
const $ = id => document.getElementById(id);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = t => String(t??'').trim().toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ');
const state={exam:null,user:null,studentName:'',ends:0,tick:null,busy:false,submitted:false,attempt:null};
const isBadi=()=>state.exam?.id===BADI_ID;
const say = msg => $('ue-message').textContent=msg;
function renderQuestion(q,i){
 const head=`<strong>${i+1}. ${esc(q.text)}</strong>`;
 const kind={mcq:'اختر الإجابة الصحيحة',tf:'صح أم خطأ',fill:'أكمل الفراغ',essay:'سؤال مقالي — يصححه الأدمن'}[q.type];
 let body='';
 if(q.type==='mcq') body=q.options.map((v,j)=>`<label class="choice"><input type="radio" name="q${i}" value="${j}"><span>${esc(v)}</span></label>`).join('');
 if(q.type==='tf')body=['صح','خطأ'].map((v,j)=>`<label class="choice"><input type="radio" name="q${i}" value="${j===0?'true':'false'}"><span>${v}</span></label>`).join('');
 if(q.type==='fill')body=`<input type="text" name="q${i}" maxlength="250" placeholder="اكتب الإجابة هنا" aria-label="إجابة السؤال ${i+1}">`;
 if(q.type==='essay')body=`<textarea name="q${i}" maxlength="2500" placeholder="اكتب إجابتك بأسلوبك مع التعليل" aria-label="إجابة السؤال ${i+1}"></textarea>`;
 return `<section class="ue-q"><small>${kind}</small>${head}${body}</section>`;
}
function answersFromForm(){const f=new FormData($('ue-form'));return state.exam.questions.map((q,i)=>{let val=f.get('q'+i); if(q.type==='mcq')return val===null?null:Number(val);if(q.type==='tf')return val===null?null:val==='true';return String(val??'').trim()});}
function computeAuto(exam,answers){return exam.questions.reduce((n,q,i)=>{
 const a=answers[i];if(q.type==='essay'||a===null||a==='')return n;
 if(q.type==='mcq')return n+(a===q.answer?1:0);
 if(q.type==='tf')return n+(a===q.answer?1:0);
 if(q.type==='fill')return n+((q.answers||[]).some(x=>norm(x)===norm(a))?1:0);
 return n;},0);}
function badiActions(){
  return `<div class="ue-report-actions"><button type="button" id="ue-print-result">🖨️ طباعة النتيجة</button><button type="button" id="ue-print-answers">🖨️ طباعة تقرير الإجابات</button><button type="button" id="ue-refresh-result">🔄 تحديث النتيجة بعد تصحيح المقالي</button></div>`;
}
function readScore(x){
  const auto=computeAuto(state.exam,x?.answers||[]);
  const final=Number.isInteger(x?.finalScore)?x.finalScore:null;
  return {auto,final,graded:final!==null};
}
function renderResult(auto){
  $('ue-form').hidden=true;$('ue-meta').hidden=true;$('ue-name-step').hidden=true;$('ue-result').hidden=false;
  const score=readScore(state.attempt);
  const essayCount=state.exam.questions.filter(q=>q.type==='essay').length;
  const objectiveCount=state.exam.questions.length-essayCount;
  $('ue-result').innerHTML=`<h2>✅ تم إرسال إجاباتك بنجاح</h2>
    <p>الطالب: <strong>${esc(state.studentName)}</strong></p>
    <p>الدرجة الموضوعية المبدئية: <b>${score.auto} من ${objectiveCount}</b>.</p>
    ${score.graded?`<p>✅ الدرجة النهائية المعتمدة بعد تصحيح المقالي: <b>${score.final} من ${state.exam.questions.length}</b></p>`:`<p>الأسئلة المقالية ${essayCount} <strong>بانتظار تصحيح الإدارة</strong>، ولن تُعتمد النتيجة النهائية قبل مراجعتها.</p>`}
    ${isBadi()?badiActions():''}
    <p><a href="code-exams.html" style="color:#f8d370">العودة لقائمة الامتحانات</a></p>`;
  say('تم حفظ المحاولة في حساب الطالب وإتاحتها للإدارة.');
}
function studentPrintResult(){
  if(!isBadi()||!state.attempt) return;
  const x=state.attempt, {auto,final,graded}=readScore(x);
  const win=window.open('', '_blank');if(!win){alert('اسمح بفتح النوافذ المنبثقة لطباعة النتيجة');return}
  const logo=new URL('../../images/logo.png',import.meta.url).href;
  const title=esc(state.exam.title);const when=x.createdAt?.toDate?.()?.toLocaleString('ar-EG')||new Date().toLocaleString('ar-EG');
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>نتيجة امتحان علم البديع</title><style>body{font-family:Tahoma,Arial,sans-serif;max-width:760px;padding:30px;margin:auto;color:#10223d;line-height:2}header{display:flex;gap:20px;align-items:center;border-bottom:3px solid #d7b552;padding-bottom:16px}img{width:76px;height:76px}h1{font-size:25px;margin:0}section{border:1px solid #cbd5e1;border-radius:16px;padding:22px;margin-top:20px}b{color:#173b66}small{color:#475569}button{padding:12px 22px;background:#e6c05a;border:0;border-radius:12px;font-size:16px}@media print{button{display:none}}</style></head><body><header><img src="${logo}" alt="لوجو زاد المعرفة"><div><h1>أكاديمية زاد المعرفة التعليمية</h1><p>${title}</p></div></header><section><p>اسم الطالب: <b>${esc(x.studentName||state.studentName)}</b></p><p>تاريخ النتيجة: <b>${esc(when)}</b></p><p>الدرجة الموضوعية: <b>${auto} من 26</b></p><p>حالة المقالي: <b>${graded?'تم تصحيحه واعتماده':'بانتظار مراجعة الأدمن'}</b></p><h2>${graded?`الدرجة النهائية المعتمدة: ${final} من 30`:'الدرجة النهائية لم تعتمد بعد'}</h2><small>نتيجة صادرة من سجلات الامتحان الإلكترونية في حساب الطالب.</small></section><p><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button></p></body></html>`);win.document.close();
}
async function refreshBadi(){
  if(!isBadi()||!state.user)return;
  try{const snap=await getDoc(doc(db,'unitOneExamAttempts',state.user.uid+'_'+state.exam.id));if(!snap.exists())throw Error('المحاولة غير متاحة');state.attempt=snap.data();state.studentName=state.attempt.studentName||state.studentName;renderResult();}
  catch(e){say('تعذر تحديث النتيجة: '+(e.code||e.message))}
}
$('ue-result').addEventListener('click',e=>{
  if(e.target.closest('#ue-print-result'))studentPrintResult();
  if(e.target.closest('#ue-print-answers')&&state.attempt)printUnitExamAnswers(state.exam,state.attempt);
  if(e.target.closest('#ue-refresh-result'))refreshBadi();
});
function tick(){const left=Math.max(0,state.ends-Date.now());const t=$('ue-timer');if(t)t.textContent=`⏳ ${Math.floor(left/60000)}:${String(Math.floor(left/1000)%60).padStart(2,'0')}`;if(left<=0&&!state.submitted&&!state.busy){clearInterval(state.tick);submit(true)}}
async function submit(expired=false){if(state.busy||state.submitted)return; if(isBadi()&&(!state.studentName||state.studentName.trim().length<3)){say('اسم الطالب مطلوب قبل التسليم.');return;} if(!expired && !confirm('هل تريد تسليم إجاباتك؟ لا يمكن إعادة نفس الامتحان بعد التسليم.'))return;state.busy=true;$('ue-submit').disabled=true;
 const answers=answersFromForm();const id=state.user.uid+'_'+state.exam.id;const payload={studentUid:state.user.uid,studentName:state.studentName,examId:state.exam.id,answers,source:'unit-one-2026',createdAt:serverTimestamp()};
 try{await setDoc(doc(db,'unitOneExamAttempts',id),payload);state.attempt={...payload,createdAt:new Date()};state.submitted=true;clearInterval(state.tick);renderResult(computeAuto(state.exam,answers));}
 catch(e){say('تعذر إرسال الإجابات: '+(e.code||e.message)+'. إجاباتك ما زالت في الصفحة؛ لا تغلقها.');$('ue-submit').disabled=false;state.busy=false;}
}
$('ue-form').addEventListener('submit',e=>{e.preventDefault();submit(false)});
$('ue-start').addEventListener('click',()=>{
  const input=$('ue-student-name');
  const name=input.value.replace(/\s+/g,' ').trim();
  if(name.length<3||name.length>150){$('ue-name-error').textContent='الاسم إجباري ولا يقل عن 3 أحرف.';input.focus();return}
  $('ue-name-error').textContent='';state.studentName=name;
  $('ue-name-step').hidden=true;$('ue-form').hidden=false;$('ue-meta').hidden=false;
  state.ends=Date.now()+state.exam.timeMinutes*60000;state.tick=setInterval(tick,1000);tick();
  say('تم بدء الامتحان باسم '+name+' — أجب ثم سلّم مرة واحدة.');
});
const withTimeout=(p,ms,message)=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))]);
let user=null;try{user=await withTimeout(examAuthReady,15000,'انتهت مهلة تسجيل الدخول؛ أعد فتح الصفحة.')}catch(e){say(e.message)}
if(user){try{
 state.user=user;
 const bank=await fetch('../../exams/unit1/bank.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('تعذر الوصول لبنك الأسئلة '+r.status);return r.json()});
 const id=new URLSearchParams(location.search).get('id')||'';
 const exam=bank.exams.find(x=>x.id===id);
 if(!exam){say('لم يتم العثور على هذا الامتحان. افتح رابط الامتحان من القائمة.');}
 else{
 state.exam=exam;
 const attemptRef=doc(db,'unitOneExamAttempts',user.uid+'_'+exam.id);
 const old=await withTimeout(getDoc(attemptRef),15000,'انتهت مهلة التحقق من محاولة الامتحان في Firebase');
 $('ue-title').textContent='📝 '+exam.title;
 $('ue-scope').textContent=exam.scope;
 if(old.exists()){
   state.submitted=true;state.attempt=old.data();state.studentName=state.attempt.studentName||'';
   if(isBadi())renderResult();
   else{
     $('ue-result').hidden=false;
     const past=old.data();const final=Number.isFinite(past.finalScore)?`تم اعتماد النتيجة النهائية: <b>${past.finalScore} من 30</b>.`:'الإجابات المقالية ما زالت قيد المراجعة الإدارية.';
     $('ue-result').innerHTML='<h2>سبق لك تسليم هذا الامتحان.</h2><p>'+final+'</p><p>مسموح بمحاولة واحدة لكل طالب.</p><a href="code-exams.html" style="color:#f8d370">العودة للامتحانات</a>';
     say('هذه المحاولة مسجلة في حسابك.');
   }
 }
 else{
   try{const profile=await getDoc(doc(db,'users',user.uid));state.studentName=profile.exists()?String(profile.data().fullName||profile.data().name||user.displayName||'').slice(0,150):String(user.displayName||'');}catch{state.studentName=String(user.displayName||'')}
   $('ue-questions').innerHTML=exam.questions.map(renderQuestion).join('');
   $('ue-meta').innerHTML=`<span>📘 ${esc(exam.subject)}</span><span>30 سؤالًا: 26 آليًا + 4 مقالي</span><strong id="ue-timer"></strong>`;
   say(exam.sourceNote?`تنبيه عن المصدر: ${exam.sourceNote}`:'الامتحان من الوحدة الأولى فقط. اختر إجاباتك ثم سلّم مرة واحدة.');
   if(isBadi()){
     $('ue-student-name').value=state.studentName==='طالب'?'':state.studentName;
     $('ue-name-step').hidden=false;
     say('اكتب اسم الطالب أولًا لبدء الامتحان المجاني وحفظ الإجابات للإدارة.');
   }else{
     $('ue-form').hidden=false;$('ue-meta').hidden=false;
     state.ends=Date.now()+exam.timeMinutes*60000;state.tick=setInterval(tick,1000);tick();
   }
 }
 }
 }
}catch(e){
 const hint=e?.code==='permission-denied'
   ? 'لا توجد صلاحية لقراءة محاولة الامتحان. انشر ملف firestore.rules المرفق من Firebase Console ← Firestore Database ← Rules، ثم أعد فتح الامتحان.'
   : 'تعذر تجهيز الامتحان: '+(e.code||e.message);
 say(hint);
}}
