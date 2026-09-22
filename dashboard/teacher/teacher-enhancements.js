import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $=id=>document.getElementById(id); const stat=(id,v)=>$(id)&&($(id).textContent=String(v));
onAuthStateChanged(auth,async user=>{if(!user)return;try{
 const [students,bookings,attempts,attendance]=await Promise.all([
  getDocs(query(collection(db,'users'),where('role','==','student'))),
  getDocs(query(collection(db,'bookings'),where('teacherUid','==',user.uid))),
  getDocs(query(collection(db,'quizAttempts'),where('teacherUid','==',user.uid))),
  getDocs(query(collection(db,'lessonAttendance'),where('teacherUid','==',user.uid)))
 ]);
 stat('teacherStudentsCount',students.size);stat('teacherBookingsCount',bookings.size);stat('teacherQuizCount',attempts.size);stat('teacherAttendanceCount',attendance.size);
 const countries=[...new Set(students.docs.map(d=>d.data().country).filter(Boolean))];stat('teacherCountriesCount',countries.length);
 const body=$('teacherStudentEnhancedRows'); if(body){body.innerHTML=students.docs.map(d=>{const x=d.data();return `<tr><td>${esc(x.fullName||x.name||'-')}</td><td>${esc(x.country||'-')}</td><td>${esc(x.city||'-')}</td><td>${esc(x.grade||x.studyGrade||'-')}</td><td>${esc(x.phone||'-')}</td></tr>`}).join('')||'<tr><td colspan="5">لا يوجد طلاب.</td></tr>';}
}catch(e){console.error('Teacher enhancements:',e);}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
