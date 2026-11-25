import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {INTERNAL_LIBRARY_BASE,MAX_LIBRARY_PDF_BYTES,isLibraryOwner,safeLegacyUrl,normalizeLegacyUrl,
  MIGRATION_COLLECTION,legacyKeyForUrl,validLegacyKey,validProtectedBookId,validateMigrationMapping,buildMigrationMapping,assertMigrationTransition,
  resolveLibraryRoute,validateLibraryPdf,buildLegacyInventory,inventoryMetadata} from '../assets/library-migration-core.mjs';

const owner='owner@example.test';
const mapping=(kind,extra={})=>buildMigrationMapping({kind,title:'كتاب تجريبي',...extra},'owner-uid',{seconds:100,nanoseconds:0});
const protectedMapping=()=>mapping('protected',{bookId:'Book123456'});
const freeMapping=()=>mapping('free',{freeTarget:'https://example.test/free.pdf'});
const route=extras=>resolveLibraryRoute({hasSession:true,isSubscribed:true,...extras});

test('file management requires the configured verified, non-anonymous owner',()=>{
  assert.equal(isLibraryOwner({email:owner,emailVerified:true},owner),true);
  assert.equal(isLibraryOwner({email:owner.toUpperCase(),emailVerified:true},owner),false);
  for(const user of [null,{email:owner,emailVerified:false},{email:owner,emailVerified:true,isAnonymous:true},
    {email:'admin@example.test',emailVerified:true,role:'admin'},{email:owner}])assert.equal(isLibraryOwner(user,owner),false);
});

test('relative identity survives root hosting, preview origin, and project prefixes',async()=>{
  const relative='sections/material.pdf#page=2';
  const expected=await legacyKeyForUrl(relative,undefined,webcrypto);
  for(const [url,base] of [
    ['sections/material.pdf','http://localhost:4173/'],
    ['http://localhost:4173/sections/material.pdf?tracking=1','http://localhost:4173/'],
    ['https://example.test/project/sections/material.pdf','https://example.test/project/'],
    ['sections/material.pdf','https://example.test/project/'],
    ['https://preview.test/sections/material.pdf','https://preview.test/']
  ])assert.equal(await legacyKeyForUrl(url,base,webcrypto),expected);
  assert.equal(normalizeLegacyUrl(relative),INTERNAL_LIBRARY_BASE+'sections/material.pdf');
  assert.equal(validLegacyKey(expected),true);
  assert.equal(validLegacyKey('not-a-hash'),false);
});

test('Drive viewing/export aliases have one identity; other query identities survive',async()=>{
  const variants=['https://drive.google.com/file/d/FILE_123/view?usp=sharing',
    'https://drive.google.com/open?id=FILE_123','https://drive.google.com/uc?export=download&id=FILE_123'];
  const keys=await Promise.all(variants.map(url=>legacyKeyForUrl(url,undefined,webcrypto)));
  assert.equal(new Set(keys).size,1);
  assert.notEqual(keys[0],await legacyKeyForUrl('https://drive.google.com/file/d/OTHER/view',undefined,webcrypto));
  assert.notEqual(normalizeLegacyUrl('https://example.test/view?id=1'),normalizeLegacyUrl('https://example.test/view?id=2'));
});

test('destinations reject executable schemes and embedded credentials',()=>{
  for(const value of ['javascript:alert(1)','data:application/pdf,x','file:///tmp/document.pdf',
    'https://user:password@example.test/file.pdf',''])assert.throws(()=>safeLegacyUrl(value));
  assert.equal(safeLegacyUrl('../book.pdf','https://example.test/sections/'),'https://example.test/book.pdf');
});

test('protected mapping schema contains no source URL, token, or arbitrary extra field',()=>{
  const data=protectedMapping();
  assert.equal(data.freeTarget,'');assert.equal(validateMigrationMapping(data),data);
  for(const field of ['url','sourceUrl','storagePath','downloadToken'])assert.throws(()=>validateMigrationMapping({...data,[field]:'private'}));
  assert.throws(()=>validateMigrationMapping({...data,freeTarget:'https://example.test/private.pdf'}));
  assert.throws(()=>validateMigrationMapping({...data,bookId:'../escape'}));
  const missing={...data};delete missing.updatedBy;assert.throws(()=>validateMigrationMapping(missing));
  assert.throws(()=>mapping('free',{freeTarget:'https://example.test/sections/book-access.html?legacy=loop'}));
});

