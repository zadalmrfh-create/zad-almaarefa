import {essayTask, publishTodayQueue} from './today-queues.js?v=20261122-step5';
import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,query,limit,orderBy,updateDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const el=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let exams=new Map(),results=[],adminUser=null;
const status=text=>{el('zadSpecialAdminStatus').textContent=text};
const keyed=q=>Number.isInteger(q.answer)&&['mcq','tf'].includes(q.type);
const score=(q,a)=>keyed(q)?(String(a??'')===String(q.answer)?1:0):null;
const answered=(q,a)=>{if(a===null||a===undefined||a==='')return 'لم يجب';const n=Number(a);return q.type==='mcq'||q.type==='tf' ? (Number.isInteger(n)?q.options[n]||'إجابة غير معروفة':'إجابة غير معروفة'):String(a)};
const correct=q=>keyed(q)?q.options[q.answer]:(['mcq','tf'].includes(q.type)?'مفتاح يحتاج مراجعة الإدارة':'مقالي / أكمل — مراجعة الإدارة');
const maxResults = 150;
let loadRequest = 0;
let coverage = {};

function publishEssayQueue(uid) {
  const items=results.map(entry=>essayTask('special',entry,exams.get(entry.data.examId))).filter(Boolean);
  publishTodayQueue('special',uid,{items,...coverage});
}
const bankReady = fetch('../../exams/zad-special/bank.json').then(async response => {
  if (!response.ok) throw Error('تعذر تحميل بنك الأسئلة');
  const bank=await response.json();
  return new Map(bank.exams.map(exam=>[exam.id,exam]));
}).then(bank=>({bank}), error=>({error}));

onAuthStateChanged(auth, async user => {
  adminUser=null;results=[];coverage={};
  el('zadSpecialAdminList').replaceChildren();
  el('zadSpecialReview').replaceChildren();
  el('zadSpecialReview').hidden=true;
  if(!user){status('سجّل الدخول بحساب الإدارة أولًا.');return;}
  try {
    const access=await getDoc(doc(db,'admins',user.uid));
    if(!access.exists() && !(user.email?.toLowerCase()==='maleksameh121@gmail.com' && user.emailVerified)){
      const profile=await getDoc(doc(db,'users',user.uid));
      if(profile.data()?.role!=='admin')throw Error('عرض الإجابات خاص بالإدارة المعتمدة فقط.');
    }
    const {bank,error}=await bankReady;
    if(auth.currentUser?.uid!==user.uid)return;
    if(error)throw error;
    exams=bank;
    adminUser=user;
    await loadResults();
  } catch(error){
    if(auth.currentUser?.uid!==user.uid)return;
    status(error.message);
    publishTodayQueue('special',user.uid,{error:true});
  }
});

async function loadResults() {
  if(!adminUser)return;
  const uid=adminUser.uid;
  const request=++loadRequest;
  const list=el('zadSpecialAdminList');
  status('جارٍ تحميل أحدث 150 محاولة…');
  list.replaceChildren();
  try {
    const snap=await getDocs(query(collection(db,'zad_exam_submissions'),orderBy('createdAt','desc'),limit(maxResults+1)));
    if(request!==loadRequest || auth.currentUser?.uid!==uid)return;
    const recent=snap.docs.slice(0,maxResults).map(d=>({id:d.id,data:d.data()}));
    results=recent.filter(entry=>exams.has(entry.data.examId));
    coverage={limited:snap.size>maxResults,error:recent.length!==results.length};
    publishEssayQueue(uid);
    status(`ظهر ${results.length} تسليمًا (من أحدث 150 سجلًا).`);
    if(!results.length){list.textContent='لا توجد إجابات مرسلة بعد.';return;}
    for(const result of results){
      const box=document.createElement('article');
      box.className='zad-special-result';
      box.dataset.attemptId=result.id;
      const data=result.data;
      const exam=exams.get(data.examId);
      const date=data.createdAt?.toDate?.()?.toLocaleString('ar-EG')||'—';
      box.innerHTML=`<strong>${esc(data.studentName||'طالب')} — ${esc(exam.title)}</strong><p>${esc(date)} · <span data-grade-state>${Number.isFinite(data.finalScore)?'✅ تمت المراجعة':'⏳ بانتظار التصحيح'}</span></p>`;
      const button=document.createElement('button');
      button.type='button';button.className='btn';
      button.textContent='عرض الإجابات وتصحيحها وطباعتها';
      button.onclick=()=>review(result);
      box.append(button);
      list.append(box);
    }
  } catch(error) {
    if(request!==loadRequest || auth.currentUser?.uid!==uid)return;
    results=[];
    publishTodayQueue('special',uid,{error:true});
    status('تعذر قراءة النتائج: '+(error.code||error.message));
  }
}
window.addEventListener('zad:today-special-essay',event=>{
  const target=results.find(result=>result.id===event.detail?.attemptId);
  if(target && adminUser?.uid===auth.currentUser?.uid)review(target);
});

