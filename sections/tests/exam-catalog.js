/* Zad Al-Maarefa — exam catalog | stage -> track -> grade -> subject
   Firestore read occurs only after the student selects the stage (one limited query). */
import { db } from '../../firebase-config.js';
import { collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { examAuthReady } from './exam-auth-gate.js';

const $ = id => document.getElementById(id);
const state={stage:'',track:'',grade:'',subject:'all',search:'',remoteLoaded:false,remoteLoading:false};
const items=[
 {id:'water-azhar-2026',name:'الماء وخصائصه الكيميائية — نموذج (2)',subject:'العلوم المتكاملة',stage:'secondary',track:'azhar',grade:1,minutes:30,questions:20,icon:'💧',note:'الصف الأول الثانوي الأزهري • اختيار وأكمل ومقالي ومسائل',url:'zad-special-exam.html?id=water-azhar-2026'},
 {id:'fiqh-khiyar-azhar-2026-v2',name:'الفقه الحنفي — خيار الشرط والرؤية والعيب',subject:'الفقه',stage:'secondary',track:'azhar',grade:0,minutes:60,questions:40,icon:'⚖️',note:'مراجعة للمرحلة الثانوية الأزهرية • 4 أقسام متنوعة',url:'zad-special-exam.html?id=fiqh-khiyar-azhar-2026-v2'},
 {id:'badi-2bac-2026',name:'البلاغة — علم البديع',subject:'البلاغة',stage:'secondary',track:'general',grade:2,minutes:60,questions:30,icon:'🎨',note:'الصف الثاني البكالوريا • اختيار ومقالي',url:'unit-one-exam.html?id=badi-2bac-2026'},
 {id:'legacy-nahw',name:'امتحان النحو الإلكتروني',subject:'النحو',stage:'secondary',track:'azhar',grade:0,minutes:null,questions:null,icon:'📘',note:'مراجعة عامة للنحو',url:'nahw.html'},
 {id:'legacy-balagha',name:'امتحان البلاغة الإلكتروني',subject:'البلاغة',stage:'secondary',track:'azhar',grade:0,minutes:null,questions:null,icon:'🎨',note:'مراجعة عامة للبلاغة',url:'balagha.html'},
 {id:'legacy-tawheed',name:'امتحان التوحيد الإلكتروني',subject:'التوحيد',stage:'secondary',track:'azhar',grade:0,minutes:null,questions:null,icon:'🕌',note:'مراجعة عامة للتوحيد',url:'tawheed.html'}
];
const icons={'الفقه':'⚖️','العلوم المتكاملة':'💧','البلاغة':'🎨','اللغة العربية':'📖','اللغة الإنجليزية':'🇬🇧','English':'🇬🇧','الرياضيات':'📐','الفيزياء':'⚛️','التاريخ':'📜','الكيمياء':'🧪','التوحيد':'🕌','النحو':'📘','الأدب والنصوص':'✍️'};
const gradeNames={1:'الأول',2:'الثاني',3:'الثالث'};
const stageLabel=()=>state.stage==='prep'?'الإعدادية':'الثانوية';
const trackLabel=()=>state.track==='azhar'?'أزهري':'عام وبكالوريا';
const collectionUrl=id=>'code-exam.html?id='+encodeURIComponent(id);
function append(parent,tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;parent.append(el);return el}
function gradeOf(v){const s=String(v||'');if(!s)return 0;if(/الثالث|تالت|3rd|third|^3$|3\s*ث/.test(s))return 3;if(/الثاني|تاني|تانية|2nd|second|^2$|2\s*ث/.test(s))return 2;if(/الأول|اول|أولى|1st|first|^1$|1\s*ث/.test(s))return 1;return 0}
function stageOf(v,grade){const s=String(v||'').toLowerCase();if(['prep','preparatory','middle'].includes(s)||/اعداد|إعداد/.test(grade))return 'prep';return 'secondary'}
function iconFor(s){return icons[s]||'📝'}
const relevant=()=>items.filter(x=>x.stage===state.stage&&(x.track==='both'||x.track===state.track)&&(!x.grade||x.grade===Number(state.grade)));
const matchText=(x)=>[x.name,x.subject,x.note].join(' ').toLowerCase().includes(state.search.toLowerCase());

function steps(){[['stepStage',state.stage],['stepTrack',state.track],['stepGrade',state.grade],['stepSubject',state.grade]].forEach(([id,val],i)=>{const el=$(id);el.className='step '+(val?(i===3?'active':'done'):(i===0|| (i===1&&state.stage)||(i===2&&state.track)||(i===3&&state.grade)?'active':''));});}
function pickStage(stage){state.stage=stage;state.track='';state.grade='';state.subject='all';state.search='';document.querySelectorAll('[data-stage]').forEach(b=>b.classList.toggle('active',b.dataset.stage===stage));$('trackPanel').hidden=false;$('gradePanel').hidden=true;$('catalogPanel').hidden=true;steps();$('trackPanel').scrollIntoView({behavior:'smooth',block:'start'});loadRemote();}
function pickTrack(track){state.track=track;state.grade='';state.subject='all';state.search='';document.querySelectorAll('[data-track]').forEach(b=>b.classList.toggle('active',b.dataset.track===track));$('gradePanel').hidden=false;$('catalogPanel').hidden=true;for(let i=1;i<=3;i++)$('grade'+i+'Text').textContent=stageLabel()+(track==='azhar'?' الأزهري':'');steps();$('gradePanel').scrollIntoView({behavior:'smooth',block:'start'});}
function pickGrade(grade){state.grade=grade;state.subject='all';state.search='';$('examSearch').value='';document.querySelectorAll('[data-grade]').forEach(b=>b.classList.toggle('active',b.dataset.grade===grade));$('catalogPanel').hidden=false;steps();render();$('catalogPanel').scrollIntoView({behavior:'smooth',block:'start'});}
function render(){if(!state.grade)return;const breadcrumbs=$('breadcrumbs');breadcrumbs.replaceChildren();for(const [idx,t] of [stageLabel(),trackLabel(),gradeNames[state.grade]+' '+stageLabel()].entries()){if(idx)append(breadcrumbs,'span','','‹');append(breadcrumbs,idx===2?'b':'span','',t)}
 const filtered=relevant(),subjects=['all',...new Set(filtered.map(x=>x.subject))];if(!subjects.includes(state.subject))state.subject='all';const tabs=$('subjectTabs');tabs.replaceChildren();subjects.forEach(subject=>{const b=append(tabs,'button','subject-tab'+(state.subject===subject?' active':''),subject==='all'?'كل المواد':subject);b.type='button';b.setAttribute('aria-pressed',String(state.subject===subject));b.onclick=()=>{state.subject=subject;render()}});
 const visible=filtered.filter(x=>(state.subject==='all'||x.subject===state.subject)&&matchText(x));$('countLabel').textContent=`${visible.length} امتحان متاح`;
 const cards=$('examCards');cards.replaceChildren();for(const x of visible){const card=append(cards,'article','exam-card');const row=append(card,'div','card-top');append(row,'span','subjicon',x.icon||iconFor(x.subject));append(row,'span','tag',x.subject);append(card,'h4','',x.name);append(card,'p','description',x.note||'');const metas=append(card,'div','meta');append(metas,'em','',x.grade===0?'مراجعة عامة':gradeNames[x.grade]+' '+stageLabel());if(x.questions)append(metas,'em','',x.questions+' سؤالًا');if(x.minutes)append(metas,'em','',x.minutes+' دقيقة');const a=append(card,'a','','ابدأ الامتحان ←');a.href=x.url;a.setAttribute('aria-label','ابدأ امتحان '+x.name);}
 if(!visible.length){const note=append(cards,'div','placeholder');append(note,'div','','📭');append(note,'strong','','لا توجد امتحانات مطابقة للاختيار الحالي');append(note,'p','','جرّب مادة أخرى، أو غيّر الصف أو النظام لعرض المتاح حاليًا.');}
}
async function loadStatic(){try{const res=await fetch('../../exams/unit1/bank.json',{cache:'force-cache'});if(!res.ok)throw Error('bank unavailable');const bank=await res.json();for(const x of bank.exams){if(x.id==='badi-2bac-2026')continue;items.push({id:'unit-'+x.id,name:x.title,subject:x.subject||'مادة عامة',stage:'secondary',track:'general',grade:2,minutes:60,questions:Array.isArray(x.questions)?x.questions.length:30,icon:iconFor(x.subject),note:'الوحدة الأولى • الصف الثاني الثانوي / البكالوريا',url:'unit-one-exam.html?id='+encodeURIComponent(x.id)})}render();}catch(err){console.info('Unit-one exam list not available:',err.message);}}
async function loadRemote(){if(state.remoteLoaded||state.remoteLoading)return;state.remoteLoading=true;try{
 await examAuthReady;
 // A bounded one-off query; no continuous onSnapshot listener on the catalog.
 const snap=await getDocs(query(collection(db,'codeExams'),where('published','==',true),limit(120)));
 for(const d of snap.docs){const v=d.data();const track=v.stage==='secondary'?'azhar':v.stage==='prep'?'both':'general';items.push({id:'db-'+d.id,name:String(v.title||'امتحان إلكتروني'),subject:String(v.subject||'مادة عامة'),stage:stageOf(v.stage,v.grade),track,grade:gradeOf(v.grade),minutes:null,questions:null,icon:iconFor(v.subject),note:[String(v.grade||''),'امتحان إلكتروني منشور'].filter(Boolean).join(' • '),url:collectionUrl(d.id)})}
 state.remoteLoaded=true;$('catalogStatus').textContent='تم تحديث قائمة الامتحانات المنشورة.';render();
 }catch(err){$('catalogStatus').textContent='تعذر تحديث امتحانات قاعدة البيانات حاليًا، ويمكنك استخدام الامتحانات الثابتة الظاهرة. '+(err.code||'');$('catalogStatus').classList.add('error');}finally{state.remoteLoading=false}}

for(const btn of document.querySelectorAll('[data-stage]'))btn.addEventListener('click',()=>pickStage(btn.dataset.stage));
for(const btn of document.querySelectorAll('[data-track]'))btn.addEventListener('click',()=>pickTrack(btn.dataset.track));
for(const btn of document.querySelectorAll('[data-grade]'))btn.addEventListener('click',()=>pickGrade(btn.dataset.grade));
$('examSearch').addEventListener('input',e=>{state.search=e.target.value.trim();render()});
$('resetFilters').addEventListener('click',()=>{$('stagePanel').scrollIntoView({behavior:'smooth',block:'start'});});
steps();loadStatic();
