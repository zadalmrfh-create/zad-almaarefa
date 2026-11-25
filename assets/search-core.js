/* Search public metadata only. This module never grants access to content. */
export const SEARCH_TYPES = Object.freeze({book:'كتب',summary:'ملخصات',exam:'اختبارات',evaluation:'تقييمات',teacher:'معلمون',course:'كورسات',lesson:'دروس'});
const stopWords = new Set(['في','من','عن','علي','الي','عاوز','عايز','اريد','ممكن','ابحث','الصف']);
const digit = character => String('٠١٢٣٤٥٦٧٨٩'.includes(character) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(character) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(character));
export function normalizeSearch(value = '') {
  return String(value).normalize('NFKC').toLocaleLowerCase('ar')
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
    .replace(/[٠-٩۰-۹]/g,digit)
    .replace(/\b([123])\s*ث(?=\s|$)/g,(_,n)=>({'1':'الاول الثانوي','2':'الثاني الثانوي','3':'الثالث الثانوي'}[n]))
    .replace(/(?:\benglish\b|انجليزيه|انجليزي|انجليزيه|انجليزى)/g,'انجليزي')
    .replace(/(^|\s)(اولي|اولى)(?=\s|$)/g,'$1اول')
    .replace(/(^|\s)(تانيه|ثانيه|تاني)(?=\s|$)/g,'$1ثاني')
    .replace(/(^|\s)(تالته|ثالثه|تالت)(?=\s|$)/g,'$1ثالث')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
export function searchTokens(value) {
  return [...new Set(normalizeSearch(value).split(' ').filter(word=>word && !stopWords.has(word)))].slice(0,16);
}
export function safeSearchHref(href, base = 'https://zad.invalid/') {
  if(typeof href!=='string' || href.length>1600 || !href || /^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(href) || /[\u0000-\u001f]/.test(href))return '';
  try {
    const parent = new URL(base), url = new URL(href,parent);
    if(url.origin!==parent.origin || url.username || url.password || !url.pathname.endsWith('.html'))return '';
    if(href.split(/[?#]/)[0].split('/').includes('..'))return '';
    return href;
  } catch { return ''; }
}
export function prepareSearchRecords(records = []) {
  return records.filter(item=>item && typeof item.title==='string' && SEARCH_TYPES[item.type] && safeSearchHref(item.href)).map(item=>{
    const subjects=Array.isArray(item.subjects)?item.subjects.filter(x=>typeof x==='string'):[];
    const grades=Array.isArray(item.grades)?item.grades.filter(x=>typeof x==='string'):[];
    const clean={id:String(item.id||''),title:item.title,type:item.type,href:item.href,subject:String(item.subject||''),grade:String(item.grade||''),description:String(item.description||''),access:String(item.access||''),subjects,grades};
    const fields=[clean.title,[clean.subject,...subjects].join(' '),[clean.grade,...grades].join(' '),clean.description,SEARCH_TYPES[clean.type]].map(normalizeSearch);
    return {...clean,_fields:fields,_search:fields.join(' ')};
  });
}
export function searchRecords(records,{query='',subject='',grade='',type=''} = {}) {
  const terms=searchTokens(query),needle=normalizeSearch(query),subjectKey=normalizeSearch(subject),gradeKey=normalizeSearch(grade);
  const prepared=records.every(x=>Array.isArray(x._fields))?records:prepareSearchRecords(records);
  return prepared.filter(item=>{
    if(type && item.type!==type)return false;
    if(subjectKey && ![item.subject,...item.subjects].some(x=>normalizeSearch(x)===subjectKey))return false;
    if(gradeKey && ![item.grade,...item.grades].some(x=>normalizeSearch(x)===gradeKey))return false;
    return terms.every(term=>item._search.includes(term));
  }).map(item=>({item,score:(needle&&item._fields[0].includes(needle)?20:0)+terms.reduce((sum,term)=>sum+item._fields.reduce((s,value,index)=>s+(value.includes(term)?[8,5,4,1,1][index]:0),0),0)}))
    .sort((a,b)=>b.score-a.score || a.item.title.localeCompare(b.item.title,'ar'))
    .map(({item})=>item);
}
export function searchFacets(records) {
  const unique = values => [...new Set(values.filter(x=>typeof x==='string'&&x.trim()))].sort((a,b)=>a.localeCompare(b,'ar'));
  return {subjects:unique(records.flatMap(x=>[x.subject,...(x.subjects||[])])),grades:unique(records.flatMap(x=>[x.grade,...(x.grades||[])]))};
}
