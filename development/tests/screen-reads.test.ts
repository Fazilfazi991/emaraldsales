import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ScreenReads} from '../client/screen-reads.js';
test('screen reads validate cached sessions, expire, invalidate and isolate users',async()=>{
 let now=0,reads=0,checks=0;const cache=new ScreenReads(15,()=>now);
 cache.setScope('org:alice');
 const load=async()=>({items:[++reads]}),authorize=async()=>{checks++;};
 const first=await cache.get('/shops',load,authorize);first.items.push(999);
 assert.deepEqual(await cache.get('/shops',load,authorize),{items:[1]});assert.equal(checks,1);
 await assert.rejects(()=>cache.get('/shops',load,async()=>{throw Error('revoked');}));
 now=16;assert.deepEqual(await cache.get('/shops',load,authorize),{items:[2]});
 cache.clear();await cache.get('/shops',load,authorize);assert.equal(reads,3);
 cache.setScope('org:bob');await cache.get('/shops',load,authorize);assert.equal(reads,4);
});
test('obsolete and pre-mutation reads cannot repopulate the screen cache',async()=>{
 const cache=new ScreenReads();cache.setScope('user');let resolve!:(value:string)=>void;
 const pending=cache.get('/shops',()=>new Promise<string>(r=>resolve=r),async()=>{});
 cache.clear();resolve('old');await pending;
 assert.equal(await cache.get('/shops',async()=>'fresh',async()=>{}),'fresh');
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>cache.get('/shops',async()=>'unused',async()=>{},controller.signal),{name:'AbortError'});
});
