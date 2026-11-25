/* UID-scoped, pure calculations. Opening a page is never treated as completion. */
import {hasApprovedGrade} from '../dashboard/admin/exam-result-verification.js';
export function cairoCalendarDay(now=new Date()) {
  const date=now instanceof Date?now:new Date(now);if(!Number.isFinite(date.getTime()))throw Error('Invalid date');
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function validDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T12:00:00Z');return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;}
function moveDay(day,offset){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);}
export function cairoWeek(now=new Date()) {
  const today=cairoCalendarDay(now),weekday=new Date(today+'T12:00:00Z').getUTCDay();
  const start=moveDay(today,-((weekday+1)%7));return {start,end:moveDay(start,6),today};
}
export function timestampMs(value) {
  if(value===null||value===undefined||value==='')return 0;
  try {
    if(typeof value?.toMillis==='function'){const n=value.toMillis();return Number.isFinite(n)?n:0;}
    if(typeof value?.toDate==='function')return timestampMs(value.toDate());
    if(Number.isFinite(value?.seconds))return value.seconds*1000+Math.floor((value.nanoseconds||0)/1e6);
    if(value instanceof Date)return Number.isFinite(+value)?+value:0;
    if(typeof value==='number')return Number.isFinite(value)?value:0;
    if(typeof value==='string'){const n=Date.parse(value);return Number.isFinite(n)?n:0;}
  } catch {}
  return 0;
}
export function attendanceDay(value) {
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(value))return validDay(value.slice(0,10))?value.slice(0,10):'';
  const time=timestampMs(value);return time?cairoCalendarDay(new Date(time)):'';
}
export function scopedAttendance(rows,uid,today) {
  const unique=new Map();
  for(const row of rows||[]){if(!uid||row?.studentUid!==uid||row.deleted===true||!['حاضر','غائب','اعتذر'].includes(row.status))continue;
    const day=attendanceDay(row.date);if(!day||day>today)continue;
    const entry={...row,day};const key=row.id?String(row.id):Symbol();const previous=unique.get(key);
    if(!previous || timestampMs(row.updatedAt)>=timestampMs(previous.updatedAt))unique.set(key,entry);
  }
  return [...unique.values()].sort((a,b)=>b.day.localeCompare(a.day)||timestampMs(b.updatedAt||b.createdAt)-timestampMs(a.updatedAt||a.createdAt));
}
export function approvedExam(result,source) {
  if(!result||result.deleted===true)return null;
  let score,total;
  if(source==='codeExamResults'){
    if(!hasApprovedGrade(result))return null;score=result.finalScore;total=result.finalTotal;
  }else if(source==='unitOneExamAttempts'){
    if(!result.reviewedBy||!timestampMs(result.reviewedAt)||!Array.isArray(result.answers)||result.answers.length!==30
       ||!Array.isArray(result.essayMarks)||result.essayMarks.length!==4||result.essayMarks.some(x=>x!==0&&x!==1)
       ||!Number.isInteger(result.autoScoreOverride)||result.autoScoreOverride<0||result.autoScoreOverride>26)return null;
    score=result.finalScore;total=30;
    if(score!==result.autoScoreOverride+result.essayMarks.reduce((a,b)=>a+b,0))return null;
  }else if(source==='zad_exam_submissions'){
    if(!result.reviewedBy||!timestampMs(result.reviewedAt)||result.status!=='graded'||!Array.isArray(result.answers)
       ||!Array.isArray(result.gradeDetails)||result.gradeDetails.length!==result.answers.length||result.gradeDetails.some(x=>!Number.isFinite(x)||x<0||x>1))return null;
    score=result.finalScore;total=result.answers.length;
    if(!Number.isFinite(score)||Math.abs(score-result.gradeDetails.reduce((a,b)=>a+b,0))>1e-8)return null;
  }else return null;
  if(!Number.isFinite(score)||!Number.isInteger(total)||total<=0||total>1000||score<0||score>total)return null;
  return {...result,score,total,percent:Math.round(score/total*100),collection:source,updated:timestampMs(result.reviewedAt)||timestampMs(result.verifiedAt)||timestampMs(result.createdAt)};
}
export function studentHomeSummary({uid,attendance=[],results={},now=new Date()}={}) {
  const week=cairoWeek(now);const rows=scopedAttendance(attendance,uid,week.today),weekly=rows.filter(row=>row.day>=week.start&&row.day<=week.end);
  const approved=[];
  for(const [source,list] of Object.entries(results))for(const row of list||[])if(uid&&row?.studentUid===uid){const grade=approvedExam(row,source);if(grade)approved.push(grade);}
  approved.sort((a,b)=>b.updated-a.updated);
  return {week,present:weekly.filter(x=>x.status==='حاضر').length,absent:weekly.filter(x=>x.status==='غائب').length,excused:weekly.filter(x=>x.status==='اعتذر').length,
    weeklyRecords:weekly.length,lastAttendance:rows.find(x=>x.status==='حاضر')||null,lastApproved:approved[0]||null,approvedUndated:approved.filter(x=>!x.updated).length};
}
