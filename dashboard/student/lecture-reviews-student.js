import {auth,db} from '../../firebase-config.js';
import {getPreviewContext} from '../admin-preview-core.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,query,where,onSnapshot,doc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const box=document.getElementById('studentLectureRatingsList');
const badge=document.getElementById('studentLectureRatingBadge');
const clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let uid='',lessons=[],ratings=new Map(),unsubs=[],currentUser=null,preview=false;
let latestLessonId=null,latestPointerLoaded=false;
// Zero-cost automatic reminder shown within the student dashboard, not via WhatsApp.
let reminderDismissedForUid='';
function syncFreeReminder(pending){
 const id='zadLectureRatingReminder';
 let element=document.getElementById(id);
 if(!pending||preview||!uid||reminderDismissedForUid===uid){element?.remove();return;}
 if(element){
   const count=element.querySelector('[data-pending-count]');
   if(count)count.textContent=String(pending);
   return;
 }
 element=document.createElement('aside');
 element.id=id;
 element.setAttribute('role','status');
 element.dir='rtl';
 element.style.cssText='position:fixed;bottom:18px;left:18px;right:18px;max-width:430px;margin-inline-start:auto;z-index:20000;background:#142640;color:#fff;border:2px solid #d6ae57;border-radius:15px;padding:16px;box-shadow:0 8px 40px #0008;font-family:inherit';
 element.innerHTML='<strong style="font-size:17px">🌟 قيّم محاضرتك</strong><p style="margin:8px 0">لديك <b data-pending-count></b> محاضرة تنتظر تقييمك. رأيك يساعدنا نحسّن الشرح.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-open-lecture-ratings style="border:0;border-radius:10px;padding:9px 14px;background:#d6ae57;color:#142640;font-weight:bold;cursor:pointer">قيّم الآن</button><button type="button" data-dismiss-lecture-ratings style="border:1px solid #a7b3c5;border-radius:10px;padding:9px 14px;background:transparent;color:#fff;cursor:pointer">لاحقًا</button></div>';
 element.querySelector('[data-pending-count]').textContent=String(pending);
 element.querySelector('[data-open-lecture-ratings]').addEventListener('click',()=>{
   document.querySelector('[data-student-tab="lectureRatings"]')?.click();
   element.remove();
   reminderDismissedForUid=uid;
 });
 element.querySelector('[data-dismiss-lecture-ratings]').addEventListener('click',()=>{
   reminderDismissedForUid=uid;
   element.remove();
 });
 document.body.appendChild(element);
}
function render(){
 if(!box||!uid||!latestPointerLoaded)return;
 const eligible=lessons.filter(x=>x.status==='حاضر'&&x.deleted!==true&&['manual-attendance','teacher-dashboard'].includes(x.source));
 eligible.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 const latest=eligible.find(x=>x.id===latestLessonId);
 const pending=latest&&!ratings.has(latest.id)?1:0;
 if(badge)badge.textContent=pending?'(1)':'';
 syncFreeReminder(pending);
 if(!eligible.length){box.innerHTML='<div class="notice">لا توجد محاضرات مسجّلة بحضورك حتى الآن.</div>';return;}
 const requestedId=new URLSearchParams(location.search).get('lessonId');
 const sorted=[...eligible].sort((a,b)=>Number(b.id===requestedId)-Number(a.id===requestedId));
 box.innerHTML=sorted.map(x=>{
  const rated=ratings.get(x.id);
  const header=`<strong>${clean(x.subject||'محاضرة')}</strong><p style="margin:5px 0;color:#bfc9d8">${clean(x.date||'')} — ${clean(x.teacherName||'المعلم')}</p>`;
  if(rated)return `<article style="padding:16px;border:1px solid #435672;border-radius:14px;background:#122039">${header}<p style="color:#e7c75d">✅ تقييمك: ${'★'.repeat(rated.stars)}${'☆'.repeat(5-rated.stars)}</p>${rated.comment?`<p>${clean(rated.comment)}</p>`:''}</article>`;
  if(x.id!==latestLessonId)return `<article style="padding:16px;border:1px solid #435672;border-radius:14px;background:#122039">${header}<p style="color:#bfc9d8">🔒 انتهت فترة تقييم هذه المحاضرة. التقييم متاح لآخر محاضرة فقط.</p></article>`;
  return `<article style="padding:16px;border:1px solid #bb9850;border-radius:14px;background:#14233a">${header}<p style="color:#e9c85b">🟢 هذه آخر محاضرة يمكنك تقييمها.</p><form data-rate-lesson="${clean(x.id)}" style="display:grid;gap:10px"><label>تقييم المحاضرة <select name="stars" required style="padding:10px;background:#fff;color:#142035"><option value="">اختر التقييم</option><option value="5">⭐⭐⭐⭐⭐ ممتازة</option><option value="4">⭐⭐⭐⭐ جيدة جدًا</option><option value="3">⭐⭐⭐ جيدة</option><option value="2">⭐⭐ تحتاج تحسين</option><option value="1">⭐ لم أستفد بالشكل المطلوب</option></select></label><label>ملاحظتك (اختياري)<textarea name="comment" maxlength="500" rows="3" placeholder="إيه اللي عجبك وإيه اللي محتاج يتحسن؟" style="width:100%;padding:10px"></textarea></label><button class="btn gold" type="submit" ${preview?'disabled title="المعاينة لا تسمح بالتقييم"':''}>🌟 إرسال التقييم</button><small data-rate-message role="status"></small></form></article>`;
 }).join('');
}
box?.addEventListener('submit',async e=>{
 const form=e.target.closest('[data-rate-lesson]');if(!form)return;e.preventDefault();
 const id=form.dataset.rateLesson,lesson=lessons.find(x=>x.id===id);
 const stars=Number(form.elements.stars.value),comment=String(form.elements.comment.value||'').trim();
 const message=form.querySelector('[data-rate-message]'),btn=form.querySelector('button[type=submit]');
 if(!lesson||preview||currentUser?.uid!==uid){message.textContent='افتح حساب الطالب نفسه لإرسال التقييم.';return;}
 if(!latestPointerLoaded||lesson.id!==latestLessonId){message.textContent='انتهت فترة التقييم لهذه الحصة؛ آخر محاضرة فقط متاحة.';return;}
 if(!Number.isInteger(stars)||stars<1||stars>5||comment.length>500){message.textContent='اختر من نجمة إلى 5 نجوم.';return;}
 btn.disabled=true;message.textContent='جارٍ حفظ التقييم...';
 try{
  await setDoc(doc(db,'lectureReviews',id),{
   lessonId:id,studentUid:uid,studentName:lesson.studentName||'',teacherUid:lesson.teacherUid||null,
   teacherName:lesson.teacherName||'',subject:lesson.subject||'',lessonDate:lesson.date||'',stars,comment,createdAt:serverTimestamp()
  });
  message.textContent='✅ تم إرسال تقييمك بنجاح.';
 }catch(error){message.textContent=error.code==='permission-denied'?'تعذّر الحفظ: يلزم نشر قواعد Firestore المرفقة، والتأكد أن الحصة مسجّلة حاضرًا.':(error.code||error.message||'تعذر إرسال التقييم');btn.disabled=false;}
});
onAuthStateChanged(auth,async user=>{
 unsubs.forEach(fn=>fn());unsubs=[];uid='';lessons=[];ratings.clear();latestLessonId=null;latestPointerLoaded=false;currentUser=user;preview=false;
 document.getElementById('zadLectureRatingReminder')?.remove();
 if(!user){if(box)box.textContent='سجّل الدخول لعرض تقييمات المحاضرات.';return;}
 const pv=await getPreviewContext(user,'student');if(pv.denied){if(box)box.textContent='لا يمكن عرض هذا الحساب.';return;}
 uid=pv.uid;preview=pv.active;
 const onError=e=>{if(box)box.textContent='تعذر عرض التقييمات: '+(e.code||e.message)};
 unsubs.push(onSnapshot(doc(db,'latestLectureReview',uid),snap=>{latestPointerLoaded=true;latestLessonId=snap.exists()?snap.data().lessonId:null;render();},onError));
 // A shared link opens the rating tab directly, after the normal tab controls are loaded.
 if(new URLSearchParams(location.search).get('tab')==='lectureRatings')setTimeout(()=>document.querySelector('[data-student-tab="lectureRatings"]')?.click(),0);
 unsubs.push(onSnapshot(query(collection(db,'lessonAttendance'),where('studentUid','==',uid)),snap=>{lessons=snap.docs.map(d=>({id:d.id,...d.data()}));render();},onError));
 unsubs.push(onSnapshot(query(collection(db,'lectureReviews'),where('studentUid','==',uid)),snap=>{ratings=new Map(snap.docs.map(d=>[d.id,d.data()]));render();},onError));
});
