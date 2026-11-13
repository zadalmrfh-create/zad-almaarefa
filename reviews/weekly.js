import {auth,db} from '../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {doc,collection,getDoc,getDocs,query,where,writeBatch,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {TEACHER_QUESTIONS,PLATFORM_QUESTIONS,ADMIN_QUESTIONS,lastFullWeek,lastFullMonth,reviewId,eligibleTeachers,htmlEscape} from './weekly-shared.js';
const $=id=>document.getElementById(id);
const week=lastFullWeek();
const month=lastFullMonth();
const intended=(()=>{const next=new URLSearchParams(location.search).get('next');if(!next)return '../dashboard/student/index.html';try{const url=new URL(next,location.href);if(url.origin===location.origin&&url.pathname!==location.pathname)return url.href}catch(_){}return '../dashboard/student/index.html'})();
$('weekLabel').textContent=`تقييم المعلمين: ${week.start} إلى ${week.end} (آخر أسبوع مكتمل) | تقييم المنصة والإدارة: ${month.start} إلى ${month.end} (آخر شهر مكتمل)`;
$('weeklyContinue').href=intended;
let currentUser=null,forms=[];
function render(){
 const target=$('evaluationItems');target.replaceChildren();
 const completed=forms.filter(x=>x.saved).length,total=forms.length;
 $('progressBar').style.width=`${total?completed/total*100:100}%`;
 $('progressText').textContent=`تم إكمال ${completed} من ${total} تقييمات`;
 $('weeklyComplete').hidden=completed!==total;
 for(const data of forms){
  const panel=document.createElement('article');panel.className='panel';
  const heading=document.createElement('h2');heading.textContent=data.title;panel.appendChild(heading);
  const sub=document.createElement('p');sub.className='sub';sub.textContent=data.saved?'✅ تم تسجيل التقييم بنجاح':`${data.kind==='teacher'?'الأسبوع':'الشهر'} ${data.period.start} — ${data.period.end}. أجب عن كل سؤال.`;panel.appendChild(sub);
  if(data.saved){const done=document.createElement('p');done.className='done';done.textContent='تقييم محفوظ، ولا يمكن إرساله مرة ثانية.';panel.append(done);target.append(panel);continue}
  const form=document.createElement('form');form.noValidate=true;form.dataset.reviewKey=data.kind+'::'+(data.teacherUid||'');
  data.questions.forEach((question,i)=>{
   const box=document.createElement('div');box.className='question';const title=document.createElement('strong');title.textContent=`${i+1}. ${question}`;box.append(title);
   const choices=document.createElement('div');choices.className='choices';choices.setAttribute('role','group');choices.setAttribute('aria-label',question);
   const vals=data.kind==='teacher'?[1,2,3,4,5]:[1,2,3,4,5,0];
   vals.forEach(score=>{const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name=`q${i}`;input.value=String(score);input.required=true;input.checked=data.draft?.scores?.[i]===score;label.append(input,document.createTextNode(score===0?'لا ينطبق':`${score} ★`));choices.append(label)});
   box.append(choices);form.append(box)
  });
  const memo=document.createElement('label');memo.className='comment';memo.textContent='ملاحظاتك أو اقتراحاتك (اختياري)';const textarea=document.createElement('textarea');textarea.maxLength=700;textarea.value=data.draft?.comment||'';textarea.placeholder='اكتب رأيك بصراحة وباحترام. لا تضع بياناتك الشخصية داخل الملاحظة.';memo.append(textarea);form.append(memo);
  const notice=document.createElement('p');notice.className='consent';notice.textContent=data.kind==='administration'?'تقييم الإدارة خاص بالإدارة فقط.':'عند إرسال التقييم، ستُنشر ملاحظتك المكتوبة تلقائيًا في صفحة آراء الطلاب دون اسمك. لا تكتب معلومات تكشف هويتك.';form.append(notice);
  const button=document.createElement('button');button.className='save';button.type='submit';button.textContent='إرسال التقييم';form.append(button);
  const status=document.createElement('p');status.className='status';status.setAttribute('role','status');form.append(status);
  form.addEventListener('submit',async e=>{
   e.preventDefault();const scores=data.questions.map((_,i)=>{const found=form.querySelector(`input[name="q${i}"]:checked`);return found?Number(found.value):null});
   if(scores.some(x=>x===null)){status.textContent='من فضلك أجب عن جميع الأسئلة أولًا.';return}
   if(data.kind==='teacher'&&scores.some(x=>x===0)){status.textContent='اختر تقييمًا من 1 إلى 5 لكل سؤال.';return}
   if(data.saved){status.textContent='✅ تم إرسال التقييم بالفعل.';return;}
   button.disabled=true;status.textContent='جارٍ حفظ التقييم في Firebase...';
   const feedbackDoc=data.kind==='teacher'?doc(collection(db,'weeklyTeacherFeedback')):null;
   const id=reviewId(currentUser.uid,data.period.start,data.kind,data.teacherUid||'');
   const privateData={studentUid:currentUser.uid,kind:data.kind,periodType:data.kind==='teacher'?'weekly':'monthly',weekStart:data.period.start,weekEnd:data.period.end,teacherUid:data.teacherUid||'',sourceAttendanceId:data.attendanceId||'',sourceBookingId:data.bookingId||'',feedbackId:feedbackDoc?.id||'',scores,comment:textarea.value.trim(),publishConsent:data.kind!=='administration',createdAt:serverTimestamp()};
   try{
    const prior=await getDoc(doc(db,'weeklyReviewPrivate',id));
    if(prior.exists()){data.saved=true;render();$('weeklyMessage').textContent='✅ هذا التقييم تم إرساله بالفعل ولا يمكن إرساله مرة ثانية.';return;}
    const batch=writeBatch(db);batch.set(doc(db,'weeklyReviewPrivate',id),privateData);
    if(feedbackDoc)batch.set(feedbackDoc,{kind:'teacher',teacherUid:data.teacherUid,weekStart:data.period.start,scores,comment:privateData.comment,createdAt:serverTimestamp()});
    if(data.kind!=='administration'&&privateData.comment){
      const publicRef=doc(collection(db,'publicTestimonials'));
      batch.set(publicRef,{status:'published',kind:data.kind,text:privateData.comment,rating:data.kind==='teacher'?scores[5]:scores[3],teacherUid:data.teacherUid||'',teacherName:data.kind==='teacher'?data.name||'من معلمي المنصة':'',weekStart:data.period.start,createdAt:serverTimestamp()});
    }
    await batch.commit();for(const entry of forms){const dom=[...document.querySelectorAll('form[data-review-key]')].find(f=>f.dataset.reviewKey===entry.kind+'::'+(entry.teacherUid||''));if(!dom)continue;entry.draft={scores:entry.questions.map((_,i)=>{const v=dom.querySelector(`input[name="q${i}"]:checked`);return v?Number(v.value):null}),comment:dom.querySelector('textarea')?.value||'',consent:true}}data.saved=true;render();$('weeklyMessage').textContent='✅ تم حفظ التقييم بنجاح.';
   }catch(err){
    console.error('weekly-review-save',err);
    try{const stored=await getDoc(doc(db,'weeklyReviewPrivate',id));if(stored.exists()){data.saved=true;render();$('weeklyMessage').textContent='✅ التقييم محفوظ بالفعل ولا يمكن إرساله مرة أخرى.';return;}}catch(_){}
    status.textContent='تعذر حفظ التقييم. لم يُحتسب مكتملًا. تحقق من صلاحيات Firestore وقواعد التقييم وأعد المحاولة. '+(err.code||err.message||'');button.disabled=false
   }
  });panel.append(form);target.append(panel)
 }
}
async function load(user){
 currentUser=user;$('weeklyMessage').textContent='';
 try{
  const account=await getDoc(doc(db,'users',user.uid));
  if(account.data()?.role!=='student'){$('evaluationItems').innerHTML='<div class="panel">هذه الصفحة مخصصة لتقييم الطلاب.</div>';return}
  const [attendanceSnap,bookingSnap]=await Promise.all([
   getDocs(query(collection(db,'lessonAttendance'),where('studentUid','==',user.uid))),
   getDocs(query(collection(db,'bookings'),where('studentUid','==',user.uid)))
  ]);
  const a=attendanceSnap.docs.map(d=>({id:d.id,...d.data()}));
  const b=bookingSnap.docs.map(d=>({id:d.id,...d.data()}));
  const teacherOptions=eligibleTeachers(a,b,week);
  const entries=teacherOptions.map(t=>({...t,kind:'teacher',period:week,teacherUid:t.uid,title:`تقييم المعلم: ${t.name}${t.subject?' — '+t.subject:''}`,questions:TEACHER_QUESTIONS}));
  entries.push({kind:'platform',period:month,title:'التقييم الشهري لمنصة زاد المعرفة',questions:PLATFORM_QUESTIONS});
  entries.push({kind:'administration',period:month,title:'التقييم الشهري لإدارة الأكاديمية',questions:ADMIN_QUESTIONS});
  const docs=await Promise.all(entries.map(x=>getDoc(doc(db,'weeklyReviewPrivate',reviewId(user.uid,x.period.start,x.kind,x.teacherUid||'')))));
  forms=entries.map((x,i)=>({...x,saved:docs[i].exists()}));
  render();
  if(!teacherOptions.length&&a.some(r=>r.status==='حاضر'&&r.date>=week.start&&r.date<=week.end&&!r.teacherUid)){
   $('weeklyMessage').textContent='تنبيه: توجد حصص غير مربوطة بحساب معلم. يجب مراجعتها من الإدارة حتى يظهر تقييم المعلم الصحيح.';
  }
 }catch(err){console.error('weekly-review-load',err);$('evaluationItems').innerHTML='<div class="panel"><h2>تعذر التحقق من بيانات التقييم</h2><p>لم يتم تجاوز التقييم أو احتسابه. تأكد من الاتصال ونشر قواعد Firestore المطلوبة ثم أعد المحاولة.</p><button class="save" type="button" onclick="location.reload()">إعادة المحاولة</button></div>';$('weeklyMessage').textContent=err.code||err.message||'خطأ في تحميل البيانات'}
}
onAuthStateChanged(auth,user=>{if(!user){location.replace('../login/index.html');return}load(user)});
