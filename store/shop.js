import {db,$,esc,fmt,types,emoji,toast,session,adminCheck,navActive,printReceipt,dateText} from './common.js';
import {collection,doc,getDoc,getDocs,onSnapshot,query,where,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {getStorage,ref,getBlob,uploadBytes} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js';
import {baseProducts} from './catalog-data.js?v=20261103-seven-files-v2';

const storage=getStorage();
const defaultSettings={vodafonePhone:'01042239704',instapayAddress:'',whatsapp:'01042239704'};
let rawStoreDocs=[];
let products=[];
let cart=[];
let user=null;
let orders=[];
let rights=[];
let productById={};
let coupon=null;

try{cart=JSON.parse(localStorage.getItem('zad-store-cart-v1')||'[]').filter(x=>typeof x==='string').slice(0,80)}catch{}
const saveCart=()=>{try{localStorage.setItem('zad-store-cart-v1',JSON.stringify(cart))}catch{} document.querySelectorAll('#cartCount,.cart-count').forEach(el=>el.textContent=cart.length)};

const typeTiles=[['summary','📝'],['exam','📝'],['evaluation','📋'],['book','📚'],['lesson','👨‍🏫'],['course','🎓']];
const normalize=v=>String(v||'').toLowerCase().normalize('NFKC').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/[َ-ْ]/g,'');
const summary=items=>items.reduce((s,p)=>s+Number(p.price||0),0);
const resolved=()=>cart.map(id=>productById[id]).filter(p=>readyForCheckout(p)&&!p.deleted&&Number(p.price)>=0);
const byNewest=(a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)||Number(b.baseOrder||0)-Number(a.baseOrder||0);

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
  return [...merged,...extras].map(p=>{const {directUrl,previewUrl,downloadUrl,videoUrl,storagePath,...safe}=p; return safe}).filter(x=>!x.deleted&&x.published!==false).sort(byNewest);
}

const paidDigitalTypes=new Set(['summary','exam','evaluation','book']);
function readyForCheckout(p){return Boolean(p&&p.published!==false&&p.deliveryReady===true)}
function secureMedia(p){return paidDigitalTypes.has(p?.type)}
function purchaseControl(p){return readyForCheckout(p)?`<button class="primary" data-add="${esc(p.id)}">أضف إلى السلة</button>`:`<div class="notice pending-file">🔒 ${secureMedia(p)?'المحتوى تحت التجهيز والحماية — غير متاح للشراء الآن':'غير متاح للحجز الآن'}</div>`}

function updateCatalog(){
  products=mergeProducts(rawStoreDocs);
  productById=Object.fromEntries(products.map(p=>[p.id,p]));
  renderHome();
  renderCatalog();
  renderMine();
}

function renderTypeTiles(){
  $('#typeTiles').innerHTML=typeTiles.map(([type,icon])=>`<div class="tile" data-type="${type}"><div class="emoji">${icon}</div><div>${types[type]}</div><div class="muted small">${products.filter(p=>p.type===type).length} منتج</div></div>`).join('');
  $('#quickCounts').innerHTML=[
    ['ملخصات',products.filter(p=>p.type==='summary').length],
    ['امتحانات',products.filter(p=>p.type==='exam').length],
    ['تقييمات',products.filter(p=>p.type==='evaluation').length],
    ['كتب',products.filter(p=>p.type==='book').length]
  ].map(([label,val])=>`<span class="chip">${esc(label)}: ${esc(val)}</span>`).join('');
}

function card(p){
  const ico=p.icon||emoji[p.type]||'📚';
  return `<article class="product product-card">
    <div class="cover">${p.coverUrl?.startsWith('https://')?`<img src="${esc(p.coverUrl)}" alt="غلاف ${esc(p.title)}" loading="lazy">`:ico}</div>
    <div class="row product-flags"><span class="badge">${esc(types[p.type]||p.type)}</span><span class="chip">${esc(p.stage||'')}</span></div>
    <h3>${esc(p.title)}</h3>
    <div class="muted small product-subtitle">${esc(p.subject||'')} ${p.grade?`• ${esc(p.grade)}`:''}</div>
    <p class="muted small product-desc">${esc((p.description||'').slice(0,180))}</p>
    <div class="product-footer">
      <div class="row product-price-row"><strong class="price">${fmt(p.price)}</strong><button class="secondary" data-detail="${esc(p.id)}">التفاصيل</button></div>
      ${purchaseControl(p)}
    </div>
  </article>`;
}

