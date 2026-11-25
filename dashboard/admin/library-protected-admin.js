import {auth,db,ADMIN_EMAIL} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,getDocs,query,limit,orderBy,documentId,startAfter} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {isLibraryOwner} from '../../assets/library-migration-core.mjs';
import {assertLibraryFileOwner,uploadLibraryPdf} from '../../assets/library-migration-storage.js';

const $=id=>document.getElementById(id),status=$('status'),button=$('submit'),form=$('uploadForm');
let ownerUid='',generation=0,busy=false,cursor=null,loaded=new Map();
const say=message=>{status.textContent=message;};
const more=document.createElement('button');more.type='button';more.textContent='تحميل المزيد من الكتب';more.hidden=true;
$('list').after(more);
const migration=document.createElement('p'),migrationLink=document.createElement('a');
migrationLink.href='library-migration.html';migrationLink.textContent='تنظيم وتصنيف الكتب القديمة وربطها بالملفات المحمية';
migration.append(migrationLink);document.querySelector('main h1').after(migration);
function owner(token=generation){
  if(token!==generation||!ownerUid)throw new Error('تغيّر الحساب. أعد فتح الصفحة.');
  return assertLibraryFileOwner(ownerUid);
}
function lock(value){
  busy=value;button.disabled=value||!ownerUid;$('refresh').disabled=value||!ownerUid;more.disabled=value||!ownerUid;
  for(const input of form.querySelectorAll('input'))input.disabled=value||!ownerUid;
}
function friendly(error){
  return String(error?.code||'').includes('permission-denied')
    ? 'رُفضت الصلاحية. هذه الأداة للمالك ذي البريد الموثّق وفق سياسة Storage الحالية. راجع القواعد المنشورة إن استمر الرفض.'
    : error?.message||'تعذر إكمال العملية. حاول مرة أخرى.';
}
function buildBookLink(id,title){return new URL('../../sections/book-access.html?'+new URLSearchParams({id,title}),import.meta.url).href;}
function render(){
  const list=$('list');list.replaceChildren();
  if(!loaded.size){list.textContent='لا توجد ملفات محمية بعد.';return;}
  for(const item of [...loaded.values()].sort((a,b)=>String(a.title).localeCompare(String(b.title),'ar'))){
    const box=document.createElement('div');box.className='item';
    const strong=document.createElement('strong');strong.textContent=item.title||'بدون عنوان';box.append(strong);
    if(item.published!==true){const note=document.createElement('p');note.textContent='هذا الكتاب غير منشور للطلاب.';box.append(note);}
    const code=document.createElement('code'),url=buildBookLink(item.id,item.title||'');code.textContent=url;box.append(code);
    const row=document.createElement('div');row.className='row';
    const open=document.createElement('a');open.href=url;open.target='_blank';open.rel='noopener';open.textContent='فتح صفحة القراءة';
    const copy=document.createElement('button');copy.type='button';copy.textContent='نسخ رابط الكتاب';
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url);copy.textContent='تم النسخ';}catch{say('تعذر النسخ التلقائي. يمكنك نسخ رابط القراءة المكتوب تحت عنوان الكتاب.');}});
    row.append(copy,open);box.append(row);list.append(box);
  }
}
async function load(reset=false){
  const token=generation;owner(token);
  if(reset){cursor=null;loaded.clear();$('list').textContent='جارٍ جلب القائمة…';more.hidden=true;}
  const constraints=[orderBy(documentId()),...(cursor?[startAfter(cursor)]:[]),limit(100)];
  const docs=await getDocs(query(collection(db,'libraryProtectedBooks'),...constraints));owner(token);
  docs.docs.forEach(snapshot=>loaded.set(snapshot.id,{id:snapshot.id,...snapshot.data()}));
  cursor=docs.docs.at(-1)||cursor;more.hidden=docs.size<100;render();
}
async function run(callback){
  if(busy)return;const token=generation;lock(true);
  try{owner(token);await callback(token);}catch(error){if(token===generation)say(friendly(error));}
  finally{if(token===generation)lock(false);}
}
form.addEventListener('submit',event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const data=new FormData(form),title=String(data.get('title')||'').trim(),file=data.get('file');
  run(async token=>{
    const user=owner(token);
    await uploadLibraryPdf({file,title,expectedUid:user.uid,onStatus:message=>{if(token===generation)say(message);}});owner(token);
    form.reset();say('تم رفع وحفظ الكتاب المحمي. استخدم رابط القراءة من القائمة، أو افتح تنظيم المكتبة لربطه بمصدر قديم.');
    await load(true);
  });
});
$('refresh').addEventListener('click',()=>run(()=>load(true)));
more.addEventListener('click',()=>run(()=>load()));
lock(true);
onAuthStateChanged(auth,async user=>{
  const token=++generation;ownerUid='';cursor=null;loaded.clear();form.reset();more.hidden=true;
  $('list').textContent='القائمة متاحة لحساب المالك ذي البريد الموثّق.';lock(true);
  if(!isLibraryOwner(user,ADMIN_EMAIL)){say('سجّل الدخول بحساب المالك ذي البريد الموثّق. صلاحيات الإدارة العامة وحدها لا تمنح حق رفع الملفات المحمية.');return;}
  ownerUid=user.uid;say('تم التحقق من المالك. جاهز لرفع PDF محمي.');
  try{await load(true);}catch(error){if(token===generation)say(friendly(error));}
  finally{if(token===generation)lock(false);}
},()=>{ownerUid='';generation++;loaded.clear();form.reset();lock(true);$('list').replaceChildren();more.hidden=true;say('تعذر التحقق من الحساب. أعد فتح الصفحة وحاول مرة أخرى.');});
