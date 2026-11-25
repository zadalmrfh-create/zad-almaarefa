import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {collectSiteFiles,protectedSourcePaths} from './site-files.mjs';

// A deterministic, dependency-free publication gate. It does not contact Firebase.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicFiles=await collectSiteFiles(root);
const published=new Set(publicFiles);
const errors=[];
let jsCount=0,inlineCount=0,referenceCount=0;
const sourceFiles=[];
async function walk(dir,prefix='') {
  for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
    if(entry.name.startsWith('.')||['public','node_modules','dist','README_FILES'].includes(entry.name))continue;
    const relative=prefix?`${prefix}/${entry.name}`:entry.name;
    if(entry.isSymbolicLink())continue;
    if(entry.isDirectory())await walk(path.join(dir,entry.name),relative);
    else if(/\.(?:[cm]?js|html)$/.test(relative))sourceFiles.push(relative);
  }
}
await walk(root);
function syntax(source,label,module=true) {
  try {
    if(module) {
      const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:source,encoding:'utf8'});
      if(result.status!==0)throw new Error((result.stderr||result.error?.message||'Syntax check failed').split('\n').slice(0,7).join('\n'));
    } else new vm.Script(source,{filename:label});
  } catch(error) {errors.push(`${label}: ${error.message}`);}
}
for(const relative of sourceFiles) {
  const source=await fs.readFile(path.join(root,relative),'utf8');
  if(relative==='sections/tests/code-exam-bridge.js') {
    // This existing resource is fetched as text and inserted into sandboxed srcdoc.
    // Despite its extension it is deliberately one complete script element.
    const fragment=/^\s*<script>\s*([\s\S]*?)\s*<\/script>\s*$/.exec(source);
    if(!fragment)errors.push(`${relative}: invalid sandbox script fragment`);
    else {syntax(fragment[1],relative,false);inlineCount++;}
    continue;
  }
  if(/\.[cm]?js$/.test(relative)){syntax(source,relative);jsCount++;continue;}
  let index=0;
  for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs=match[1],body=match[2];index++;
    if(/\bsrc\s*=/.test(attrs)||!body.trim())continue;
    const type=/\btype\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]||'';
    if(type&&!['module','text/javascript','application/javascript'].includes(type.toLowerCase()))continue;
    syntax(body,`${relative} inline script ${index}`,type==='module');inlineCount++;
  }
}
// Integration entry points: every local script, stylesheet and image must survive the public build.
const pages=['index.html','store/index.html','dashboard/admin/index.html','dashboard/student/index.html',
  'store/digital-services/index.html','store/digital-services/account.html','store/digital-services/checkout.html','store/digital-services/track.html',
  'dashboard/admin/library-migration.html','dashboard/admin/library-protected-admin.html','sections/book-access.html',
  'english_summary_malek.html','sections/tests/nahw.html','sections/tests/tawheed.html','sections/tests/balagha.html'];
for(const relative of pages) {
  let source;
  try{source=await fs.readFile(path.join(root,relative),'utf8');}catch{errors.push(`Missing integrated page: ${relative}`);continue;}
  for(const match of source.matchAll(/<(script|link|img)\b([^>]*)>/gi)) {
    const tag=match[1].toLowerCase(),attrs=match[2];
    if(tag==='link'&&!/\brel\s*=\s*["'](?:stylesheet|manifest)["']/i.test(attrs))continue;
    const attribute=tag==='link'?'href':'src';
    const url=new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`,'i').exec(attrs)?.[1];
    if(!url||/^(?:https?:|data:|blob:|\/\/|#)/i.test(url))continue;
    let target;
    try{target=decodeURIComponent(url.split(/[?#]/)[0]);}catch{errors.push(`Bad URL in ${relative}`);continue;}
    const resolved=target.startsWith('/')?target.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(relative),target));
    if(!published.has(resolved))errors.push(`${relative}: missing public ${attribute} ${url}`);
    referenceCount++;
  }
}
const homepage=await fs.readFile(path.join(root,'index.html'),'utf8');
for(const hook of ['zadGlobalSearchDialog','zadStudentProgress','assets/header-navigation.js','assets/navigation-accessibility.js','assets/platform-discovery.css','assets/global-search.js','assets/student-home-progress.js']) {
  if(!homepage.includes(hook))errors.push(`Homepage integration missing: ${hook}`);
}
for(const obsolete of ['function getRealProgressData','function findStoredArrays','id="globalSearchModal"']) {
  if(homepage.includes(obsolete))errors.push(`Obsolete homepage implementation: ${obsolete}`);
}
for(const file of await protectedSourcePaths(root))if(published.has(file))errors.push(`Private PDF included in output: ${file}`);
for(const relative of ['english_summary_malek.html','sections/tests/nahw.html','sections/tests/tawheed.html','sections/tests/balagha.html']) {
  const source=await fs.readFile(path.join(root,relative),'utf8');
  if(/data:image\/[^;,]+;base64,[A-Za-z0-9+/=]{100000}/.test(source))errors.push(`Large embedded image returned: ${relative}`);
}
if(errors.length){console.error(errors.join('\n\n'));process.exitCode=1;}
else console.log(`Checked ${jsCount} JavaScript files, ${inlineCount} inline scripts and ${referenceCount} integrated asset references. No live service calls.`);
