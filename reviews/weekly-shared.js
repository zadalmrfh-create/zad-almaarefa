/* Shared calculations for ZAD weekly reviews. Egypt week is Saturday to Friday. */
export const TEACHER_QUESTIONS=[
 'مدى التزام المعلم بمواعيد الحصص',
 'وضوح الشرح وتبسيط المعلومات',
 'مدى تفاعل المعلم والإجابة عن الأسئلة',
 'الاستفادة من الحصص خلال الأسبوع',
 'مدى تنظيم الحصة وإدارة الوقت',
 'تقييمك العام للمعلم'
];
export const PLATFORM_QUESTIONS=[
 'سهولة استخدام المنصة والتنقل بين أقسامها',
 'سرعة المنصة واستقرارها',
 'سهولة الوصول إلى الحصص والكتب والامتحانات',
 'تقييمك العام لتجربتك مع المنصة'
];
export const ADMIN_QUESTIONS=[
 'سرعة استجابة الإدارة لاستفساراتك',
 'التزام الإدارة بتنظيم الحصص ومواعيدها',
 'وضوح التعاملات المالية والحجوزات',
 'تقييمك العام لتعامل إدارة الأكاديمية'
];
export const scoreAverage=items=>{const nums=(items||[]).filter(x=>Number.isInteger(x)&&x>0);return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:0};
export const htmlEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function lastFullWeek(){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 const now=new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day));
 const sinceSat=(now.getUTCDay()+1)%7;
 const start=new Date(now);start.setUTCDate(now.getUTCDate()-sinceSat-7);
 const end=new Date(start);end.setUTCDate(start.getUTCDate()+6);
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
// Last fully completed calendar month in Cairo, used ONLY for platform/admin reviews.
export function lastFullMonth(){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 const y=Number(parts.year),m=Number(parts.month);
 const start=new Date(Date.UTC(y,m-2,1));
 const end=new Date(Date.UTC(y,m-1,0));
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
export function reviewId(uid,week,kind,teacherUid=''){
 return `${uid}__${week}__${kind==='teacher'?'teacher__'+teacherUid:kind}`;
}
export const validLesson=r=>r.status==='حاضر'&&r.deleted!==true&&r.archived!==true;
export function eligibleTeachers(attendance,bookings,week){
 const matches=(attendance||[]).filter(r=>validLesson(r)&&r.teacherUid&&String(r.date||'').slice(0,10)>=week.start&&String(r.date||'').slice(0,10)<=week.end);
 const map=new Map();
 for(const att of matches){
  const bk=(bookings||[]).find(b=>b.teacherUid===att.teacherUid&&!['مرفوض','ملغى','ملغي','مُلغى','rejected','cancelled'].includes(b.status));
  if(!bk)continue;
  if(!map.has(att.teacherUid))map.set(att.teacherUid,{uid:att.teacherUid,name:att.teacherName||bk.teacherName||'المعلم',subject:att.subject||bk.subject||'',attendanceId:att.id,bookingId:bk.id});
 }
 return [...map.values()];
}
export function valueText(value){return value===0?'لا ينطبق':`${value} / 5`}
