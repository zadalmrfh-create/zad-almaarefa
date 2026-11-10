// Saad Alaa: public teaching card is independent of Authentication.
// This admin-only module checks the real teacher account and offers an explicit,
// name-verified one-time link for older booking/attendance documents without UID.
import {auth, db} from '../../firebase-config.js';
import {isAdminAccount} from '../admin-preview-core.js';
import {doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, serverTimestamp, writeBatch} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const createButton = $('createSaadTeacherProfile');
const status = $('saadTeacherAdminStatus');
const inspectButton = $('saadAdminInspect');
const linkButton = $('saadAdminLink');
const info = $('saadAdminAccountInfo');
const say = message => {if(status)status.textContent=message;};
const note = message => {if(info)info.textContent=message;};
const normalize = v => String(v||'').normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا')
  .replace(/ة/g,'ه').replace(/ى/g,'ي')
  .replace(/^(الاستاذ|استاذ|ا\s*\/|مستر)\s*/,'')
  .replace(/\s+/g,' ').trim().toLowerCase();
const isSaad = v => normalize(v)==='سعد علاء';
const candidateNames = ['سعد علاء','الأستاذ سعد علاء','أ/ سعد علاء'];
let inspected = null;

async function ensureAdmin(){
  if(!auth.currentUser)throw Error('سجل الدخول بحساب الإدارة أولًا.');
  if(!(await isAdminAccount(auth.currentUser)))throw Error('هذه العملية متاحة للإدارة فقط.');
}

createButton?.addEventListener('click',async()=>{
  createButton.disabled=true;
  try{
    await ensureAdmin();
    const exact=doc(db,'teachers','zad-saad-alaa');
    const current=await getDoc(exact);
    if(current.exists()){
      await updateDoc(exact,{visible:true,bookingSection:'الرياضيات',bookingSubject:'الرياضيات'});
      say('✅ ملف سعد موجود بالفعل. تم تأكيد إظهاره وتوجيهه إلى قسم الرياضيات. ظهور الملف لا يعني أن حساب دخوله نشط.');
      return;
    }
    const similar=await getDocs(query(collection(db,'teachers'),where('name','in',['الأستاذ سعد علاء','سعد علاء'])));
    if(!similar.empty){
      await updateDoc(similar.docs[0].ref,{visible:true,bookingSection:'الرياضيات',bookingSubject:'الرياضيات'});
      say('✅ تم تحديث الملف الموجود وإظهاره وربطه بقسم الرياضيات، بدون إنشاء نسخة مكررة.');return;
    }
    await setDoc(exact,{
      name:'الأستاذ سعد علاء',legacyKey:'zad-saad-alaa',role:'مدرس الرياضيات والعلوم والكيمياء',
      subject:'الرياضيات, العلوم, الكيمياء',stages:'',image:'../images/saad-alaa-poster.png',
      bookingSection:'الرياضيات',bookingSubject:'الرياضيات',
      bio:'طالب بكلية التربية بجامعة الأزهر بالقاهرة. يشرح الرياضيات والعلوم والكيمياء بأسلوب مبسط.',
      visible:true,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid
    });
    say('✅ تم إنشاء الملف التعريفي لسعد. افحص حساب دخوله من الزر الموجود أدناه.');
  }catch(error){console.error('[saad-profile]',error);say('❌ '+(error.code||error.message||'تعذر حفظ الملف'));}
  finally{createButton.disabled=false;}
});