test('legacy protected mapping never falls back to the supplied old URL',()=>{
  const old='https://old.example.test/public.pdf';
  assert.deepEqual(route({mapping:protectedMapping(),legacyUrl:old}),{kind:'protected',bookId:'Book123456'});
  assert.deepEqual(route({mapping:protectedMapping(),legacyUrl:old,isSubscribed:false}),{kind:'payment'});
  assert.deepEqual(route({mapping:{...protectedMapping(),freeTarget:old},legacyUrl:old}),{kind:'denied',reason:'invalid-mapping'});
  assert.deepEqual(route({mapping:protectedMapping(),legacyUrl:old,hasSession:false}),{kind:'login'});
});

test('explicit free, unclassified raw, and unmapped hash routes remain distinct',()=>{
  const old='https://old.example.test/public.pdf';
  assert.deepEqual(route({mapping:freeMapping(),isSubscribed:false}),{kind:'free',url:'https://example.test/free.pdf'});
  assert.deepEqual(route({mapping:freeMapping(),hasSession:false}),{kind:'login'});
  assert.deepEqual(route({legacyUrl:old,isSubscribed:false}),{kind:'payment'});
  assert.deepEqual(route({mapping:mapping('unclassified'),legacyUrl:old}),{kind:'legacy',url:old});
  assert.deepEqual(route({}),{kind:'denied',reason:'unclassified'});
  assert.deepEqual(route({mapping:mapping('unclassified')}),{kind:'denied',reason:'unclassified'});
  assert.deepEqual(route({bookId:'Book123456',isSubscribed:false}),{kind:'payment'});
  assert.deepEqual(route({bookId:'../invalid'}),{kind:'denied',reason:'invalid-book'});
});

test('migrated links cannot return to the legacy fallback by unclassifying',()=>{
  assert.throws(()=>assertMigrationTransition(protectedMapping(),mapping('unclassified')));
  assert.doesNotThrow(()=>assertMigrationTransition(protectedMapping(),freeMapping()));
  assert.doesNotThrow(()=>assertMigrationTransition(mapping('unclassified'),protectedMapping()));
});

test('owner inventory deduplicates aliases; exported metadata omits URLs and source text',async()=>{
  const rows=[{title:'النسخة الأولى',url:'https://drive.google.com/file/d/FILE_123/view',source:'catalog',text:'private text'},
    {title:'النسخة الثانية',url:'https://drive.google.com/open?id=FILE_123',source:'summaries'},
    {title:'رابط غير صالح',url:'javascript:void(0)'},{title:'ملف محلي',url:'sections/notes.pdf',source:'catalog'}];
  const inventory=await buildLegacyInventory(rows,undefined,webcrypto);
  assert.equal(inventory.items.length,2);assert.equal(inventory.skipped,1);
  assert.equal(inventory.items[0].titles.length,2);
  const metadata=inventoryMetadata(inventory.items,new Map([[inventory.items[0].key,protectedMapping()]]),true);
  assert.equal(metadata[0].classification,'protected');assert.equal(metadata[1].classification,'unclassified');
  assert.equal(inventoryMetadata(inventory.items)[0].classification,'not-checked');
  const output=JSON.stringify(metadata);
  for(const excluded of ['https://','javascript:','private text','storagePath','downloadToken'])assert.equal(output.includes(excluded),false);
});

test('PDF validation checks actual header, extension, and the Storage size limit',async()=>{
  const file=(name,body,size=body.length)=>({name,size,slice:(a,b)=>new Blob([body.slice(a,b)])});
  await assert.doesNotReject(()=>validateLibraryPdf(file('notes.PDF','%PDF-1.7\ncontent')));
  await assert.rejects(()=>validateLibraryPdf(file('notes.pdf','<html>')));
  await assert.rejects(()=>validateLibraryPdf(file('notes.txt','%PDF-')));
  await assert.rejects(()=>validateLibraryPdf(file('notes.pdf','%PDF-',MAX_LIBRARY_PDF_BYTES+1)));
});

