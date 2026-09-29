import {cp,mkdir,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CONFIG} from '../config.js';
if(CONFIG.publishableKey.startsWith('sb_secret_'))throw new Error('A server secret was placed in config.js. Remove and rotate it immediately.');
try{if(CONFIG.publishableKey.split('.').length===3&&JSON.parse(Buffer.from(CONFIG.publishableKey.split('.')[1],'base64url')).role==='service_role')throw new Error('A service_role key cannot be published.');}catch(e){if(e.message.includes('service_role'))throw e;}
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','classroom.html','overview.html','style.css','favicon.svg','config.js','LICENSE'])await cp(file,`dist/${file}`);
for(const dir of ['src','shared','vendor','docs','examples']){try{await cp(dir,`dist/${dir}`,{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
const assetFiles=['config.js','style.css'];
async function collect(dir){for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=`${dir}/${e.name}`;if(e.isDirectory())await collect(path);else assetFiles.push(path);}}
for(const dir of ['src','shared','vendor'])await collect(dir);
const hash=createHash('sha256');for(const path of assetFiles){hash.update(path);hash.update(await readFile(path));}
const assetRoot=`assets/${hash.digest('hex').slice(0,16)}`;
await mkdir(`dist/${assetRoot}`,{recursive:true});
for(const item of ['src','shared','vendor','config.js','style.css'])await cp(item,`dist/${assetRoot}/${item}`,{recursive:true});
for(const page of ['index.html','classroom.html','overview.html']){
  const html=(await readFile(page,'utf8')).replaceAll('./style.css',`./${assetRoot}/style.css`).replaceAll('./src/',`./${assetRoot}/src/`);
  await writeFile(`dist/${page}`,html);
}
await writeFile('dist/.nojekyll','');console.log('Static site built in dist/. Backend source, credentials, and tests are excluded.');
