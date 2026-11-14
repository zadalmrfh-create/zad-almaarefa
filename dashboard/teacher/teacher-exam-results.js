import { gradeForDisplay, hasApprovedGrade } from '../admin/exam-result-verification.js';
// Student-scoped results. Back-end Rules enforce the admin-approved relationship.
// Results load ONLY after the teacher clicks the button to avoid unnecessary reads.
import {auth,db} from '../../firebase-config.js';
import {getPreviewContext} from '../admin-preview-core.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,query,where,limit} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const txt=v=>String(v??'').trim();
const date=d=>{const x=d?.toDate?.()||(d?.seconds?new Date(d.seconds*1000):d?new Date(d):null);return x&&!Number.isNaN(x.getTime())?x.toLocaleString('ar-EG'):'—';};
const types=[{type:'special',collection:'zad_exam_submissions',label:'امتحانات العلوم والفقه'},{type:'unit',collection:'unitOneExamAttempts',label:'امتحانات الوحدة الأولى'},{type:'code',collection:'codeExamResults',label:'امتحانات بالكود'},{type:'quiz',collection:'quizAttempts',label:'الاختبارات الأخرى'}];
let effectiveUid=null,loading=false,results=[],links=[],banks={special:new Map(),unit:new Map()},bankLoaded=false;
const say=s=>{$('teacherExamResultsStatus').textContent=s;};
function title(x,entry){const exam=banks[entry.type]?.get(x.examId);return exam?.title||x.examTitle||x.quizTitle||x.title||`${entry.label} — ${x.examId||x.quizId||'اختبار'}`;}
function verified(entry){const d=entry.data;
 if(entry.type==='special')return Array.isArray(d.gradeDetails)&&Number.isFinite(Number(d.finalScore));
 if(entry.type==='unit')return Number.isFinite(Number(d.finalScore))&&Array.isArray(d.essayMarks);
 if(entry.type==='code')return hasApprovedGrade(d);
 return d.verified===true||d.status==='graded';
}
function grade(entry){const d=entry.data;if(entry.type==='code'){const g=gradeForDisplay(d);return `${g.score} من ${g.total} (${g.percent}%) — ${g.approved?'معتمدة':'مبدئية غير معتمدة'}`;}let n=null,total=null;
 if(verified(entry)&&Number.isFinite(Number(d.finalScore)))n=Number(d.finalScore);
 else if(Number.isFinite(Number(d.score))&&(entry.type==='code'||entry.type==='quiz'))n=Number(d.score);
 total=entry.type==='special'?banks.special.get(d.examId)?.total??(d.examId==='fiqh-khiyar-azhar-2026-v2'?40:d.examId==='water-azhar-2026'?20:null):entry.type==='unit'?30:(d.total??d.maxScore??null);
 if(!verified(entry)&&entry.type==='special')return 'بانتظار اعتماد الإدارة';
 if(n===null)return 'بانتظار اعتماد النتيجة';
 return `${n} ${total!==null?'من '+total:''}${verified(entry)?' — معتمدة':' — مبدئية غير معتمدة'}`;
}
function asText(x){if(x===null||x===undefined||x==='')return 'لم يُجب';if(typeof x==='string'){
 try{const v=JSON.parse(x);if(typeof v==='object')return JSON.stringify(v,null,2);}catch(_){}
 return x;}
 return typeof x==='object'?JSON.stringify(x,null,2):String(x);
}
function details(entry){const d=entry.data,qbank=banks[entry.type]?.get(d.examId)?.questions;
 const answers=d.answers;let out=[];
 if(Array.isArray(answers)){
  out=answers.map((v,i)=>{
   const q=qbank?.[i];const answered=q?.type==='tf'&&typeof v==='boolean'?(v?'صح':'خطأ'):((q?.type==='mcq'||q?.type==='tf')&&v!==null&&v!==undefined&&String(v)!==''&&Number.isInteger(Number(v))?q.options?.[Number(v)]??asText(v):asText(v));
   const score=Array.isArray(d.gradeDetails)?d.gradeDetails[i]:null;
   const reference=q?.answer!==undefined&&q.type==='tf'&&typeof q.answer==='boolean'?(q.answer?'صح':'خطأ'):(q?.answer!==undefined&&(q.type==='mcq'||q.type==='tf')?q.options?.[q.answer]:'مراجعة الإدارة');
   return {heading:`س${i+1} — ${q?.text||q?.question||'إجابة السؤال'}`,answer:answered,reference:qbank?reference:null,score};
  });
 }else if(typeof answers==='string'){
  try{const parsed=JSON.parse(answers);if(Array.isArray(parsed))out=parsed.map((v,i)=>({heading:`س${i+1}`,answer:asText(v)}));else if(parsed&&typeof parsed==='object')out=Object.entries(parsed).map(([k,v])=>({heading:k,answer:asText(v)}));}
  catch(_){out=[{heading:'الإجابات',answer:answers}];}
 }else if(answers&&typeof answers==='object')out=Object.entries(answers).map(([k,v])=>({heading:k,answer:asText(v)}));
 if(!out.length)out=[{heading:'الإجابات',answer:'لم تُحفظ تفاصيل الإجابات في هذا النوع من الامتحانات.'}];
 return out;
}
function reportHTML(e){const d=e.data,qs=details(e),name=d.studentName||links.find(a=>a.studentUid===d.studentUid)?.studentName||'طالب';
 const rows=qs.map(q=>`<section class="q"><b>${esc(q.heading)}</b><div>إجابة الطالب: ${esc(q.answer)}</div>${q.reference!==null&&q.reference!==undefined?`<div>الإجابة المرجعية: ${esc(q.reference)}</div>`:''}${q.score!==null&&q.score!==undefined?`<div>درجة السؤال: ${esc(q.score)}</div>`:''}</section>`).join('');
 return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير إجابات ${esc(name)}</title><style>body{font:15px/1.9 Tahoma,Arial,sans-serif;max-width:900px;margin:25px auto;padding:0 18px;color:#1d2e42}header{border-bottom:3px solid #bd903c;display:flex;align-items:center;gap:14px;padding-bottom:12px}img{width:65px;height:65px;object-fit:contain}.q{border:1px solid #c6d1de;padding:12px;margin:9px 0;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid}button{margin:14px 0;padding:9px 15px}footer{margin-top:25px;color:#475569}@media print{button{display:none}}</style></head><body><header><img src="${new URL('../../images/logo.png',import.meta.url).href}" alt="شعار زاد المعرفة"><div><h2>منصة زاد المعرفة التعليمية</h2><p>تقرير إجابات الطالب — عرض للمعلم فقط</p></div></header><h3>${esc(title(d,e))}</h3><p>الطالب: <strong>${esc(name)}</strong> · تاريخ التسليم: ${esc(date(d.createdAt))}</p><p>الدرجة: <strong>${esc(grade(e))}</strong></p><button onclick="window.print()">🖨️ طباعة التقرير</button>${rows}<footer>تنبيه: النتائج المبدئية ليست درجات معتمدة حتى مراجعة الإدارة.</footer></body></html>`;
}
function printReport(e){const popup=window.open('','_blank');if(!popup){alert('اسمح بفتح نافذة جديدة لطباعة التقرير.');return;}popup.document.open();popup.document.write(reportHTML(e));popup.document.close();}
function render(){const selected=$('teacherExamStudentFilter').value,which=$('teacherExamTypeFilter').value,search=txt($('teacherExamSearch').value).toLocaleLowerCase();
 const items=results.filter(r=>(!selected||r.data.studentUid===selected)&&(!which||r.type===which)&&(!search||[r.data.studentName,title(r.data,r)].some(x=>txt(x).toLocaleLowerCase().includes(search))));
 const list=$('teacherExamResultsList');list.replaceChildren();
 if(!items.length){list.innerHTML='<div class="teacher-empty">لا توجد نتائج مطابقة للبحث أو لم يتم تسليم امتحانات حتى الآن.</div>';return;}
 for(const r of items){const d=r.data,verifiedResult=verified(r);const item=document.createElement('article');item.className='teacher-exam-item';
  const box=document.createElement('div');box.className='teacher-exam-top';
  box.innerHTML=`<div><h4>${esc(title(d,r))}</h4><p>👤 ${esc(d.studentName||links.find(x=>x.studentUid===d.studentUid)?.studentName||'طالب')} • ${esc(r.label)}</p><p>📅 ${esc(date(d.createdAt))}</p><p>📊 <strong>${esc(grade(r))}</strong></p></div><span class="teacher-exam-status${verifiedResult?' verified':''}">${verifiedResult?'✅ معتمدة':'⏳ مبدئية / قيد المراجعة'}</span>`;
  const buttons=document.createElement('div');buttons.className='teacher-exam-actions';const expand=document.createElement('button');expand.type='button';expand.className='btn';expand.textContent='👁️ عرض الإجابات';const print=document.createElement('button');print.type='button';print.className='btn gold';print.textContent='🖨️ طباعة التقرير';const content=document.createElement('div');content.className='teacher-exam-detail';content.hidden=true;
  expand.onclick=()=>{content.hidden=!content.hidden;if(!content.hidden){content.replaceChildren();for(const row of details(r)){const div=document.createElement('div');div.className='teacher-exam-q';div.innerHTML=`<strong>${esc(row.heading)}</strong><div>إجابة الطالب: ${esc(row.answer)}</div>${row.reference!==null&&row.reference!==undefined?`<div>الإجابة المرجعية: ${esc(row.reference)}</div>`:''}${row.score!==null&&row.score!==undefined?`<div>الدرجة: ${esc(row.score)}</div>`:''}`;content.append(div)}expand.textContent='إخفاء الإجابات';}else expand.textContent='👁️ عرض الإجابات';};
  print.onclick=()=>printReport(r);buttons.append(expand,print);item.append(box,buttons,content);list.append(item);
 }
}
async function loadBank(){if(bankLoaded)return;const sources=[['special','../../exams/zad-special/bank.json'],['unit','../../exams/unit1/bank.json']];
 await Promise.all(sources.map(async([key,url])=>{try{const data=await fetch(url).then(r=>{if(!r.ok)throw Error(r.status);return r.json()});banks[key]=new Map((data.exams||[]).map(x=>[x.id,x]));}catch(err){console.warn('Exam bank unavailable:',key,err);}}));bankLoaded=true;
}
async function load(){if(loading)return;const user=auth.currentUser;if(!user){say('يجب تسجيل الدخول أولًا.');return;}
 loading=true;$('teacherExamLoad').disabled=true;results=[];links=[];try{
 const preview=await getPreviewContext(user,'teacher');if(preview.denied)throw Error('لا تملك صلاحية معاينة بيانات معلم آخر');effectiveUid=preview.active?preview.uid:user.uid;
 say('جارٍ قراءة سجل طلابك المصرح لهم...');
 const index=await getDoc(doc(db,'teacherExamStudentIndex',effectiveUid));
 links=index.exists()&&index.data().teacherUid===effectiveUid?(index.data().studentUids||[]).map(studentUid=>({studentUid})):[];
 if(!links.length){say('لا توجد ارتباطات معتمدة لنتائج الطلاب. اطلب من الإدارة الضغط على «مزامنة صلاحيات نتائج طلاب المعلمين» بعد ربط الحجوزات والحضور بأرقام UID.');render();return;}
 await loadBank();const uids=[...new Set(links.map(x=>x.studentUid))];
 const errors=[],truncated=[];
 for(const t of types){for(let n=0;n<uids.length;n+=10){const ids=uids.slice(n,n+10);
  try{const snap=await getDocs(query(collection(db,t.collection),where('studentUid','in',ids),limit(250)));
   if(snap.size===250)truncated.push(t.label);
   for(const item of snap.docs){const data=item.data();if(ids.includes(data.studentUid))results.push({id:item.id,data,type:t.type,label:t.label});}
  }catch(err){errors.push(`${t.label}: ${err.code||err.message}`);}
 }}
 results.sort((a,b)=>(b.data.createdAt?.seconds||0)-(a.data.createdAt?.seconds||0));
 $('teacherExamSummary').hidden=false;$('teacherExamCount').textContent=results.length;$('teacherExamStudentCount').textContent=new Set(results.map(e=>e.data.studentUid)).size;$('teacherExamVerifiedCount').textContent=results.filter(verified).length;
 const select=$('teacherExamStudentFilter');select.replaceChildren(new Option('كل طلابي',''));
 const used=new Set();
 for(const x of links.sort((a,b)=>String(a.studentUid).localeCompare(String(b.studentUid)))){
  if(used.has(x.studentUid))continue;used.add(x.studentUid);
  const name=results.find(e=>e.data.studentUid===x.studentUid)?.data.studentName||x.studentUid;
  select.add(new Option(name,x.studentUid));
 }
 render();
 say(`${results.length} نتيجة تخص ${new Set(results.map(e=>e.data.studentUid)).size} طالبًا من الطلاب المرتبطين بك.`+(errors.length?' ⚠️ فشلت بعض المصادر: '+errors.join(' | '):'')+(truncated.length?' ⚠️ بعض المصادر تجاوزت 250 نتيجة لكل دفعة؛ يلزم تقسيم الاستعلام للوصول للأقدم.':''));
 }catch(err){console.error('Teacher exams',err);say('تعذّر عرض النتائج: '+(err.code||err.message));$('teacherExamResultsList').innerHTML='<div class="teacher-empty">تعذّر تحميل البيانات. تحقق من صلاحيات Firebase وارتباط الطلاب بمعرّف المعلم.</div>';}
 finally{loading=false;$('teacherExamLoad').disabled=false;}
}
$('teacherExamLoad')?.addEventListener('click',load);
for(const id of ['teacherExamStudentFilter','teacherExamTypeFilter','teacherExamSearch'])$(id)?.addEventListener('input',render);
