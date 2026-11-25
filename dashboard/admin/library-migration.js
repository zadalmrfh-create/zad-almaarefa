import {auth,db,ADMIN_EMAIL} from '../../firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,query,orderBy,documentId,limit,startAfter,runTransaction,serverTimestamp}
  from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {MIGRATION_COLLECTION,ACCESS_LABELS,isLibraryOwner,validLegacyKey,buildLegacyInventory,inventoryMetadata,
  buildMigrationMapping,assertMigrationTransition,validateMigrationMapping} from '../../assets/library-migration-core.mjs';
import {assertLibraryFileOwner,uploadLibraryPdf} from '../../assets/library-migration-storage.js';

const $ = id => document.getElementById(id);
const siteRoot = new URL('../../',import.meta.url).href;
const BATCH_SIZE = 200;
let ownerUid = '',generation = 0,busy = false,records = [],safeItems = [],items = [],visibleLimit = 60,rebuildSerial=0;
let mappings = new Map(),books = new Map(),selection = null,selectionRevision = '',selectionSerial = 0;
let mappingsCursor = null,mappingsDone = false,booksCursor = null,booksDone = false;
let liveCursors = {libraryBooks:null,azharBooks:null},liveDone = {libraryBooks:false,azharBooks:false};
function text(id,message) {$(id).textContent = message;}
function owner(generationAtStart = generation) {
  if (generationAtStart !== generation) throw new Error('تغيّر الحساب. أعد فتح الصفحة.');
  return assertLibraryFileOwner(ownerUid);
}
function errorText(error) {
  if (String(error?.code||'').includes('permission-denied')) return 'رُفضت الصلاحية. تأكد من دخول المالك الموثّق ونشر قواعد المكتبة الجديدة قبل تشغيل الترحيل.';
  return error?.message || 'تعذر إكمال العملية. جرّب مرة أخرى.';
}
function revision(mapping) {
  if (!mapping) return '';
  const stamp = mapping.updatedAt;
  return `${stamp?.seconds || 0}:${stamp?.nanoseconds || 0}:${mapping.kind}:${mapping.bookId}:${mapping.freeTarget}`;
}
function setBusy(value) {
  busy = value;
  for (const id of ['reloadInventory','loadLive','exportInventory','saveMapping','moreMappings','loadMoreBooks']) $(id).disabled = value;
  for(const form of [$('addSourceForm'),$('mappingForm'),$('importInventoryForm')])for(const control of form.querySelectorAll('input,select,button'))control.disabled=value;
}
async function batch(name,cursor=null) {
  const constraints = [orderBy(documentId()),...(cursor?[startAfter(cursor)]:[]),limit(BATCH_SIZE)];
  return getDocs(query(collection(db,name),...constraints));
}
async function loadMappings() {
  const token=generation;owner(token);
  if (mappingsDone) return;
  const snap = await batch(MIGRATION_COLLECTION,mappingsCursor);owner(token);
  snap.docs.forEach(d=>{try {validateMigrationMapping(d.data());mappings.set(d.id,d.data());} catch {mappings.set(d.id,{kind:'invalid'});}});
  mappingsCursor=snap.docs.at(-1)||mappingsCursor;mappingsDone=snap.size<BATCH_SIZE;
  $('moreMappings').hidden=mappingsDone;
  await rebuild();
}
function renderBooks(selectedValue='') {
  const previous = selectedValue || $('protectedBook').value;
  $('protectedBook').replaceChildren(new Option('اختر كتابًا محميًا منشورًا…',''));
  [...books.values()].filter(book=>book.published===true).sort((a,b)=>a.title.localeCompare(b.title,'ar'))
    .forEach(book=>$('protectedBook').add(new Option(book.title,book.id)));
  if (books.has(previous)) $('protectedBook').value=previous;
  $('loadMoreBooks').hidden=booksDone;
}
async function loadBooks() {
  const token=generation;owner(token);
  if (booksDone) return;
  const snap=await batch('libraryProtectedBooks',booksCursor);owner(token);
  snap.docs.forEach(d=>books.set(d.id,{id:d.id,...d.data()}));
  booksCursor=snap.docs.at(-1)||booksCursor;booksDone=snap.size<BATCH_SIZE;
  renderBooks();
}
function renderInventory() {
  const term=$('inventorySearch').value.trim().toLocaleLowerCase('ar');
  const kind=$('inventoryFilter').value;
  const filtered=items.filter(item=>(!term||[...item.titles,...item.sources].join(' ').toLocaleLowerCase('ar').includes(term))
    && (kind==='all'||(mappings.get(item.key)?.kind||(mappingsDone?'unclassified':'pending'))===kind));
  const rows=$('inventoryRows');rows.replaceChildren();
  for (const item of filtered.slice(0,visibleLimit)) {
    const mapping=mappings.get(item.key);
    const tr=document.createElement('tr');
    const title=document.createElement('td');title.textContent=item.title;
    if(item.titles.length>1){const small=document.createElement('small');small.textContent=`هذا المصدر مشترك بين ${item.titles.length} عناوين.`;title.append(small);}
    const source=document.createElement('td');source.textContent=item.sources.join('، ');
    const status=document.createElement('td');const badge=document.createElement('span');badge.className='badge '+(mapping?.kind||'');
    badge.textContent=mapping?.kind==='invalid'?'تصنيف يحتاج مراجعة':mapping?ACCESS_LABELS[mapping.kind]:mappingsDone?ACCESS_LABELS.unclassified:'لم يُحمّل تصنيفه بعد';status.append(badge);
    const action=document.createElement('td');const button=document.createElement('button');button.type='button';button.textContent='راجع التصنيف';button.dataset.key=item.key;button.disabled=busy;action.append(button);
    tr.append(title,source,status,action);rows.append(tr);
  }
  if(!filtered.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='لا توجد مصادر مطابقة للبحث.';tr.append(td);rows.append(tr);}
  $('moreInventory').hidden=filtered.length<=visibleLimit;
  text('inventoryCount',`${items.length} مصدرًا فريدًا · المعروض ${Math.min(filtered.length,visibleLimit)} من ${filtered.length} نتيجة`);
}
async function rebuild() {
  const token=generation,serial=++rebuildSerial;
  const inventory=await buildLegacyInventory(records,siteRoot);owner(token);
  if(serial!==rebuildSerial)return;
  const combined=new Map(safeItems.map(item=>[item.key,{...item,titles:[...item.titles],sources:[...item.sources]}]));
  for(const item of inventory.items){const previous=combined.get(item.key);combined.set(item.key,{...item,
    titles:[...new Set([...(previous?.titles||[]),...item.titles])],sources:[...new Set([...(previous?.sources||[]),...item.sources])]});}
  for(const [key,value] of mappings)if(validLegacyKey(key)&&value.title&&!combined.has(key))combined.set(key,{key,title:value.title,url:'',titles:[value.title],sources:['تصنيف محفوظ']});
  items=[...combined.values()];visibleLimit=60;renderInventory();
  if(inventory.skipped)text('inventoryStatus',`تُرك ${inventory.skipped} سجل بلا رابط صالح دون تعديل. راجع المصدر الأصلي عند الحاجة.`);
}
async function loadStaticInventory() {
  const token=generation;owner(token);
  let ok=true;
  try{
    const response=await fetch(new URL('assets/library-migration-inventory.json',siteRoot),{cache:'no-store'});
    if(!response.ok)throw new Error('missing-index');
    const data=await response.json();owner(token);
    if(data.schemaVersion!==1||!Array.isArray(data.items))throw new Error('invalid-index');
    safeItems=metadataItems(data.items);
  }catch(error){owner(token);ok=false;text('inventoryStatus','تعذر تحميل الجرد المنشور. يمكنك قراءة ملفات الكتالوج من جهازك أو تحميل سجلات المكتبة. يُنشأ الفهرس الآمن عند بناء الموقع.');}
  await rebuild();return ok;
}
function metadataItems(rows){
  return rows.filter(row=>validLegacyKey(row?.legacyKey)&&typeof row.title==='string'&&row.title.trim()).map(row=>({
    key:row.legacyKey,title:row.title.slice(0,180),url:'',titles:Array.isArray(row.aliases)?row.aliases.filter(s=>typeof s==='string').map(s=>s.slice(0,180)):[row.title.slice(0,180)],
    sources:Array.isArray(row.sources)?row.sources.filter(s=>typeof s==='string').map(s=>s.slice(0,100)):['جرد محلي']}));
}
async function loadLiveInventory() {
  const token=generation;owner(token);
  for(const name of ['libraryBooks','azharBooks']) {
    if(liveDone[name])continue;
    const snap=await batch(name,liveCursors[name]);owner(token);
    for(const d of snap.docs){const row=d.data();records.push({title:row.title||row.name,url:row.url||row.link,source:name});}
    liveCursors[name]=snap.docs.at(-1)||liveCursors[name];liveDone[name]=snap.size<BATCH_SIZE;
  }
  await rebuild();
  $('loadLive').textContent=Object.values(liveDone).every(Boolean)?'اكتمل تحميل سجلات المكتبة':'تحميل الدفعة التالية من السجلات';
  text('inventoryStatus','تمت إضافة السجلات المقروءة إلى الجرد فقط. لم تتغير أي روابط أو صلاحيات.');
}
function updateFields() {
  const kind=$('mappingKind').value;
  $('freeFields').hidden=kind!=='free';$('freeTarget').required=kind==='free';
  $('protectedFields').hidden=kind!=='protected';
  const upload=kind==='protected'&&$('protectedMode').value==='upload';
  $('uploadBookFields').hidden=!upload;$('existingBookFields').hidden=upload;
  $('migrationPdf').required=upload;$('protectedBook').required=kind==='protected'&&!upload;
  $('confirmClassification').checked=false;
}
async function selectItem(key) {
  if(busy)return;
  const token=generation,serial=++selectionSerial;owner(token);
  const item=items.find(item=>item.key===key);if(!item)return;
  selection=null;$('editorPanel').hidden=true;setBusy(true);
  text('inventoryStatus','جارٍ التحقق من أحدث تصنيف…');
  try {
    const snap=await getDoc(doc(db,MIGRATION_COLLECTION,key));owner(token);
    if(serial!==selectionSerial)return;
    const previous=snap.exists()?snap.data():null;
    if(previous)validateMigrationMapping(previous);
    selection=item;selectionRevision=revision(previous);
    if(previous)mappings.set(key,previous);else mappings.delete(key);
    $('mappingTitle').value=previous?.title||item.title;$('mappingKind').value=previous?.kind||'unclassified';
    $('legacyKey').value=key;$('sourceUrl').value=item.url;
    $('freeTarget').value=previous?.kind==='free'?previous.freeTarget:item.url;
    $('protectedMode').value='existing';$('migrationPdf').value='';
    if(previous?.bookId&&!books.has(previous.bookId)){
      const book=await getDoc(doc(db,'libraryProtectedBooks',previous.bookId));owner(token);
      if(serial!==selectionSerial)return;if(book.exists())books.set(book.id,{id:book.id,...book.data()});
    }
    renderBooks(previous?.bookId||'');$('protectedBook').value=previous?.bookId||'';
    text('selectedAliases',item.titles.length>1?`نفس الرابط مرتبط بهذه العناوين: ${item.titles.join('، ')}. التصنيف الجديد سيطبق على الرابط نفسه في جميعها.`:'التغيير يخص هوية هذا المصدر فقط.');
    $('editorPanel').hidden=false;updateFields();
    text('saveStatus','لم يُحفظ أي تغيير بعد.');text('inventoryStatus','تم تحميل أحدث تصنيف.');
    setGateLink(item.key,previous?.kind&&previous.kind!=='unclassified');renderInventory();
    $('editorPanel').focus();$('editorPanel').scrollIntoView({block:'start',behavior:'smooth'});
  }catch(error){if(token===generation)text('inventoryStatus',errorText(error));}
  finally{if(token===generation&&serial===selectionSerial){setBusy(false);renderInventory();}}
}
function setGateLink(key,available) {
  $('previewGate').href=new URL('sections/book-access.html?'+new URLSearchParams({legacy:key,title:$('mappingTitle').value}),siteRoot).href;
  $('previewGate').hidden=!available;$('copyGate').hidden=!available;
}
async function action(callback,statusId='inventoryStatus') {
  if(busy)return;const token=generation;setBusy(true);
  try{owner();await callback();}catch(error){if(token===generation)text(statusId,errorText(error));}
  finally{if(token===generation){setBusy(false);renderInventory();}}
}
$('reloadInventory').addEventListener('click',()=>action(async()=>{
  mappings=new Map();mappingsCursor=null;mappingsDone=false;
  const loaded=await loadStaticInventory();await loadMappings();
  if(loaded)text('inventoryStatus','تم تحديث الجرد والتصنيفات المقروءة. لم تُجرَ أي كتابة.');
}));
$('loadLive').addEventListener('click',()=>action(loadLiveInventory));
$('moreMappings').addEventListener('click',()=>action(loadMappings));
$('loadMoreBooks').addEventListener('click',()=>action(loadBooks,'saveStatus'));
$('inventoryRows').addEventListener('click',event=>{const button=event.target.closest('button[data-key]');if(button)selectItem(button.dataset.key);});
for(const id of ['inventorySearch','inventoryFilter'])$(id).addEventListener('input',()=>{visibleLimit=60;renderInventory();});
$('moreInventory').addEventListener('click',()=>{visibleLimit+=60;renderInventory();});
for(const id of ['mappingKind','protectedMode'])$(id).addEventListener('change',updateFields);
$('importInventoryForm').addEventListener('submit',event=>{
  event.preventDefault();const files=[...$('localInventoryFiles').files];
  action(async()=>{
    const token=generation;let imported=0;
    if(!files.length||files.length>5)throw new Error('اختر من ملف إلى خمسة ملفات JSON.');
    for(const file of files){
      if(file.size>10*1024*1024)throw new Error('الحد الأقصى لكل ملف JSON هو 10 ميجابايت.');
      let data;try{data=JSON.parse(await file.text());}catch{throw new Error('أحد الملفات ليس JSON صالحًا.');}owner(token);
      const rows=Array.isArray(data)?data:Array.isArray(data.items)?data.items:null;
      if(!rows||rows.length>10000)throw new Error('استخدم مصفوفة كتالوج أو جرد لا تزيد على 10000 سجل.');
      const metadata=metadataItems(rows);safeItems.push(...metadata);
      const raw=rows.filter(row=>row&&typeof row.url==='string').map(row=>({title:row.title,url:row.url,source:'ملف محلي اختاره المالك'}));
      records.push(...raw);imported+=metadata.length+raw.length;
    }
    await rebuild();$('importInventoryForm').reset();
    text('inventoryStatus',`قُرئ ${imported} سجلًا في ذاكرة الصفحة. لم تُرفع ملفات JSON ولم تُحفظ تصنيفات جديدة.`);
  });
});
$('addSourceForm').addEventListener('submit',event=>{
  event.preventDefault();const form=new FormData(event.currentTarget);
  action(async()=>{
    const candidate={title:String(form.get('title')||'').trim(),url:String(form.get('url')||'').trim(),source:'إضافة يدوية'};
    const preview=await buildLegacyInventory([candidate],siteRoot);if(preview.items.length!==1)throw new Error('اكتب عنوانًا ورابط HTTP أو HTTPS صالحًا.');
    records.push(candidate);await rebuild();$('addSourceForm').reset();text('inventoryStatus','أضيف المصدر للجرد المحلي. اضغط «راجع التصنيف» لحفظ القرار.');
  });
});
$('exportInventory').addEventListener('click',()=>{
  if(!ownerUid||busy)return;
  const body=JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),mappingSnapshotComplete:mappingsDone,
    note:'جرد metadata فقط؛ لا ينقل ملفات ولا يثبت اكتمال تقييد المصادر القديمة. not-checked تعني أن تصنيف المصدر لم يُقرأ بعد.',items:inventoryMetadata(items,mappings,mappingsDone)},null,2);
  const href=URL.createObjectURL(new Blob([body],{type:'application/json'}));const link=document.createElement('a');
  link.href=href;link.download='library-migration-inventory.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
});
$('copyGate').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('previewGate').href);text('saveStatus','تم نسخ رابط القراءة.');}catch{text('saveStatus','تعذر النسخ التلقائي. انسخ عنوان رابط القراءة يدويًا.');}});
$('mappingForm').addEventListener('submit',event=>{
  event.preventDefault();if(!selection||!event.currentTarget.reportValidity())return;
  action(async()=>{
    const token=generation,selected=selection;const user=owner(token);
    const kind=$('mappingKind').value,title=$('mappingTitle').value.trim(),freeTarget=$('freeTarget').value;
    let bookId=$('protectedBook').value;
    if(kind==='free'&&!confirm('سيصبح المصدر المختار متاحًا للمستخدم المسجّل دون اشتراك المكتبة. هل هذا هو التصنيف المقصود؟'))return;
    if(kind==='protected'&&$('protectedMode').value==='upload'){
      const result=await uploadLibraryPdf({file:$('migrationPdf').files[0],title,expectedUid:user.uid,onStatus:message=>{if(token===generation)text('saveStatus',message);}});owner(token);
      books.set(result.id,result);bookId=result.id;renderBooks(bookId);$('protectedMode').value='existing';$('migrationPdf').value='';updateFields();
      text('saveStatus','اكتمل رفع الكتاب المحمي. جارٍ حفظ ربط المصدر القديم…');
    }
    const next=buildMigrationMapping({kind,title,bookId,freeTarget},user.uid,serverTimestamp());
    const mapRef=doc(db,MIGRATION_COLLECTION,selected.key);
    await runTransaction(db,async transaction=>{
      owner(token);
      const current=await transaction.get(mapRef);
      const previous=current.exists()?current.data():null;
      if(revision(previous)!==selectionRevision)throw new Error('تغيّر التصنيف من نافذة أخرى. اختر المصدر مرة أخرى لمراجعة أحدث بيانات.');
      assertMigrationTransition(previous,next);
      if(kind==='protected'){
        const book=await transaction.get(doc(db,'libraryProtectedBooks',bookId));
        if(!book.exists()||book.data().published!==true||book.data().storagePath!=='libraryProtected/'+bookId+'/content.pdf')throw new Error('اختر كتابًا محميًا منشورًا وصالحًا.');
      }
      owner(token);transaction.set(mapRef,next);
    });owner(token);
    const saved=await getDoc(mapRef);owner(token);validateMigrationMapping(saved.data());
    mappings.set(selected.key,saved.data());selectionRevision=revision(saved.data());
    $('confirmClassification').checked=false;setGateLink(selected.key,kind!=='unclassified');renderInventory();
    text('saveStatus',kind==='protected'?'تم حفظ الربط بالكتاب المحمي. افحص رابط القراءة بحساب مشترك، ثم قيّد المصدر القديم يدويًا قبل اعتبار نقله مكتملًا.':'تم حفظ التصنيف. لا يتغير أي مصدر آخر مختلف عن هوية هذا الرابط.');
  },'saveStatus');
});

