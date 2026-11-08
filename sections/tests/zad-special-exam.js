import {auth,db} from '../../firebase-config.js';
import {doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {examAuthReady} from './exam-auth-gate.js';
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=new URLSearchParams(location.search).get('id')||'';
let user=null,exam=null,started=false,finished=false,locked=false,deadline=0,ticker=null;
const setStatus=(s,error=false)=>{$('examStatus').textContent=s;$('examStatus').classList.toggle('error',error)};
const expectedId=()=>user.uid+'_'+id;
function render(){const box=$('examQuestions');box.replaceChildren();let current='';let container=null;const sections=[];const navigator=$('sectionNavigator');if(navigator)navigator.replaceChildren();
 exam.questions.forEach((q,i)=>{
  if(current!==q.section){current=q.section;const details=document.createElement('details');details.className='box group';details.open=sections.length===0;sections.push(details);const summary=document.createElement('summary');summary.textContent=current;details.append(summary);container=document.createElement('div');details.append(container);box.append(details)}
  const article=document.createElement('div');article.className='question';const h=document.createElement('strong');h.textContent=(i+1)+' / '+q.text;article.append(h);
  if(q.type==='mcq'||q.type==='tf'){
   const wrap=document.createElement('div');wrap.className='choices';for(const [k,opt] of q.options.entries()){
    const label=document.createElement('label');label.className='choice';const input=document.createElement('input');input.type='radio';input.name='q'+i;input.value=String(k);const span=document.createElement('span');span.textContent=(q.type==='tf'?'':('أبجدهوزحطيكلمنسعفصقرشتثخذضظغ'[k]||String(k+1))+') ')+opt;label.append(input,span);wrap.append(label)}article.append(wrap)
  }else if(q.type==='text'){
   const input=document.createElement('input');input.type='text';input.maxLength=600;input.name='q'+i;input.placeholder='اكتب إجابتك هنا';article.append(input)
  }else{
   const input=document.createElement('textarea');input.maxLength=4000;input.name='q'+i;input.placeholder='اكتب الإجابة أو التعليل هنا';article.append(input)
  }container.append(article);
 });
 if(navigator){sections.forEach((details,i)=>{const b=document.createElement('button');b.type='button';b.className='section-pill'+(i===0?' active':'');b.textContent=(i+1)+' • '+details.querySelector('summary').textContent.split('—').pop().replace(/\s*\([^)]*\)\s*$/,'').trim();b.onclick=()=>{sections.forEach((d,k)=>d.open===true&&k!==i&&(d.open=false));details.open=true;navigator.querySelectorAll('button').forEach((c,k)=>c.classList.toggle('active',k===i));details.scrollIntoView({behavior:'smooth',block:'start'});};navigator.append(b);details.addEventListener('toggle',()=>{if(details.open){navigator.querySelectorAll('button').forEach((c,k)=>c.classList.toggle('active',k===i));}})})}
 $('examForm').addEventListener('input',updateCount);
 updateCount();
}
function collect(){const fd=new FormData($('examForm'));return exam.questions.map((q,i)=>String(fd.get('q'+i)??'').trim());}
function updateCount(){const n=collect().filter(Boolean).length;$('countAnswered').textContent=`${n} من ${exam.questions.length} إجابة`;const bar=$('answerProgress');if(bar){bar.style.width=((n/exam.questions.length)*100)+'%';bar.setAttribute('aria-valuenow',String(n));bar.setAttribute('aria-valuemax',String(exam.questions.length));}}
function provisionalScore(answers){return exam.questions.reduce((t,q,i)=>t+(Number.isInteger(q.answer)&&['mcq','tf'].includes(q.type)&&answers[i]===String(q.answer)?1:0),0)}
function tick(){let sec=Math.max(0,Math.ceil((deadline-Date.now())/1000));$('clock').textContent=`⏳ ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;if(sec<=0&&!locked&&!finished){clearInterval(ticker);submit(true)}}
async function submit(expired=false){if(locked||finished||!user||!started)return;const answers=collect();const missing=answers.filter(v=>!v).length;if(!expired&&!confirm(`تسليم الامتحان؟ ${missing?'عدد الأسئلة بدون إجابة: '+missing+'. ':''}لن يمكنك تعديل الإجابات بعد الإرسال.`))return;locked=true;$('submitBtn').disabled=true;
 const payload={studentUid:user.uid,studentName:$('studentName').value.trim(),examId:id,answers,source:'zad-special-2026',createdAt:serverTimestamp()};
 try{await setDoc(doc(db,'zad_exam_submissions',expectedId()),payload);finished=true;clearInterval(ticker);$('examPanel').hidden=true;$('intro').hidden=true;showResult(payload,provisionalScore(answers),false)}
 catch(error){locked=false;$('submitBtn').disabled=false;setStatus('تعذر إرسال الإجابات: '+(error.code||error.message)+'. احتفظ بالصفحة مفتوحة وحاول التسليم مرة ثانية.',true)}
}
function showResult(data,score,previous){$('resultPanel').hidden=false;const el=$('resultContent');el.replaceChildren();const h=document.createElement('h3');h.textContent=previous?'هذه المحاولة مسجلة بالفعل':'تم حفظ إجاباتك بنجاح ✅';el.append(h);
 const p=document.createElement('p');p.textContent='الطالب: '+(data.studentName||'—')+' • الامتحان: '+exam.title;el.append(p);
 const info=document.createElement('p');info.className='auto-note';info.textContent=Number.isFinite(data.finalScore)?`الدرجة المعتمدة من الإدارة: ${data.finalScore} من ${exam.total}`:`التصحيح الموضوعي المبدئي: ${score} من ${exam.autoCount}. الدرجة النهائية من ${exam.total} تُعتمد بعد مراجعة الإدارة.`;el.append(info);
 const note=document.createElement('p');note.className='small-note';note.textContent='تُعرض درجات الاختياري والصح والخطأ مبدئيًا، وباقي الإجابات والمفاتيح التي تحتاج مراجعة تُصحّحها الإدارة.';el.append(note);
 setStatus(previous?'تم العثور على محاولة سابقة لهذا الامتحان.':'تم تسليم الامتحان إلى الإدارة.');
}
$('startBtn').addEventListener('click',()=>{const name=$('studentName').value.trim().replace(/\s+/g,' ');if(name.length<3){setStatus('اكتب اسم الطالب (3 أحرف على الأقل) قبل البدء.',true);$('studentName').focus();return}if(!exam||!user||started)return;started=true;$('studentName').value=name;$('intro').hidden=true;$('examPanel').hidden=false;deadline=Date.now()+exam.minutes*60000;ticker=setInterval(tick,1000);tick();setStatus('تم بدء الامتحان. بالتوفيق.');});
$('examForm').addEventListener('submit',e=>{e.preventDefault();submit(false)});
async function init(){try{
 const bank=await fetch('../../exams/zad-special/bank.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('ملف الأسئلة غير متاح');return r.json()});exam=bank.exams.find(e=>e.id===id);if(!exam)throw Error('رابط امتحان غير معروف');if(exam.archived&&exam.replacedBy){location.replace('zad-special-exam.html?id='+encodeURIComponent(exam.replacedBy));return;}
 $('examTitle').textContent=exam.title;$('examMeta').textContent=`${exam.subject} • ${exam.grade} • ${exam.total} سؤالًا • ${exam.minutes} دقيقة`;
 user=await Promise.race([examAuthReady,new Promise((_,reject)=>setTimeout(()=>reject(Error('انتهت مهلة تسجيل الدخول')),18000))]);if(!user)throw Error('يجب تسجيل الدخول أولًا');
 const previous=await getDoc(doc(db,'zad_exam_submissions',expectedId()));
 if(previous.exists()){const data=previous.data();finished=true;showResult(data,provisionalScore(data.answers||[]),true);return}
 const name=user.displayName||user.email?.split('@')[0]||'';$('studentName').value=name;render();$('intro').hidden=false;setStatus('جاهز للبدء. المحاولة مسموحة مرة واحدة فقط.');
 }catch(error){setStatus('تعذر تجهيز الامتحان: '+(error.code||error.message)+'. تحقق من تسجيل الدخول وقواعد Firestore ثم أعد المحاولة.',true)}}
init();
