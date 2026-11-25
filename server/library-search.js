/* Server-only public metadata projection. Source URLs and document bodies never leave it. */
import {createHash} from 'node:crypto';
import {normalizeLegacyUrl} from '../assets/library-migration-core.mjs';
import {normalizeSearch} from '../assets/search-core.js';
export const LIBRARY_SOURCE_BASE='https://zadalmrfh-create.github.io/zad-almaarefa/';
const ignored=new Set(['انا','عايز','عاوز','ممكن','فين','اللي','في','من','عن','علي','فيه','الي','ايه','هات','كتاب','كتب','الكتب','ملخص','الملخصات','محتاج','عايزه','ماده','الصف','ابحث','عندك','شوف']);
const text=(value,max=220)=>typeof value==='string'?value.replace(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi,'').replace(/<[^>]*>/g,'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
function fallback(type){return type==='questions'||type==='electronic_exam'||type==='interactive_exam'?'sections/library.html':'store/index.html#catalog';}
export function libraryGatewayUrl(source,title='',type='',baseUrl=LIBRARY_SOURCE_BASE){
  if(typeof source!=='string'||!source.trim())return fallback(type);
  try{const canonical=normalizeLegacyUrl(source,baseUrl);const legacy=createHash('sha256').update(canonical,'utf8').digest('hex');const params=new URLSearchParams({legacy,title:text(title,180)});return 'sections/book-access.html?'+params.toString();}
  catch{return fallback(type);}
}
export function publicLibraryMetadata(record={},options={}){
  const title=text(record.title,180),type=text(record.type||options.type||'',40);
  return {title,description:text(record.description),grade:text(record.grade,100),category:text(record.category,100),type,url:libraryGatewayUrl(record.url,title,type,options.baseUrl)};
}
function keywords(query){return [...new Set(normalizeSearch(query).split(' ').filter(word=>word.length>1&&!ignored.has(word)))].slice(0,18);}
function ranked(rows,query,max){const keys=keywords(query);if(!keys.length)return [];const count=Number.isInteger(max)?Math.max(0,Math.min(50,max)):6;
  return rows.map((row,index)=>{const title=normalizeSearch(row.title),rest=normalizeSearch([row.description,row.category,row.grade,row.type].join(' '));const rank=keys.reduce((sum,word)=>sum+(title.includes(word)?6:rest.includes(word)?2:0),0);return {row,rank,index};}).filter(x=>x.rank>0).sort((a,b)=>b.rank-a.rank||a.index-b.index).slice(0,count).map(x=>({...x.row}));
}
export function createPublicLibrarySearch(catalog=[],summaries=[],options={}){
  const books=(Array.isArray(catalog)?catalog:[]).filter(x=>x&&x.deleted!==true&&x.published!==false).map(item=>publicLibraryMetadata(item,options)).filter(x=>x.title);
  // Read title/metadata only. In particular, do not access summary.text or summary.excerpt.
  const summaryMetadata=(Array.isArray(summaries)?summaries:[]).filter(x=>x&&x.deleted!==true&&x.published!==false).map(item=>publicLibraryMetadata(item,{...options,type:'summary'})).filter(x=>x.title);
  return {total:books.length,searchLibrary:(query,max=6)=>ranked(books,query,max),searchSummaries:(query,max=3)=>ranked(summaryMetadata,query,max)};
}
export function libraryMetadataContext(rows=[]){
  const valid=url=>typeof url==='string'&&(url==='store/index.html#catalog'||url==='sections/library.html'||/^sections\/book-access\.html\?legacy=[a-f0-9]{64}&title=/.test(url));
  return rows.filter(row=>row&&valid(row.url)).map(row=>'- '+text(row.title,180)+(text(row.grade,100)?' ('+text(row.grade,100)+')':'')+' — '+row.url).join('\n');
}
