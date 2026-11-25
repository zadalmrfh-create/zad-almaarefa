import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {createPublicLibrarySearch,publicLibraryMetadata,libraryGatewayUrl,libraryMetadataContext,LIBRARY_SOURCE_BASE} from '../server/library-search.js';
import {legacyKeyForUrl} from '../assets/library-migration-core.mjs';

test('Library API projects metadata and never exposes direct sources or extra source fields',()=>{
  const source='https://drive.google.com/file/d/PRIVATE_BOOK_ID/view?usp=sharing';
  const search=createPublicLibrarySearch([{title:'كتاب الفيزياء',description:'مراجعة فيزياء https://files.example/private.pdf',grade:'الثاني الثانوي',category:'الفيزياء',type:'books',url:source,downloadUrl:source,storagePath:'private-files/object.pdf',text:'PAID_BODY_MARKER',secret:'PRIVATE'}]);
  const results=search.searchLibrary('فيزياء');assert.equal(results.length,1);const serialized=JSON.stringify(results);
  assert.doesNotMatch(serialized,/drive\.google|files\.example|PRIVATE_BOOK_ID|PAID_BODY_MARKER|storagePath|downloadUrl|"secret"/);
  assert.deepEqual(Object.keys(results[0]).sort(),['category','description','grade','title','type','url']);
  assert.match(results[0].url,/^sections\/book-access\.html\?legacy=[a-f0-9]{64}&title=/);
  assert.equal(search.total,1);
});
test('Summary lookup searches metadata only and never reads document text',()=>{
  const summary={title:'ملخص علم التوحيد',url:'books/tawheed.pdf'};
  Object.defineProperty(summary,'text',{get(){throw Error('Document body must not be read');}});
  Object.defineProperty(summary,'excerpt',{get(){throw Error('Excerpt must not be read');}});
  const search=createPublicLibrarySearch([], [summary]);const results=search.searchSummaries('التوحيد');
  assert.equal(results.length,1);assert.equal(Object.hasOwn(results[0],'text'),false);assert.equal(Object.hasOwn(results[0],'excerpt'),false);
  assert.equal(search.searchSummaries('SECRET_BODY_TERM').length,0);
  assert.doesNotMatch(libraryMetadataContext(results),/undefined|\[مقتطف/);
});
test('Empty or invalid sources use a real store/library page rather than hashing a made-up source',()=>{
  for(const value of ['',null,undefined,'javascript:alert(1)','data:application/pdf,x','https://user:secret@example.test/file.pdf'])assert.equal(libraryGatewayUrl(value,'كتاب'),'store/index.html#catalog');
  assert.equal(libraryGatewayUrl('','امتحان','questions'),'sections/library.html');
});
test('Server SHA matches the existing migration core for Drive and internal links',async()=>{
  for(const source of ['https://drive.google.com/open?id=DEMO_SOURCE_ID','books/demo.pdf#page=2','https://zadalmrfh-create.github.io/zad-almaarefa/books/demo.pdf?download=1']){
    const expected=await legacyKeyForUrl(source,LIBRARY_SOURCE_BASE,webcrypto);
    const actual=new URL(libraryGatewayUrl(source,'عنوان'), 'https://example.test/').searchParams.get('legacy');assert.equal(actual,expected);
  }
  const first=libraryGatewayUrl('books/demo.pdf','عنوان');
  const hosted=libraryGatewayUrl('https://school.test/zad/books/demo.pdf#page=5','عنوان','','https://school.test/zad/');
  assert.equal(first,hosted);
});
test('Public projection strips URLs embedded in metadata and does not mutate source records',()=>{
  const original={title:'كتاب https://secret.example/book',description:'تعريف <a href="https://secret.example/file">بالمادة</a>',url:'books/a.pdf',text:'PRIVATE_BODY'};
  const projected=publicLibraryMetadata(original);assert.doesNotMatch(JSON.stringify(projected),/secret\.example|PRIVATE_BODY/);assert.equal(original.text,'PRIVATE_BODY');
  assert.match(projected.url,/title=/);
});
test('Search limits are bounded and unknown queries remain empty',()=>{
  const rows=Array.from({length:80},(_,i)=>({title:'فيزياء '+i,url:'books/'+i+'.pdf'}));const search=createPublicLibrarySearch(rows);
  assert.equal(search.searchLibrary('فيزياء',999).length,50);assert.equal(search.searchLibrary('فيزياء',0).length,0);assert.equal(search.searchLibrary('جغرافيا').length,0);
});

const browserSource=await readFile(new URL('../chatbot.js',import.meta.url),'utf8');
const context=vm.createContext({URL,document:{currentScript:{src:'https://school.test/zad/chatbot.js'},baseURI:'https://school.test/zad/index.html',addEventListener(){}}});
new vm.Script(browserSource,{filename:'chatbot.js'}).runInContext(context,{timeout:1000});
const sourceURL=context.zadResolveChatSource;
test('Chatbot accepts project-relative sections/store HTML and preserves a deployment prefix',()=>{
  assert.equal(sourceURL('sections/book-access.html?legacy='+'a'.repeat(64)+'&title=book'),'https://school.test/zad/sections/book-access.html?legacy='+'a'.repeat(64)+'&title=book');
  assert.equal(sourceURL('store/index.html#catalog'),'https://school.test/zad/store/index.html#catalog');
  assert.equal(sourceURL('sections/tests/nahw.html'),'https://school.test/zad/sections/tests/nahw.html');
});
test('Chatbot rejects external links, credentials, traversal, protocol tricks and non-HTML files',()=>{
  const blocked=['https://evil.test/sections/a.html','https://user:secret@school.test/zad/sections/a.html','//evil.test/a.html','/sections/a.html','../sections/a.html','sections/../store/index.html','sections/%2e%2e/store/index.html','sections/%252e%252e/store/index.html','sections\\a.html','javascript:alert(1)','data:text/html,hello','books/private.pdf','sections/private.pdf','sections/a.html\n','sections/a.html '];
  for(const value of blocked)assert.equal(sourceURL(value),'',value);
});
test('Actual server-only catalog projections contain no raw URLs or document text',async()=>{
  const catalog=JSON.parse(await readFile(new URL('../library-catalog.json',import.meta.url),'utf8'));const summaries=JSON.parse(await readFile(new URL('../summary-text-index.json',import.meta.url),'utf8'));
  const metadata=catalog.map(item=>publicLibraryMetadata(item));const summaryMetadata=summaries.map(item=>publicLibraryMetadata(item,{type:'summary'}));
  assert.doesNotMatch(JSON.stringify([...metadata,...summaryMetadata]),/https?:\/\/|"excerpt"|"text"|\.pdf(?:["?#\s]|$)/i);
  for(const row of [...metadata,...summaryMetadata])assert.ok(sourceURL(row.url));
});
