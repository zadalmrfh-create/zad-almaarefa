// Admin-initiated profile creation only. Does not create authentication identities.
import {auth,db} from '../../firebase-config.js';
import {doc,getDoc,collection,query,where,getDocs,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
const button=document.getElementById('createSaadTeacherProfile');
const status=document.getElementById('saadTeacherAdminStatus');
function say(message){if(status)status.textContent=message;}
button?.addEventListener('click',async()=>{
 if(!auth.currentUser){say('يجب دخول حساب الإدارة أولًا.');return;}
 button.disabled=true;
 try{
  const exact=doc(db,'teachers','zad-saad-alaa');
  const existing=await getDoc(exact);
  if(existing.exists()){say('✅ ملف سعد علاء موجود بالفعل. افتح «إدارة محتوى المنصة ← طاقم التدريس» لتعديله.');return;}
  const similar=await getDocs(query(collection(db,'teachers'),where('name','in',['الأستاذ سعد علاء','سعد علاء'])));
  if(!similar.empty){say('✅ يوجد ملف بالاسم نفسه بالفعل؛ لن ننشئ ملفًا مكررًا. افتح إدارة المحتوى لتعديله.');return;}
  await setDoc(exact,{
   name:'الأستاذ سعد علاء',legacyKey:'zad-saad-alaa',
   role:'مدرس علوم وكيمياء ورياضيات',
   subject:'الرياضيات, العلوم, الكيمياء',
   stages:'',image:'../images/saad-alaa-poster.png',
   bookingSection:'العلوم',bookingSubject:'الرياضيات',
   bio:'طالب بكلية التربية بجامعة الأزهر بالقاهرة. يقدّم شرحًا مبسطًا للعلوم والكيمياء والرياضيات مع مراعاة الفروق الفردية.',
   visible:true,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid
  });
  say('✅ تمت إضافة ملف سعد علاء إلى إدارة طاقم التدريس. لإنشاء صلاحية المعلم، اعتمد حسابه الحقيقي من إدارة المستخدمين.');
 }catch(error){say('تعذرت إضافة الملف: '+(error.code||error.message||'خطأ غير معروف'));console.error(error);}
 finally{button.disabled=false;}
});
