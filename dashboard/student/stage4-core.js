/* Pure helpers for Stage4 student schedule and real study progress; no Firebase writes. */
export const pad=n=>String(n).padStart(2,'0');
export function cairoDay(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
export function isoDay(date){return new Date(date).toISOString().slice(0,10);}
export function daysAfter(day,n){const d=new Date(`${day}T00:00:00Z`);if(Number.isNaN(+d)||isoDay(d)!==day)throw Error('تاريخ غير صالح');d.setUTCDate(d.getUTCDate()+n);return isoDay(d);}
export function weekRange(day,offset=0){
 const d=new Date(`${day}T00:00:00Z`);if(Number.isNaN(+d)||isoDay(d)!==day)throw Error('تاريخ غير صالح');
 const from=daysAfter(day,-((d.getUTCDay()+1)%7)+7*offset);
 return {start:from,end:daysAfter(from,6),until:daysAfter(from,7)};
}
export function eligibleLesson(item,uid,grade,range){
 const x=item||{},dt=String(x.date||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dt)||dt<range.start||dt>range.end||x.deleted===true||x.published===false)return false;
 if(['cancelled','canceled','ملغى','ملغي','مُلغى'].includes(String(x.status||'').toLowerCase()))return false;
 if(x.audience==='selected' && !(Array.isArray(x.targetUids)&&x.targetUids.includes(uid)))return false;
 if(x.grade && (!grade || String(x.grade).trim()!==String(grade).trim()))return false;
 return true;
}
export function scheduleDays(rows,range){
 const grouped=[];
 for(let i=0;i<7;i++){
  const date=daysAfter(range.start,i),lessons=(rows||[]).filter(x=>String(x.date||'').slice(0,10)===date)
    .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  grouped.push({date,lessons});
 }
 return grouped;
}
export function studentMetrics(attendance=[],examItems=[],today=cairoDay()){
 const cut=daysAfter(today,-30);
 const rows=attendance.filter(x=>x.deleted!==true && ['حاضر','غائب','اعتذر'].includes(x.status));
 const recent=rows.filter(x=>String(x.date||'').slice(0,10)>=cut && String(x.date||'').slice(0,10)<=today);
 const present=recent.filter(x=>x.status==='حاضر').length,absent=recent.filter(x=>x.status==='غائب').length;
 const pending=examItems.filter(x=>x.pendingEssay===true).length;
 const graded=examItems.filter(x=>x.complete===true && Number.isFinite(x.percent) && x.percent>=0 && x.percent<=100);
 const avg=graded.length?Math.round(graded.reduce((sum,x)=>sum+x.percent,0)/graded.length):null;
 return {present,absent,excused:recent.filter(x=>x.status==='اعتذر').length,attendanceRate:present+absent?Math.round(100*present/(present+absent)):null,
  exams:examItems.length,graded:graded.length,pendingEssay:pending,averageExam:avg};
}
export function nextLessonLabel(x){
 const dt=String(x?.date||''),clock=dt.match(/T(\d{2}:\d{2})/);
 return [x?.title||x?.name||'محاضرة',dt.slice(0,10),clock?.[1]||'الوقت غير محدد'].join(' • ');
}
