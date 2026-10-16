import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { collection, doc, getDoc, onSnapshot, query, where, updateDoc, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const list = document.getElementById('zadActivityList');
const unreadCount = document.getElementById('zadActivityUnread');
const readAll = document.getElementById('zadActivityReadAll');
const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=[], unsubscribe=null;
const supported = new Set(['signup','book-download','booking']);
function render(uid){
 const entries=current.filter(x=>supported.has(x.data.type) || x.data.type==='reservation' || x.data.bookingId);
 const unread=entries.filter(x=>!Array.isArray(x.data.readBy)||!x.data.readBy.includes(uid));
 unreadCount.textContent=String(unread.length);unreadCount.hidden=!unread.length;
 readAll.disabled=!unread.length;
 list.innerHTML=entries.length ? entries.map(({id,data})=>{
  const seen=Array.isArray(data.readBy)&&data.readBy.includes(uid);
  const when=data.createdAt?.toDate?.();
  return `<article class="zad-activity-item ${seen?'':'unread'}"><div><strong>${safe(data.title||'إشعار جديد')}</strong><p>${safe(data.message||'')}</p><small>${when?when.toLocaleString('ar-EG'):'جارٍ تحديد الوقت'}</small></div><button type="button" class="btn" data-read="${safe(id)}" ${seen?'disabled':''}>${seen?'✓ مقروء':'تحديد كمقروء'}</button></article>`;
 }).join('') : '<p>لا توجد إشعارات نشاط حتى الآن.</p>';
}
async function markRead(id,uid){const row=current.find(x=>x.id===id);if(!row)return;const prev=Array.isArray(row.data.readBy)?row.data.readBy:[];if(prev.includes(uid))return;await updateDoc(doc(db,'notifications',id),{readBy:[...prev,uid]});}
list?.addEventListener('click',async e=>{const button=e.target.closest('[data-read]');if(!button||!auth.currentUser)return;button.disabled=true;try{await markRead(button.dataset.read,auth.currentUser.uid)}catch(err){button.disabled=false;alert('تعذر تحديث الإشعار: '+(err.code||err.message));}});
readAll?.addEventListener('click',async()=>{const uid=auth.currentUser?.uid;if(!uid)return;readAll.disabled=true;for(const item of current.filter(x=>supported.has(x.data.type)||x.data.bookingId)){try{await markRead(item.id,uid)}catch(e){console.warn('تعذر تحديث الإشعار',e)}}});
onAuthStateChanged(auth,async user=>{
 if(unsubscribe){unsubscribe();unsubscribe=null;}
 if(!user)return;
 try{
  const admin=(await getDoc(doc(db,'admins',user.uid))).exists()||(user.email?.toLowerCase()==='maleksameh121@gmail.com'&&user.emailVerified);
  if(!admin)return;
  // Where فقط لتجنب قراءة إشعارات المستخدمين العادية.
  unsubscribe=onSnapshot(query(collection(db,'notifications'),where('audience','==','admin'),limit(150)),snap=>{
   current=snap.docs.map(d=>({id:d.id,data:d.data()})).sort((a,b)=>(b.data.createdAt?.toMillis?.()||0)-(a.data.createdAt?.toMillis?.()||0));render(user.uid);
  },err=>{list.textContent='تعذر تحميل إشعارات النشاط: '+(err.code||err.message)});
 }catch(e){list.textContent='تعذر التحقق من صلاحية الإدارة: '+(e.code||e.message)}
});