async function executeGate({lookupError=false,subscription='active',savedMapping=protectedMapping(),changeAccountDuringDownload=false}={}){
  // Execute the actual gate locally with in-memory Firebase/DOM dependencies.
  // No SDK is imported and no HTTP request can occur in this harness.
  let source=await readFile(new URL('../assets/library-book-access.js',import.meta.url),'utf8');
  source=source.replace(/^import[\s\S]*?;\s*/gm,'').replaceAll('import.meta.url',JSON.stringify('https://site.example.test/assets/library-book-access.js'));
  source=source.replace(/checkAccess\(\);\s*$/,'globalThis.gateFinished = checkAccess();');
  const elements=new Map(),redirects=[],downloads=[],opens=[],accessCalls=[];
  const auth={currentUser:{uid:'student-uid'}};
  const getElement=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false});return elements.get(id);};
  class TestURL extends URL {static createObjectURL(){return 'blob:test';}static revokeObjectURL(){}}
  const sandbox={URL:TestURL,URLSearchParams,TextEncoder,queueMicrotask,window:{},auth,db:{},
    setTimeout:(fn,ms)=>ms===60000?0:setTimeout(fn,ms),clearTimeout,
    location:{search:'?url='+encodeURIComponent('https://old.example.test/public.pdf'),pathname:'/sections/book-access.html',hash:'',replace:href=>redirects.push(href)},
    sessionStorage:{setItem(){}},document:{getElementById:getElement,body:{append(){}},createElement:()=>({click(){downloads.push(this.href);},remove(){}})},
    console:{error(){},warn(){}},MIGRATION_COLLECTION,legacyKeyForUrl,validLegacyKey,validProtectedBookId,safeLegacyUrl,resolveLibraryRoute,
    onAuthStateChanged:(_auth,callback)=>{queueMicrotask(()=>callback(auth.currentUser));return ()=>{};},
    doc:(_db,name,id)=>({name,id}),getDoc:async reference=>{
      if(reference.name===MIGRATION_COLLECTION){if(lookupError)throw Object.assign(new Error('denied'),{code:'permission-denied'});return {exists:()=>Boolean(savedMapping),data:()=>savedMapping};}
      return {exists:()=>true,data:()=>({title:'كتاب محمي',published:true,storagePath:'libraryProtected/'+reference.id+'/content.pdf'})};
    },
    libraryAccessState:async()=>{accessCalls.push(true);return {status:subscription};},getStorage:()=>({}),ref:(_storage,path)=>path,
    getBlob:async()=>{if(changeAccountDuringDownload)auth.currentUser=null;return {};},
    trackBookDownload:async value=>opens.push(value)
  };
  vm.runInNewContext(source,sandbox);await sandbox.gateFinished;
  return {redirects,downloads,opens,accessCalls,status:getElement('accessStatus').textContent};
}

test('actual gate fails closed on a rejected mapping lookup without a raw URL fallback',async()=>{
  const result=await executeGate({lookupError:true});
  assert.deepEqual(result.redirects,[]);assert.deepEqual(result.downloads,[]);assert.equal(result.accessCalls.length,0);
  assert.match(result.status,/تعذر/);
});

test('actual gate maps old URLs to SDK-protected downloads and records only the safe reading URL',async()=>{
  const result=await executeGate();
  assert.deepEqual(result.redirects,[]);assert.deepEqual(result.downloads,['blob:test']);
  assert.equal(result.opens.length,1);assert.match(result.opens[0].url,/book-access\.html\?id=Book123456$/);
  assert.equal(JSON.stringify(result.opens).includes('old.example.test'),false);
});

test('actual gate redirects an expired subscriber to payment and checks account after download',async()=>{
  const expired=await executeGate({subscription:'expired'});
  assert.equal(expired.downloads.length,0);assert.match(expired.redirects[0],/library-payment\.html$/);
  const changed=await executeGate({changeAccountDuringDownload:true});
  assert.equal(changed.downloads.length,0);assert.equal(changed.redirects.length,0);assert.match(changed.status,/تغيّر الحساب/);
});

test('published migration inventory contains only metadata and the UI does not fetch raw source files',async()=>{
  const data=JSON.parse(await readFile(new URL('../assets/library-migration-inventory.json',import.meta.url),'utf8'));
  assert.equal(data.schemaVersion,1);assert.ok(data.items.length>0);
  for(const item of data.items){assert.deepEqual(Object.keys(item).sort(),['aliases','legacyKey','sources','title']);assert.equal(validLegacyKey(item.legacyKey),true);}
  assert.equal(/https?:\/\//.test(JSON.stringify(data)),false);
  const ui=await readFile(new URL('../dashboard/admin/library-migration.js',import.meta.url),'utf8');
  assert.equal(ui.includes("new URL('assets/library-migration-inventory.json',siteRoot)"),true);
  assert.equal(ui.includes('summary-text-index.json'),false);assert.equal(ui.includes('library-catalog.json'),false);
});
