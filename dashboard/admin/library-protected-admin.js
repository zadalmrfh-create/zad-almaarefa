import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {doc,collection,getDoc,getDocs,setDoc,query,limit,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {getStorage,ref,uploadBytes,deleteObject} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js';
const $=id=>document.getElementById(id),status=$('status'),button=$('submit');
let canManage=false,user=null;
const say=message=>{status.textContent=message};
function buildBookLink(id,title){return new URL('../../sections/book-access.html?'+new URLSearchParams({id,title}),location.href).href;}
async function authorized(u){
  if(!u)return false;
  const [a,p]=await Promise.all([getDoc(doc(db,'admins',u.uid)),getDoc(doc(db,'users',u.uid))]);
  return a.exists()||p.data()?.role==='admin'||(u.email?.toLowerCase()==='maleksameh121@gmail.com'&&u.emailVerified);
}
async function load(){
  if(!canManage)return;
  const list=$('list');list.textContent='جارٍ جلب القائمة...';
  try{
    const docs=await getDocs(query(collection(db,'libraryProtectedBooks'),limit(100)));
    list.replaceChildren();if(docs.empty){list.textContent='لا توجد ملفات محمية بعد.';return;}
    const items=docs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.title).localeCompare(String(b.title),'ar'));
    for(const item of items){
      const box=document.createElement('div');box.className='item';
      const strong=document.createElement('strong');strong.textContent=item.title||'بدون عنوان';box.append(strong);
      const code=document.createElement('code');const url=buildBookLink(item.id,item.title);code.textContent=url;box.append(code);
      const row=document.createElement('div');row.className='row';
      const open=document.createElement('a');open.href=url;open.target='_blank';open.rel='noopener';open.textContent='فتح صفحة القراءة';
      const copy=document.createElement('button');copy.type='button';copy.textContent='📋 نسخ رابط الكتاب';
      copy.onclick=async()=>{try{await navigator.clipboard.writeText(url);copy.textContent='✅ تم النسخ';}catch{window.prompt('انسخ الرابط:',url)}};
      row.append(copy,open);box.append(row);list.append(box);
    }
  }catch(error){list.textContent='تعذر جلب الملفات: '+(error.code||error.message)}
}
$('uploadForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!canManage||!user){say('الحساب غير مخوّل لإضافة الكتب.');return;}
  const data=new FormData(event.currentTarget),title=String(data.get('title')||'').trim(),file=data.get('file');
  if(title.length<2||title.length>180){say('اكتب عنوانًا من حرفين إلى 180 حرفًا.');return;}
  if(!(file instanceof File)||file.size<1||file.size>30*1024*1024||!file.name.toLowerCase().endsWith('.pdf')){say('اختر ملف PDF سليمًا لا يتجاوز 30 ميجابايت.');return;}
  const head=new Uint8Array(await file.slice(0,5).arrayBuffer());
  if(String.fromCharCode(...head)!=='%PDF-'){say('الملف المختار لا يبدو ملف PDF صحيحًا.');return;}
  button.disabled=true;const bookDoc=doc(collection(db,'libraryProtectedBooks'));
  const storagePath='libraryProtected/'+bookDoc.id+'/content.pdf';let uploaded=false;
  try{
    say('جارٍ رفع الملف إلى Firebase Storage، لا تغلق الصفحة...');
    await uploadBytes(ref(getStorage(),storagePath),file,{contentType:'application/pdf'});uploaded=true;
    await setDoc(bookDoc,{title,storagePath,published:true,createdAt:serverTimestamp(),createdBy:user.uid,updatedAt:serverTimestamp()});
    say('✅ تم الرفع والحفظ بنجاح. انسخ رابط الكتاب من القائمة وأضفه إلى المكتبة.');
    event.currentTarget.reset();await load();
  }catch(error){
    say('فشل الرفع أو الحفظ: '+(error.code||error.message));
    if(uploaded){try{await deleteObject(ref(getStorage(),storagePath));}catch(e){say('فشل حفظ بيانات الكتاب، وقد يحتاج الملف المرفوع لحذف يدوي بواسطة الإدارة: '+storagePath);}}
  }finally{button.disabled=false;}
});
$('refresh').addEventListener('click',load);
onAuthStateChanged(auth,async u=>{
  user=u;canManage=false;button.disabled=true;
  if(!u){say('سجّل الدخول بحساب الإدارة.');return;}
  try{canManage=await authorized(u);if(!canManage){say('هذه الصفحة مخصصة للإدارة فقط.');return;}button.disabled=false;say('جاهز لرفع PDF محمي.');await load();}
  catch(e){say('تعذر التحقق من صلاحيات الإدارة: '+(e.code||e.message));}
});
