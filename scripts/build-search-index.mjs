/* Build a public, metadata-only index. No Firebase connection or source-module execution. */
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {webcrypto} from 'node:crypto';
import {normalizeSearch,safeSearchHref} from '../assets/search-core.js';
import {legacyKeyForUrl,normalizeLegacyUrl} from '../assets/library-migration-core.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const text=value=>typeof value==='string'?value.replace(/https?:\/\/\S+/gi,'').replace(/[\u0000-\u001f]/g,' ').trim():'';
const split=value=>[...new Set(text(value).split(/[,،;؛]+/).map(x=>x.trim()).filter(Boolean))];
/* Deliberately accepts only data literals: no calls, getters, spreads, imports, or expressions. */
export function parseDataLiteral(source) {
  let position=0;
  function space(){while(position<source.length){if(/\s/.test(source[position])){position++;continue;}if(source.startsWith('//',position)){position=source.indexOf('\n',position);if(position<0)position=source.length;continue;}if(source.startsWith('/*',position)){const end=source.indexOf('*/',position+2);if(end<0)throw Error('Unclosed comment');position=end+2;continue;}break;}}
  function string(){const quote=source[position++];let value='';while(position<source.length){const c=source[position++];if(c===quote)return value;if(c==='\\'){const e=source[position++];const escapes={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v','0':'\0'};if(e==='u'||e==='x'){const length=e==='u'?4:2,part=source.slice(position,position+length);if(!new RegExp('^[0-9a-f]{'+length+'}$','i').test(part))throw Error('Invalid escape');value+=String.fromCharCode(parseInt(part,16));position+=length;}else value+=escapes[e]??e;}else value+=c;}throw Error('Unclosed string');}
  function value(){space();const c=source[position];if(c==='"'||c==="'")return string();if(c==='['){position++;const out=[];space();while(source[position]!==']'){out.push(value());space();if(source[position]!==',')break;position++;space();}if(source[position++]!==']')throw Error('Invalid data array');return out;}if(c==='{'){position++;const out=Object.create(null);space();while(source[position]!=='}'){let key;if(source[position]==='"'||source[position]==="'")key=string();else{const match=/^[A-Za-z_$][\w$]*/.exec(source.slice(position));if(!match)throw Error('Invalid data key');key=match[0];position+=key.length;}if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsafe data key');space();if(source[position++]!==':')throw Error('Expected colon');out[key]=value();space();if(source[position]!==',')break;position++;space();}if(source[position++]!=='}')throw Error('Invalid data object');return out;}for(const [word,result] of [['true',true],['false',false],['null',null]])if(source.startsWith(word,position)&&!/[\w$]/.test(source[position+word.length]||'')){position+=word.length;return result;}const number=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(source.slice(position));if(number){position+=number[0].length;return Number(number[0]);}throw Error('Only static data literals may be indexed');}
  const result=value();space();if(position!==source.length)throw Error('Unexpected code after data');return result;
}
export function extractArray(source,name) {
  const declaration=new RegExp('(?:export\\s+)?(?:const|let|var)\\s+'+name+'\\s*=\\s*\\[').exec(source);
  if(!declaration)throw Error('Missing metadata array: '+name);
  const start=declaration.index+declaration[0].length-1;let depth=0,quote='',escape=false,comment='';
  for(let i=start;i<source.length;i++){const c=source[i],next=source[i+1];if(comment==='line'){if(c==='\n')comment='';continue;}if(comment==='block'){if(c==='*'&&next==='/'){comment='';i++;}continue;}if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='/'&&next==='/'){comment='line';i++;continue;}if(c==='/'&&next==='*'){comment='block';i++;continue;}if(c==='[')depth++;if(c===']'&&--depth===0)return parseDataLiteral(source.slice(start,i+1));}
  throw Error('Unclosed metadata array: '+name);
}
function gradeLabels(value,title='') {
  const source=text(value)||text(title);const encoded=/^([1-6])(prep|sec|pri|primary)$/.exec(source);if(encoded){const order=['الأول','الثاني','الثالث','الرابع','الخامس','السادس'][Number(encoded[1])-1];return [order+' '+({prep:'الإعدادي',sec:'الثانوي',pri:'الابتدائي',primary:'الابتدائي'}[encoded[2]])];}const normalized=normalizeSearch(source),labels=[];
  const stages=[['ابتدائي','الابتدائي'],['اعدادي','الإعدادي'],['ثانوي','الثانوي'],['بكالوريا','البكالوريا']];
  const orders=[['اول','الأول'],['ثاني','الثاني'],['ثالث','الثالث'],['رابع','الرابع'],['خامس','الخامس'],['سادس','السادس']];
  for(const [needle,label] of stages)if(normalized.includes(needle))for(const [order,name] of orders)if(normalized.includes(order))labels.push(name+' '+label);
  return [...new Set(labels)];
}
function canonicalSubject(value) {
  const key=normalizeSearch(value);
  const aliases=new Map([
    ['لغه عربيه','اللغة العربية'],['اللغه العربيه','اللغة العربية'],['عربي','اللغة العربية'],['العربيه','اللغة العربية'],
    ['لغه انجليزي','اللغة الإنجليزية'],['اللغه الانجليزي','اللغة الإنجليزية'],['انجليزي','اللغة الإنجليزية'],['الانجليزي','اللغة الإنجليزية'],['كورسات اللغه الانجليزي','اللغة الإنجليزية']
  ]);
  return aliases.get(key)||value;
}
/** A literal subject word in the title overrides misleading legacy group labels.
 * Do not infer from publisher names, school tracks (علمي/أدبي), or descriptions.
 * Unknown titles preserve their original metadata, apart from known label aliases. */
export function subjectLabels(value,title='') {
  const titleKey=normalizeSearch(title);
  const word=pattern=>new RegExp('(?:^| )(?:[وفبك]?(?:ال)?|لل)?(?:'+pattern+')(?= |$)').test(titleKey);
  const found=[];
  const add=(label,pattern)=>{if(word(pattern))found.push(label);};
  add('اللغة الإنجليزية','انجليزي');
  add('النحو','نحو|نحويه');
  add('الصرف','صرف');
  add('البلاغة','بلاغه');
  add('الأدب والنصوص','ادب|نصوص');
  add('الرياضيات','رياضيات|mathematics|maths|math');
  add('الفيزياء','فيزياء|physics');
  add('الكيمياء','كيمياء|chemistry');
  add('الأحياء','احياء|بيولوجيا|biology');
  add('الجيولوجيا','جيولوجيا|geology');
  add('التاريخ','تاريخ|history');
  add('الجغرافيا','جغرافيا|geography');
  add('الفلسفة','فلسفه');
  add('المنطق','منطق');
  add('التوحيد','توحيد');
  add('الفقه','فقه');
  // «التاريخ الحديث» names history, not the separate subject of Hadith.
  if(!found.includes('التاريخ'))add('الحديث','حديث|احاديث');
  add('التفسير','تفسير');
  add('التجويد','تجويد');
  if(word('علوم (?:ال)?متكامله'))found.push('العلوم المتكاملة');
  else if(word('علوم|science')&&!/علوم (?:ال)?شرعيه/.test(titleKey))found.push('العلوم');
  // Arabic is a broader label; explicit grammar/rhetoric words get the precise facet.
  if(!found.length&&word('لغه (?:ال)?عربيه|عربي|عربيه'))found.push('اللغة العربية');
  if(!found.length&&word('قران'))found.push('القرآن الكريم');
  return found.length?[...new Set(found)]:[...new Set(split(value).map(canonicalSubject))];
}
export async function buildSearchIndex(projectRoot=root) {
  const read=path=>readFile(resolve(projectRoot,path),'utf8');
  const records=[],targets=new Set();
  const add=record=>{if(!record.title||!record.id||!safeSearchHref(record.href))throw Error('Invalid index entry: '+record.id);if(targets.has(record.href))return;targets.add(record.href);records.push(record);};
  const products=extractArray(await read('store/catalog-data.js'),'baseProducts');
  const allowed=new Set(['book','summary','exam','evaluation','course','lesson']);
  for(const item of products){if(!allowed.has(item.type)||item.deleted===true||item.published===false||!text(item.id)||!text(item.title)||['lib-101','lib-102'].includes(item.id))continue;const subjects=subjectLabels(item.subject,item.title),grades=gradeLabels(item.grade,item.title);add({id:'product:'+item.id,title:text(item.title),type:item.type,subject:subjects[0]||'',subjects,grade:grades[0]||'',grades,description:text(item.description).slice(0,220),href:'store/index.html?product='+encodeURIComponent(item.id)+'#catalog',access:'store'});}
  const examCatalog=extractArray(await read('sections/tests/exam-catalog.js'),'items');
  const catalogById=new Map(examCatalog.map(item=>[item.id,item]));
  for(const [bankPath,page] of [['exams/unit1/bank.json','unit-one-exam.html'],['exams/zad-special/bank.json','zad-special-exam.html']]){
    const bank=JSON.parse(await read(bankPath));
    for(const item of bank.exams||[]){if(item.published===false||item.deleted===true||!text(item.id))continue;const extra=catalogById.get(item.id)||{},gradeText=text(item.grade)||text(item.level)||text(extra.note),grades=gradeLabels(gradeText,item.title),subjects=subjectLabels(item.subject,item.title||item.name);add({id:page+':'+item.id,title:text(item.title||item.name),type:'exam',subject:subjects[0]||'',subjects,grade:grades[0]||'',grades,description:text(item.scope||extra.note||'امتحان إلكتروني داخل المنصة.').slice(0,220),href:'sections/tests/'+page+'?id='+encodeURIComponent(item.id),access:'exam'});}
  }
  for(const item of examCatalog){const href='sections/tests/'+text(item.url);if(targets.has(href))continue;const grades=gradeLabels(item.note,item.name),subjects=subjectLabels(item.subject,item.name);add({id:'exam:'+item.id,title:text(item.name),type:'exam',subject:subjects[0]||'',subjects,grade:grades[0]||'',grades,description:text(item.note).slice(0,220),href,access:'exam'});}
  const teachers=extractArray(await read('teachers/index.html'),'LEGACY_TEACHERS');
  for(const item of teachers){const subjects=subjectLabels(item.subject),grades=gradeLabels(item.stages),name=text(item.name);const coursesOnly=normalizeSearch(item.subject).includes('كورسات');const query=new URLSearchParams({teacher:name});if(text(item.bookingSection))query.set('section',text(item.bookingSection));if(text(item.bookingSubject)||subjects[0])query.set('subject',text(item.bookingSubject)||subjects[0]);add({id:'teacher:'+text(item.legacyKey),title:name,type:'teacher',subject:subjects[0]||'',subjects,grade:grades[0]||'',grades,description:text(item.role||item.bio).slice(0,220),href:coursesOnly?'teachers/index.html#teachersGrid':'sections/booking/index.html?'+query.toString(),access:'teacher'});}
  const summaries=JSON.parse(await read('summary-text-index.json'));
  const libraryMetadata=JSON.parse(await read('library-catalog.json'));
  const sourceBase='https://zadalmrfh-create.github.io/zad-almaarefa/';
  const metadataBySource=new Map(libraryMetadata.filter(item=>typeof item.url==='string').map(item=>[normalizeLegacyUrl(item.url,sourceBase),item]));
  for(const item of summaries){if(!text(item.title)||typeof item.url!=='string')continue;const key=await legacyKeyForUrl(item.url,'https://zadalmrfh-create.github.io/zad-almaarefa/',webcrypto);if(!key)continue;const metadata=metadataBySource.get(normalizeLegacyUrl(item.url,sourceBase))||{},subjects=subjectLabels(metadata.category,item.title),grades=gradeLabels(metadata.grade);add({id:'indexed-summary:'+key,title:text(item.title),type:'summary',subject:subjects[0]||'',subjects,grade:grades[0]||'',grades,description:'ملخص مفهرس في المنصة. فتح الملف يخضع لصلاحية الوصول وحالة تجهيز المصدر.',href:'sections/book-access.html?legacy='+key,access:'protected-gateway'});}
  for(const item of records){const path=decodeURIComponent(item.href.split(/[?#]/)[0]);const target=resolve(projectRoot,path);if(relative(projectRoot,target).startsWith('..'))throw Error('Outside project link');try{await access(target);}catch{throw Error('Missing search destination: '+path);}}
  const index={version:1,generatedAt:new Date().toISOString(),source:'project-files',records};
  await mkdir(resolve(projectRoot,'assets'),{recursive:true});
  await writeFile(resolve(projectRoot,'assets/search-index.json'),JSON.stringify(index,null,2)+'\n');
  return {records:records.length,types:Object.fromEntries([...new Set(records.map(x=>x.type))].map(type=>[type,records.filter(x=>x.type===type).length])),output:'assets/search-index.json'};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){buildSearchIndex().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});}
