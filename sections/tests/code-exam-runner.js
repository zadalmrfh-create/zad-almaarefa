import {auth,db} from '../../firebase-config.js';
import {examAuthReady} from './exam-auth-gate.js';
import {printCodeExamAnswers} from '../../dashboard/admin/exam-answer-report.js';
import {doc,getDoc,getDocs,collection,query,orderBy,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
const withTimeout=(p,ms,message)=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))]);
let exam=null,user=null,receipt=null,handled=false;
try{user=await withTimeout(examAuthReady,15000,'انتهت مهلة تسجيل الدخول؛ أعد فتح الصفحة.')}catch(e){$('status').textContent=e.message;$('title').textContent='تعذر تحميل الامتحان'}
function printAnswersReport(){ if(receipt)printCodeExamAnswers(receipt); }
$('printAnswers').onclick=printAnswersReport;
const makeBridge=(html)=>{const s=String(html||''),tag='__BRIDGE__';return /<\/body\s*>/i.test(s)?s.replace(/<\/body\s*>/i,tag+'</body>'):s+tag};
if(!user){$('status').textContent='سجّل دخولك لبدء الامتحان.';}else if(!id||id.length>150){$('status').textContent='رابط الامتحان غير صحيح.'}else try{
 const s=await withTimeout(getDoc(doc(db,'codeExams',id)),15000,'انتهت مهلة قراءة الامتحان من Firebase');if(!s.exists()||!s.data().published)throw Error('الامتحان غير متاح حاليًا');exam=s.data();document.title=exam.title+' | زاد المعرفة';$('title').textContent=exam.title;$('details').textContent=[exam.grade,exam.subject].filter(Boolean).join(' • ');
 let html=exam.code||'';if(exam.chunkCount){const parts=await withTimeout(getDocs(query(collection(db,'codeExams',id,'chunks'),orderBy('index'))),15000,'انتهت مهلة تحميل أسئلة الامتحان');if(parts.size!==exam.chunkCount)throw Error('لم تكتمل أجزاء الامتحان');html=parts.docs.map(x=>x.data().content).join('')}
 const bridge=await fetch('code-exam-bridge.js').then(r=>{if(!r.ok)throw Error('تعذر تحميل ربط النتائج');return r.text()});$('examFrame').srcdoc=makeBridge(html).replace('__BRIDGE__',bridge);$('examFrame').hidden=false;$('status').textContent='';
}catch(e){$('status').textContent='تعذر فتح الامتحان: '+e.message}
window.addEventListener('message',async event=>{if(event.source!==$('examFrame').contentWindow||event.data?.source!=='zad-code-exam'||event.data?.type!=='finish'||handled||!exam)return;const score=Number(event.data.score),total=Number(event.data.total);if(!Number.isInteger(score)||!Number.isInteger(total)||total<1||score<0||score>total)return;handled=true;const percent=Math.round(score/total*100);receipt={examId:id,examTitle:exam.title,studentUid:user?.uid||'',studentName:user?.displayName||user?.email||'طالب زاد المعرفة',score,total,percent,answers:String(event.data.answers||'').slice(0,12000),excellent:percent>=85,source:'client-reported',verified:false};$('resultPanel').hidden=false;
 const mode=event.data.method==='key-comparison'?'تصحيح تلقائي للأسئلة الموضوعية': 'نتيجة حسبها كود الامتحان تلقائيًا';
 $('resultInfo').textContent=`${receipt.studentName}: ${score} من ${total} (${percent}%) — ${mode}${percent>=85?' 🏅':''}`;
 if(!user){$('saveStatus').textContent='انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول من جديد.';return}
 try{const key=crypto.randomUUID();await setDoc(doc(db,'codeExamResults',key),{...receipt,createdAt:serverTimestamp()});$('saveStatus').textContent=percent>=85?'تم حفظ نتيجة الامتحان في لوحة الطالب. إصدار الشهادات خاص بالإدارة فقط.':'تم حفظ النتيجة في لوحة الطالب.';}catch(e){$('saveStatus').textContent='تعذر حفظ النتيجة في Firebase: '+e.message+' — يمكنك طباعة نتيجتك الآن.'}
});