async function inspectSaad(){
  inspected=null;
  if(linkButton)linkButton.disabled=true;
  inspectButton.disabled=true;
  try{
    await ensureAdmin();
    note('جارٍ فحص حساب المعلم النشط...');
    // Only registered, active teacher accounts can be the UID target.
    const accounts=await getDocs(query(collection(db,'users'),where('role','==','teacher')));
    const matches=accounts.docs.filter(d=>{
      const data=d.data();
      return [data.fullName,data.name,data.displayName,...(Array.isArray(data.attendanceAliases)?data.attendanceAliases:[])]
        .some(isSaad);
    });
    const active=matches.filter(d=>d.data().status==='active');
    if(!matches.length){
      note('⚠️ لا يوجد حساب معلم مسجل باسم سعد علاء. أضف ملفه التعريفي إن أردت ظهوره في المحتوى، لكن اربط الحساب فقط بعد أن يسجل سعد ويعتمده الأدمن.');
      return;
    }
    if(active.length!==1 || matches.length!==1){
      note('⚠️ '+(active.length===0?'حساب سعد موجود لكنه لم يُعتمد بعد.':'توجد حسابات محتملة متعددة باسم سعد. افتح إدارة المستخدمين، تحقّق من الهوية وأزل التكرار أولًا.')+' لن يتم أي ربط تلقائي.');
      return;
    }
    const uid=active[0].id;
    // Fetch only matching names; do not scan every student's private records.
    note('✅ تم العثور على حساب واحد نشط. جارٍ فحص الحجوزات والحضور المكتوب عليهما اسم سعد...');
    const [bookings,attendance]=await Promise.all([
      getDocs(query(collection(db,'bookings'),where('teacherName','in',candidateNames))),
      getDocs(query(collection(db,'lessonAttendance'),where('teacherName','in',candidateNames)))
    ]);
    const pending=[];
    let linked=0,conflicts=0;
    for(const [origin,snap] of [['حجز',bookings],['حضور',attendance]]){
      for(const d of snap.docs){
        const data=d.data();
        if(!isSaad(data.teacherName)||data.deleted===true||data.archived===true)continue;
        const present=String(data.teacherUid||'').trim();
        if(present===uid){linked++;continue;}
        if(present){conflicts++;continue;} // Never overwrite a different instructor.
        pending.push({ref:d.ref,origin});
      }
    }
    inspected={uid,pending};
    note(`✅ حساب سعد معتمد ومطابق. سجلات مربوطة بالفعل: ${linked}، تحتاج ربط UID: ${pending.length}، سجلات متعارضة لم تُمس: ${conflicts}. ${pending.length?'اضغط «ربط السجلات» بعد مراجعة الاسم.':'لا يوجد ربط قديم ناقص.'}`);
    if(linkButton)linkButton.disabled=pending.length===0;
  }catch(error){console.error('[saad-inspect]',error);note('❌ فشل الفحص: '+(error.code||error.message||'خطأ غير معروف')+'. لم تتغير أي بيانات.');}
  finally{inspectButton.disabled=false;}
}
inspectButton?.addEventListener('click',inspectSaad);
linkButton?.addEventListener('click',async()=>{
  const selection=inspected;
  if(!selection||!selection.uid||!selection.pending.length)return;
  if(!confirm(`ربط ${selection.pending.length} سجل حجز/حضور قديم بحساب سعد المعتمد؟ لن تتغير الأسعار أو المدفوعات أو أسماء الطلاب، ولن يُعدل سجل مرتبط بمعلم آخر.`))return;
  linkButton.disabled=true;inspectButton.disabled=true;
  try{
    await ensureAdmin();
    // Verify the identity again; a teacher could have been disabled since inspection.
    const current=await getDoc(doc(db,'users',selection.uid));
    if(!current.exists()||current.data().role!=='teacher'||current.data().status!=='active'||
      ![current.data().fullName,current.data().name,current.data().displayName,...(Array.isArray(current.data().attendanceAliases)?current.data().attendanceAliases:[])].some(isSaad))
      throw Error('حساب المعلم تغيّر أو لم يعد نشطًا. أعد الفحص.');
    let updated=0,skipped=0;
    for(let i=0;i<selection.pending.length;i+=300){
      // Re-read right before writing and never replace any existing UID.
      const slice=selection.pending.slice(i,i+300);
      const latest=await Promise.all(slice.map(x=>getDoc(x.ref)));
      const batch=writeBatch(db);let changes=0;
      latest.forEach((docSnap,j)=>{
        const data=docSnap.data();
        if(!data||!isSaad(data.teacherName)||data.deleted===true||data.archived===true||String(data.teacherUid||'').trim()){
          skipped++;return;
        }
        batch.update(slice[j].ref,{teacherUid:selection.uid,updatedAt:serverTimestamp()});changes++;
      });
      if(changes){await batch.commit();updated+=changes;}
    }
    inspected=null;
    note(`✅ ربطت ${updated} سجلًا بحساب سعد النشط، وتجاوزت ${skipped} سجلًا تغيّر أو لا ينطبق عليه الشرط. افتح الامتحانات واعمل «مزامنة صلاحيات نتائج طلاب المعلمين» ثم حدّث قسم المرتبات والحضور.`);
  }catch(error){console.error('[saad-link]',error);note('❌ تعذر إكمال الربط: '+(error.code||error.message)+'. قد تكون بعض الدفعات السابقة حُفظت؛ اضغط فحص الحساب والسجلات للتأكد.');}
  finally{inspectButton.disabled=false;linkButton.disabled=true;}
});