onAuthStateChanged(auth,async user=>{
  generation++;selectionSerial++;rebuildSerial++;ownerUid='';selection=null;records=[];safeItems=[];items=[];mappings.clear();books.clear();
  mappingsCursor=null;mappingsDone=false;booksCursor=null;booksDone=false;
  liveCursors={libraryBooks:null,azharBooks:null};liveDone={libraryBooks:false,azharBooks:false};
  $('workspace').hidden=true;$('editorPanel').hidden=true;$('migrationPdf').value='';$('localInventoryFiles').value='';$('inventoryRows').replaceChildren();
  if(!isLibraryOwner(user,ADMIN_EMAIL)){text('ownerStatus','هذه الأداة لمالك المنصة ذي البريد الموثّق فقط، وفق صلاحيات رفع الملفات الحالية. سجّل الدخول بذلك الحساب للمتابعة.');return;}
  ownerUid=user.uid;const token=generation;
  $('workspace').hidden=false;text('ownerStatus','تم التحقق من حساب المالك. تحميل الجرد وقراءة التصنيفات لا يغيران البيانات.');
  setBusy(true);
  try{await loadStaticInventory();await loadMappings();await loadBooks();owner(token);}
  catch(error){if(token===generation)text('inventoryStatus',errorText(error));}
  finally{if(token===generation){setBusy(false);renderInventory();}}
},()=>{text('ownerStatus','تعذر التحقق من حساب المالك. افحص الإنترنت وأعد فتح الصفحة.');$('workspace').hidden=true;});
