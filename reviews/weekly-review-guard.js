/* Used across public/student pages. Prevents bypass via normal navigation; Firestore rules remain authoritative for data permissions. */
import {db,auth} from '../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {doc,getDoc,getDocs,collection,query,where} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {lastFullWeek,lastFullMonth,reviewId,eligibleTeachers} from './weekly-shared.js';
import {isStudentReviewer} from './review-account.js';
const target=new URL('./weekly.html',import.meta.url);

function redirectToReview(user,retry=false){
 if(auth.currentUser?.uid!==user.uid)return;
 const destination=new URL(target);
 destination.searchParams.set('next',location.href);
 if(retry)destination.searchParams.set('check','retry');
 location.replace(destination.href);
}

if(location.pathname!==target.pathname){
 onAuthStateChanged(auth,async user=>{
  if(!user)return;
  try{
   if(!await isStudentReviewer(user)||auth.currentUser?.uid!==user.uid)return;
  }catch(error){
   console.error('weekly-review-account',error);
   return;
  }
  try{
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
   if(needed)redirectToReview(user);
  }catch(error){
   console.error('weekly-review-guard',error);
   // Keep the retry path for accounts already confirmed to be students.
   redirectToReview(user,true);
  }
 });
}
