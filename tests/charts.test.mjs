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

for(const name of ['scatterSpec','heroSpec'])test(`${name} keeps point glyphs separate from trendline dashes`,()=>{
 const compiled=vegaLite.compile(specs[name]()).spec;
 const stage=compiled.legends.find(l=>l.title==='Stage'),trend=compiled.legends.find(l=>l.title==='Trendline');
 assert.ok(stage.shape);assert.equal(stage.strokeDash,undefined);
 assert.equal(trend.symbolType,'stroke');assert.ok(trend.strokeDash);
 assert.equal(compiled.legends.filter(l=>l.shape).length,1);
});

test('boundary chart exposes the shared run focus and selection signals',()=>{const spec=specs.boundarySpec();assert.ok(spec.params.some(p=>p.name==='focusStudent'));assert.equal(spec.layer[2].params[0].name,'selectedPerson');assert.match(spec.layer[1].encoding.opacity.condition.test,/dataset_id/);assert.match(spec.layer[2].encoding.opacity.condition.test,/dataset_id/);});

test('classroom hero overlays selected-run fits without changing the participant scatter',()=>{const classroom=specs.heroSpec(),participant=specs.scatterSpec();assert.equal(classroom.layer.filter(l=>l.data?.name==='selectedFit').length,2);assert.equal(participant.layer.filter(l=>l.data?.name==='selectedFit').length,0);});
test('boundary chart accepts a focused y-domain',()=>{const spec=specs.boundarySpec({height:185,yMax:1250});assert.equal(spec.height,185);for(const layer of spec.layer)assert.deepEqual(layer.encoding.y.scale.domain,[0,1250]);});
test('classroom boundary analysis adds an estimation panel and 95% interval layers',()=>{const spec=specs.boundarySpec({analysis:true});assert.equal(spec.vconcat.length,2);assert.ok(spec.vconcat[0].layer.some(l=>l.data?.name==='boundarySummary'&&l.encoding?.y2));assert.ok(spec.vconcat[1].layer.some(l=>l.data?.name==='effectSummary'&&l.encoding?.y2));});
test('classroom hero includes condition-level uncertainty layers',()=>{const spec=specs.heroSpec();assert.ok(spec.layer.some(l=>l.data?.name==='summary'&&l.encoding?.y2));});
