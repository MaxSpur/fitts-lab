import {readdir} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
let bad=false;async function walk(p){for(const d of await readdir(p,{withFileTypes:true})){const f=`${p}/${d.name}`;if(d.isDirectory())await walk(f);else if(/\.(js|mjs)$/.test(f)){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status){console.error(r.stderr);bad=true;}}}}
for(const p of ['src','shared','scripts','supabase/functions'])await walk(p);if(bad)process.exit(1);console.log('JavaScript syntax checks passed.');
