import {db,$,esc,fmt,types,toast,session,adminCheck,printReceipt,dateText} from './common.js';
import {collection,doc,getDoc,getDocs,onSnapshot,serverTimestamp,deleteField,setDoc,updateDoc,deleteDoc,runTransaction} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {getStorage,ref,getBlob,uploadBytes} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js';
import {baseProducts} from './catalog-data.js?v=20261103-secure4';

const storage=getStorage();
const defaultSettings={vodafonePhone:'01042239704',instapayAddress:'',whatsapp:'01042239704'};
let rawStoreDocs=[];
let products=[];
let orders=[];
let drafts=[];
let coupons=[];
let currentUser=null;
let currentProductId='';
let unsubscribe=[];

const isValidUrl=s=>!s||/^https:\/\/[^\s]+$/i.test(s);
const byBase=(a,b)=>String(a.title||'').localeCompare(String(b.title||''),'ar')||Number(a.baseOrder||0)-Number(b.baseOrder||0);
const productIndex=()=>Object.fromEntries(products.map(p=>[p.id,p]));

function mergeProducts(overrides){
  const map=new Map(overrides.map(x=>[x.id,x]));
  const merged=baseProducts.map(base=>{
    const override=map.get(base.id)||{};
    const item={...base,...override};
    // ترقية التصنيف القديم: تقييمات المكتبة كانت تظهر ككتب أو امتحانات.
    // إن تم تعديل التقييم في المتجر نفسه لاحقًا نحتفظ بالسعر المختار.
    if(base.type==='evaluation' && override.type!=='evaluation'){
      item.type='evaluation';
      item.price=10;
    }
    return item;
  });
  const extras=overrides.filter(x=>!baseProducts.some(b=>b.id===x.id)).map(x=>({published:true,...x}));
  return [...merged,...extras].filter(x=>!x.deleted).sort(byBase);
}

function updateProducts(){
  products=mergeProducts(rawStoreDocs);
  renderProducts();
  renderStats();
  renderReports();
  loadLessons();
}

function tab(t){
  document.querySelectorAll('main>section').forEach(x=>x.classList.toggle('hidden',x.id!==`tab-${t}`));
  document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===t));
  if(t==='products') renderProducts();
  if(t==='orders') renderOrders();
  if(t==='courses') loadLessons();
  if(t==='reports') renderReports();
  if(t==='drafts') renderDrafts();
  if(t==='coupons') renderCoupons();
}

function statusLabel(s){return {pending:'بانتظار المراجعة',approved:'معتمد',rejected:'مرفوض'}[s]||s}

function renderStats(){
  const approved=orders.filter(o=>o.status==='approved');
  const total=approved.reduce((n,o)=>n+Number(o.approvedTotal||0),0);
  const stats=[['إجمالي المبيعات',fmt(total)],['طلبات معتمدة',approved.length],['طلبات تحت المراجعة',orders.filter(x=>x.status==='pending').length],['منتجات ظاهرة',products.filter(x=>x.published!==false).length]];
  $('#stats').innerHTML=stats.map(([l,v])=>`<div class="stat"><span class="muted">${l}</span><strong>${esc(v)}</strong></div>`).join('');
}

function resetProduct(){
  currentProductId='';
  $('#productForm').reset();
  $('#productId').value='';
  $('#productFormTitle').textContent='اختر منتجًا لتعديله';
  $('#pPublished').checked=true;
  $('#pFile').value='';
  $('#pProtectionStatus').textContent='اختر منتجًا لمعرفة حالة الحماية.';
}

function editProduct(id){
  const p=products.find(x=>x.id===id);
  if(!p) return;
  currentProductId=id;
  const fields={pTitle:'title',pType:'type',pPrice:'price',pStage:'stage',pGrade:'grade',pSubject:'subject',pTeacher:'teacherName',pTeacherUid:'teacherUid',pSchedule:'schedule',pDuration:'duration',pDescription:'description',pContents:'contents',pCover:'coverUrl'};
  for(const [key,val] of Object.entries(fields)) $('#'+key).value=p[val]??'';
  $('#pPublished').checked=p.published!==false;
  $('#productId').value=id;
  $('#productFormTitle').textContent='تعديل المنتج: '+p.title;
  $('#pProtectionStatus').textContent=(p.deliveryReady&&String(p.storagePath||'').startsWith('storeProtected/'+id+'/'))?'✅ ملف محمي جاهز':'🔒 المنتج غير جاهز للبيع: ارفع PDF محميًا من هنا';
  $('#tab-products').scrollIntoView({behavior:'smooth'});
}

