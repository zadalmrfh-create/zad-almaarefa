<script>
/* ZAD code-exam bridge v3 — objective grading and evidence-backed answer reports.
   Runs inside the isolated srcdoc iframe; doesn't access Firebase or admin answer keys. */
(()=>{
  'use strict';
  let done=false,armed=false,savedSnapshot=null;
  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
  const norm=s=>clean(s).toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'');
  const skipTypes=new Set(['hidden','button','submit','reset','file','password','image','email','tel']);
  const metaName=/^(student[-_ ]?name|full[-_ ]?name|name|student|email|phone|grade|class|studentgrade|studentclass|اسم[-_ ]?الطالب)$/i;
  const holderSelector='[data-question],.question,.question-item,.question-block,.question-card,.quiz-question,.exam-question,.q-block,.q-item,fieldset,article,li';
  const questionText=(el)=>{
    const holder=el.closest(holderSelector);
    if(holder){
      const prompt=holder.querySelector('[data-question-text],.question-text,.question-title,.q-text,.q-title,.prompt,legend,h2,h3,h4,h5,p,strong');
      const text=clean(prompt?.innerText||prompt?.textContent);
      if(text.length>3&&text.length<700)return text;
    }
    const attr=el.getAttribute('data-question')||el.getAttribute('aria-label');
    if(attr&&!/اسم|الصف|الهاتف|الايميل|email/i.test(attr))return clean(attr).slice(0,600);
    const near=(el.closest('div,section,fieldset')||el.parentElement)?.querySelector('p,legend,h3,h4,strong');
    const text=clean(near?.innerText||near?.textContent);
    return text.length>3&&text.length<450?text:'';
  };
  const labelOf=el=>{
    const label=el.closest('label')||(el.id?document.querySelector('label[for="'+CSS.escape(el.id)+'"]'):null);
    const val=clean(label?.innerText||label?.textContent);
    return val.length<300?val:'';
  };
  const hideEmbeddedPrint=()=>document.querySelectorAll('button,a,input[type="button"],input[type="submit"]').forEach(el=>{
    const t=clean(el.innerText||el.value),on=el.getAttribute('onclick')||'';
    if(/print\s*\(/i.test(on)||/طباعة|حفظ PDF|print (result|page)|print\s*\//i.test(t)){
      el.style.setProperty('display','none','important');el.setAttribute('aria-hidden','true');
    }
  });
  const parseKeyCandidate=data=>{
    if(typeof data==='string'){
      try{data=JSON.parse(data)}catch{return null}
    }
    if(Array.isArray(data)&&data.length&&data.length<=200)return data;
    if(data&&typeof data==='object'&&!Array.isArray(data)&&Object.keys(data).length<=250)return data;
    return null;
  };
  // Read simple literal keys even when defined inside a function. Never execute code
  // found in script tags. Dynamic/computed grading rules cannot be reconstructed here.
  const scanScriptKeys=()=>{
    const found=[];
    const names='answerKey|correctAnswers|answersKey|correctOptions|modelAnswers|rightAnswers|solutions|questions|QUESTIONS|quizData';
    const matcher=new RegExp('\\b(?:const|let|var)\\s+('+names+')\\s*=\\s*(?=[\\[{])','g');
    for(const script of document.querySelectorAll('script:not([src])')){
      if(script.type&&script.type!=='text/javascript'&&script.type!=='module')continue;
      const code=script.textContent||'';
      if(code.length>350000)continue;
      matcher.lastIndex=0;
      let match;
      while((match=matcher.exec(code))){
        const from=matcher.lastIndex,opening=code[from];
        let depth=0,quote='',escaped=false,end=-1;
        for(let i=from;i<Math.min(code.length,from+25000);i++){
          const c=code[i];
          if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}
          if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
          if(c==='{'||c==='[')depth++;
          if(c==='}'||c===']'){depth--;if(depth===0){end=i+1;break;}}
        }
        if(end<0)continue;
        const literal=code.slice(from,end);
        if(literal.includes('`'))continue;
        const json=literal.replace(/'((?:\\.|[^'\\])*)'/g,(_,part)=>JSON.stringify(part.replace(/\\'/g,"'")))
          .replace(/([{,]\s*)([A-Za-z_$][\w$]*|[0-9]+)(\s*:)/g,'$1"$2"$3')
          .replace(/,\s*([}\]])/g,'$1');
        try{const data=parseKeyCandidate(JSON.parse(json));if(data)found.push({data,source:'source-'+match[1]})}catch{}
      }
    }
    return found;
  };
  // These names are common in teacher-authored HTML quizzes. In classic scripts,
  // top-level let/const bindings can be read by later classic scripts without eval.
  const discoverKey=()=>{
    const candidates=[];
    const add=(value,source)=>{
      const parsed=parseKeyCandidate(value);
      if(!parsed)return;
      if((source==='questions'||source==='QUESTIONS'||source==='quizData') &&
        (!Array.isArray(parsed)||!parsed.some(row=>row&&typeof row==='object'&&
          ['correctAnswer','correctAnswers','correct','answer','rightAnswer','right','solution'].some(k=>Object.prototype.hasOwnProperty.call(row,k)))))return;
      if(!candidates.some(c=>c.data===parsed))candidates.push({data:parsed,source});
    };
    try{if(typeof answerKey!=='undefined')add(answerKey,'answerKey')}catch{}
    try{if(typeof correctAnswers!=='undefined')add(correctAnswers,'correctAnswers')}catch{}
    try{if(typeof answersKey!=='undefined')add(answersKey,'answersKey')}catch{}
    try{if(typeof correctOptions!=='undefined')add(correctOptions,'correctOptions')}catch{}
    try{if(typeof modelAnswers!=='undefined')add(modelAnswers,'modelAnswers')}catch{}
    try{if(typeof rightAnswers!=='undefined')add(rightAnswers,'rightAnswers')}catch{}
    try{if(typeof solutions!=='undefined')add(solutions,'solutions')}catch{}
    try{if(typeof questions!=='undefined'&&Array.isArray(questions))add(questions,'questions')}catch{}
    try{if(typeof QUESTIONS!=='undefined'&&Array.isArray(QUESTIONS))add(QUESTIONS,'QUESTIONS')}catch{}
    for(const name of ['answerKey','correctAnswers','answersKey','correctOptions','modelAnswers','rightAnswers','solutions','questions','QUESTIONS','quizData']){
      try{add(window[name],name)}catch{}
    }
    for(const node of document.querySelectorAll('script[type="application/json"][id*="answer" i],script[type="application/json"][id*="question" i],script[data-answer-key]')){
      try{add(JSON.parse(node.textContent),'json-key')}catch{}
    }
    for(const found of scanScriptKeys())add(found.data,found.source);
    // Prefer an actual answer map to an array of question objects.
    return candidates;
  };
  const keyValue=(entry)=>{
    if(entry&&typeof entry==='object'&&!Array.isArray(entry)){
      for(const prop of ['correctAnswer','correctAnswers','correct','answer','rightAnswer','right','solution']){
        if(Object.prototype.hasOwnProperty.call(entry,prop))return entry[prop];
      }
      return undefined;
    }
    return entry;
  };
  const findKey=(keys,q,index)=>{
    const field=clean(q.fieldName);
    const numberMatch=field.match(/(?:q|question|سؤال)[\s_-]*([0-9]{1,3})/i);
    const number=numberMatch?Number(numberMatch[1]):index+1;
    for(const key of keys){
      const data=key.data;
      let val;
      if(Array.isArray(data))val=data[index];
      else{
        const names=[field,String(number),'q'+number,'Q'+number,'question'+number,'question_'+number,String(index),'q'+(index+1)];
        for(const k of names){if(k&&Object.prototype.hasOwnProperty.call(data,k)){val=data[k];break}}
        if(val===undefined&&Array.isArray(data.questions))val=data.questions[index];
      }
      val=keyValue(val);
      if(val!==undefined&&val!==null&&(['string','number','boolean'].includes(typeof val)||Array.isArray(val)))return {value:val,source:key.source};
    }
    return null;
  };
  const explicitAnswer=(q)=>{
    const first=q.els[0],holder=first.closest(holderSelector);
    for(const el of [first,holder]){
      if(!el)continue;
      for(const name of ['data-correct-answer','data-answer-key','data-right-answer','data-answer','data-solution']){
        const val=el.getAttribute(name);
        if(val!==null&&clean(val))return {value:val,source:'markup'};
      }
    }
    if(q.type==='radio'||q.type==='checkbox'){
      const explicit=q.els.filter(el=>el.getAttribute('data-correct')==='true'||el.getAttribute('data-answer-correct')==='true');
      if(explicit.length)return {value:q.type==='checkbox'?explicit.map(el=>el.value):explicit[0].value,source:'markup'};
      const correctChoices=q.els.filter(el=>el.closest('label')?.classList.contains('correct-answer')||el.closest('label')?.classList.contains('right-answer'));
      if(correctChoices.length)return {value:q.type==='checkbox'?correctChoices.map(el=>el.value):correctChoices[0].value,source:'markup'};
    }
    const shown=holder?.querySelector('[data-correct-answer],.correct-answer-value,.correct-answer-text,.model-answer,.answer-correct,.solution-text');
    if(shown){const val=shown.getAttribute('data-correct-answer')||clean(shown.innerText||shown.textContent);if(val)return {value:val,source:'displayed-solution'}}
    return null;
  };
  const keyDisplay=(raw,q)=>{
    if(Array.isArray(raw))return raw.map(x=>keyDisplay(x,q)).join('، ');
    const value=clean(raw);
    if(raw===true||value.toLowerCase()==='true')return 'صح';
    if(raw===false||value.toLowerCase()==='false')return 'خطأ';
    if(q.type==='radio'||q.type==='checkbox'||q.type==='select'){
      const options=q.options||[];
      const candidate=options.find(x=>norm(x.value)===norm(value));
      if(candidate)return candidate.label||candidate.value;
      if(/^[0-9]+$/.test(value)){
        const n=Number(value),indexed=options[n]||options[n-1];
        if(indexed)return indexed.label||indexed.value;
      }
    }
    return value;
  };
  const equivalent=(a,b,q)=>{
    const set=(v)=>Array.isArray(v)?v.map(norm).sort().join('|'):norm(v);
    const a1=set(a),b1=set(b);
    if(a1===b1&&a1!=='')return true;
    if(!Array.isArray(a)&&!Array.isArray(b)){
      if(norm(keyDisplay(a,q))===norm(keyDisplay(b,q)))return true;
      if(typeof b==='boolean'&&['صح','خطأ'].includes(clean(a)))return norm(a)===(b?'صح':'خطأ');
      if(['true','false'].includes(clean(a).toLowerCase())&&['صح','خطأ'].includes(clean(b)))return (clean(a).toLowerCase()==='true')===(clean(b)==='صح');
    }
    return false;
  };
  const groupInputs=()=>{
    const fields=[...document.querySelectorAll('input,textarea,select')].filter(el=>!el.disabled&&!skipTypes.has((el.type||'').toLowerCase())&&el.getAttribute('data-report-exclude')!=='true')
      .filter(el=>!metaName.test(el.name||el.id||''));
    const groups=new Map();
    fields.slice(0,300).forEach((el,index)=>{
      const type=(el.type||el.tagName).toLowerCase();
      const group=(type==='radio'||type==='checkbox')&&el.name?'group:'+el.name:'single:'+index;
      if(!groups.has(group))groups.set(group,[]);groups.get(group).push(el);
    });
    return [...groups.values()].map(els=>{
      const first=els[0],type=(first.type||first.tagName).toLowerCase();
      const options=type==='radio'||type==='checkbox'?els.map(el=>({value:el.value,label:labelOf(el)||el.value})):
        first.tagName==='SELECT'?[...first.options].map(o=>({value:o.value,label:clean(o.textContent)})):[];
      let studentRaw='',studentAnswer='';
      if(type==='radio'||type==='checkbox'){
        const selected=els.filter(el=>el.checked);
        studentRaw=type==='checkbox'?selected.map(el=>el.value):selected[0]?.value||'';
        studentAnswer=selected.map(el=>labelOf(el)||el.value||'تم الاختيار').join('، ');
      }else if(first.tagName==='SELECT'){
        studentRaw=first.value;studentAnswer=clean(first.selectedOptions?.[0]?.textContent||first.value);
      }else{studentRaw=clean(first.value);studentAnswer=studentRaw}
      return {els,type:type==='radio'?'radio':type==='checkbox'?'checkbox':first.tagName==='TEXTAREA'?'essay':first.tagName==='SELECT'?'select':'text',fieldName:first.name||first.id||'',question:questionText(first),studentRaw,studentAnswer,options};
    }).filter(q=>(q.question||q.studentAnswer)&&(!/اسم\s*الطالب|الصف\s*الدراسي|اسم\s*الممتحن|الاسم\s*الثلاثي/i.test(q.question)||q.els[0].closest('.question,.question-card,.quiz-question,.exam-question')));
  };
  const collect=()=>{
    const keys=discoverKey(),groups=groupInputs();
    const questions=groups.map((q,index)=>{
      const key=explicitAnswer(q)||findKey(keys,q,index);
      const essay=q.type==='essay',hasAnswer=Array.isArray(q.studentRaw)?q.studentRaw.length>0:clean(q.studentRaw)!=='';
      const correctAnswer=key?keyDisplay(key.value,q):'';
      const status=essay?'essay':!hasAnswer?'unanswered':!key?'unknown':equivalent(q.studentRaw,key.value,q)||equivalent(q.studentAnswer,key.value,q)?'correct':'incorrect';
      return {number:index+1,question:q.question.slice(0,500),type:q.type,fieldName:q.fieldName.slice(0,70),studentAnswer:q.studentAnswer.slice(0,900),correctAnswer:correctAnswer.slice(0,700),answerStatus:status,answerSource:key?.source||''};
    });
    // The snapshot must fit in the same Firestore field accepted by the old system.
    while(questions.length&&JSON.stringify({format:'zad-answers-v3',questions}).length>11600)questions.pop();
    return {format:'zad-answers-v3',questions};
  };
  const getResult=()=>{
    const text=(document.body?.innerText||'').slice(-18000);
    const patterns=[/نتيجة\s*[^\n:]{0,90}:?\s*(\d+)\s*من\s*(\d+)\s*\((\d+)%\)/,/نتيجة\s*[^\n:]{0,90}:?\s*(\d+)\s*من\s*(\d+)/,/الدرجة\s*:?\s*(\d+)\s*[\/من]+\s*(\d+)/];
    for(const re of patterns){const match=text.match(re);if(match){const score=Number(match[1]),total=Number(match[2]);if(total>0&&total<=1000&&score>=0&&score<=total)return {score,total,source:'exam-auto-grade'};}}
    return null;
  };
  const send=()=>{
    if(done||!armed)return;
    const external=getResult(),after=collect();
    const before=savedSnapshot||after;
    // Prefer the form as it was submitted; enrich only correct answers from the graded page.
    const enriched=before.questions.map((item,i)=>{
      const from=after.questions[i];
      if(!from)return item;
      if(!item.correctAnswer&&from.correctAnswer){
        const answerStatus=item.type==='essay'?'essay':!clean(item.studentAnswer)?'unanswered':
          equivalent(item.studentAnswer,from.correctAnswer,{type:item.type,options:[]})?'correct':'incorrect';
        return {...item,correctAnswer:from.correctAnswer,answerStatus,answerSource:from.answerSource};
      }
      return item;
    });
    const payload={format:'zad-answers-v3',questions:enriched};
    const objective=enriched.filter(q=>q.type!=='essay');
    const fullyKeyed=objective.length>0&&objective.every(q=>q.correctAnswer||q.answerStatus==='unanswered');
    const automatic=fullyKeyed?{score:objective.filter(q=>q.answerStatus==='correct').length,total:objective.length,source:'key-comparison'}:null;
    const hasEssay=enriched.some(q=>q.type==='essay');
    const result=automatic||external||(hasEssay?{score:0,total:Math.max(1,objective.length),source:'essay-pending'}:null);
    if(!result)return;
    payload.gradingMethod=result.source;
    let answers=JSON.stringify(payload);
    while(enriched.length&&answers.length>11950){enriched.pop();answers=JSON.stringify({...payload,questions:enriched})}
    done=true;
    parent.postMessage({source:'zad-code-exam',type:'finish',score:result.score,total:result.total,answers,method:result.source},'*');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hideEmbeddedPrint);else hideEmbeddedPrint();
  document.addEventListener('click',event=>{
    const b=event.target.closest('button,input[type=submit]');
    if(b&&/تسليم|تصحيح|إنهاء|اظهار النتيجة|إظهار النتيجة|submit|finish/i.test(b.innerText||b.value||'')){
      if(!armed)savedSnapshot=collect();armed=true;
      setTimeout(send,250);setTimeout(send,1000);setTimeout(send,2500);setTimeout(send,4800);
    }
  },true);
  document.addEventListener('submit',()=>{if(!armed)savedSnapshot=collect();armed=true;setTimeout(send,300);setTimeout(send,1000);setTimeout(send,2500);},true);
  const observer=new MutationObserver(()=>{hideEmbeddedPrint();if(armed&&!done)send();});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();
</script>
