import {auth,db} from '../../firebase-config.js';
import {examAuthReady} from './exam-auth-gate.js';
import {printCodeExamAnswers} from '../../dashboard/admin/exam-answer-report.js';
import {doc,getDoc,getDocs,collection,query,orderBy,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
const withTimeout=(p,ms,message)=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))]);
let exam=null,user=null,receipt=null,handled=false;
let submissionId=null,submitted=false;
async function studentName(){
  if(!user)return 'طالب زاد المعرفة';
  try{
    const snap=await withTimeout(getDoc(doc(db,'users',user.uid)),6000,'انتهت مهلة جلب اسم الطالب');
    if(snap.exists()){
      const p=snap.data();
      const name=[p.name,p.fullName,p.displayName].find(v=>typeof v==='string'&&v.trim());
      if(name)return name.trim().slice(0,200);
    }
  }catch(e){console.info('تعذر قراءة اسم الطالب، سيتم استخدام اسم الحساب.',e.code||e.message)}
  return user.displayName||user.email||'طالب زاد المعرفة';
}
async function saveExamResult(){
  if(!receipt||!user||submitted)return;
  if(!submissionId)submissionId=crypto.randomUUID();
  const status=$('saveStatus');
  let retry=document.getElementById('zadRetryCodeResult');
  if(!retry){retry=document.createElement('button');retry.type='button';retry.id='zadRetryCodeResult';retry.textContent='🔄 إعادة محاولة حفظ النتيجة';retry.onclick=saveExamResult;status.insertAdjacentElement('afterend',retry)}
  retry.hidden=true;status.textContent='جارٍ حفظ النتيجة في Firebase...';
  const target=doc(db,'codeExamResults',submissionId);
  try{
    await setDoc(target,{...receipt,createdAt:serverTimestamp()});
    submitted=true;
  }catch(error){
    // A successful first write can occasionally lose its acknowledgement: do not create a duplicate.
    try{const saved=await getDoc(target);if(saved.exists()&&saved.data().studentUid===user.uid)submitted=true;}catch{}
    if(!submitted){status.textContent='تعذر حفظ النتيجة في Firebase: '+(error.code||error.message)+' — اضغط إعادة المحاولة حتى تظهر رسالة نجاح الحفظ.';retry.hidden=false;return}
  }
  retry.hidden=true;
  status.textContent='✅ تم تسجيل نتيجة الامتحان في لوحة الطالب ولوحة الإدارة تلقائيًا. النتيجة مبدئية وتحتاج مراجعة الإدارة.';
}
try{user=await withTimeout(examAuthReady,15000,'انتهت مهلة تسجيل الدخول؛ أعد فتح الصفحة.')}catch(e){$('status').textContent=e.message;$('title').textContent='تعذر تحميل الامتحان'}
function printAnswersReport(){ if(receipt)printCodeExamAnswers(receipt); }
$('printAnswers').onclick=printAnswersReport;
const makeBridge=(html)=>{const s=String(html||''),tag='__BRIDGE__';return /<\/body\s*>/i.test(s)?s.replace(/<\/body\s*>/i,tag+'</body>'):s+tag};
if(!user){$('status').textContent='سجّل دخولك لبدء الامتحان.';}else if(!id||id.length>150){$('status').textContent='رابط الامتحان غير صحيح.'}else try{
 const s=await withTimeout(getDoc(doc(db,'codeExams',id)),15000,'انتهت مهلة قراءة الامتحان من Firebase');if(!s.exists()||!s.data().published)throw Error('الامتحان غير متاح حاليًا');exam=s.data();document.title=exam.title+' | زاد المعرفة';$('title').textContent=exam.title;$('details').textContent=[exam.grade,exam.subject].filter(Boolean).join(' • ');
 let html=exam.code||'';if(exam.chunkCount){const parts=await withTimeout(getDocs(query(collection(db,'codeExams',id,'chunks'),orderBy('index'))),15000,'انتهت مهلة تحميل أسئلة الامتحان');if(parts.size!==exam.chunkCount)throw Error('لم تكتمل أجزاء الامتحان');html=parts.docs.map(x=>x.data().content).join('')}
 const bridge=await fetch('code-exam-bridge.js').then(r=>{if(!r.ok)throw Error('تعذر تحميل ربط النتائج');return r.text()});$('examFrame').srcdoc=makeBridge(html).replace('__BRIDGE__',bridge);$('examFrame').hidden=false;$('status').textContent='';
}catch(e){$('status').textContent='تعذر فتح الامتحان: '+e.message}
window.addEventListener('message',async event=>{if(event.source!==$('examFrame').contentWindow||event.data?.source!=='zad-code-exam'||event.data?.type!=='finish'||handled||!exam)return;const score=Number(event.data.score),total=Number(event.data.total);if(!Number.isInteger(score)||!Number.isInteger(total)||total<1||score<0||score>total)return;handled=true;const percent=Math.round(score/total*100);const resolvedName=await studentName();receipt={examId:id,examTitle:exam.title,studentUid:user?.uid||'',studentName:resolvedName,score,total,percent,answers:String(event.data.answers||'').slice(0,12000),excellent:percent>=85,source:'client-reported',verified:false};$('resultPanel').hidden=false;
 const mode=event.data.method==='key-comparison'?'تصحيح تلقائي للأسئلة الموضوعية': 'نتيجة حسبها كود الامتحان تلقائيًا';
 $('resultInfo').textContent=`${receipt.studentName}: ${score} من ${total} (${percent}%) — ${mode}${percent>=85?' 🏅':''}`;
 if(!user){$('saveStatus').textContent='انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول من جديد.';return}
 await saveExamResult();
});