function review(item){const data=item.data,exam=exams.get(data.examId);const panel=el('zadSpecialReview');panel.hidden=false;panel.replaceChildren();const h=document.createElement('h3');h.textContent=`📄 تقرير: ${data.studentName||'طالب'} — ${exam.title}`;panel.append(h);const caption=document.createElement('p');caption.textContent=`${data.answers?.filter(Boolean).length||0} إجابة من ${exam.total} سؤالًا • الدرجات الآلية المقترحة قابلة للتعديل قبل الاعتماد`;panel.append(caption);
 const save=document.createElement('button');save.className='btn gold';save.type='button';save.textContent='💾 اعتماد درجات جميع الأسئلة';const print=document.createElement('button');print.className='btn';print.type='button';print.textContent='🖨️ طباعة تقرير الإجابات';const total=document.createElement('strong');total.style.margin='0 16px';const controls=document.createElement('div');controls.className='zad-special-review-actions';controls.append(save,print,total);panel.append(controls);
 const sections=new Map();const inputs=[];
 exam.questions.forEach((q,i)=>{
   let s=sections.get(q.section);if(!s){s=document.createElement('section');s.className='zad-special-section';const title=document.createElement('h4');title.textContent=q.section;s.append(title);sections.set(q.section,s);panel.append(s)}
   const block=document.createElement('div');block.className='zad-special-q';const text=document.createElement('b');text.textContent=`${i+1}- ${q.text}`;const ans=document.createElement('p');ans.textContent=`إجابة الطالب: ${answered(q,data.answers?.[i])}`;const key=document.createElement('p');key.className='zad-special-key';key.textContent='الصحيحة / توجيه التصحيح: '+correct(q);block.append(text,ans,key);
   const label=document.createElement('label');label.textContent='درجة السؤال من 1: ';const grade=document.createElement('input');grade.type='number';grade.min='0';grade.max='1';grade.step='.5';grade.placeholder='—';const prev=data.gradeDetails?.[i];grade.value=prev!==undefined&&prev!==null?String(prev):(keyed(q)?String(score(q,data.answers?.[i])):'');grade.dataset.index=String(i);grade.addEventListener('input',refreshTotal);label.append(grade);block.append(label);inputs.push(grade);s.append(block);
 });
 function refreshTotal(){let n=0,pending=0;for(const input of inputs){if(input.value==='')pending++;else n+=Number(input.value)||0}total.textContent=`المجموع الحالي: ${n} / ${exam.total} ${pending?'• '+pending+' أسئلة بانتظار درجة':''}`}
 refreshTotal();panel.scrollIntoView({block:'start',behavior:'smooth'});
 save.onclick=async()=>{
   if(inputs.some(input=>input.value===''||!Number.isFinite(Number(input.value))||Number(input.value)<0||Number(input.value)>1)){
     alert('برجاء إدخال درجة من 0 إلى 1 لكل سؤال قبل اعتماد النتيجة.');
     return;
   }
   const owner=adminUser?.uid;
   if(!owner || owner!==auth.currentUser?.uid)return;
   const gradeDetails=inputs.map(input=>Number(input.value));
   const finalScore=gradeDetails.reduce((sum,value)=>sum+value,0);
   save.disabled=true;
   try {
     await updateDoc(doc(db,'zad_exam_submissions',item.id),{
       gradeDetails,finalScore,
       autoScore:exam.questions.reduce((sum,q,i)=>sum+(score(q,data.answers?.[i])||0),0),
       reviewedAt:serverTimestamp(),reviewedBy:owner,status:'graded'
     });
     if(owner!==auth.currentUser?.uid)return;
     Object.assign(item.data,{gradeDetails,finalScore});
     const latest=results.find(result=>result.id===item.id);
     if(latest)Object.assign(latest.data,{gradeDetails,finalScore});
     publishEssayQueue(owner);
     const row=[...el('zadSpecialAdminList').children].find(node=>node.dataset.attemptId===item.id);
     const state=row?.querySelector('[data-grade-state]');
     if(state)state.textContent='✅ تمت المراجعة';
     status(`تم اعتماد نتيجة ${data.studentName}: ${finalScore} من ${exam.total} ✅`);
     refreshTotal();
   } catch(error){
     if(owner===auth.currentUser?.uid)status('تعذر اعتماد النتيجة: '+(error.code||error.message));
   } finally {save.disabled=false;}
 };

 print.onclick=()=>printReport(exam,data,inputs.map(i=>i.value===''?null:Number(i.value)));
}
function printReport(exam,data,grades){const rows=exam.questions.map((q,i)=>{const ans=answered(q,data.answers?.[i]);return `<section class="item"><strong>${i+1}- ${esc(q.text)}</strong><div>إجابة الطالب: <b>${esc(ans)}</b></div><div>الإجابة المرجعية: ${esc(correct(q))}</div><div>الدرجة: ${grades[i]===null?'لم تراجع بعد':esc(grades[i])} / 1</div></section>`}).join('');const counted=grades.filter(v=>v!==null).reduce((a,b)=>a+b,0);const complete=grades.every(v=>v!==null);const popup=window.open('','_blank');if(!popup){alert('اسمح بفتح نافذة الطباعة من المتصفح.');return}const when=data.createdAt?.toDate?.()?.toLocaleString('ar-EG')||'—';const logo=new URL('../../images/logo.png',import.meta.url).href;
 popup.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير إجابات ${esc(data.studentName)} — زاد المعرفة</title><style>body{font:15px/2 Tahoma,Arial,sans-serif;color:#1a2e49;margin:30px auto;max-width:880px}header{display:flex;align-items:center;gap:20px;border-bottom:3px solid #c7a146;padding-bottom:16px}img{width:78px}h1{margin:0;font-size:23px}h2{font-size:19px}.item{margin:10px 0;padding:12px;border:1px solid #c6cfdb;border-radius:9px;break-inside:avoid}.item div{margin-top:4px}button{background:#d8b35c;border:0;padding:10px 18px;font:inherit;margin:15px}@media print{button{display:none}}</style></head><body><header><img src="${logo}" alt="زاد المعرفة"><div><h1>منصة زاد المعرفة التعليمية</h1><p>تقرير إجابات الامتحان الإلكتروني</p></div></header><h2>${esc(exam.title)}</h2><p><b>الطالب:</b> ${esc(data.studentName)} — <b>تاريخ التسليم:</b> ${esc(when)}</p><p><b>حالة التصحيح:</b> ${complete?'مكتمل وفق درجات النموذج الحالي':'غير مكتمل (يوجد أسئلة تحتاج مراجعة)'} — <b>المجموع:</b> ${counted} / ${exam.total}</p>${rows}<p>هذا تقرير مراجعة الإدارة. الدرجات المعتمدة لا تُسجَّل إلا بعد الضغط على «اعتماد درجات جميع الأسئلة».</p><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button></body></html>`);popup.document.close();}
el('zadSpecialReload').addEventListener('click',loadResults);
