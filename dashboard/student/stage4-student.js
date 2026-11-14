/* Stage4 student companion — real weekly timetable, progress and quick mobile actions. */
import {auth,db} from '../../firebase-config.js';
import {getPreviewContext} from '../admin-preview-core.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {doc,getDoc,getDocs,collection,query,where,limit} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {cairoDay,daysAfter,weekRange,eligibleLesson,scheduleDays,studentMetrics,nextLessonLabel} from './stage4-core.js';
const $=id=>document.getElementById(id);
const sched=$('zadStage4ScheduleList'),state=$('zadStage4ScheduleStatus'),weekLabel=$('zadStage4WeekLabel');
const refresh=$('zadStage4Reload'),prev=$('zadStage4ThisWeek'),next=$('zadStage4NextWeek');
let uid='',grade='',offset=0,loading=false,authGeneration=0;
let board={attendance:[],bookings:[],dataError:''},exams=[];
const text=(tag,content,cls)=>{const e=document.createElement(tag);e.textContent=String(content||'');if(cls)e.className=cls;return e};
const setStatus=(s)=>{if(state)state.textContent=s};
const formatDate=day=>{const date=new Date(`${day}T12:00:00Z`);return new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',weekday:'long',day:'numeric',month:'long'}).format(date)};
function setWeekButtons(){
 prev?.classList.toggle('gold',offset===0);next?.classList.toggle('gold',offset===1);
 if(weekLabel){const x=weekRange(cairoDay(),offset);weekLabel.textContent=`من ${x.start} إلى ${x.end} (بتوقيت القاهرة)`;}
}
function openStudentTab(id){const el=document.querySelector(`.student-tabs [data-student-tab="${id}"]`);if(el)el.click();}
document.querySelectorAll('[data-stage4-open]').forEach(btn=>btn.addEventListener('click',()=>{openStudentTab(btn.dataset.stage4Open);updateMobileActive(btn.dataset.stage4Open)}));
function updateMobileActive(id){document.querySelectorAll('.zad-stage4-bottom-nav [data-stage4-open]').forEach(btn=>{const active=btn.dataset.stage4Open===id;btn.classList.toggle('active',active);if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');});}
document.querySelector('.student-tabs')?.addEventListener('click',event=>{const id=event.target.closest('[data-student-tab]')?.dataset.studentTab;if(id)updateMobileActive(id)});
updateMobileActive('overview');
function putBookingPrefs(){const el=$('zadStage4BookingPrefs');if(!el)return;el.replaceChildren();
 if(!board.bookings.length){el.append(text('p','لا توجد حجوزات مسجلة حاليًا.'));return;}
 for(const x of board.bookings.slice(0,30)){
  const d=text('p',[x.subject||'حجز حصة',x.status||'حالة غير محددة', [x.preferredDay1,x.preferredDay2].filter(Boolean).join(' / ')].filter(Boolean).join(' — '));el.append(d);
 }
}
function showProgress(){const target=$('zadStage4ProgressCards');if(!target)return;target.replaceChildren();
 const data=studentMetrics(board.attendance,exams);
 const cards=[['حضور آخر 30 يوم',board.dataError?'—':data.attendanceRate===null?'لا توجد حصص':data.attendanceRate+'%'],
  ['حضر / غاب',board.dataError?'—':`${data.present} / ${data.absent}`],
  ['امتحانات مسلّمة',String(data.exams)],
  ['متوسط النتائج المكتملة',data.averageExam===null?'—':data.averageExam+'%'],
  ['بانتظار تصحيح المقالي',String(data.pendingEssay)]];
 for(const [label,val] of cards){const item=text('div','', 'zad-stage4-metric');item.append(text('strong',val),text('span',label));target.append(item);}
}
function updateBanner(lessons=[]){const box=$('zadStage4NextLesson');if(!box)return;
 const start=Date.now(),upcoming=lessons.filter(x=>{const ms=new Date(String(x.date||'')).getTime();return !Number.isNaN(ms)&&ms>start-15*60000;}).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const title=box.querySelector('strong');if(!title)return;
 if(upcoming.length){const next=upcoming[0],d=new Date(String(next.date||'')),isToday=String(next.date).slice(0,10)===cairoDay();
   const soon=!Number.isNaN(+d)&&d.getTime()-start<2*60*60*1000;
   title.textContent=`${soon?'⏰ الحصة اقتربت: ':isToday?'📅 حصة اليوم: ':'📚 الحصة القادمة: '}${nextLessonLabel(next)}`;
 }else title.textContent='لا توجد محاضرات مجدولة قادمة ضمن المواعيد المحمّلة.';
}
function renderSchedule(items,range){sched.replaceChildren();
 let count=0;
 for(const day of scheduleDays(items,range)){
  const card=text('section','', 'zad-stage4-day');card.append(text('h4',formatDate(day.date)));
  if(!day.lessons.length){card.append(text('p','لا توجد حصة مجدولة.', 'zad-stage4-empty'));}
  for(const lesson of day.lessons){count++;const row=text('article','','zad-stage4-lesson');
    row.append(text('strong',lesson.title||lesson.name||'محاضرة جديدة'));
    const date=String(lesson.date||''),clock=(date.match(/T(\d{2}:\d{2})/)||[])[1];
    row.append(text('span',[clock?'🕒 '+clock:'الساعة غير محددة',lesson.subject||lesson.section||'',lesson.teacherName||lesson.teacher||''].filter(Boolean).join(' • ')));
    const btn=text('button','🎥 فتح المحاضرات','btn');btn.type='button';btn.addEventListener('click',()=>openStudentTab('lessons'));row.append(btn);card.append(row);
  }
  sched.append(card);
 }
 if(!count)setStatus('لا توجد حصص مجدولة لصفك في هذا الأسبوع. قد تكون الحجوزات بانتظار تأكيد الإدارة.');
 else setStatus(`✅ عُرضت ${count} حصة بموعد محدد. يُحدَّث الجدول عند الضغط على «تحديث الجدول».`);
}
async function loadSchedule(){
 if(loading||!uid){setStatus('سجّل الدخول بحساب طالب لعرض جدولك.');return;}
 loading=true;const generation=authGeneration,day=cairoDay(),range=weekRange(day,offset);
 refresh.disabled=true;prev.disabled=true;next.disabled=true;sched.replaceChildren();setStatus('جارٍ تحميل مواعيد هذا الأسبوع من Firebase...');setWeekButtons();
 try{
  // Range query is bounded and reads only scheduled lessons, not the entire collection.
  const q=query(collection(db,'lessons'),where('date','>=',range.start+'T00:00'),where('date','<',range.until+'T00:00'),limit(160));
  const snap=await getDocs(q);if(generation!==authGeneration)return;
  const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>eligibleLesson(x,uid,grade,range));
  renderSchedule(rows,range);
  if(offset===0)updateBanner(rows);
  if(snap.size===160)setStatus('⚠️ تم تحميل أول 160 محاضرة فقط؛ لو جدولك أكبر من كده راجع صفحة المحاضرات أو الإدارة.');
 }catch(err){sched.replaceChildren(text('p','تعذر تحميل الجدول: '+(err.code||err.message)));setStatus('فشل التحميل؛ جرّب زر التحديث.');}
 finally{loading=false;refresh.disabled=false;prev.disabled=false;next.disabled=false;}
}
refresh?.addEventListener('click',loadSchedule);
prev?.addEventListener('click',()=>{offset=0;loadSchedule()});
next?.addEventListener('click',()=>{offset=1;loadSchedule()});
$('zadStage4RefreshNotifications')?.addEventListener('click',()=>{window.dispatchEvent(new Event('zad:stage4-refresh-student'));});
window.addEventListener('zad:stage4-dashboard-data',event=>{board=event.detail||board;putBookingPrefs();showProgress();});
window.addEventListener('zad:stage4-exam-data',event=>{exams=event.detail?.items||[];showProgress();});
onAuthStateChanged(auth,async user=>{
 authGeneration++;uid='';grade='';
 if(!user){setStatus('يرجى تسجيل الدخول أولًا لعرض الجدول.');return;}
 const generation=authGeneration;
 try{const pv=await getPreviewContext(user,'student');if(generation!==authGeneration||pv.denied)return;uid=pv.uid;
   try{const x=await getDoc(doc(db,'users',uid));grade=String(x.data()?.grade||x.data()?.studyGrade||'').trim()}catch(error){console.warn('تعذر معرفة الصف عند تحديث الجدول',error.code||error.message)}
   if(generation===authGeneration){setWeekButtons();putBookingPrefs();showProgress();loadSchedule()}
 }catch(error){setStatus('تعذر معرفة حساب الطالب: '+(error.code||error.message));}
});
