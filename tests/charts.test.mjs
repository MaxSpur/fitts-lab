import test from 'node:test';
import assert from 'node:assert/strict';
import {vega,vegaLite} from '../vendor/index.js';
import * as specs from '../src/specs.js';
for(const name of ['scatterSpec','heroSpec','pathSpec','speedSpec','endpointsSpec','boundarySpec'])test(`Real Vega-Lite compilation and Vega parse: ${name}`,()=>{
 const spec=specs[name]();const compiled=vegaLite.compile(spec).spec;
 const runtime=vega.parse(compiled);assert.ok(runtime);assert.ok(compiled.marks.length);
});
test('Vendored runtime versions are recorded accurately',()=>{assert.equal(vega.version,'6.2.0');assert.equal(vegaLite.version,'6.4.2');});
import {readFile} from 'node:fs/promises';
for(const name of ['basic-scatter','participant-selection'])test(`Notebook example compiles: ${name}`,async()=>{
 const spec=JSON.parse(await readFile(new URL(`../examples/${name}.vl.json`,import.meta.url),'utf8'));
 assert.ok(vega.parse(vegaLite.compile(spec).spec));
});

test('all three axes plot their actual measurement field with data-derived bounds',async()=>{
 const {plotAxis}=await import('../src/analysis.js');
 for(const [field,value] of [['distance',1001],['approach_width',73],['index_difficulty',8.2]]){
  const axis=plotAxis([{[field]:value}],field);assert.ok(axis.maximum>=value);
  const spec=specs.heroSpec({x:field,xMax:axis.maximum});
  assert.equal(spec.layer[0].encoding.x.field,field);
  const view=new vega.View(vega.parse(vegaLite.compile(spec).spec),{renderer:'none'});
  await view.runAsync();view.finalize();
 }
});
