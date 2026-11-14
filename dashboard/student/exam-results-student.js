import { codeExamProgress } from '../admin/exam-result-verification.js';
import {getPreviewContext} from '../admin-preview-core.js';
import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,query,where,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const box=document.getElementById('zad-student-exam-results');const stats=document.getElementById('zad-results-stats');
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const safeNumber=v=>Number.isFinite(Number(v))?Number(v):0;
function printReport(x){
  const w=window.open('','_blank');
  if(!w){alert('اسمح بالنوافذ المنبثقة لطباعة تقرير الإجابات');return;}
  const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const name=esc(x.studentName||'طالب زاد المعرفة'),exam=esc(x.examTitle||'امتحان إلكتروني');
  const grade=codeExamProgress(x);
  const number=grade.score===null?'—':grade.score+' من '+grade.total+' ('+grade.percent+'%)';
  const status=grade.pendingEssay?'⏳ في انتظار نتيجة الأسئلة المقالية':grade.label;
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير إجابات امتحان | زاد المعرفة</title><style>@page{size:A4;margin:16mm}body{font-family:Tahoma,Arial,sans-serif;color:#192640;text-align:center;padding:15px}article{max-width:790px;margin:auto;border:3px solid #bb963d;padding:28px;box-sizing:border-box}h1{font-size:28px;color:#9f7926}pre{text-align:right;white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f6f9;padding:18px;font:14px/2 Tahoma,Arial}.foot{font-size:12px;color:#666;margin-top:32px}</style></head><body><article><h1>تقرير نتيجة الامتحان</h1><p>الطالب: <strong>${name}</strong></p><h3>${exam}</h3><p><strong>${esc(number)}</strong> — ${esc(status)}</p><h3>الإجابات المحفوظة</h3><pre>${esc(x.answers||'لم يوفر كود الامتحان إجابات تفصيلية.')}</pre><div class="foot">درجة الموضوعي تظهر تلقائيًا؛ المقالي ينتظر مراجعة الإدارة. نتائج HTML المرسلة من المتصفح ليست تصحيحًا موثقًا من الخادم.</div></article></body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),400);
}
function renderStats(items){
  stats.replaceChildren();
  const done=items.map(codeExamProgress).filter(g=>!g.pendingEssay && g.percent!==null);
  const values=[['الامتحانات المسلّمة',items.length],['أعلى نتيجة مكتملة',done.length?Math.max(...done.map(g=>g.percent))+'%':'—'],['بانتظار تصحيح المقالي',items.filter(x=>codeExamProgress(x).pendingEssay).length]];
  values.forEach(([lab,val])=>{const el=node('div','zad-stat');el.append(node('span','',lab),node('strong','',String(val)));stats.append(el);});
}
function render(items){
  box.replaceChildren();renderStats(items);
  window.dispatchEvent(new CustomEvent('zad:stage4-exam-data',{detail:{
    items:items.map(x=>{const g=codeExamProgress(x);return {pendingEssay:g.pendingEssay,
      percent:g.percent,complete:!g.pendingEssay && g.percent!==null,
      score:g.score,total:g.total};})
  }}));
  if(!items.length){box.append(node('div','zad-results-empty','📚 لم تُسجّل أي نتائج بعد. بعد الانتهاء من أول امتحان، ستظهر نتيجتك هنا.'));return;}
  items.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).forEach(x=>{
    const row=node('article','zad-exam-result-row'),top=node('div','zad-result-top');
    const date=x.createdAt?.toDate?x.createdAt.toDate().toLocaleDateString('ar-EG'):'نتيجة محفوظة';
    const g=codeExamProgress(x);
    top.append(node('span','zad-result-date',date),node('span','zad-result-badge'+(g.approved?' excellent':''),g.label));
    row.append(top,node('h4','',x.examTitle||'امتحان إلكتروني'));
    const score=node('div','zad-score-box'),right=node('div');
    right.append(node('small','',g.pendingEssay?'درجة الأسئلة الموضوعية (فقط)':'درجتك'));
    right.append(node('strong','',g.score===null?'—':g.score+' / '+g.total));
    score.append(right,node('strong','',g.percent===null?'—':g.percent+'%'));row.append(score);
    if(g.percent!==null){const bar=node('div','zad-score-track'),fill=node('span');fill.style.width=Math.min(100,Math.max(0,g.percent))+'%';bar.append(fill);row.append(bar);}
    if(g.pendingEssay)row.append(node('p','zad-student-pending-essay','⏳ في انتظار نتيجة الأسئلة المقالية — الدرجة النهائية ستظهر تلقائيًا بعد تصحيح الإدارة للمقالي.'));
    else if(g.source==='client-reported' && !g.approved)row.append(node('p','zad-result-disclaimer','النتيجة آلية من كود الامتحان، وليست درجة تحقّق منها الخادم.'));
    const actions=node('div','zad-result-actions'),print=node('button','','🖨️ طباعة إجاباتي');print.type='button';print.onclick=()=>printReport(x);actions.append(print);row.append(actions);box.append(row);
  });
}

onAuthStateChanged(auth,async user=>{if(!user){stats.replaceChildren();box.replaceChildren(node('div','zad-results-empty','سجّل دخولك لعرض نتائج امتحاناتك.'));return;}onSnapshot(query(collection(db,'codeExamResults'),where('studentUid','==',(await getPreviewContext(user,'student')).uid)),snap=>render(snap.docs.map(d=>d.data())),e=>{box.replaceChildren(node('div','zad-results-empty','تعذر عرض النتائج: '+e.message));});});
