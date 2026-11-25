import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyPublicTree} from './site-files.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try {const result=await verifyPublicTree(root);console.log(`Verified ${result.files.length} files: source, local preview and deployment output match.`);}
catch(error){console.error(error.message);process.exitCode=1;}
