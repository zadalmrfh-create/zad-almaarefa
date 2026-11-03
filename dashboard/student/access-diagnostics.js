// فحص قراءة بيانات الطالب بهويته الحقيقية. لا يغير أية سجلات أو صلاحيات.
import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {getPreviewContext} from '../admin-preview-core.js';

const button=document.getElementById('zadCheckStudentRecords');
const box=document.getElementById('zadStudentRecordReport');
let activeUser=null;
const shownError=e=>e?.code||e?.message||'خطأ غير معروف';
function render(lines){if(!box)return;box.hidden=false;box.textContent=lines.join('\n');}
function timeLimit(fn){let clock;return Promise.race([fn(),new Promise((_,reject)=>{clock=setTimeout(()=>reject(new Error('timeout')),15000);})]).finally(()=>clearTimeout(clock));}
async function run(){
 if(!button||!box)return;
 const user=activeUser||auth.currentUser;
 if(!user){render(['❌ لا توجد جلسة طالب مسجلة. أعد تسجيل الدخول.']);return;}
 button.disabled=true;button.textContent='⏳ جارٍ فحص الحساب...';
 try{
  const preview=await getPreviewContext(user,'student');
  if(preview.denied){render(['❌ تم رفض فتح معاينة الحساب.']);return;}
  const targetUid=preview.uid;
  const lines=['🔍 تقرير فحص سجل الحضور والمدفوعات'];
  lines.push('هوية تسجيل الدخول Firebase Auth: '+user.uid);
  lines.push('البريد المسجل في جلسة الدخول: '+(user.email||'غير متاح'));
  if(preview.active){
   lines.push('⚠️ الوضع الحالي: معاينة إدارية تستخدم صلاحيات الأدمن، وليست جلسة الطالب.');
   lines.push('UID الطالب المختار في المعاينة: '+targetUid);
   lines.push('افتح لوحة الطالب بتسجيل دخول الطالب الحقيقي واضغط نفس الزر، ثم قارن UID الحالي بمعرف المعاينة.');
  }else{
   lines.push('✅ الوضع الحالي: جلسة الحساب الحقيقية، الفحص يستخدم صلاحيات هذا الحساب فقط.');
  }
  const checks=await Promise.allSettled([
   timeLimit(()=>getDoc(doc(db,'users',targetUid))),
   timeLimit(()=>getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',targetUid)))),
   timeLimit(()=>getDocs(query(collection(db,'vodafonePayments'),where('studentUid','==',targetUid))))
  ]);
  const [profile,attendance,payments]=checks;
  if(profile.status==='fulfilled'){
   if(!profile.value.exists())lines.push('❌ ملف الطالب users/'+targetUid+' غير موجود؛ يرجى مراجعة حساب الطالب.');
   else{
    const p=profile.value.data();
    lines.push('اسم الحساب في Firestore: '+(p.fullName||p.name||'غير محدد'));
    lines.push('بريد الحساب في Firestore: '+(p.email||'غير محدد'));
    if(!preview.active && p.email && user.email && p.email.trim().toLowerCase()!==user.email.trim().toLowerCase()){
     lines.push('⚠️ البريد في الملف لا يطابق البريد المستخدم لتسجيل الدخول؛ راجع مع الأدمن هوية الحساب الصحيح.');
    }
   }
  }else lines.push('❌ تعذر قراءة ملف الحساب: '+shownError(profile.reason));
  for(const [result,label] of [[attendance,'الحضور والغياب'],[payments,'الدفعات والتحويلات']]){
   if(result.status==='fulfilled')lines.push('✅ قراءة '+label+' نجحت — عدد السجلات: '+result.value.size);
   else {
    lines.push('❌ قراءة '+label+' فشلت — '+shownError(result.reason));
    if(result.reason?.code==='permission-denied'){
     lines.push('مطلوب مراجعة قواعد Firestore المنشورة: السماح للطالب بقراءة السجلات التي تحمل studentUid يساوي UID تسجيل دخوله فقط. رفع ملف rules إلى GitHub وحده لا ينشر قواعد Firebase.');
    }
   }
  }
  if(!preview.active && checks[1].status==='fulfilled' && checks[2].status==='fulfilled' && checks[1].value.empty && checks[2].value.empty){
   lines.push('⚠️ لا يوجد أي سجل مرتبط بهذا UID. لو المعاينة الإدارية بها سجلات، قارن UID في المعاينة بالـ UID الحالي. لو مختلفين، يجب على الإدارة تصحيح ربط السجلات بالحساب الصحيح دون نسخ السجلات لطالب آخر تلقائيًا.');
  }
  lines.push('لا يغير هذا الفحص المدفوعات أو سجلات الطلاب أو صلاحياتهم.');
  render(lines);
 }catch(error){render(['❌ تعذر إجراء الفحص: '+shownError(error)]);}
 finally{button.disabled=false;button.textContent='🔍 فحص ربط حسابي بالسجلات';}
}
button?.addEventListener('click',run);
onAuthStateChanged(auth,user=>{activeUser=user;if(box&&!box.hidden)box.hidden=true;});
