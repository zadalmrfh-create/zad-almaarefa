import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

// The project root is the only editable website source. public/ is generated.
export const CLIENT_DIRECTORIES = new Set(['assets','dashboard','events','exams','images','login','reviews','sections','store','students','teachers']);
const CLIENT_ROOT_SCRIPTS = new Set(['auth-ui.js','chatbot.js','content-protection.js','firebase-config.js','home-data.js','notifications.js','share-button-fix.js','student-counter.js']);
const CLIENT_EXTENSIONS = new Set(['.html','.css','.js','.mjs','.svg','.webp','.png','.jpg','.jpeg','.gif','.ico','.woff','.woff2','.ttf','.otf','.mp3','.ogg','.wav','.mp4','.webm','.pdf']);
const PUBLIC_JSON = new Set(['assets/search-index.json','assets/library-migration-inventory.json','sections/library-inventory.json','exams/unit1/bank.json','exams/zad-special/bank.json']);
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function isPublicFile(relative, protectedFiles = new Set()) {
  const normalized = relative.replaceAll('\\','/');
  const parts = normalized.split('/');
  if (normalized === '.nojekyll') return true;
  if (!normalized || path.posix.isAbsolute(normalized) || parts.some(p => !p || p === '..' || p.startsWith('.')) || protectedFiles.has(normalized)) return false;
  if (['node_modules','public','dist','scripts','tests','README_FILES'].includes(parts[0]) || parts.includes('node_modules')) return false;
  const ext = path.posix.extname(normalized).toLowerCase();
  if (normalized === 'store/digital-services/manifest.webmanifest') return true;
  if (ext === '.json') return PUBLIC_JSON.has(normalized);
  if (!CLIENT_EXTENSIONS.has(ext)) return false;
  if (parts.length === 1) return ext === '.html' || ext === '.css' || CLIENT_ROOT_SCRIPTS.has(normalized);
  return CLIENT_DIRECTORIES.has(parts[0]);
}

export async function protectedSourcePaths(root) {
  // These files are explicitly identified as paid source PDFs by the existing store.
  // Keep the originals for the owner's upload workflow; do not publish them as static URLs.
  const file = path.join(root,'store/local-pdf-migration-manifest.json');
  let rows;
  try { rows = JSON.parse(await fs.readFile(file,'utf8')); }
  catch (error) { if(error.code==='ENOENT') return new Set(); throw error; }
  if (!Array.isArray(rows)) throw new Error('Invalid private PDF inventory.');
  return new Set(rows.map(row=>String(row.relativePath||'').replaceAll('\\','/')).filter(Boolean));
}

export async function collectSiteFiles(root) {
  const protectedFiles = await protectedSourcePaths(root);
  const found=[];
  async function visit(directory, prefix='') {
    const entries=await fs.readdir(directory,{withFileTypes:true});
    for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
      const relative=prefix ? `${prefix}/${entry.name}` : entry.name;
      if(entry.isSymbolicLink()) continue;
      if(entry.isDirectory()) {
        if(!prefix && !CLIENT_DIRECTORIES.has(entry.name)) continue;
        if(entry.name.startsWith('.') || entry.name === 'node_modules')continue;
        await visit(path.join(directory,entry.name),relative);
      } else if(entry.isFile() && isPublicFile(relative,protectedFiles)) found.push(relative);
    }
  }
  await visit(root);
  return found.sort();
}

export async function createPublicTree(root,output = path.join(root,'public')) {
  if(path.resolve(output)!==path.resolve(root,'public')) throw new Error('Build output must be the generated public directory.');
  const files=await collectSiteFiles(root);
  if(!files.includes('index.html'))throw new Error('Canonical index.html is missing.');
  const stage=path.join(root,`.public-build-${process.pid}`);
  await fs.rm(stage,{recursive:true,force:true});
  await fs.mkdir(stage,{recursive:true});
  const manifest={version:1,source:'project-root',output:'public',files:[]};
  try {
    for(const relative of files) {
      const source=path.join(root,relative), destination=path.join(stage,relative);
      const bytes=await fs.readFile(source);
      await fs.mkdir(path.dirname(destination),{recursive:true});
      await fs.writeFile(destination,bytes);
      manifest.files.push({path:relative,size:bytes.length,sha256:hash(bytes)});
    }
    await fs.writeFile(path.join(stage,'.site-build.json'),JSON.stringify(manifest,null,2)+'\n');
    await fs.rm(output,{recursive:true,force:true});
    await fs.rename(stage,output);
  } catch(error) {await fs.rm(stage,{recursive:true,force:true});throw error;}
  return manifest;
}

export async function verifyPublicTree(root) {
  const output=path.join(root,'public');
  const manifest=JSON.parse(await fs.readFile(path.join(output,'.site-build.json'),'utf8'));
  if(manifest.version!==1 || manifest.source!=='project-root')throw new Error('Unknown generated output. Run npm run build.');
  const expected=await collectSiteFiles(root);
  if(JSON.stringify(expected)!==JSON.stringify(manifest.files.map(f=>f.path)))throw new Error('Website file inventory changed. Run npm run build.');
  for(const entry of manifest.files) {
    const [source,built]=await Promise.all([fs.readFile(path.join(root,entry.path)),fs.readFile(path.join(output,entry.path))]);
    if(hash(source)!==entry.sha256 || hash(built)!==entry.sha256)throw new Error(`Source/output mismatch: ${entry.path}`);
  }
  // Unexpected files in a generated tree must not silently survive an update.
  const actual=[];
  async function walk(dir,prefix='') {for(const e of await fs.readdir(dir,{withFileTypes:true})){const rel=prefix?`${prefix}/${e.name}`:e.name;if(e.isDirectory())await walk(path.join(dir,e.name),rel);else if(rel!=='.site-build.json')actual.push(rel);}}
  await walk(output);
  if(JSON.stringify(actual.sort())!==JSON.stringify(expected))throw new Error('Unexpected file in generated public tree. Run npm run build.');
  return manifest;
}
