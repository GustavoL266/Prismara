import {performance} from 'node:perf_hooks';
import {cpus,totalmem,platform,release} from 'node:os';
import {mkdirSync,writeFileSync} from 'node:fs';
import {World} from '../src/sim/world';
import {Factory} from '../src/sim/machines';
import {Mat} from '../src/sim/materials';
import {generateTerrain} from '../src/sim/terrain';
import {installLine} from '../tests/fixtures/line';
const percentile=(list:number[],p:number)=>[...list].sort((a,b)=>a-b)[Math.min(list.length-1,Math.floor(list.length*p))];
const report:any={environment:{os:platform()+' '+release(),node:process.version,cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramGiB:totalmem()/1024**3},scenarios:[]};
for(const scenario of ['generated','autonomous'] as const){
  const w=new World(1024,1536,91207),f=new Factory(w),generation=performance.now();
  if(scenario==='generated')generateTerrain(w);else installLine(w,f);
  const generationMs=performance.now()-generation,times:number[]=[],samples:number[]=[];
  for(let i=0;i<5400;i++){const start=performance.now();f.step();w.step();times.push(performance.now()-start);if(i%900===899)samples.push(f.gold);}
  const typedArrayBytes=Object.values(w).filter(v=>ArrayBuffer.isView(v)).reduce((s,v)=>s+(v as Uint8Array).byteLength,0);
  report.scenarios.push({scenario,dimensions:[w.width,w.height],ticks:5400,simulatedSeconds:180,generationMs,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:percentile(times,.95),p99Ms:percentile(times,.99),maxMs:Math.max(...times),typedArrayMiB:typedArrayBytes/1024**2,goldEvery30Seconds:samples,counters:f.counters,remainingWater:w.count(Mat.Water),processMemory:process.memoryUsage()});
}
mkdirSync('.local',{recursive:true});writeFileSync('.local/benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
