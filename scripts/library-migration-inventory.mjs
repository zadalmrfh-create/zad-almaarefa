#!/usr/bin/env node
/** Local dry run: no Firebase SDK, credentials, network, or changes to source files. */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {webcrypto} from 'node:crypto';
import {buildLegacyInventory,inventoryMetadata} from '../assets/library-migration-core.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
let baseUrl='https://zadalmrfh-create.github.io/zad-almaarefa/';
let includeItems=false;
let writeIndex=false;
for(let i=0;i<args.length;i++){
  if(args[i]==='--details')includeItems=true;
  else if(args[i]==='--write-index')writeIndex=true;
  else if(args[i]==='--base-url'&&args[i+1])baseUrl=args[++i];
  else if(args[i]==='--help'){
    console.log('node scripts/library-migration-inventory.mjs [--details] [--write-index] [--base-url https://host/project/]\nDefault: read-only local inventory. --details adds titles and keys, never URLs or full text. --write-index writes only assets/library-migration-inventory.json for the website build.');
    process.exit(0);
  }else throw new Error('Unknown argument. Use --help.');
}
const parsedBase=new URL(baseUrl);
if(!['http:','https:'].includes(parsedBase.protocol)||parsedBase.username||parsedBase.password)throw new Error('Use an HTTP(S) project root without credentials.');
const sources=[['library-catalog.json','الكتالوج المحلي'],['summary-text-index.json','فهرس الملخصات']];
const records=[],counts={};
for(const [path,label] of sources){
  const data=JSON.parse(await readFile(resolve(root,path),'utf8'));
  if(!Array.isArray(data))throw new Error('Expected an array in '+path);
  counts[path]=data.length;
  for(const row of data)records.push({title:row.title,url:row.url,source:label});
}
const {items,skipped}=await buildLegacyInventory(records,baseUrl,webcrypto);
if(writeIndex){
  const safeIndex={schemaVersion:1,items:inventoryMetadata(items).map(({legacyKey,title,aliases,sources})=>({legacyKey,title,aliases,sources}))};
  await writeFile(resolve(root,'assets/library-migration-inventory.json'),JSON.stringify(safeIndex,null,2)+'\n','utf8');
}
let storeManifestCount=null;
try{
  const manifest=JSON.parse(await readFile(resolve(root,'store/local-pdf-migration-manifest.json'),'utf8'));
  storeManifestCount=Array.isArray(manifest)?manifest.length:null;
}catch(error){if(error.code!=='ENOENT')throw error;}
const report={schemaVersion:1,mode:writeIndex?'metadata-index-build':'local-read-only',sources:counts,uniqueLegacySources:items.length,skipped,
  remoteMappingsRead:false,filesUploaded:0,sourceFilesChanged:0,
  classification:'not-checked',
  note:'التصنيفات الفعلية تُقرأ بحساب المالك في واجهة الإدارة. هذا الجرد لا يتصل بقاعدة البيانات ولا ينقل ملفات.',
  existingStoreMigration:{manifest:'store/local-pdf-migration-manifest.json',count:storeManifestCount,adminPage:'store/admin.html'},
  ...(writeIndex?{metadataIndexWritten:'assets/library-migration-inventory.json'}:{}),
  ...(includeItems?{items:inventoryMetadata(items)}:{})};
console.log(JSON.stringify(report,null,2));
