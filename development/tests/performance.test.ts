import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {requestTiming,timing,flushProfiles} from '../src/performance.js';
test('timings isolate concurrent requests and SQL samples require explicit manager authorization',async()=>{
 const server=createServer((req,res)=>requestTiming(req,res,async()=>{
   const state=timing()!;state.commands=req.url==='/first'?3:8;
   state.allowed=state.requested&&req.url==='/manager';
   state.profiles.push(async()=>({execution:2.5,planning:.5}));
   await new Promise(r=>setTimeout(r,req.url==='/first'?20:2));await flushProfiles();
   res.end('ok');
 }));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+(server.address() as any).port;
 try{
  const [a,b]=await Promise.all(['/first','/second'].map(path=>fetch(origin+path)));
  assert.match(a.headers.get('server-timing')!,/commands;dur=3.00/);assert.match(b.headers.get('server-timing')!,/commands;dur=8.00/);
  const unprivileged=await fetch(origin+'/first',{headers:{'X-Emerald-Diagnostics':'sql'}});assert.ok(!unprivileged.headers.get('server-timing')!.includes('sql_execution'));
  const manager=await fetch(origin+'/manager',{headers:{'X-Emerald-Diagnostics':'sql'}});assert.match(manager.headers.get('server-timing')!,/sql_execution;dur=2.50/);
  assert.match(manager.headers.get('server-timing')!,/plans;dur=1.00/);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
