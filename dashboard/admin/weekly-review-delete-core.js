// A legacy public testimonial has a random ID. Only link it by the exact
// server timestamp shared by the original batch plus all review content fields.
function timestampKey(value){
 if(!value||!Number.isSafeInteger(value.seconds)||!Number.isInteger(value.nanoseconds)||value.nanoseconds<0||value.nanoseconds>=1e9)return null;
 return `${value.seconds}:${value.nanoseconds}`;
}
const text=value=>String(value??'');
export function sameReview(a,b){
 return ['studentUid','kind','periodType','weekStart','weekEnd','teacherUid','feedbackId','sourceAttendanceId','sourceBookingId','comment'].every(k=>text(a[k])===text(b[k]))
   &&a.publishConsent===b.publishConsent&&JSON.stringify(a.scores)===JSON.stringify(b.scores)
   &&timestampKey(a.createdAt)===timestampKey(b.createdAt);
}
export function publicCopiesForReview(review,docs){
 const empty={randomId:null,ambiguous:false,unresolved:false};
 if(!['teacher','platform'].includes(review.kind))return empty;
 const historicalId='weekly_'+review.hash;
 const comment=text(review.comment),rating=review.scores?.[review.kind==='teacher'?5:3];
 // The original client only generated random-ID testimonials for written comments.
 if(!comment)return empty;
 const possible=docs.filter(d=>typeof d.id==='string'&&d.id!==historicalId&&!d.id.startsWith('weekly_')&&d.kind===review.kind&&d.weekStart===review.weekStart&&text(d.teacherUid)===text(review.teacherUid)&&d.text===comment&&d.rating===rating);
 const key=timestampKey(review.createdAt);
 const exact=key?possible.filter(d=>timestampKey(d.createdAt)===key):[];
 return {randomId:exact.length===1?exact[0].id:null,ambiguous:exact.length>1,unresolved:exact.length===0&&possible.length>0};
}
