import {AsyncLocalStorage} from 'node:async_hooks';
import type {IncomingMessage,ServerResponse} from 'node:http';

type Timing={started:number;dbActive:number;dbStarted:number;controlActive:number;controlStarted:number;module:number;init:number;connect:number;acquire:number;wire:number;control:number;commands:number;connections:number;profileMs:number;execution:number;planning:number;plans:number;profileErrors:number;requested:boolean;allowed:boolean;suspended:boolean;profiles:(()=>Promise<{execution:number;planning:number}>)[]};
const storage=new AsyncLocalStorage<Timing>();
export const timing=()=>storage.getStore();
export function requestTiming<T>(req:IncomingMessage,res:ServerResponse,work:()=>T):T{
  if(timing())return work();
  const state:Timing={started:performance.now(),dbActive:0,dbStarted:0,controlActive:0,controlStarted:0,module:0,init:0,connect:0,acquire:0,wire:0,control:0,commands:0,connections:0,profileMs:0,execution:0,planning:0,plans:0,profileErrors:0,requested:req.headers['x-emerald-diagnostics']==='sql'&&req.method==='GET',allowed:false,suspended:false,profiles:[]};
  return storage.run(state,()=>{
    const end=res.end;
    res.end=function(this:ServerResponse,...args:any[]){
      if(!res.headersSent){
        const metrics={app:performance.now()-state.started-state.profileMs,module:state.module,init:state.init,connect:state.connect,acquire:state.acquire,db:state.wire,control:state.control,commands:state.commands,connections:state.connections,...(state.allowed?{sql_execution:state.execution,sql_planning:state.planning,plans:state.plans,profile_errors:state.profileErrors,profile:state.profileMs}:{})};
        res.setHeader('Server-Timing',Object.entries(metrics).map(([k,v])=>`${k};dur=${Math.max(0,v).toFixed(2)}`).join(', '));
      }
      return end.apply(this,args as any);
    } as typeof res.end;
    return work();
  });
}
export async function phase<T>(name:'init'|'module',work:()=>Promise<T>){const state=timing(),start=performance.now();try{return await work();}finally{if(state)state[name]+=performance.now()-start;}}
/** Explicit manager-only EXPLAIN sampling; normal traffic never runs a plan twice. */
export async function flushProfiles(){
  const state=timing();if(!state?.allowed||state.suspended)return;
  const start=performance.now();state.suspended=true;
  try{for(const explain of state.profiles.splice(0,8)){try{const p=await explain();state.execution+=p.execution;state.planning+=p.planning;state.plans++;}catch{state.profileErrors++;}}}
  finally{state.profileMs+=performance.now()-start;state.suspended=false;state.profiles.length=0;}
}
