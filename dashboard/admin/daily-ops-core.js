/* Zad — admin daily-operations pure helpers. No Firebase and no writes. */
export const LIMITS = Object.freeze({bookings:80,payments:80,essays:150,lessons:100});
export const BOOKING_REVIEW = new Set(['جديد','قيد المراجعة','تم التواصل','pending']);
export function cairoDay(date=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function followingDay(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('تاريخ غير صحيح');
  const d=new Date(`${day}T00:00:00.000Z`);
  if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==day)throw new Error('تاريخ غير صحيح');
  d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
}
export function row(kind,id,data={}){
  const x=data||{};
  const text=v=>String(v??'').trim();
  let title='',detail='',when='';
  switch(kind){
    case 'bookings':
      title=text(x.fullName||x.studentName||'طلب حجز');
      detail=[x.subject,x.grade,x.teacherName,x.status].filter(Boolean).map(text).join(' • ');
      when=x.createdAt;
      break;
    case 'payments':
      title=text(x.studentName||'طلب تحويل');
      detail=`تحويل بانتظار المراجعة • ${Number(x.amountPiastres||0)/100} ج.م`;
      when=x.createdAt;
      break;
    case 'essays':
      title=text(x.examTitle||'امتحان');
      detail=`${text(x.studentName||'طالب')} • تصحيح المقالي مطلوب`;
      when=x.createdAt;
      break;
    case 'lessons':
      title=text(x.title||x.name||'حصة');
      detail=[x.subject,x.teacherName,x.grade].filter(Boolean).map(text).join(' • ');
      when=x.date;
      break;
    default:throw Error('نوع غير معروف');
  }
  return {kind,id:String(id),title:title.slice(0,150),detail:detail.slice(0,250),when};
}
export function timeText(value){
  if(!value)return 'غير محدد';
  if(typeof value==='string')return value.replace('T',' ').slice(0,19);
  try{const d=typeof value.toDate==='function'?value.toDate():new Date(value.seconds?value.seconds*1000:value);return Number.isNaN(d.getTime())?'غير محدد':new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'short',timeStyle:'short'}).format(d);}catch{return 'غير محدد'}
}
export const groupSpecs = Object.freeze({
  bookings:{title:'📅 حجوزات تحتاج متابعة',tab:'bookings',sectionId:'bookingsManagement'},
  payments:{title:'💳 تحويلات بانتظار المراجعة',tab:'payments',sectionId:'zadVodafoneAdminPanel',financeMode:'review'},
  essays:{title:'📝 امتحانات تنتظر تصحيح المقالي',tab:'exams',sectionId:'codeExamResultsSection'},
  lessons:{title:'🎥 حصص التاريخ المختار',tab:'content',sectionId:'contentManagement'}
});
// Treat all downloaded data as untrusted strings; prevent CSV formula injection.
export function csvCell(value){
  let s=String(value??'').replace(/\r\n?/g,'\n');
  if(/^[\s\x00-\x1f]*[=+@-]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
export function csvReport(groups){
  const rows=[['القسم','العنوان','التفاصيل','التاريخ']];
  for(const key of ['bookings','payments','essays','lessons']){
    for(const item of groups[key]||[])rows.push([groupSpecs[key].title,item.title,item.detail,timeText(item.when)]);
  }
  return '\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
