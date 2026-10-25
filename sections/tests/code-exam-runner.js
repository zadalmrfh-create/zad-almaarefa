import {auth,db} from '../../firebase-config.js';
import {examAuthReady} from './exam-auth-gate.js';
import {doc,getDoc,getDocs,collection,query,orderBy,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
let exam=null,user=await examAuthReady,receipt=null,handled=false;
function printAnswersReport(){
  if(!receipt)return;
  const r=receipt, w=window.open('','_blank');
  if(!w){alert('اسمح بالنوافذ المنبثقة لطباعة التقرير.');return;}
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  w.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تقرير إجابات امتحان - زاد المعرفة</title><style>@page{size:A4;margin:15mm}body{font-family:Tahoma,Arial;text-align:center;padding:35px;color:#17233b}article{border:3px solid #bb993b;padding:25px}pre{text-align:right;white-space:pre-wrap;overflow-wrap:anywhere}</style><article><h1>تقرير نتيجة الامتحان والإجابات</h1><h2>منصة زاد المعرفة</h2><p>الطالب: '+esc(r.studentName)+'</p><p>الامتحان: '+esc(r.examTitle)+'</p><p>النتيجة الآلية: '+r.score+' من '+r.total+' ('+r.percent+'%)</p><h3>الإجابات المسجلة</h3><pre>'+esc(r.answers||'لا توجد إجابات تفصيلية مسجلة.')+'</pre><small>النتيجة غير معتمدة، والشهادات تصدر من إدارة المنصة فقط.</small></article></html>');
  w.document.close();w.focus();setTimeout(()=>w.print(),400);
}
$('printAnswers').onclick=printAnswersReport;
const makeBridge=(html)=>{const s=String(html||''),tag='__BRIDGE__';return /<\/body\s*>/i.test(s)?s.replace(/<\/body\s*>/i,tag+'</body>'):s+tag};
if(!user){$('status').textContent='سجّل دخولك لبدء الامتحان.';}else if(!id||id.length>150){$('status').textContent='رابط الامتحان غير صحيح.'}else try{
 const s=await getDoc(doc(db,'codeExams',id));if(!s.exists()||!s.data().published)throw Error('الامتحان غير متاح حاليًا');exam=s.data();document.title=exam.title+' | زاد المعرفة';$('title').textContent=exam.title;$('details').textContent=[exam.grade,exam.subject].filter(Boolean).join(' • ');
 let html=exam.code||'';if(exam.chunkCount){const parts=await getDocs(query(collection(db,'codeExams',id,'chunks'),orderBy('index')));if(parts.size!==exam.chunkCount)throw Error('لم تكتمل أجزاء الامتحان');html=parts.docs.map(x=>x.data().content).join('')}
 const bridge=await fetch('code-exam-bridge.js').then(r=>{if(!r.ok)throw Error('تعذر تحميل ربط النتائج');return r.text()});$('examFrame').srcdoc=makeBridge(html).replace('__BRIDGE__',bridge);$('examFrame').hidden=false;$('status').textContent='';
}catch(e){$('status').textContent='تعذر فتح الامتحان: '+e.message}
window.addEventListener('message',async event=>{if(event.source!==$('examFrame').contentWindow||event.data?.source!=='zad-code-exam'||event.data?.type!=='finish'||handled||!exam)return;const score=Number(event.data.score),total=Number(event.data.total);if(!Number.isInteger(score)||!Number.isInteger(total)||total<1||score<0||score>total)return;handled=true;const percent=Math.round(score/total*100);receipt={examId:id,examTitle:exam.title,studentUid:user?.uid||'',studentName:user?.displayName||user?.email||'طالب زاد المعرفة',score,total,percent,answers:String(event.data.answers||'').slice(0,12000),excellent:percent>=85,source:'client-reported',verified:false};$('resultPanel').hidden=false;$('resultInfo').textContent=`${receipt.studentName}: ${score} من ${total} (${percent}%) — ${percent>=85?'ممتاز 🏅':'تم التصحيح'}`;
 if(!user){$('saveStatus').textContent='انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول من جديد.';return}
 try{const key=crypto.randomUUID();await setDoc(doc(db,'codeExamResults',key),{...receipt,createdAt:serverTimestamp()});$('saveStatus').textContent=percent>=85?'تم حفظ نتيجة الامتحان في لوحة الطالب. إصدار الشهادات خاص بالإدارة فقط.':'تم حفظ النتيجة في لوحة الطالب.';}catch(e){$('saveStatus').textContent='تعذر حفظ النتيجة في Firebase: '+e.message+' — يمكنك طباعة نتيجتك الآن.'}
});
