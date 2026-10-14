import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,deleteDoc,onSnapshot,serverTimestamp,query,orderBy} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const $=id=>document.getElementById(id);
let editId=null,authorized=false;
const CHUNK_SIZE=80000;
async function readCode(id,info){if(!info.chunkCount)return info.code||'';const snap=await getDocs(query(collection(db,'codeExams',id,'chunks'),orderBy('index')));if(snap.size!==info.chunkCount)throw Error('بعض أجزاء الامتحان غير متاحة');return snap.docs.map(d=>d.data().content).join('');}
async function writeCode(id,code,oldCount){const pieces=[];for(let i=0;i<code.length;i+=CHUNK_SIZE)pieces.push(code.slice(i,i+CHUNK_SIZE));if(pieces.length>100)throw Error('الحد الأقصى لحجم الكود 8 ملايين حرف');for(let i=0;i<pieces.length;i++)await setDoc(doc(db,'codeExams',id,'chunks',String(i).padStart(4,'0')),{index:i,content:pieces[i]});for(let i=pieces.length;i<oldCount;i++)await deleteDoc(doc(db,'codeExams',id,'chunks',String(i).padStart(4,'0')));return pieces.length;}

const msg=(t)=>{$('ceStatus').textContent=t};
const vals=()=>({title:$('ceTitle').value.trim(),stage:$('ceStage').value,grade:$('ceGrade').value.trim(),subject:$('ceSubject').value.trim(),code:$('ceCode').value.trim()});
function clear(){editId=null;['ceTitle','ceGrade','ceSubject','ceCode'].forEach(id=>$(id).value='');$('ceStage').value='prep';$('cePreviewBox').hidden=true;$('ceFrame').removeAttribute('srcdoc');msg('جاهز لإضافة امتحان جديد.');}
$('ceReset').onclick=clear;
$('cePreview').onclick=()=>{const {code}=vals();if(!code){msg('الصق كود الامتحان أولًا.');return;} $('ceFrame').srcdoc=code;$('cePreviewBox').hidden=false;msg('هذه معاينة معزولة؛ لا يمكن للكود الوصول إلى بيانات المنصة.');};
async function save(publish){
 if(!authorized){msg('يجب تسجيل الدخول بحساب مسؤول معتمد.');return;}
 const data=vals();if(!data.title||!data.code){msg('اكتب اسم الامتحان والكود.');return;}
 if(data.code.length>8000000){msg('الحد الأقصى 8 ملايين حرف.');return;}
 if(data.code.toLowerCase().includes('<script src=')){msg('للحماية: ضع JavaScript داخل وسم script بدل تحميل ملفات خارجية.');return;}
 const btn=$(publish?'cePublish':'ceSave');btn.disabled=true;
 try{
  const ref=editId?doc(db,'codeExams',editId):doc(collection(db,'codeExams'));
  const old=editId?(await getDoc(ref)).data():null;
  const oldCount=old?.chunkCount||0;
  const count=Math.ceil(data.code.length/CHUNK_SIZE);
  // Hide the exam while chunks are being replaced; publish only after all writes finish.
  const meta={title:data.title,stage:data.stage,grade:data.grade,subject:data.subject,code:'',chunkCount:count,published:false,updatedAt:serverTimestamp()};
  if(old)await updateDoc(ref,meta);
  else await setDoc(ref,{...meta,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});
  editId=ref.id;
  msg('جارٍ حفظ أجزاء الامتحان...');
  await writeCode(ref.id,data.code,oldCount);
  if(publish)await updateDoc(ref,{published:true,updatedAt:serverTimestamp()});
  msg(publish?'تم نشر الامتحان للطلاب ✅':'تم حفظ الامتحان كمسودة ✅');
 }catch(e){msg('تعذر الحفظ، والامتحان غير منشور حتى يكتمل: '+e.message);}
 finally{btn.disabled=false;}
}
$('ceSave').onclick=()=>save(false);$('cePublish').onclick=()=>save(true);
onAuthStateChanged(auth,async user=>{if(!user){msg('يجب تسجيل الدخول كمسؤول.');return;}try{const check=await getDoc(doc(db,'admins',user.uid));authorized=check.exists()||(user.email?.toLowerCase()==='maleksameh121@gmail.com'&&user.emailVerified);if(!authorized){msg('الحساب غير معتمد للإدارة.');return;}onSnapshot(query(collection(db,'codeExams'),orderBy('createdAt','desc')),snap=>{const box=$('ceList');box.replaceChildren();if(snap.empty){box.textContent='لا توجد امتحانات حتى الآن.';return;}snap.docs.forEach(d=>{const x=d.data(),item=document.createElement('div');item.className='ce-item';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=x.title||'بدون عنوان';const sub=document.createElement('small');sub.textContent=[x.grade,x.subject,x.published?'منشور':'مسودة'].filter(Boolean).join(' • ');info.append(name,sub);const buttons=document.createElement('div');buttons.className='ce-actions';const mk=(t,f)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=t;b.onclick=f;buttons.append(b);};mk('تعديل',async()=>{editId=d.id;$('ceTitle').value=x.title||'';$('ceStage').value=x.stage||'general';$('ceGrade').value=x.grade||'';$('ceSubject').value=x.subject||'';msg('جارٍ تحميل الكود...');try{$('ceCode').value=await readCode(d.id,x);document.getElementById('codeExamsManagement').scrollIntoView({behavior:'smooth'});msg('تعديل: '+x.title);}catch(e){msg('تعذر تحميل الكود: '+e.message);}});mk(x.published?'إلغاء النشر':'نشر',async()=>{try{await updateDoc(d.ref,{published:!x.published,updatedAt:serverTimestamp()})}catch(e){msg(e.message)}});mk('فتح',()=>window.open('../../sections/tests/code-exam.html?id='+encodeURIComponent(d.id),'_blank','noopener'));mk('حذف',async()=>{if(!confirm('حذف هذا الامتحان نهائيًا؟'))return;try{const parts=await getDocs(collection(db,'codeExams',d.id,'chunks'));for(const part of parts.docs)await deleteDoc(part.ref);await deleteDoc(d.ref);if(editId===d.id)clear()}catch(e){msg(e.message)}});item.append(info,buttons);box.append(item);});},e=>msg('تعذر قراءة الامتحانات: '+e.message));}catch(e){msg('تعذر التحقق من المسؤول: '+e.message);}});
