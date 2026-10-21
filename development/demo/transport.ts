import source from "demo:fixtures";
import { profiles } from "./data.js";
import { DemoStore } from "./store.js";
import { exportDemoReport } from "./reports.js";
import type { DemoControls } from "../client/transport.js";
import { Fault, businessDay } from "../src/domain.js";
import { formatDuration } from "./attendance.js";
const store=new DemoStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)},source);
const controls:DemoControls={profiles,select:id=>store.select(id),reset:()=>store.reset(),download:path=>exportDemoReport(store,path),dutyNow:()=>store.request("/duty"),formatDuration,currentDay:()=>businessDay(new Date())};
export function getDemoControls(){return controls;}
export async function request(path:string,init?:RequestInit):Promise<Response>{
  const run=()=>{
    try{const body=init?.body?JSON.parse(String(init.body)):undefined,key=new Headers(init?.headers).get("Idempotency-Key")??undefined;
      return Response.json(store.request(path,body,key));
    }catch(error){const status=error instanceof Fault?error.status:400;return Response.json({error:{message:error instanceof Error?(error.name==="ZodError"?"Please check the form details and try again.":error.message):"The demo could not save. Please retry."}},{status});}
  };
  return init?.method==="POST"&&navigator.locks?navigator.locks.request("emerald-client-demo",run):run();
}