function renderHome(){
  renderTypeTiles();
  const latest=[...products].sort(byNewest).slice(0,8);
  $('#homeProducts').innerHTML=latest.length?latest.map(card).join(''):'<div class="empty">لا توجد منتجات متاحة حاليًا.</div>';
  const evaluations=products.filter(p=>p.type==='evaluation').slice(0,4);
  $('#homeEvaluations').innerHTML=evaluations.length?evaluations.map(card).join(''):'<div class="empty">لا توجد تقييمات متاحة حاليًا.</div>';
}

function renderCatalog(){
  const s=normalize($('#search')?.value),ty=$('#typeFilter')?.value,st=$('#stageFilter')?.value,sort=$('#sortFilter')?.value||'popular';
  let out=products.filter(p=>(!ty||p.type===ty)&&(!st||p.stage===st)&&normalize([p.title,p.description,p.subject,p.teacherName,p.grade,p.stage].join(' ')).includes(s));
  if(sort==='cheap') out.sort((a,b)=>Number(a.price)-Number(b.price));
  else if(sort==='expensive') out.sort((a,b)=>Number(b.price)-Number(a.price));
  else if(sort==='name') out.sort((a,b)=>String(a.title).localeCompare(String(b.title),'ar'));
  else if(sort==='new') out.sort(byNewest);
  else out.sort((a,b)=>Number(b.popular||0)-Number(a.popular||0)||byNewest(a,b));
  $('#catalogCount').textContent=`${out.length} منتج`;
  $('#catalogGrid').innerHTML=out.length?out.map(card).join(''):'<div class="empty">لا توجد منتجات مطابقة للبحث.</div>';
}

function show(view){
  document.querySelectorAll('main>section').forEach(el=>el.classList.toggle('hidden',el.id!==`view-${view}`));
  navActive(view);
  if(view==='catalog') renderCatalog();
  if(view==='cart') renderCart();
  if(view==='mine') renderMine();
  window.scrollTo({top:0,behavior:'instant'});
  location.hash=view;
}

function productDetail(id){
  const p=productById[id];
  if(!p) return toast('المنتج غير متاح');
  const owned=rights.some(r=>r.productId===id&&r.active===true);
  const ico=p.icon||emoji[p.type]||'📚';
  $('#view-product').innerHTML=`
    <button class="secondary" data-back="catalog">← عودة للمنتجات</button>
    <div class="split" style="margin-top:18px">
      <div class="panel">
        <span class="badge">${esc(types[p.type]||p.type)}</span>
        <h1 style="margin:10px 0">${esc(p.title)}</h1>
        <p class="muted">${esc(p.description||'')}</p>
        <div class="product-meta">
          <span class="chip">المادة: ${esc(p.subject||'—')}</span>
          <span class="chip">الصف: ${esc(p.grade||'—')}</span>
          <span class="chip">النظام: ${esc(p.stage||'—')}</span>
        </div>
        ${p.teacherName?`<p>المعلم / المُعِد: <b>${esc(p.teacherName)}</b></p>`:''}
        ${p.type==='lesson'?`<p>المدة: <b>${esc(p.duration||'—')}</b> — المواعيد: <b>${esc(p.schedule||'يتم التنسيق بعد اعتماد الطلب')}</b></p>`:''}
        ${p.type==='course'?`<p class="help">محتويات الكورس ومحاضراته تظهر للمشترك بعد الاعتماد.</p>`:''}
        <h2>محتويات المنتج</h2>
        <p class="muted" style="white-space:pre-line">${esc(p.contents||'لا يوجد وصف إضافي.')}</p>
        ${p.type==='course'?`<h2>دروس الكورس</h2><div id="courseLessons" class="lessons">جاري عرض الدروس...</div>`:''}
      </div>
      <div class="panel sidebox">
        <div class="cover">${p.coverUrl?.startsWith('https://')?`<img src="${esc(p.coverUrl)}" alt="الغلاف">`:ico}</div>
        <h2 class="price">${fmt(p.price)}</h2>
        ${owned?`<div class="notice ok">متاح في مشترياتك</div><button class="primary" data-download="${esc(p.id)}">فتح المنتج</button>`:purchaseControl(p)}
        <p class="hint">بعد اعتماد الدفع يمكنك فتح الكتاب أو الملخص أو الامتحان مباشرة.</p>
      </div>
    </div>`;
  show('product');
  if(p.type==='course') loadCourseLessons(p,owned);
}

