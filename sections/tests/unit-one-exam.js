import { auth, db } from '../../firebase-config.js';
import { examAuthReady } from './exam-auth-gate.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $ = id => document.getElementById(id);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = t => String(t??'').trim().toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ');
const state={exam:null,user:null,studentName:'',ends:0,tick:null,busy:false,submitted:false};
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
function renderResult(auto){$('ue-form').hidden=true;$('ue-meta').hidden=true;$('ue-result').hidden=false;$('ue-result').innerHTML=`<h2>✅ تم إرسال إجاباتك</h2><p>الدرجة المبدئية للأسئلة الموضوعية: <b>${auto} من 26</b>.</p><p>الأسئلة المقالية الأربعة <strong>بانتظار مراجعة الأدمن</strong>، لذلك لم تُحسب الدرجة النهائية بعد.</p><a href="code-exams.html" style="color:#f8d370">العودة لقائمة الامتحانات</a>`;say('تم تسليم الامتحان بنجاح.');}
function tick(){const left=Math.max(0,state.ends-Date.now());const t=$('ue-timer');if(t)t.textContent=`⏳ ${Math.floor(left/60000)}:${String(Math.floor(left/1000)%60).padStart(2,'0')}`;if(left<=0&&!state.submitted&&!state.busy){clearInterval(state.tick);submit(true)}}
async function submit(expired=false){if(state.busy||state.submitted)return; if(!expired && !confirm('هل تريد تسليم إجاباتك؟ لا يمكن إعادة نفس الامتحان بعد التسليم.'))return;state.busy=true;$('ue-submit').disabled=true;
 const answers=answersFromForm();const id=state.user.uid+'_'+state.exam.id;const payload={studentUid:state.user.uid,studentName:state.studentName,examId:state.exam.id,answers,source:'unit-one-2026',createdAt:serverTimestamp()};
 try{await setDoc(doc(db,'unitOneExamAttempts',id),payload);state.submitted=true;clearInterval(state.tick);renderResult(computeAuto(state.exam,answers));}
 catch(e){say('تعذر إرسال الإجابات: '+(e.code||e.message)+'. إجاباتك ما زالت في الصفحة؛ لا تغلقها.');$('ue-submit').disabled=false;state.busy=false;}
}
$('ue-form').addEventListener('submit',e=>{e.preventDefault();submit(false)});
const user=await examAuthReady;
if(user){try{
 state.user=user;
 const bank=await fetch('../../exams/unit1/bank.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('تعذر الوصول لبنك الأسئلة '+r.status);return r.json()});
 const id=new URLSearchParams(location.search).get('id')||'';
 const exam=bank.exams.find(x=>x.id===id);
 if(!exam){say('لم يتم العثور على هذا الامتحان. افتح رابط الامتحان من القائمة.');}
 else{
 state.exam=exam;
 const attemptRef=doc(db,'unitOneExamAttempts',user.uid+'_'+exam.id);
 const old=await getDoc(attemptRef);
 $('ue-title').textContent='📝 '+exam.title;
 $('ue-scope').textContent=exam.scope;
 if(old.exists()){state.submitted=true;$('ue-result').hidden=false;const past=old.data();const final=Number.isFinite(past.finalScore)?`تم اعتماد النتيجة النهائية: <b>${past.finalScore} من 30</b>.`:'الإجابات المقالية ما زالت قيد المراجعة الإدارية.';$('ue-result').innerHTML='<h2>سبق لك تسليم هذا الامتحان.</h2><p>'+final+'</p><p>مسموح بمحاولة واحدة لكل طالب.</p><a href="code-exams.html" style="color:#f8d370">العودة للامتحانات</a>';say('هذه المحاولة مسجلة في حسابك.');}
 else{
 try{const profile=await getDoc(doc(db,'users',user.uid));state.studentName=profile.exists()?String(profile.data().fullName||profile.data().name||user.displayName||'طالب').slice(0,150):String(user.displayName||'طالب');}catch{state.studentName=String(user.displayName||'طالب')}
 $('ue-questions').innerHTML=exam.questions.map(renderQuestion).join('');
 $('ue-form').hidden=false;$('ue-meta').hidden=false;
 $('ue-meta').innerHTML=`<span>📘 ${esc(exam.subject)}</span><span>30 سؤالًا: 26 آليًا + 4 مقالي</span><strong id="ue-timer"></strong>`;
 say(exam.sourceNote?`تنبيه عن المصدر: ${exam.sourceNote}`:'الامتحان من الوحدة الأولى فقط. اختر إجاباتك ثم سلّم مرة واحدة.');
 state.ends=Date.now()+exam.timeMinutes*60000;state.tick=setInterval(tick,1000);tick();
 }
 }
}catch(e){say('تعذر تجهيز الامتحان: '+(e.code||e.message))}}
