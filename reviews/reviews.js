import {db} from '../firebase-config.js';
import {collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $=id=>document.getElementById(id);let reviews=[],filter='all';
function render(){
 const items=reviews.filter(r=>filter==='all'||r.kind===filter),grid=$('reviewsGrid');grid.replaceChildren();
 if(!items.length){$('reviewMessage').textContent=reviews.length?'لا توجد آراء منشورة في هذا القسم بعد.':'لا توجد آراء منشورة حتى الآن.';return}
 $('reviewMessage').textContent='';
 for(const r of items){
  const el=document.createElement('article');el.className='review-card';
  const top=document.createElement('div');top.className='review-top';
  const category=document.createElement('span');category.className='review-category';category.textContent=r.kind==='teacher'?'تقييم معلم':'تقييم المنصة';
  const stars=document.createElement('div');stars.className='review-stars';const rating=Math.min(5,Math.max(0,Number(r.rating)||0));stars.textContent='★'.repeat(rating)+'☆'.repeat(5-rating);top.append(category,stars);
  const text=document.createElement('p');text.className='review-text';text.textContent=String(r.text||'').trim()?'«'+String(r.text).trim()+'»':'تقييم بالنجوم فقط — لم يكتب الطالب تعليقًا.';if(!String(r.text||'').trim())text.classList.add('rating-only');
  const author=document.createElement('div');author.className='review-author';author.textContent='طالب من أكاديمية زاد المعرفة';
  const meta=document.createElement('div');meta.className='review-meta';meta.textContent=(r.kind==='teacher'?`المعلم: ${r.teacherName||'من معلمي المنصة'}`:'تجربة استخدام المنصة')+(r.weekStart?' • الأسبوع '+r.weekStart:'');
  el.append(top,text,author,meta);grid.append(el)
 }
}
async function load(){
 try{
  const snap=await getDocs(query(collection(db,'publicTestimonials'),where('status','==','published')));
  reviews=snap.docs.map(d=>d.data()).filter(r=>r.kind==='teacher'||r.kind==='platform');
  $('reviewCount').textContent=reviews.length.toLocaleString('ar-EG');
  const scored=reviews.map(r=>Number(r.rating)).filter(x=>x>0&&x<=5);
  $('reviewAverage').textContent=scored.length?(scored.reduce((a,b)=>a+b,0)/scored.length).toFixed(1)+' / 5':'—';render();
 }catch(err){console.error(err);$('reviewCount').textContent='—';$('reviewMessage').textContent='تعذر تحميل الآراء المنشورة. حاول تحديث الصفحة، وتحقق من صلاحيات Firebase.'}
}
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.filter;document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b===btn));render()}));load();