async function loadCourseLessons(p,owned){
  const box=$('#courseLessons');
  if(!box) return;
  try{
    const snap=await getDocs(collection(db,'storeProducts',p.id,'lessons'));
    const lessons=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.position||0)-(b.position||0));
    let done=[];
    if(owned&&user){
      try{const x=await getDoc(doc(db,'storeProgress',p.id+'_'+user.uid)); done=x.data()?.completedLessonIds||[]}catch{}
    }
    box.innerHTML=lessons.length?lessons.map(x=>`<div class="lesson"><b>${esc(x.position)}. ${esc(x.title)}</b><p class="muted small">${esc(x.description||'')}</p>${owned&&x.videoUrl?.startsWith('https://')?`<a class="secondary" href="${esc(x.videoUrl)}" target="_blank" rel="noopener noreferrer">مشاهدة الدرس</a>`:'🔒 متاح بعد الاشتراك'}${owned?` <button class="secondary" data-progress-product="${esc(p.id)}" data-progress-lesson="${esc(x.id)}">${done.includes(x.id)?'✓ تمت المشاهدة':'تحديد كمكتمل'}</button>`:''}</div>`).join(''):'<div class="empty">لا توجد دروس منشورة لهذا الكورس بعد.</div>';
  }catch(e){box.innerHTML='<div class="empty">الدروس غير متاحة الآن.</div>'}
}

function renderCart(){
  const items=resolved();
  cart=cart.filter(id=>readyForCheckout(productById[id]));saveCart();
  $('#cartItems').innerHTML=items.length?items.map(p=>`<div class="item row"><div><b>${esc(p.title)}</b><div class="muted small">${esc(types[p.type])} • ${esc(p.grade||'')}</div></div><div><b>${fmt(p.price)}</b> <button class="secondary" data-remove="${esc(p.id)}">حذف</button></div></div>`).join(''):'<div class="empty">السلة فارغة.</div>';
  $('#cartSummary').innerHTML=`<h3>ملخص السلة</h3><p>عدد المنتجات: ${items.length}</p><h2 class="price">${fmt(summary(items))}</h2><button class="primary" id="checkoutBtn" ${!items.length?'disabled':''}>إتمام الطلب</button>`;
}

