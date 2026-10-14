import {auth,db} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {getDoc,doc,collection,query,orderBy,onSnapshot,deleteDoc} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const box=document.getElementById('codeExamResultsList');
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
let unsubscribe=null;
onAuthStateChanged(auth,async user=>{
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  if(!user){box.textContent='سجّل دخولك كمشرف.';return;}
  let ok=false;
  try{ok=(await getDoc(doc(db,'admins',user.uid))).exists()||(user.email?.toLowerCase()==='maleksameh121@gmail.com'&&user.emailVerified)}catch(e){}
  if(!ok){box.textContent='يتطلب صلاحية المشرف.';return;}
  unsubscribe=onSnapshot(query(collection(db,'codeExamResults'),orderBy('createdAt','desc')),snap=>{
    box.replaceChildren();
    if(snap.empty){box.textContent='لا توجد نتائج محفوظة بعد.';return;}
    snap.docs.forEach(d=>{
      const x=d.data(),row=make('div',undefined,'zad-exam-result-row');
      const title=make('strong',(x.studentName||'طالب')+' — '+(x.examTitle||'امتحان'));
      const line=make('div',(x.score??0)+' من '+(x.total??0)+' ('+(x.percent??0)+'%)'+(x.excellent?' — ممتاز 🏅':'')+' — نتيجة آلية غير معتمدة');
      const actions=make('div',undefined,'zad-result-actions');
      const show=make('button','عرض الإجابات');show.type='button';
      const del=make('button','🗑️ حذف النتيجة','zad-delete-result');del.type='button';
      const pre=make('pre');pre.hidden=true;pre.style.whiteSpace='pre-wrap';pre.textContent=x.answers||'لم تتوفر بيانات الإجابات من كود الامتحان.';
      const status=make('span',undefined,'zad-delete-status');status.setAttribute('role','status');
      show.onclick=()=>{pre.hidden=!pre.hidden;show.textContent=pre.hidden?'عرض الإجابات':'إخفاء الإجابات'};
      del.onclick=async()=>{
        const description=`${x.studentName||'الطالب'} — ${x.examTitle||'الامتحان'} — ${x.score??0} من ${x.total??0}`;
        if(!window.confirm(`هل تريد حذف هذه النتيجة نهائيًا؟\n${description}\nستختفي من لوحة الطالب، وقد تختفي شهادة التفوق المرتبطة بها. لا يمكن التراجع عن الحذف.`))return;
        del.disabled=true;status.textContent='جارٍ الحذف...';
        try{await deleteDoc(doc(db,'codeExamResults',d.id));status.textContent='تم حذف النتيجة.';}
        catch(error){del.disabled=false;status.textContent='تعذّر الحذف: '+(error.code||error.message);}
      };
      actions.append(show,del,status);row.append(title,line,actions,pre);box.append(row);
    });
  },e=>box.textContent='خطأ في تحميل النتائج: '+e.message);
});
