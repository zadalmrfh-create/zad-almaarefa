import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, getDocs, query, orderBy, limit, getCountFromServer } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateValue = v => v?.toDate ? v.toDate() : (v ? new Date(v) : null);
const dateText = v => { const d=dateValue(v); return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('ar-EG') : '-'; };

let users = [];
let bookings = [];
let attemptsCount = null;
let attemptsNotice = '';

function stat(id, value){ const el=$(id); if(el) el.textContent=String(value); }
function renderStats(){
  stat('enhTotalUsers', users.length);
  stat('enhStudents', users.filter(x=>x.role==='student').length);
  stat('enhTeachers', users.filter(x=>x.role==='teacher').length);
  stat('enhPendingTeachers', users.filter(x=>x.role==='teacher' && x.status==='pending').length);
  stat('enhBookings', bookings.length);
  stat('enhQuizAttempts', attemptsCount===null ? '—' : attemptsCount);
  const attemptEl=$('enhQuizAttempts');
  if(attemptEl) attemptEl.title=attemptsNotice || 'إجمالي محاولات الامتحانات المحفوظة في المصادر الثلاثة';
  const today = new Date(); today.setHours(0,0,0,0);
  stat('enhNewToday', users.filter(x=>{const d=dateValue(x.createdAt);return d && d>=today;}).length);
}

function filteredUserList(){
  const q=($('enhUserSearch')?.value||'').trim().toLowerCase();
  const role=$('enhRoleFilter')?.value||'all';
  const status=$('enhStatusFilter')?.value||'all';
  const country=($('enhCountryFilter')?.value||'all');
  return users.filter(u=>{
    const hay=[u.fullName,u.name,u.displayName,u.email,u.phone,u.country,u.city,u.grade,u.studyGrade,u.subject].join(' ').toLowerCase();
    return (!q||window.ZadNameSearch.matches(hay,q)) && (role==='all'||u.role===role) && (status==='all'||(u.status||'active')===status) && (country==='all'||(u.country||'')===country);
  }).sort((a,b)=>(dateValue(b.createdAt)?.getTime()||0)-(dateValue(a.createdAt)?.getTime()||0));
}

function applyFilters(){
  window.applyAdminUserFilters?.();
}

function exportCSV(){
  const header=['الاسم','البريد','الهاتف','البلد','المدينة','النوع','الحالة','الصف/المادة','تاريخ التسجيل'];
  const lines=[header,...filteredUserList().map(u=>[u.fullName||u.name||'',u.email||'',u.phone||'',u.country||'',u.city||'',u.role==='teacher'?'معلم':'طالب',u.status||'active',u.role==='teacher'?(u.subject||u.grade||''):(u.grade||u.studyGrade||''),dateText(u.createdAt)])];
  const csv='\ufeff'+lines.map(row=>row.map(v=>{const raw=String(v??'');const safe=/^[=+@\-\t\r]/.test(raw)?'\''+raw:raw;return '"'+safe.replaceAll('"','""')+'"';}).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`zad-users-${new Date().toISOString().slice(0,10)}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

// Some Firestore projects reject aggregation queries even when a normal collection
// read is allowed. Use a direct read as a fallback; don't convert access errors to 0.
async function countAttempts(path){
  try { return (await getCountFromServer(collection(db,path))).data().count; }
  catch(aggregationError){
    try { return (await getDocs(collection(db,path))).size; }
    catch(readError){
      console.warn('Cannot count exam attempts',path,{aggregationError,readError});
      throw readError;
    }
  }
}

async function load(){
  try{
    const [usResult,bookResult,...examResults]=await Promise.allSettled([
      getDocs(collection(db,'users')),
      getDocs(query(collection(db,'bookings'),orderBy('createdAt','desc'),limit(500))),
      countAttempts('quizAttempts'),
      countAttempts('codeExamResults'),
      countAttempts('unitOneExamAttempts')
    ]);
    if(usResult.status==='fulfilled') users=usResult.value.docs.map(d=>d.data());
    else { users=[]; console.warn('تعذر تحميل المستخدمين',usResult.reason); }
    if(bookResult.status==='fulfilled') bookings=bookResult.value.docs.map(d=>d.data());
    else { bookings=[]; console.warn('تعذر تحميل الحجوزات',bookResult.reason); }
    const examNames=['الاختبارات القصيرة','الامتحانات الإلكترونية','امتحانات الوحدة'];
    const failed=examResults.map((r,i)=>r.status==='rejected'?examNames[i]:null).filter(Boolean);
    const availableCount=examResults.reduce((total,r)=>total+(r.status==='fulfilled'?Number(r.value):0),0);
    attemptsCount=failed.length?null:availableCount;
    attemptsNotice=failed.length?'تم العثور على '+availableCount+' محاولة في المصادر المقروءة، لكن تعذر الوصول إلى '+failed.join('، ')+'؛ الإجمالي غير مكتمل.':'';
    const attemptsLabel=document.getElementById('zadExamAttemptsStatNote');
    if(attemptsLabel){attemptsLabel.textContent=attemptsNotice || 'محاولات الاختبارات القصيرة والامتحانات الإلكترونية وامتحانات الوحدة';attemptsLabel.style.color=failed.length?'#f7bb60':'';}
    for(let i=0;i<examResults.length;i++) if(examResults[i].status==='rejected') console.warn('Exam statistics read failed: '+examNames[i],examResults[i].reason);
    if(usResult.status==='rejected'){ const el=$('enhDataStatus');if(el)el.textContent='تعذر قراءة المستخدمين من Firebase؛ أعد المحاولة بعد التأكد من صلاحيات الأدمن.'; }

    const countries=[...new Set(users.map(x=>x.country).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const select=$('enhCountryFilter'); if(select){ select.innerHTML='<option value="all">كل البلدان</option>'+countries.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join(''); }
    renderStats(); applyFilters();
  }catch(e){ console.error('Admin enhancements:',e); const el=$('enhDataStatus'); if(el) el.textContent='تعذر تحميل بعض الإحصائيات. تأكد من قواعد Firestore.'; }
}

onAuthStateChanged(auth, async user=>{ if(!user) return; try { const {doc,getDoc}=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');const snap=await getDoc(doc(db,'admins',user.uid));if(!snap.exists() && !(user.email?.toLowerCase()==='maleksameh121@gmail.com' && user.emailVerified)){ const {getDoc,doc}=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');const profile=await getDoc(doc(db,'users',user.uid));if(profile.data()?.role!=='admin')return; }await load();}catch(e){console.warn('Admin statistics unavailable',e);} });
$('enhUserSearch')?.addEventListener('input',applyFilters);
$('enhRoleFilter')?.addEventListener('change',applyFilters);
$('enhStatusFilter')?.addEventListener('change',applyFilters);
$('enhCountryFilter')?.addEventListener('change',applyFilters);
$('enhResetUserFilters')?.addEventListener('click',()=>{
  if($('enhUserSearch')) $('enhUserSearch').value='';
  if($('enhRoleFilter')) $('enhRoleFilter').value='all';
  if($('enhStatusFilter')) $('enhStatusFilter').value='all';
  if($('enhCountryFilter')) $('enhCountryFilter').value='all';
  applyFilters();
});
$('enhExportUsers')?.addEventListener('click',exportCSV);
$('enhRefreshData')?.addEventListener('click',load);
$('refresh')?.addEventListener('click',()=>setTimeout(load,200));