function renderMine(){
  if(!$('#myOrders')) return;
  if(!user){
    $('#myOrders').innerHTML='<div class="empty">سجّل الدخول بحسابك لعرض الطلبات.</div>';
    $('#myProducts').innerHTML='';
    return;
  }
  $('#myOrders').innerHTML=orders.length?orders.map(o=>`<div class="item"><div class="row"><b>طلب ${esc(o.id.slice(0,10))}</b><span class="badge">${esc({pending:'تحت المراجعة',approved:'معتمد',rejected:'مرفوض'}[o.status]||o.status)}</span></div><div class="muted small">${esc(dateText(o.createdAt))}</div><p>${(o.items||[]).map(x=>esc(x.title)).join(' • ')||esc(o.productIds?.join('، ')||'')}</p>${o.status==='approved'?`<div class="row"><strong>المبلغ المعتمد: ${fmt(o.approvedTotal)}</strong><button class="secondary" data-receipt="${esc(o.id)}">طباعة الإيصال</button></div>`:''}${o.status==='rejected'?`<p class="hint">${esc(o.adminNote||'رفضت الإدارة الطلب')}</p>`:''}</div>`).join(''):'<div class="empty">مفيش طلبات عندك حتى الآن.</div>';
  const owned=rights.filter(r=>r.active).map(r=>productById[r.productId]).filter(Boolean);
  $('#myProducts').innerHTML=owned.length?owned.map(p=>`<div class="product"><div class="cover">${p.coverUrl?.startsWith('https://')?`<img src="${esc(p.coverUrl)}" alt="الغلاف">`:(p.icon||emoji[p.type]||'📚')}</div><b>${esc(p.title)}</b><span class="badge">${esc(types[p.type])}</span><button class="primary" data-download="${esc(p.id)}">${p.type==='course'?'دروس الكورس':'فتح المنتج'}</button></div>`).join(''):'<div class="empty">المنتجات المعتمدة ستظهر هنا بعد مراجعة الطلب.</div>';
}

function checkout(){
  coupon=null;
  $('#couponCode').value='';
  $('#couponInfo').textContent='';
  if(!user){
    $('#checkoutGate').innerHTML='لازم تسجل الدخول بحساب الطالب في الأكاديمية أولًا. <a href="../login.html" class="gold">صفحة تسجيل الدخول</a>';
    $('#checkoutForm').classList.add('hidden');
  }else{
    $('#checkoutGate').textContent=`الحساب الحالي: ${user.email||user.uid} — تأكد أن اسم الطالب مطابق للحساب.`;
    $('#checkoutForm').classList.remove('hidden');
    $('#buyerName').value=user.displayName||'';
  }
  checkoutSummaryOnly();
  show('checkout');
}

function checkoutSummaryOnly(){
  const items=resolved();
  const total=summary(items);
  const afterDiscount=coupon?Math.round(total*(100-coupon.percent))/100:total;
  $('#checkoutSummary').innerHTML=`<h3>ملخص الطلب</h3>${items.map(p=>`<div class="row"><span>${esc(p.title)}</span><b>${fmt(p.price)}</b></div>`).join('')}<hr><h2 class="price">السعر التقديري: ${fmt(afterDiscount)}</h2><p class="hint">السعر النهائي تؤكده الإدارة بعد التحقق من الكوبون والتحويل.</p>`;
}

async function placeOrder(e){
  e.preventDefault();
  if(!user) return toast('سجّل الدخول أولًا');
  const items=resolved();
  if(items.length!==cart.length||!items.length) return toast('بعض المنتجات لم تعد متاحة، حدّث السلة');
  const btn=$('#placeOrder');
  btn.disabled=true;
  try{
    const orderRef=doc(collection(db,'storeOrders'));
    const file=$('#paymentProof').files[0];
    let proofPath='';
    if(file){
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024) throw Error('صورة إثبات التحويل يجب أن تكون JPG/PNG/WebP وأقل من 8 ميجابايت');
      proofPath=`storeProofs/${user.uid}/${orderRef.id}`;
      await uploadBytes(ref(storage,proofPath),file,{contentType:file.type});
    }
    const data={
      studentUid:user.uid,
      buyerEmail:user.email||'',
      buyerName:$('#buyerName').value.trim(),
      productIds:items.map(x=>x.id),
      paymentMethod:$('#paymentMethod').value,
      senderPhone:$('#senderPhone').value.trim(),
      paymentReference:$('#paymentReference').value.trim(),
      note:$('#orderNote').value.trim(),
      couponCode:coupon?.code||'',
      proofPath,
      status:'pending',
      createdAt:serverTimestamp()
    };
    await setDoc(orderRef,data);
    cart=[];
    saveCart();
    toast('تم تسجيل الطلب للمراجعة.');
    show('mine');
  }catch(err){
    toast('تعذر حفظ الطلب: '+(err.code||err.message));
  }finally{btn.disabled=false}
}

