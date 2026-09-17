import {auth,db} from "../firebase-config.js";
import {onAuthStateChanged,signOut,deleteUser,EmailAuthProvider,reauthenticateWithCredential} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {doc,getDoc,deleteDoc,collection,query,where,getDocs} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
const $=s=>document.querySelector(s); const key=(uid,n)=>`zad_${n}_${uid}`;

function escapeHtml(value){return String(value??"-").replace(/[&<>'"`]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;','`':'&#96;'}[c]||c));}
function statusClass(status){return status==='تم الحجز'||status==='مكتمل'?'success':status==='ملغي'?'danger':'pending';}
async function loadMyBookings(uid){
  const box=$("#myBookings"); if(!box)return;
  try{
    const snap=await getDocs(query(collection(db,"bookings"),where("studentUid","==",uid)));
    if(snap.empty){box.innerHTML='<div class="empty">لا توجد لديك طلبات حجز حتى الآن.</div>';return;}
    const rows=[];
    snap.forEach(item=>{
      const b=item.data();
      const status=b.status||'جديد';
      rows.push(`<div class="booking-card"><div class="booking-top"><strong>${escapeHtml(b.subject||'حصة تعليمية')}</strong><span class="booking-status ${statusClass(status)}">${escapeHtml(status)}</span></div><div class="booking-details"><span>👨‍🏫 المعلم: ${escapeHtml(b.teacherName||'سيتم ترشيح معلم')}</span><span>📚 المرحلة/الصف: ${escapeHtml((b.educationType?b.educationType+' / ':'')+(b.grade||'-'))}</span><span>📅 الأيام: ${escapeHtml(b.preferredDay1||'-')} — ${escapeHtml(b.preferredDay2||'-')}</span><span>🕒 الفترة: ${escapeHtml(b.preferredPeriod||'-')}</span><span>🎓 النوع: ${escapeHtml(b.lessonType||'-')}</span></div><div class="booking-note">${status==='تم الحجز'?'✅ تمت الموافقة على طلبك، وسيتم التواصل معك لتأكيد التفاصيل.':status==='ملغي'?'❌ تم إلغاء الطلب.':status==='مكتمل'?'✅ تم تسجيل الحصة كمكتملة.':'⏳ طلبك قيد المراجعة، وسيظهر هنا أي تحديث من الإدارة.'}</div></div>`);
    });
    box.innerHTML=rows.join('');
  }catch(e){console.error(e);box.innerHTML='<div class="empty">تعذر تحميل طلبات الحجز. تأكد من نشر قواعد Firestore ثم أعد تحميل الصفحة.</div>';}
}

function render(user,profile={}){ const name=profile.fullName||profile.name||user.displayName||user.email?.split("@")[0]||"الطالب"; $("#studentName").textContent=name; const fav=JSON.parse(localStorage.getItem(key(user.uid,"favorites"))||"[]"),read=JSON.parse(localStorage.getItem(key(user.uid,"read"))||"[]"); $("#favCount").textContent=fav.length;$("#readCount").textContent=read.length;$("#progress").textContent=Math.min(100,Math.round(read.length/Math.max(fav.length+read.length,1)*100))+"%"; if(fav.length) $("#favorites").innerHTML=fav.map(x=>`<div class="item"><span>${x}</span><small>مفضل</small></div>`).join(""); if(read.length) $("#reading").innerHTML=read.map(x=>`<div class="item"><span>${x}</span><small>مقروء</small></div>`).join("");}
onAuthStateChanged(auth,async user=>{if(!user){location.replace("../login/index.html");return;} let profile={}; try{const snap=await getDoc(doc(db,"users",user.uid));if(snap.exists())profile=snap.data();}catch(e){} if(profile.role==='teacher' && profile.status==='active'){location.replace("../dashboard/teacher/index.html");return;} if(profile.role==='admin'){location.replace("../dashboard/admin/index.html");return;} render(user,profile); await loadMyBookings(user.uid);});
$("#logout").onclick=()=>signOut(auth).then(()=>location.replace("../login/index.html"));
$("#deleteAccount").onclick=async()=>{const user=auth.currentUser;if(!user)return;if(!confirm("هل أنت متأكد من حذف حسابك نهائيًا؟"))return;if(prompt('اكتب حذف الحساب للتأكيد')!=="حذف الحساب")return;try{await deleteDoc(doc(db,"users",user.uid));localStorage.removeItem(key(user.uid,"favorites"));localStorage.removeItem(key(user.uid,"read"));await deleteUser(user);alert("تم حذف الحساب بنجاح");location.replace("../login/index.html");}catch(e){console.error(e);alert("تعذر حذف الحساب. رمز الخطأ: "+(e.code||e.message));}};