// Only for the admin's manual review. No script inside a teacher-authored exam is executed.
import {db} from '../../firebase-config.js';
import {doc,getDoc,collection,getDocs,query,orderBy} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
export async function loadOriginalExamHtml(examId){
  const snap=await getDoc(doc(db,'codeExams',examId));
  if(!snap.exists())throw Error('الامتحان غير موجود في Firebase');
  const data=snap.data();
  if(!data.chunkCount)return String(data.code||'');
  const snapParts=await getDocs(query(collection(db,'codeExams',examId,'chunks'),orderBy('index')));
  if(snapParts.size!==data.chunkCount)throw Error('أجزاء كود الامتحان غير مكتملة');
  return snapParts.docs.map(part=>String(part.data().content||'')).join('');
}
const text=el=>String(el?.textContent||'').replace(/\s+/g,' ').trim();
export function recoverExamQuestionLabels(html){
  const document=new DOMParser().parseFromString(String(html||''),'text/html');
  const all=[...document.querySelectorAll('input,textarea,select')];
  const ignoreTypes=new Set(['hidden','button','submit','reset','file','image','password','email','tel']);
  const ignoreName=/^(name|studentname|student_name|fullName|student|email|phone|grade|class|اسم_الطالب)$/i;
  const out=[];
  all.forEach((el,index)=>{
    if(ignoreTypes.has((el.type||'').toLowerCase())||ignoreName.test(el.name||el.id||''))return;
    const holder=el.closest('[data-question],.question,.question-card,.question-item,.question-block,.quiz-question,.exam-question,.q-block,.q-item,fieldset,article,li');
    const title=holder?.querySelector('[data-question-text],.question-text,.question-title,.q-text,.q-title,.prompt,legend,h2,h3,h4,h5');
    const label=text(title)||text(holder?.querySelector('p,strong'))||el.getAttribute('data-question')||el.getAttribute('aria-label')||'';
    if(label.length<5||label.length>800)return;
    const match=String(el.name||el.id||'').match(/(?:q|question|سؤال)[-_ ]*([0-9]{1,3})/i);
    out.push({fieldNo:index+1,logicalNo:match?Number(match[1]):null,question:label.slice(0,800)});
  });
  return out;
}
export function downloadExamSource(html,examId){
  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='exam-'+String(examId||'').replace(/[^\w-]/g,'')+'.html';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

/**
 * Recover an answer key from explicit exam markup or literal JavaScript answer maps.
 * Strictly static: the source is NEVER executed. Dynamic/hidden algorithms are not guessed.
 * This enables an automatic admin report for earlier code-exam submissions as well.
 */
export function recoverExamAutomaticAnswerKey(html){
  const docu=new DOMParser().parseFromString(String(html||''),'text/html');
  const named='answerKey|correctAnswers|answersKey|correctOptions|modelAnswers|rightAnswers|solutions|questions|QUESTIONS|quizData';
  const matches=new RegExp('\\b(?:const|let|var)\\s+('+named+')\\s*=\\s*(?=[\\[{])','g');
  const collections=[];
  const unwrap=x=>{
    if(x&&typeof x==='object'&&!Array.isArray(x)){
      for(const name of ['correctAnswer','correctAnswers','correct','answer','rightAnswer','right','solution']){
        if(Object.prototype.hasOwnProperty.call(x,name))return x[name];
      }
      return undefined;
    }
    return x;
  };
  for(const script of docu.querySelectorAll('script:not([src])')){
    const code=String(script.textContent||'');
    if(code.length>400000)continue;
    matches.lastIndex=0;
    let match;
    while((match=matches.exec(code))){
      const start=matches.lastIndex;
      let level=0,inString='',escape=false,last=-1;
      for(let i=start;i<Math.min(code.length,start+35000);i++){
        const c=code[i];
        if(inString){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===inString)inString='';continue;}
        if(c==='"'||c==="'"||c==='`'){inString=c;continue;}
        if(c==='['||c==='{')level++;
        if(c===']'||c==='}'){level--;if(level===0){last=i+1;break;}}
      }
      if(last<0)continue;
      const source=code.slice(start,last);
      if(source.includes('`'))continue;
      const json=source.replace(/'((?:\\.|[^'\\])*)'/g,(_,v)=>JSON.stringify(v.replace(/\\'/g,"'")))
        .replace(/([{,]\s*)([A-Za-z_$][\w$]*|[0-9]+)(\s*:)/g,'$1"$2"$3')
        .replace(/,\s*([}\]])/g,'$1');
      try{
        const data=JSON.parse(json);
        if((Array.isArray(data)||data&&typeof data==='object')&&
          (match[1]!=='questions'&&match[1]!=='QUESTIONS'&&match[1]!=='quizData'||
            Array.isArray(data)&&data.some(x=>x&&typeof x==='object'&&unwrap(x)!==undefined))){
          collections.push(data);
        }
      }catch{}
    }
  }
  for(const node of docu.querySelectorAll('script[type="application/json"][id*="answer" i],script[data-answer-key]')){
    try{collections.push(JSON.parse(node.textContent))}catch{}
  }
  const ignoreTypes=new Set(['hidden','button','submit','reset','file','password','image','email','tel']);
  const meta=/^(name|studentname|student_name|fullname|student|email|phone|grade|class|اسم_الطالب)$/i;
  const inputs=[...docu.querySelectorAll('input,textarea,select')]
    .filter(el=>!ignoreTypes.has((el.type||'').toLowerCase())&&!meta.test(el.name||el.id||''));
  const groups=[];
  const seen=new Set();
  for(let i=0;i<inputs.length;i++){
    const first=inputs[i],type=(first.type||first.tagName).toLowerCase();
    const token=(type==='radio'||type==='checkbox')&&first.name?type+':'+first.name:'field:'+i;
    if(seen.has(token))continue;
    seen.add(token);
    const els=token.includes(':')&&!token.startsWith('field:')?inputs.filter(el=>(el.type||'').toLowerCase()===type&&el.name===first.name):[first];
    groups.push({fieldIndex:i+1,type,first,els});
  }
  const valOf=(entry,group,index)=>{
    const field=String(group.first.name||group.first.id||'');
    const qNo=Number(field.match(/(?:q|question|سؤال)[-_ ]*(\d+)/i)?.[1])||index+1;
    let val;
    if(Array.isArray(entry))val=entry[index];
    else if(entry&&typeof entry==='object'){
      for(const k of [field,'q'+qNo,'Q'+qNo,'question'+qNo,String(qNo),String(index)]){
        if(k&&Object.prototype.hasOwnProperty.call(entry,k)){val=entry[k];break;}
      }
      if(val===undefined&&Array.isArray(entry.questions))val=entry.questions[index];
    }
    return unwrap(val);
  };
  const toDisplay=(value,group)=>{
    if(Array.isArray(value))return value.map(v=>toDisplay(v,group)).join('، ');
    if(value===true||String(value)==='true')return 'صح';
    if(value===false||String(value)==='false')return 'خطأ';
    const raw=String(value??'').trim();
    if(group.type==='radio'||group.type==='checkbox'){
      const el=group.els.find(x=>x.value===raw);
      if(el){const lbl=el.closest('label')||(el.id?docu.querySelector('label[for="'+CSS.escape(el.id)+'"]'):null);return String(lbl?.textContent||'').trim()||raw;}
    }
    if(group.first.tagName==='SELECT'){
      const option=[...group.first.options].find(x=>x.value===raw);
      if(option)return String(option.textContent||raw).trim();
    }
    return raw;
  };
  const items=[];
  groups.slice(0,150).forEach((group,index)=>{
    const {first,els,type,fieldIndex}=group;
    let answer;
    const holder=first.closest('[data-question],.question,.question-card,.question-item,.question-block,.quiz-question,.exam-question,.q-block,fieldset');
    for(const el of [first,holder]){
      if(!el)continue;
      for(const name of ['data-correct-answer','data-answer-key','data-right-answer','data-answer','data-solution']){
        const attr=el.getAttribute(name);if(attr!==null&&String(attr).trim()){answer=attr;break;}
      }
      if(answer!==undefined)break;
    }
    if(answer===undefined&&(type==='radio'||type==='checkbox')){
      const marked=els.filter(el=>el.getAttribute('data-correct')==='true'||el.getAttribute('data-answer-correct')==='true');
      if(marked.length)answer=type==='checkbox'?marked.map(el=>el.value):marked[0].value;
    }
    if(answer===undefined){
      const node=holder?.querySelector('.correct-answer-value,.correct-answer-text,.model-answer,.answer-correct,[data-correct-answer]');
      const raw=node?.getAttribute('data-correct-answer')||node?.textContent;
      if(String(raw||'').trim())answer=String(raw).trim();
    }
    if(answer===undefined){for(const entry of collections){answer=valOf(entry,group,index);if(answer!==undefined)break;}}
    if(answer===undefined||answer===null)return;
    if(!['string','number','boolean'].includes(typeof answer)&&!Array.isArray(answer))return;
    const title=holder?.querySelector('[data-question-text],.question-text,.question-title,.q-text,.q-title,.prompt,legend,h2,h3,h4,h5,p,strong');
    const question=String(title?.textContent||first.getAttribute('data-question')||first.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,800);
    items.push({number:fieldIndex,question,correctAnswer:toDisplay(answer,group).slice(0,1200),type:type==='radio'?'mcq':type==='checkbox'?'mcq':type==='textarea'?'essay':type==='select'?'mcq':'text'});
  });
  if(!items.length){
    // JS-only quizzes may construct their inputs at runtime; use literal question arrays.
    for(const col of collections){
      if(!Array.isArray(col))continue;
      col.slice(0,150).forEach((q,i)=>{
        if(!q||typeof q!=='object')return;
        const answer=unwrap(q);
        if(answer===undefined||answer===null)return;
        items.push({number:i+1,question:String(q.text||q.question||q.title||'').slice(0,800),correctAnswer:String(answer),type:String(q.type||'mcq')});
      });
      if(items.length)break;
    }
  }
  return items;
}
