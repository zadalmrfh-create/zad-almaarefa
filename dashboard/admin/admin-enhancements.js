import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateValue = v => v?.toDate ? v.toDate() : (v ? new Date(v) : null);
const dateText = v => { const d=dateValue(v); return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('ar-EG') : '-'; };

let users = [];
let subscriptions = [];
let bookings = [];
let attempts = [];

function stat(id, value){ const el=$(id); if(el) el.textContent=String(value); }
function renderStats(){
  stat('enhTotalUsers', users.length);
  stat('enhStudents', users.filter(x=>x.role==='student').length);
  stat('enhTeachers', users.filter(x=>x.role==='teacher').length);
  stat('enhPendingTeachers', users.filter(x=>x.role==='teacher' && x.status==='pending').length);
  stat('enhActiveSubs', users.filter(x=>x.subscriptionStatus==='active' && dateValue(x.subscriptionEnd)?.getTime()>Date.now()).length);
  stat('enhPendingSubs', subscriptions.filter(x=>x.status==='pending').length);
  stat('enhBookings', bookings.length);
  stat('enhQuizAttempts', attempts.length);
  const today = new Date(); today.setHours(0,0,0,0);
  stat('enhNewToday', users.filter(x=>{const d=dateValue(x.createdAt);return d && d>=today;}).length);
}

function applyFilters(){
  const q=($('enhUserSearch')?.value||'').trim().toLowerCase();
  const role=$('enhRoleFilter')?.value||'all';
  const status=$('enhStatusFilter')?.value||'all';
  const country=($('enhCountryFilter')?.value||'all');
  const rows=users.filter(u=>{
    const hay=[u.fullName,u.name,u.displayName,u.email,u.phone,u.country,u.city,u.grade,u.subject].join(' ').toLowerCase();
    return (!q||hay.includes(q)) && (role==='all'||u.role===role) && (status==='all'||u.status===status) && (country==='all'||(u.country||'')===country);
  }).sort((a,b)=>(dateValue(b.createdAt)?.getTime()||0)-(dateValue(a.createdAt)?.getTime()||0));
  const tbody=$('enhUsersRows');
  if(!tbody) return;
  tbody.innerHTML=rows.length?rows.map(u=>`<tr><td>${esc(u.fullName||u.name||'-')}</td><td>${esc(u.email||'-')}</td><td>${esc(u.country||'-')}</td><td>${esc(u.city||'-')}</td><td>${u.role==='teacher'?'معلم':'طالب'}</td><td>${esc(u.status||'active')}</td><td>${dateText(u.createdAt)}</td></tr>`).join(''):'<tr><td colspan="7">لا توجد نتائج.</td></tr>';
}

function exportCSV(){
  const header=['الاسم','البريد','الهاتف','البلد','المدينة','النوع','الحالة','الصف/المادة','تاريخ التسجيل'];
  const lines=[header,...users.map(u=>[u.fullName||u.name||'',u.email||'',u.phone||'',u.country||'',u.city||'',u.role==='teacher'?'معلم':'طالب',u.status||'',u.role==='teacher'?(u.subject||u.grade||''):(u.grade||u.studyGrade||''),dateText(u.createdAt)])];
  const csv='\ufeff'+lines.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`zad-users-${new Date().toISOString().slice(0,10)}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

async function load(){
  try{
    const [us,subs,book,att]=await Promise.all([
      getDocs(collection(db,'users')),
      getDocs(query(collection(db,'subscriptionRequests'),orderBy('createdAt','desc'),limit(500))),
      getDocs(query(collection(db,'bookings'),orderBy('createdAt','desc'),limit(500))),
      getDocs(query(collection(db,'quizAttempts'),orderBy('submittedAt','desc'),limit(1000)))
    ]);
    users=us.docs.map(d=>d.data()); subscriptions=subs.docs.map(d=>d.data()); bookings=book.docs.map(d=>d.data()); attempts=att.docs.map(d=>d.data());
    const countries=[...new Set(users.map(x=>x.country).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const select=$('enhCountryFilter'); if(select){ select.innerHTML='<option value="all">كل البلدان</option>'+countries.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join(''); }
    renderStats(); applyFilters();
  }catch(e){ console.error('Admin enhancements:',e); const el=$('enhDataStatus'); if(el) el.textContent='تعذر تحميل بعض الإحصائيات. تأكد من قواعد Firestore.'; }
}

onAuthStateChanged(auth, async user=>{ if(!user) return; await load(); });
$('enhUserSearch')?.addEventListener('input',applyFilters);
$('enhRoleFilter')?.addEventListener('change',applyFilters);
$('enhStatusFilter')?.addEventListener('change',applyFilters);
$('enhCountryFilter')?.addEventListener('change',applyFilters);
$('enhExportUsers')?.addEventListener('click',exportCSV);
$('enhRefreshData')?.addEventListener('click',load);
