import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {CONFIG} from '../config.js';
if(CONFIG.publishableKey.startsWith('sb_secret_'))throw new Error('A server secret was placed in config.js. Remove and rotate it immediately.');
try{if(CONFIG.publishableKey.split('.').length===3&&JSON.parse(Buffer.from(CONFIG.publishableKey.split('.')[1],'base64url')).role==='service_role')throw new Error('A service_role key cannot be published.');}catch(e){if(e.message.includes('service_role'))throw e;}
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','classroom.html','style.css','favicon.svg','config.js','LICENSE'])await cp(file,`dist/${file}`);
for(const dir of ['src','shared','vendor','docs','examples']){try{await cp(dir,`dist/${dir}`,{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
await writeFile('dist/.nojekyll','');console.log('Static site built in dist/. Backend source, credentials, and tests are excluded.');
