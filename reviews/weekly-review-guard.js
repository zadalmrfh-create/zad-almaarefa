/* Used across public/student pages. Prevents bypass via normal navigation; Firestore rules remain authoritative for data permissions. */
import {db,auth} from '../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {doc,getDoc,getDocs,collection,query,where} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {lastFullWeek,lastFullMonth,reviewId,eligibleTeachers} from './weekly-shared.js';
const target=new URL('./weekly.html',import.meta.url);
const current=new URL(location.href);
if(current.pathname!==target.pathname){
 onAuthStateChanged(auth,async user=>{
  if(!user)return;
  try{
   const account=await getDoc(doc(db,'users',user.uid));
   if(account.data()?.role!=='student')return;
   const week=lastFullWeek();
   const month=lastFullMonth();
   // General platform/administration feedback is required once per completed month.
   const [platform,admin]=await Promise.all(['platform','administration'].map(kind=>getDoc(doc(db,'weeklyReviewPrivate',reviewId(user.uid,month.start,kind)))));
   let needed=!platform.exists()||!admin.exists();
   if(!needed){
    const [a,b]=await Promise.all([
     getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',user.uid))),
     getDocs(query(collection(db,'bookings'),where('studentUid','==',user.uid)))
    ]);
    const available=eligibleTeachers(a.docs.map(d=>({id:d.id,...d.data()})),b.docs.map(d=>({id:d.id,...d.data()})),week);
    if(available.length){const done=await Promise.all(available.map(t=>getDoc(doc(db,'weeklyReviewPrivate',reviewId(user.uid,week.start,'teacher',t.uid)))));needed=done.some(s=>!s.exists())}
   }
   if(needed){target.searchParams.set('next',current.href);location.replace(target.href)}
  }catch(error){
   console.error('weekly-review-guard',error);
   // A failed permission/network check cannot silently bypass the mandatory student survey.
   target.searchParams.set('next',current.href);
   target.searchParams.set('check','retry');
   location.replace(target.href);

  }
 });
}