async function markDone(productId,lessonId){
  if(!user||!rights.some(r=>r.productId===productId&&r.active)) return toast('يلزم الاشتراك');
  try{
    const r=doc(db,'storeProgress',productId+'_'+user.uid);
    const before=await getDoc(r);
    const done=new Set(before.data()?.completedLessonIds||[]);
    if(done.has(lessonId)) done.delete(lessonId); else done.add(lessonId);
    await setDoc(r,{studentUid:user.uid,productId,completedLessonIds:[...done],updatedAt:serverTimestamp()});
    loadCourseLessons(productById[productId],true);
    toast('تم تحديث تقدمك');
  }catch(err){toast('تعذر حفظ التقدم: '+(err.code||err.message))}
}

async function openProduct(id){
  if(!user)return toast('سجّل الدخول أولًا');
  const p=productById[id];
  if(!p)return toast('المنتج غير متاح');
  const entitlement=rights.find(r=>r.productId===id&&r.active===true&&r.studentUid===user.uid);
  if(!entitlement)return toast('🔒 يجب اعتماد الدفع أولًا');
  if(p.type==='course')return productDetail(id);
  if(p.type==='lesson')return toast('تواصل مع الإدارة لتأكيد موعد الحصة');
  if(!secureMedia(p))return toast('هذا المنتج ليس ملفًا رقميًا');

  // User interaction opens a placeholder tab immediately; Firestore enforces the
  // authorization separately, even if a user manipulates browser JavaScript.
  const path=String(entitlement.storagePath||'');
  if(path.startsWith(`storeProtected/${id}/`)){
    try{
      toast('جاري تجهيز ملفك المحمي...');
      const blob=await getBlob(ref(storage,path));
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;
      link.download=(p.title||'zad-product').replace(/[\\/:*?"<>|]/g,'_')+'.pdf';
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(err){toast('تعذر فتح الملف، تحقق من اعتماد الطلب وقواعد Storage: '+(err.code||err.message))}
    return;
  }

  const popup=window.open('about:blank','_blank');
  if(popup){try{popup.opener=null;popup.document.title='زاد المعرفة - جاري التحقق';popup.document.body.textContent='جارِ التحقق من اعتماد عملية الشراء...'}catch{}}
  try{
    // storeProductLinks/{id} is not listable by students. Firestore rules permit
    // a direct get only when active storeEntitlements/{uid}_{id} exists.
    const snap=await getDoc(doc(db,'storeProductLinks',id));
    const url=String(snap.data()?.url||'');
    const parsed=new URL(url);
    if(!snap.exists()||parsed.protocol!=='https:')throw Error('لا يوجد رابط تسليم صالح');
    if(popup&&!popup.closed){popup.location.replace(parsed.href)}
    else{
      // Only rendered after a successful authenticated Firestore get.
      const el=$('#view-product');
      const a=document.createElement('a');
      a.href=parsed.href; a.target='_blank';a.rel='noopener noreferrer';a.className='primary';
      a.textContent='اضغط هنا لفتح المنتج الذي تم اعتماده';
      el.prepend(a);
      toast('تم التحقق من الشراء؛ اضغط على الرابط الجديد');
    }
  }catch(err){
    if(popup&&!popup.closed)popup.close();
    toast('لم يتم تسليم رابط المنتج. تأكد من نشر قواعد Firestore واعتماد الطلب: '+(err.code||err.message));
  }
}

function syncUser(){
  if(!user){orders=[];rights=[];renderMine();return}
  const q1=query(collection(db,'storeOrders'),where('studentUid','==',user.uid));
  const q2=query(collection(db,'storeEntitlements'),where('studentUid','==',user.uid));
  onSnapshot(q1,s=>{orders=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));renderMine()},e=>toast('تعذر قراءة الطلبات: '+e.code));
  onSnapshot(q2,s=>{rights=s.docs.map(d=>({id:d.id,...d.data()}));renderMine()},e=>toast('تعذر قراءة المشتريات: '+e.code));
}

async function applyCoupon(){
  const code=$('#couponCode').value.trim().toUpperCase();
  coupon=null;
  if(!code){$('#couponInfo').textContent='';return checkoutSummaryOnly()}
  if(!/^[A-Z0-9_-]{4,32}$/.test(code)) return toast('الكود غير صحيح');
  try{
    const x=await getDoc(doc(db,'storeCoupons',code));
    const d=x.data();
    if(!x.exists()||!d.active||d.used>=d.maxUses||(d.expires&&d.expires<new Date().toISOString().slice(0,10))) throw Error('الكوبون غير متاح');
    coupon={code,percent:d.percent};
    $('#couponInfo').textContent=`خصم ${d.percent}% — سيُراجع مع الطلب`;
    checkoutSummaryOnly();
  }catch(e){$('#couponInfo').textContent='كوبون غير صالح'; checkoutSummaryOnly()}
}

function actions(e){
  const a=e.target.closest('button,[data-type]');
  if(!a) return;
  if(a.dataset.view) return show(a.dataset.view);
  if(a.dataset.go) return show(a.dataset.go);
  if(a.dataset.type){$('#typeFilter').value=a.dataset.type; return show('catalog')}
  if(a.dataset.add){
    const id=a.dataset.add;
    if(!readyForCheckout(productById[id]))return toast('هذا المنتج غير جاهز للبيع بعد');
    if(!cart.includes(id)) cart.push(id);
    saveCart();
    return toast('تمت الإضافة للسلة');
  }
  if(a.dataset.remove){cart=cart.filter(x=>x!==a.dataset.remove);saveCart();return renderCart()}
  if(a.dataset.detail) return productDetail(a.dataset.detail);
  if(a.dataset.back) return show(a.dataset.back);
  if(a.id==='checkoutBtn') return checkout();
  if(a.id==='applyCoupon') return applyCoupon();
  if(a.dataset.progressProduct) return markDone(a.dataset.progressProduct,a.dataset.progressLesson);
  if(a.dataset.download) return openProduct(a.dataset.download);
  if(a.dataset.receipt){const o=orders.find(x=>x.id===a.dataset.receipt); if(o&&o.status==='approved') printReceipt(o)}
}

document.addEventListener('click',actions);
['search','typeFilter','stageFilter','sortFilter'].forEach(id=>$('#'+id)?.addEventListener('input',renderCatalog));
$('#checkoutForm').addEventListener('submit',placeOrder);
saveCart();

async function start(){
  user=await session();
  $('#accountState').textContent=user?`أهلًا ${user.displayName||user.email||'بالطالب'}`:'تصفح بحرية — سجّل الدخول للشراء';
  if(await adminCheck(user)) $('#adminLink').classList.remove('hidden');
  onSnapshot(doc(db,'storeSettings','main'),s=>{
    const d={...defaultSettings,...(s.data()||{})};
    const parts=[];
    if(d.vodafonePhone) parts.push(`فودافون كاش: ${esc(d.vodafonePhone)}`);
    if(d.instapayAddress) parts.push(`إنستاباي: ${esc(d.instapayAddress)}`);
    if(d.whatsapp) parts.push(`واتساب الدعم: ${esc(d.whatsapp)}`);
    $('#paymentInstructions').textContent=parts.join(' • ')||`فودافون كاش: ${defaultSettings.vodafonePhone}`;
  },()=>{$('#paymentInstructions').textContent=`فودافون كاش: ${defaultSettings.vodafonePhone}`});
  onSnapshot(collection(db,'storePublicProducts'),s=>{rawStoreDocs=s.docs.map(d=>({id:d.id,...d.data()})); updateCatalog()},e=>{rawStoreDocs=[]; updateCatalog(); toast('تعذر قراءة تعديلات المتجر، تم عرض المنتجات الافتراضية')});
  syncUser();
  show(['catalog','cart','mine'].includes(location.hash.slice(1))?location.hash.slice(1):'home');
}

start();