const publicFields=['title','type','price','stage','grade','subject','teacherName','teacherUid','schedule','duration','description','contents','coverUrl','published','deleted','deliveryReady','updatedAt'];
function publicProduct(p){return Object.fromEntries(publicFields.filter(k=>p[k]!==undefined).map(k=>[k,p[k]]))}
const isDigital=p=>['summary','exam','evaluation','book'].includes(p.type);
async function saveProduct(e){
  e.preventDefault();
  const id=$('#productId').value;
  if(!id)return toast('اختر منتجًا من القائمة أولًا');
  const old=products.find(x=>x.id===id);
  if(!old)return toast('المنتج غير موجود');
  const url=$('#pCover').value.trim();
  if(!isValidUrl(url))return toast('رابط الغلاف غير صحيح');
  const p={
    title:$('#pTitle').value.trim(),type:$('#pType').value,price:Number($('#pPrice').value),
    stage:$('#pStage').value,grade:$('#pGrade').value.trim(),subject:$('#pSubject').value.trim(),
    teacherName:$('#pTeacher').value.trim(),teacherUid:$('#pTeacherUid').value.trim(),
    schedule:$('#pSchedule').value.trim(),duration:$('#pDuration').value.trim(),
    description:$('#pDescription').value.trim(),contents:$('#pContents').value.trim(),
    coverUrl:url,published:$('#pPublished').checked,deleted:false,
    updatedAt:serverTimestamp(),updatedBy:currentUser.uid
  };
  if(!p.title||!Number.isFinite(p.price)||p.price<0)return toast('الاسم والسعر مطلوبان');
  const btn=$('#saveProduct');btn.disabled=true;
  try{
    const picked=$('#pFile').files[0];
    if(picked){
      if(!isDigital(p))throw Error('رفع PDF متاح فقط للكتب والملخصات والامتحانات والتقييمات');
      if(picked.type!=='application/pdf'||picked.size>70*1024*1024)throw Error('الملف المطلوب PDF وحجمه أقل من 70 ميجابايت');
      const path=`storeProtected/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
      await uploadBytes(ref(storage,path),picked,{contentType:'application/pdf'});
      p.storagePath=path;
      p.deliveryReady=true;
    }else if(isDigital(p)){
      const originalPath=String(old.storagePath||'');
      p.deliveryReady=Boolean(old.deliveryReady&&originalPath.startsWith(`storeProtected/${id}/`));
    }else{
      p.deliveryReady=true;
    }
    // بيانات المنتج الخاصة لا تُرسل إلى المجموعة العامة.
    await setDoc(doc(db,'storeProducts',id),{...p,directUrl:deleteField(),previewUrl:deleteField(),downloadUrl:deleteField()},{merge:true});
    await setDoc(doc(db,'storePublicProducts',id),publicProduct(p),{merge:true});
    // في حالة المنتج المدفوع، لا تتضمن المجموعة العامة أي روابط أو storagePath.
    toast(p.deliveryReady?'تم حفظ المنتج المحمي':'تم حفظ التعديل؛ المنتج مقفل حتى رفع الملف');
    $('#pFile').value='';
  }catch(err){toast('تعذر حفظ المنتج: '+(err.code||err.message))}
  finally{btn.disabled=false}
}

function renderProducts(){
  if(!$('#productList')) return;
  const s=$('#productSearch').value.trim().toLowerCase();
  const out=products.filter(p=>[p.title,p.subject,p.teacherName,p.grade,p.stage].join(' ').toLowerCase().includes(s));
  $('#productList').innerHTML=out.length?out.map(p=>`<div class="item"><div class="row"><b>${esc(p.title)}</b><span class="badge">${p.published!==false?'ظاهر':'مخفي'}</span></div><div class="muted small">${esc(types[p.type]||p.type)} • ${fmt(p.price)} • ${esc(p.grade||'')} • ${esc(p.stage||'')}</div><p class="small secure-product-label">${p.deliveryReady?'✅ محمي وجاهز للتسليم':'🔒 مقفل حتى رفع الملف المحمي'}</p><div class="actions"><button class="secondary" data-edit-product="${esc(p.id)}">تعديل</button><button class="secondary" data-toggle-product="${esc(p.id)}">${p.published!==false?'إخفاء':'نشر'}</button><button class="secondary" data-delete-product="${esc(p.id)}">حذف</button></div></div>`).join(''):'<div class="empty">لا توجد منتجات مطابقة</div>';
}

function paymentSnapshot(o){
  const ids=o.productIds||[];
  const index=productIndex();
  const items=ids.map(id=>index[id]).filter(Boolean);
  return {items,total:items.reduce((t,p)=>t+Number(p.price||0),0),missing:items.length!==ids.length};
}

function orderCard(o){
  const q=paymentSnapshot(o);
  return `<div class="item"><div class="row"><h3>طلب ${esc(o.id.slice(0,10))}</h3><span class="badge">${esc(statusLabel(o.status))}</span></div><div class="row"><div><b>${esc(o.buyerName||'')}</b><div class="muted small">${esc(o.buyerEmail||'')} · UID: ${esc(o.studentUid||'')}</div></div><div>تاريخ الطلب: ${esc(dateText(o.createdAt))}</div></div><p>المنتجات: ${q.items.map(p=>esc(p.title)).join(' • ')||'منتجات غير متاحة'} ${q.missing?'<span class="badge">تحذير: يوجد منتج غير موجود</span>':''}</p><div class="row"><b>السعر المحسوب الآن: ${fmt(q.total)}</b>${o.status==='approved'?`<b>المبلغ المعتمد: ${fmt(o.approvedTotal)}</b>`:''}</div><div class="row"><span>طريقة الدفع: ${esc(o.paymentMethod)}</span><span>رقم التحويل: ${esc(o.paymentReference)}</span><span>الهاتف: ${esc(o.senderPhone)}</span></div>${o.note?`<p class="muted">ملاحظات الطالب: ${esc(o.note)}</p>`:''}${o.proofPath?`<button class="secondary" data-proof="${esc(o.id)}">عرض صورة إثبات التحويل</button>`:''}${o.adminNote?`<p class="muted">ملاحظة الإدارة: ${esc(o.adminNote)}</p>`:''}${o.status==='pending'?`<div class="actions"><button class="primary" data-approve="${esc(o.id)}">✓ اعتماد الدفع وتفعيل المنتجات</button><button class="secondary" data-reject="${esc(o.id)}">رفض الطلب</button></div>`:o.status==='approved'?`<button class="secondary" data-receipt="${esc(o.id)}">🧾 طباعة إيصال معتمد</button>`:''}</div>`;
}

function renderOrders(){
  if(!$('#ordersList')) return;
  const s=$('#orderSearch').value.trim().toLowerCase(),st=$('#orderStatus').value;
  const list=orders.filter(o=>(!st||o.status===st)&&[o.buyerName,o.buyerEmail,o.paymentReference,o.id].join(' ').toLowerCase().includes(s));
  $('#ordersList').innerHTML=list.length?list.map(orderCard).join(''):'<div class="empty">لا توجد طلبات مطابقة</div>';
}

const keyForRef=async(method,reference)=>{const input=new TextEncoder().encode(method+':'+reference.trim().toLowerCase());const hash=await crypto.subtle.digest('SHA-256',input);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')};

async function approveOrder(id){
  const o=orders.find(x=>x.id===id);
  if(!o||o.status!=='pending') return toast('هذا الطلب لم يعد معلقًا');
  const q=paymentSnapshot(o);
  if(q.missing||!q.items.length) return toast('هناك منتجات مفقودة أو محذوفة؛ صحح الطلب أولًا');
  const cp=o.couponCode?coupons.find(c=>c.id===o.couponCode):null;
  const discounted=cp&&cp.active&&cp.used<cp.maxUses&&(!cp.expires||cp.expires>=new Date().toISOString().slice(0,10))?Math.round(q.total*(100-cp.percent))/100:q.total;
  const amount=prompt(`المبلغ بعد الخصم -إن وجد-: ${fmt(discounted)}\nاكتب المبلغ الذي تأكدت من وصوله بالجنيه:`);
  if(amount===null) return;
  const paid=Number(amount);
  if(!Number.isFinite(paid)||paid<discounted||paid<=0) return toast('المبلغ غير صالح أو أقل من المطلوب');
  if(!confirm('تأكيد نهائي: تم التحقق من وصول المبلغ، وسيتم تفعيل المنتجات للطالب؟')) return;
  try{
    const claimId=await keyForRef(o.paymentMethod,o.paymentReference);
    await runTransaction(db,async tx=>{
      const orderRef=doc(db,'storeOrders',id), claimRef=doc(db,'storePaymentRefs',claimId), couponRef=o.couponCode?doc(db,'storeCoupons',o.couponCode):null;
      const productRefs=(o.productIds||[]).map(pid=>doc(db,'storeProducts',pid));
      const reads=await Promise.all([tx.get(orderRef),tx.get(claimRef),...productRefs.map(r=>tx.get(r)),...(couponRef?[tx.get(couponRef)]:[])]);
      const current=reads[0];
      if(!current.exists()||current.data().status!=='pending') throw Error('تمت مراجعة الطلب بالفعل');
      if(reads[1].exists()) throw Error('رقم التحويل مستخدم في طلب آخر');
      const verified=reads.slice(2,2+productRefs.length);
      if(verified.length!==q.items.length||verified.some(x=>!x.exists()))throw Error('ملفات المنتجات غير جاهزة للبيع');
      if(verified.some((x,i)=>{const v=x.data();return v.published===false||v.deleted||v.deliveryReady!==true||(['summary','exam','evaluation','book'].includes(v.type)&&!String(v.storagePath||'').startsWith(`storeProtected/${o.productIds[i]}/`))}))throw Error('يوجد منتج لم يُرفع ملفه المحمي أو غير منشور');
      const accurateTotal=verified.reduce((n,x)=>n+Number(x.data().price||0),0);
      let net=accurateTotal;
      if(couponRef){
        const c=reads[reads.length-1];
        if(!c.exists()||!c.data().active||c.data().used>=c.data().maxUses||(c.data().expires&&c.data().expires<new Date().toISOString().slice(0,10))) throw Error('الكوبون غير صالح');
        net=Math.round(accurateTotal*(100-c.data().percent))/100;
        tx.update(couponRef,{used:(c.data().used||0)+1});
      }
      if(net>paid) throw Error('المبلغ أقل من قيمة المنتجات الحالية');
      const items=verified.map((d,i)=>({productId:o.productIds[i],title:d.data().title,type:d.data().type,price:Number(d.data().price||0)}));
      tx.set(claimRef,{orderId:id,studentUid:o.studentUid,method:o.paymentMethod,reference:o.paymentReference,approvedAt:serverTimestamp()});
      tx.update(orderRef,{status:'approved',approvedTotal:net,receivedTotal:paid,discountTotal:accurateTotal-net,items,reviewedBy:currentUser.uid,approvedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      for(const x of items){
        const r=doc(db,'storeEntitlements',`${o.studentUid}_${x.productId}`);
        const media=['summary','exam','evaluation','book'].includes(x.type);
        const storagePath=media?String(verified.find((v,i)=>o.productIds[i]===x.productId)?.data()?.storagePath||''):'';
        tx.set(r,{studentUid:o.studentUid,productId:x.productId,orderId:id,storagePath,active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),approvedBy:currentUser.uid},{merge:true});
      }
    });
    toast('تم اعتماد الطلب وتفعيل المنتجات');
  }catch(err){toast('تعذر اعتماد الطلب: '+(err.code||err.message))}
}

async function openProof(id){
  const o=orders.find(x=>x.id===id);
  if(!o?.proofPath) return;
  try{
    const blob=await getBlob(ref(storage,o.proofPath));
    const url=URL.createObjectURL(blob);
    window.open(url,'_blank','noopener');
    setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(err){toast('تعذر فتح الإثبات: '+(err.code||err.message))}
}

async function rejectOrder(id){
  const note=prompt('سبب رفض الطلب (سيظهر للطالب):');
  if(note===null) return;
  try{
    await updateDoc(doc(db,'storeOrders',id),{status:'rejected',adminNote:note.slice(0,300),reviewedBy:currentUser.uid,updatedAt:serverTimestamp()});
    toast('تم رفض الطلب');
  }catch(err){toast('تعذر رفض الطلب: '+(err.code||err.message))}
}

function renderDrafts(){
  const ds=drafts.filter(d=>d.status==='pending');
  $('#draftsList').innerHTML=ds.length?ds.map(d=>`<div class="item"><h3>${esc(d.title)}</h3><p>الكورس: ${esc(products.find(p=>p.id===d.courseId)?.title||d.courseId)}</p><p>المعلم: ${esc(d.teacherUid)}</p><p class="muted">${esc(d.description||'')}</p><div class="actions"><button class="primary" data-publish-draft="${esc(d.id)}">إضافة الدرس للكورس</button><button class="secondary" data-reject-draft="${esc(d.id)}">رفض المسودة</button></div></div>`).join(''):'<div class="empty">لا توجد مسودات بانتظار المراجعة.</div>';
}

async function reviewDraft(id,approve){
  const d=drafts.find(x=>x.id===id);
  if(!d||d.status!=='pending') return;
  if(!confirm(approve?'هل تريد نشر هذا الدرس داخل الكورس؟':'رفض المسودة؟')) return;
  try{
    await runTransaction(db,async tx=>{
      const refDraft=doc(db,'storeTeacherDrafts',id);
      const snap=await tx.get(refDraft);
      if(!snap.exists()||snap.data().status!=='pending') throw Error('تمت مراجعة المسودة');
      const data=snap.data();
      if(approve){
        const lessonRef=doc(collection(db,'storeProducts',data.courseId,'lessons'));
        tx.set(lessonRef,{title:data.title,description:data.description||'',videoUrl:data.videoUrl||'',position:Number(data.position||1),freePreview:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),fromDraft:id});
      }
      tx.update(refDraft,{status:approve?'approved':'rejected',reviewedBy:currentUser.uid,reviewedAt:serverTimestamp()});
    });
    toast('تمت مراجعة المسودة');
  }catch(err){toast('فشل: '+(err.code||err.message))}
}

function renderCoupons(){
  $('#couponList').innerHTML=coupons.length?coupons.map(c=>`<div class="item"><b>${esc(c.id)}</b> — ${esc(c.percent)}%<div class="small muted">الاستخدام: ${esc(c.used||0)}/${esc(c.maxUses)}</div><button class="secondary" data-toggle-coupon="${esc(c.id)}">${c.active?'تعطيل':'تفعيل'}</button></div>`).join(''):'<div class="empty">لا توجد كوبونات.</div>';
}

async function saveCoupon(e){
  e.preventDefault();
  const code=$('#cCode').value.trim().toUpperCase();
  if(!/^[A-Z0-9_-]{4,32}$/.test(code)) return toast('رمز غير صالح');
  const percent=Number($('#cPercent').value),maxUses=Number($('#cLimit').value);
  if(!Number.isInteger(percent)||percent<1||percent>90||!Number.isInteger(maxUses)||maxUses<1) return toast('نسبة الخصم أو الحد غير صحيح');
  try{
    const r=doc(db,'storeCoupons',code), old=await getDoc(r);
    await setDoc(r,{percent,maxUses,expires:$('#cExpires').value||'',used:old.data()?.used||0,active:true,updatedAt:serverTimestamp()},{merge:true});
    toast('تم حفظ الكوبون');
  }catch(err){toast('تعذر حفظ الكوبون: '+(err.code||err.message))}
}

function renderReports(){
  const list=orders.filter(o=>o.status==='approved');
  const totals={revenue:list.reduce((n,o)=>n+Number(o.approvedTotal||0),0),orders:list.length,products:products.length,students:new Set(list.map(o=>o.studentUid)).size};
  $('#reportSummary').innerHTML=[['إيرادات معتمدة',fmt(totals.revenue)],['طلبات معتمدة',totals.orders],['إجمالي المنتجات',totals.products],['عملاء مشترون',totals.students]].map(([label,value])=>`<div class="stat"><span class="muted">${label}</span><strong>${esc(value)}</strong></div>`).join('');
}

async function loadLessons(){
  if(!$('#lessonProduct')) return;
  const selected=$('#lessonProduct').value;
  const courseProducts=products.filter(x=>x.type==='course'&&x.published!==false);
  $('#lessonProduct').innerHTML=courseProducts.length?courseProducts.map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join(''):'<option value="">لا توجد كورسات حالية</option>';
  if(selected&&courseProducts.some(x=>x.id===selected)) $('#lessonProduct').value=selected;
  const id=$('#lessonProduct').value;
  if(!id){$('#lessonsList').innerHTML='<div class="empty">لا توجد كورسات لإدارة دروسها حاليًا.</div>'; return}
  try{
    const snap=await getDocs(collection(db,'storeProducts',id,'lessons'));
    const items=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.position||0)-(b.position||0));
    $('#lessonsList').innerHTML=items.length?items.map(x=>`<div class="item"><b>${esc(x.position)}. ${esc(x.title)}</b><div class="muted small">خاص بالمشتركين</div><div class="actions"><button class="secondary" data-edit-lesson="${esc(x.id)}" data-course="${esc(id)}">تعديل</button><button class="secondary" data-delete-lesson="${esc(x.id)}" data-course="${esc(id)}">حذف</button></div></div>`).join(''):'<div class="empty">لا توجد دروس لهذا الكورس.</div>';
  }catch(e){$('#lessonsList').textContent='تعذر تحميل الدروس: '+(e.code||e.message)}
}

async function saveLesson(e){
  e.preventDefault();
  const course=$('#lessonProduct').value;
  const id=$('#lessonId').value;
  if(!course) return toast('اختر كورسًا');
  if(!id) return toast('اختر درسًا موجودًا من القائمة أولًا');
  const data={title:$('#lessonTitle').value.trim(),position:Number($('#lessonPosition').value),description:$('#lessonDesc').value.trim(),videoUrl:$('#lessonVideo').value.trim(),freePreview:false,updatedAt:serverTimestamp()};
  if(data.videoUrl && !isValidUrl(data.videoUrl)) return toast('رابط الفيديو لازم يكون HTTPS');
  try{await setDoc(doc(db,'storeProducts',course,'lessons',id),data,{merge:true}); clearLesson(); await loadLessons(); toast('تم حفظ التعديل')}catch(err){toast('تعذر حفظ الدرس: '+(err.code||err.message))}
}

function clearLesson(){
  $('#lessonEditorTitle').textContent='اختر درسًا لتعديله';
  $('#lessonId').value=''; $('#lessonTitle').value=''; $('#lessonDesc').value=''; $('#lessonVideo').value=''; $('#lessonPosition').value='1';
}

async function editLesson(id,course){
  const s=await getDoc(doc(db,'storeProducts',course,'lessons',id));
  if(!s.exists()) return;
  const l=s.data();
  $('#lessonEditorTitle').textContent='تعديل الدرس: '+(l.title||'');
  $('#lessonId').value=id; $('#lessonTitle').value=l.title||''; $('#lessonPosition').value=l.position||1; $('#lessonDesc').value=l.description||''; $('#lessonVideo').value=l.videoUrl||'';
}

async function toggleProductVisibility(id){
  const p=products.find(x=>x.id===id);
  if(!p) return;
  try{await setDoc(doc(db,'storeProducts',id),{published:p.published===false?true:false,deleted:false,updatedAt:serverTimestamp(),updatedBy:currentUser.uid},{merge:true});await setDoc(doc(db,'storePublicProducts',id),{published:p.published===false?true:false,deleted:false,updatedAt:serverTimestamp()},{merge:true})}catch(e){toast(e.message)}
}

async function deleteProductSoft(id){
  const p=products.find(x=>x.id===id);
  if(!p) return;
  if(!confirm('سيتم حذف المنتج من عرض المتجر. هل تريد المتابعة؟')) return;
  try{await setDoc(doc(db,'storeProducts',id),{deleted:true,published:false,updatedAt:serverTimestamp(),updatedBy:currentUser.uid},{merge:true});await setDoc(doc(db,'storePublicProducts',id),{deleted:true,published:false,updatedAt:serverTimestamp()},{merge:true}); if(currentProductId===id) resetProduct(); toast('تم حذف المنتج من المتجر')}catch(e){toast(e.message)}
}

async function handler(e){
  const b=e.target.closest('button');
  if(!b) return;
  if(b.dataset.tab) return tab(b.dataset.tab);
  if(b.dataset.editProduct) return editProduct(b.dataset.editProduct);
  if(b.dataset.toggleProduct) return toggleProductVisibility(b.dataset.toggleProduct);
  if(b.dataset.deleteProduct) return deleteProductSoft(b.dataset.deleteProduct);
  if(b.dataset.toggleCoupon){const c=coupons.find(x=>x.id===b.dataset.toggleCoupon); if(c) try{await updateDoc(doc(db,'storeCoupons',c.id),{active:!c.active})}catch(e){toast(e.message)}; return}
  if(b.dataset.publishDraft) return reviewDraft(b.dataset.publishDraft,true);
  if(b.dataset.rejectDraft) return reviewDraft(b.dataset.rejectDraft,false);
  if(b.dataset.proof) return openProof(b.dataset.proof);
  if(b.dataset.approve) return approveOrder(b.dataset.approve);
  if(b.dataset.reject) return rejectOrder(b.dataset.reject);
  if(b.dataset.receipt){const o=orders.find(x=>x.id===b.dataset.receipt); if(o) printReceipt(o); return}
  if(b.dataset.editLesson) return editLesson(b.dataset.editLesson,b.dataset.course);
  if(b.dataset.deleteLesson){if(!confirm('حذف الدرس نهائيًا؟')) return; try{await deleteDoc(doc(db,'storeProducts',b.dataset.course,'lessons',b.dataset.deleteLesson)); clearLesson(); loadLessons()}catch(e){toast(e.message)}; return}
  if(b.id==='resetProductBtn') return resetProduct();
  if(b.id==='hideProductBtn'){if(!currentProductId) return toast('اختر منتجًا أولًا'); return toggleProductVisibility(currentProductId)}
  if(b.id==='deleteProductBtn'){if(!currentProductId) return toast('اختر منتجًا أولًا'); return deleteProductSoft(currentProductId)}
}

document.addEventListener('click',handler);
$('#productForm').addEventListener('submit',saveProduct);
$('#productSearch').addEventListener('input',renderProducts);
$('#orderSearch').addEventListener('input',renderOrders);
$('#orderStatus').addEventListener('change',renderOrders);
$('#couponForm').addEventListener('submit',saveCoupon);
$('#settingsForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{await setDoc(doc(db,'storeSettings','main'),{vodafonePhone:$('#sVodafone').value.trim(),instapayAddress:$('#sInstapay').value.trim(),whatsapp:$('#sWhatsapp').value.trim(),updatedAt:serverTimestamp()},{merge:true}); toast('تم حفظ وسائل الدفع')}catch(err){toast('تعذر الحفظ: '+(err.code||err.message))}
});
$('#lessonForm').addEventListener('submit',saveLesson);
$('#clearLesson').addEventListener('click',clearLesson);
$('#lessonProduct').addEventListener('change',()=>{clearLesson(); loadLessons()});

async function boot(){
  currentUser=await session();
  const ok=await adminCheck(currentUser);
  if(!ok){$('#gate').classList.add('error'); $('#gate').innerHTML='هذه الصفحة للأدمن فقط. ادخل بحساب إدارة زاد المعرفة ثم أعد فتح الرابط.'; return}
  $('#gate').classList.add('hidden');
  $('#adminMain').classList.remove('hidden');
  unsubscribe.push(onSnapshot(doc(db,'storeSettings','main'),s=>{const d={...defaultSettings,...(s.data()||{})}; $('#sVodafone').value=d.vodafonePhone||''; $('#sInstapay').value=d.instapayAddress||''; $('#sWhatsapp').value=d.whatsapp||''},e=>toast('تعذر تحميل إعدادات الدفع: '+e.code)));
  unsubscribe.push(onSnapshot(collection(db,'storeProducts'),s=>{rawStoreDocs=s.docs.map(d=>({id:d.id,...d.data()})); updateProducts()},e=>toast('خطأ تحميل المنتجات: '+e.code)));
  unsubscribe.push(onSnapshot(collection(db,'storeCoupons'),s=>{coupons=s.docs.map(d=>({id:d.id,...d.data()})); renderCoupons()},e=>toast('تعذر جلب الكوبونات: '+e.code)));
  unsubscribe.push(onSnapshot(collection(db,'storeTeacherDrafts'),s=>{drafts=s.docs.map(d=>({id:d.id,...d.data()})); renderDrafts()},e=>toast('خطأ تحميل مسودات المعلمين: '+e.code)));
  unsubscribe.push(onSnapshot(collection(db,'storeOrders'),s=>{orders=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)); renderOrders(); renderStats(); renderReports()},e=>toast('خطأ تحميل الطلبات: '+e.code)));
  tab('overview');
}

boot();
