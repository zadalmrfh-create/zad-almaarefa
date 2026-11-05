import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {TEACHER_QUESTIONS,scoreAverage,htmlEscape} from '../../reviews/weekly-shared.js';
const $=id=>document.getElementById(id);
let all=[],loaded=false;
function printRows(items){
 const qs=TEACHER_QUESTIONS.map((x,i)=>`<th>${htmlEscape(x)}</th>`).join('');
 const rows=items.map(r=>`<tr>${r.scores.map(v=>`<td>${v}</td>`).join('')}<td>${scoreAverage(r.scores).toFixed(2)}</td><td>${htmlEscape(r.comment||'—')}</td></tr>`).join('');
 const media=`<html lang="ar" dir="rtl"><meta charset="utf-8"><title>تقرير تقييمات المعلم</title><style>body{font-family:Tahoma,Arial,sans-serif;color:#132541;margin:25px}h1{text-align:center;color:#173b62}img{height:70px;display:block;margin:auto}table{border-collapse:collapse;width:100%;margin-top:22px;font-size:12px}td,th{border:1px solid #a0aabd;padding:9px;vertical-align:top}th{background:#142946;color:white}@page{size:A4 landscape;margin:12mm}</style><img src="../../images/logo.png"><h1>أكاديمية زاد المعرفة — تقييمات المعلم (دون أسماء)</h1><p>عدد التقييمات: ${items.length} | المتوسط: ${items.length?(items.reduce((s,r)=>s+scoreAverage(r.scores),0)/items.length).toFixed(2):'—'} من 5</p><table><thead><tr>${qs}<th>المتوسط</th><th>ملاحظة الطالب</th></tr></thead><tbody>${rows}</tbody></table></html>`;
 const frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px';document.body.append(frame);
 frame.onload=()=>{try{frame.contentWindow.focus();frame.contentWindow.print()}catch(e){alert('تعذر فتح الطباعة: '+e.message)}setTimeout(()=>frame.remove(),2500)};
 frame.contentDocument.open();frame.contentDocument.write(media);frame.contentDocument.close();
}
function show(){if(!loaded)return;const week=$('teacherWeeklyWeek').value,items=all.filter(x=>!week||x.weekStart===week),stats=$('teacherWeeklyStats'),body=$('teacherWeeklyBody');
 const overall=items.length?items.reduce((a,b)=>a+scoreAverage(b.scores),0)/items.length:0;
 stats.textContent=`إجمالي التقييمات: ${items.length} — المتوسط العام: ${items.length?overall.toFixed(2)+' / 5':'لا يوجد'} — الملاحظات لا تحتوي على أسماء الطلاب.`;
 body.innerHTML=items.length?items.map(r=>`<div class="zwr-item"><strong>الأسبوع: ${htmlEscape(r.weekStart)}</strong><div class="zwr-grid">${TEACHER_QUESTIONS.map((q,i)=>`<div><small>${htmlEscape(q)}</small><b>${r.scores[i]} / 5</b></div>`).join('')}</div><p class="zwr-comment">💬 ${htmlEscape(r.comment||'لم يكتب الطالب ملاحظة.')}</p></div>`).join(''):'<p>لم تصل تقييمات لهذه الفترة بعد.</p>';
 $('teacherWeeklyPrint').onclick=()=>printRows(items);
 $('teacherWeeklyCSV').onclick=()=>{
  const rows=[['الأسبوع',...TEACHER_QUESTIONS,'المتوسط','ملاحظات دون أسماء']];
  items.forEach(r=>rows.push([r.weekStart,...r.scores,scoreAverage(r.scores).toFixed(2),r.comment||'']));
  const csv='\ufeff'+rows.map(row=>row.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
  const blob=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=blob;link.download='zad-teacher-reviews.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(blob),60000);
 };
}
onAuthStateChanged(auth,async user=>{
 if(!user)return;
 try{
  const snap=await getDocs(query(collection(db,'weeklyTeacherFeedback'),where('teacherUid','==',user.uid)));
  all=snap.docs.map(d=>d.data()).sort((a,b)=>b.weekStart.localeCompare(a.weekStart));loaded=true;
  const weeks=[...new Set(all.map(x=>x.weekStart))];$('teacherWeeklyWeek').innerHTML='<option value="">كل الأسابيع</option>'+weeks.map(w=>`<option>${htmlEscape(w)}</option>`).join('');
  show();
 }catch(e){$('teacherWeeklyStats').textContent='تعذر تحميل التقييمات. راجع قواعد Firebase: '+(e.code||e.message)}
});
$('teacherWeeklyWeek')?.addEventListener('change',show);
$('teacherWeeklyRefresh')?.addEventListener('click',()=>location.reload());
