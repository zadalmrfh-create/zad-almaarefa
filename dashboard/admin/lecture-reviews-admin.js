import {db,auth} from '../../firebase-config.js';
import {isAdminAccount} from '../admin-preview-core.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,getDocs} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let reviews=[];
function render(){
 const box=$('lectureRatingsList'),stats=$('lectureRatingsByTeacher'),select=$('lectureRatingsTeacher'),summary=$('lectureRatingsSummary');if(!box)return;
 const teachers=[...new Set(reviews.map(x=>x.teacherName||'غير محدد'))].sort((a,b)=>a.localeCompare(b,'ar'));
 const old=select?.value||'all';
 if(select){select.replaceChildren(new Option('جميع المعلمين','all'),...teachers.map(t=>new Option(t,t)));select.value=teachers.includes(old)?old:'all';}
 const chosen=select?.value||'all';
 const shown=chosen==='all'?reviews:reviews.filter(x=>(x.teacherName||'غير محدد')===chosen);
 const avg=a=>a.length?(a.reduce((sum,x)=>sum+x.stars,0)/a.length).toFixed(1):'—';
 if(summary)summary.textContent=`${shown.length} تقييم • المتوسط ${avg(shown)} / 5`;
 if(stats)stats.innerHTML=teachers.map(t=>{const rs=reviews.filter(x=>(x.teacherName||'غير محدد')===t);return `<div style="padding:15px;border:1px solid #677088;border-radius:12px;background:#17233a"><strong>${escape(t)}</strong><p style="color:#e9c85b">⭐ ${avg(rs)} / 5</p><small>${rs.length} تقييم</small></div>`}).join('');
 box.innerHTML=shown.length?shown.map(x=>`<article style="padding:15px;border:1px solid #52617c;border-radius:12px;background:#15223a"><strong>${escape(x.studentName||'طالب')}</strong> — ${escape(x.subject||'محاضرة')}<p style="color:#bfc7d7">${escape(x.lessonDate||'')} • ${escape(x.teacherName||'المعلم')}</p><p style="color:#f0cb6c">${'★'.repeat(x.stars)}${'☆'.repeat(5-x.stars)} (${x.stars}/5)</p>${x.comment?`<p style="white-space:pre-wrap">${escape(x.comment)}</p>`:''}</article>`).join(''):'<p>لا توجد تقييمات مسجلة حتى الآن.</p>';
}
async function load(){
 const box=$('lectureRatingsList');if(box)box.textContent='جارٍ تحميل تقييمات المحاضرات...';
 try{const snap=await getDocs(collection(db,'lectureReviews'));reviews=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>Number.isInteger(x.stars)&&x.stars>=1&&x.stars<=5).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));render();}
 catch(e){if(box)box.textContent='تعذر تحميل التقييمات: '+(e.code||e.message);}
}
$('lectureRatingsTeacher')?.addEventListener('change',render);
$('lectureRatingsRefresh')?.addEventListener('click',load);
onAuthStateChanged(auth,async user=>{if(user&&await isAdminAccount(user))await load();});
window.addEventListener('zad:lecture-review-updated',load);
