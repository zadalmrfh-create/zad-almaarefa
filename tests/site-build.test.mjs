import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {isPublicFile,createPublicTree,verifyPublicTree} from '../scripts/site-files.mjs';

test('publication excludes private inputs while preserving public exam and search data',()=>{
 const privatePaths=new Set(['sections/summaries/paid.pdf']);
 for(const file of ['server.js','local-server.js','.env','firestore.rules','package.json','library-catalog.json','summary-text-index.json','store/local-pdf-migration-manifest.json','store/digital-services/firebase.json','scripts/check-site.mjs','sections/summaries/paid.pdf','public/index.html','assets/../server.js'])assert.equal(isPublicFile(file,privatePaths),false,file);
 for(const file of ['index.html','style.css','firebase-config.js','assets/search-index.json','assets/library-migration-core.mjs','exams/unit1/bank.json','dashboard/student/index.html','sections/tests/tawheed.html','store/digital-services/manifest.webmanifest'])assert.equal(isPublicFile(file,privatePaths),true,file);
});

test('canonical build replaces stale duplicates, excludes paid PDFs, and detects drift',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'zad-build-'));
 try {
   for(const folder of ['public','assets','store','sections/summaries'])await fs.mkdir(path.join(root,folder),{recursive:true});
   await fs.writeFile(path.join(root,'index.html'),'<h1>Current</h1>');
   await fs.writeFile(path.join(root,'assets/app.js'),'const version=2;');
   await fs.writeFile(path.join(root,'public/index.html'),'<h1>Old</h1>');
   await fs.writeFile(path.join(root,'public/obsolete.html'),'old');
   await fs.writeFile(path.join(root,'server.js'),'private');
   await fs.writeFile(path.join(root,'sections/summaries/paid.pdf'),'private PDF');
   await fs.writeFile(path.join(root,'store/local-pdf-migration-manifest.json'),JSON.stringify([{relativePath:'sections/summaries/paid.pdf'}]));
   const result=await createPublicTree(root);
   assert.deepEqual(result.files.map(f=>f.path),['assets/app.js','index.html']);
   assert.equal(await fs.readFile(path.join(root,'public/index.html'),'utf8'),'<h1>Current</h1>');
   await assert.rejects(fs.access(path.join(root,'public/obsolete.html')));
   assert.equal(await fs.readFile(path.join(root,'sections/summaries/paid.pdf'),'utf8'),'private PDF');
   await verifyPublicTree(root);
   await fs.writeFile(path.join(root,'assets/app.js'),'const version=3;');
   await assert.rejects(verifyPublicTree(root),/mismatch/);
   await createPublicTree(root);
   await verifyPublicTree(root);
   await fs.writeFile(path.join(root,'public/unexpected.pdf'),'x');
   await assert.rejects(verifyPublicTree(root),/Unexpected/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
