import {sharedAdminGetDocs,clearAdminReadCache} from './firestore-read-cache.js';
const getDocs=(ref)=>sharedAdminGetDocs(ref,rawGetDocs,auth);
import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,getDocs as rawGetDocs,getDoc,doc,addDoc,updateDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let entries=[],items=[],users=[],editing=null;
const msg=(s,bad=false)=>{$('mlMessage').textContent=s;$('mlMessage').style.color=bad?'#ff9292':'#e9cb75'};
const categoryName={lesson:'حصة تعليمية',qureo:'كيرو',finance:'الثقافة المالية',library:'اشتراك المكتبة',product:'منتج',advance:'رصيد مقدم'};
async function loadItems(){
 const cat=$('mlCategory').value;items=[];
 if(cat==='lesson'){
  const [ls,bs]=await Promise.allSettled([getDocs(collection(db,'lessons')),getDocs(collection(db,'bookings'))]);
  if(ls.status==='fulfilled')ls.value.forEach(d=>{const x=d.data();items.push({id:'lesson:'+d.id,title:[x.title||x.subject||'حصة',x.teacherName||x.teacher,x.grade].filter(Boolean).join(' — ')})});
  if(bs.status==='fulfilled')bs.value.forEach(d=>{const x=d.data();const name=[x.subject||x.material||x.course,x.teacherName||x.teacher,x.grade||x.studentGrade].filter(Boolean).join(' — ');if(name&&!items.some(i=>i.title===name))items.push({id:'booking:'+d.id,title:name+' (حجز)'})});
 }else if(cat==='product'){
  try{const q=await getDocs(collection(db,'storeProducts'));q.forEach(d=>{const x=d.data();items.push({id:d.id,title:x.title||x.name||d.id})})}catch(e){msg('تعذر تحميل منتجات المتجر: '+e.message,true)}
 }else if(cat!=='advance'){items=[{id:cat,title:categoryName[cat]}]}
 $('mlItem').innerHTML='<option value="">'+(cat==='advance'?'رصيد عام': 'اختر البند')+'</option>'+items.map(i=>`<option value="${esc(i.id)}">${esc(i.title)}</option>`).join('');
}
async function loadUsers(){try{const s=await getDocs(collection(db,'users'));users=s.docs.map(d=>({id:d.id,...d.data()}));$('mlUser').innerHTML='<option value="">طالب غير مرتبط بحساب</option>'+users.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.fullName||x.email||x.id)}</option>`).join('')}catch(e){msg('تعذر تحميل حسابات الطلاب: '+e.message,true)}}
async function loadEntries(){try{const s=await getDocs(collection(db,'manualPaymentLedger'));entries=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));render()}catch(e){msg('تعذر تحميل المدفوعات. تأكد من نشر قواعد Firestore: '+e.message,true)}}
function render(){$('mlRows').innerHTML=entries.length?entries.map(e=>`<tr><td>${esc(e.studentName)}</td><td>${esc(e.itemTitle||categoryName[e.category])}${e.voided?' — <b style="color:#ff9292">ملغاة</b>':''}</td><td>${esc((Number(e.amountPiastres||0)/100).toFixed(2))} ج</td><td>${esc(e.date)}</td><td>${esc(e.reference)}</td><td><div class="ml-actions"><button type="button" class="btn" data-edit="${esc(e.id)}" ${e.voided?'disabled':''}>تعديل</button><button type="button" class="btn" data-void="${esc(e.id)}" ${e.voided?'disabled':''}>إلغاء</button></div></td></tr>`).join(''):'<tr><td colspan="6">لا توجد دفعات مسجلة</td></tr>'}
$('mlRows').addEventListener('click',async ev=>{const b=ev.target.closest('button');if(!b)return;const id=b.dataset.edit||b.dataset.void,e=entries.find(x=>x.id===id);if(!e)return;if(b.dataset.void){if(!confirm('إلغاء هذه الدفعة محاسبيًا؟ سيبقى سجلها محفوظًا للمراجعة.'))return;try{await updateDoc(doc(db,'manualPaymentLedger',id),{voided:true,voidedAt:serverTimestamp(),voidedBy:auth.currentUser.uid});await loadEntries();msg('تم إلغاء الدفعة مع الاحتفاظ بسجلها')}catch(x){msg(x.message,true)}return}
 editing=id;$('mlStudent').value=e.studentName||'';$('mlUser').value=e.studentUid||'';$('mlCategory').value=e.category;await loadItems();$('mlItem').value=e.itemId||'';$('mlAmount').value=(e.amountPiastres/100).toFixed(2);$('mlDate').value=e.date;$('mlReference').value=e.reference||'';$('mlNotes').value=e.notes||'';msg('أنت الآن تعدّل دفعة موجودة. اضغط حفظ الدفعة.');$('manualPaymentLedger').scrollIntoView({behavior:'smooth'});
});
$('mlUser').addEventListener('change',()=>{const u=users.find(x=>x.id===$('mlUser').value);if(u)$('mlStudent').value=u.name||u.fullName||u.email||''});
$('mlCategory').addEventListener('change',()=>loadItems().catch(e=>msg(e.message,true)));
$('mlRefresh').addEventListener('click',()=>Promise.all([loadUsers(),loadItems(),loadEntries()]));
$('mlDate').value=new Date().toLocaleDateString('en-CA');
$('manualLedgerForm').addEventListener('submit',async ev=>{ev.preventDefault();const category=$('mlCategory').value,itemId=$('mlItem').value;const amountPiastres=Math.round(Number($('mlAmount').value)*100);if(!Number.isSafeInteger(amountPiastres)||amountPiastres<=0)return msg('أدخل مبلغًا صحيحًا',true);if(category!=='advance'&&!itemId)return msg('اختر الحصة أو الخدمة أولًا',true);const data={studentName:$('mlStudent').value.trim(),studentUid:$('mlUser').value||null,category,itemId,itemTitle:items.find(i=>i.id===itemId)?.title||categoryName[category],amountPiastres,date:$('mlDate').value,reference:$('mlReference').value.trim(),notes:$('mlNotes').value.trim(),updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid};try{if(editing){await updateDoc(doc(db,'manualPaymentLedger',editing),data)}else{await addDoc(collection(db,'manualPaymentLedger'),{...data,voided:false,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid})}editing=null;ev.target.reset();$('mlDate').value=new Date().toLocaleDateString('en-CA');await loadItems();await loadEntries();msg('تم حفظ الدفعة في Firebase بنجاح')}catch(e){msg('فشل الحفظ: '+e.message,true)}});
onAuthStateChanged(auth,async user=>{if(!user)return;try{const [a,u]=await Promise.all([getDoc(doc(db,'admins',user.uid)),getDoc(doc(db,'users',user.uid))]);if(!(a.exists()||u.data()?.role==='admin'||(user.email?.toLowerCase()==='maleksameh121@gmail.com'&&user.emailVerified)))return;await Promise.all([loadUsers(),loadItems(),loadEntries()])}catch(e){msg('خطأ في التحقق من الإدارة: '+e.message,true)}});
