import { addDays, businessDay } from "../src/domain.js";
export type Row = Record<string, any>;
export interface Source { shops: Row[]; visits: Row[] }
export interface DemoState {
  version: 1 | 2; revision: number; anchor: string; profileId: string | null;
  deliveries?: Row[]; collections?: Row[]; collection_operations?: Record<string,any>;
  shops: Row[]; visits: Row[]; followups: Row[]; sessions: Row[]; rests: Row[]; audit: Row[];
  replays: Record<string, {signature: string; result: any}>;
}
export const id = (n: number) => `de000000-0000-4000-a000-${String(n).padStart(12,"0")}`;
export const profiles = [
  {id:id(1),name:"Ahmed Hassan",role:"executive",active:true},
  {id:id(2),name:"Shihab K.",role:"executive",active:true},
  {id:id(3),name:"Naseer M.",role:"executive",active:true},
  {id:id(4),name:"Manager",role:"manager",active:true},
  {id:id(5),name:"Samir Demo",role:"delivery",active:true},
];
export function createData(source: Source, now: Date): DemoState {
  const day=businessDay(now), at=(offset:number,hour=9)=>new Date(`${addDays(day,offset)}T${String(hour).padStart(2,"0")}:00:00+04:00`).toISOString();
  const owner=(slug:string)=>profiles[{ahmed:0,shihab:1,naseer:2}[slug]??0].id;
  const shops=Array.from({length:700},(_,i)=>{
    const s=source.shops[i%source.shops.length];
    return {id:id(1000+i),name:i<36?s.name:`Synthetic Shop ${String(i+1).padStart(4,"0")} · ${s.area}`,
      contact:s.contact,phone:s.phone,area:s.area,location:s.location,notes:"Fictional sample for client review.",
      status:s.status,assigned_executive_id:owner(s.salespersonId),created_by:owner(s.createdBy),created_at:at(-8-i%8),synthetic:true,version:1};
  });
  shops[2].name="مؤسسة النور — نموذج";
  shops[3].name="മാതൃക ഹാർഡ്‌വെയർ";
  const visits=Array.from({length:18},(_,i)=>({id:id(2000+i),shop_id:shops[i%12].id,visitor_id:profiles[i%3].id,
    checked_in_at:at(-Math.floor(i/6),9+i%3),checked_out_at:at(-Math.floor(i/6),10+i%3),lifecycle:"completed",
    outcome:["Regular Visit","Follow-up Required","Order Expected"][i%3],notes:"Fictional product discussion for client review.",
    order_status:"No Order",order_note:"",order_value:null,location:{availability:"not_requested"},version:1}));
  const followups=visits.slice(0,9).map((v,i)=>({id:id(3000+i),shop_id:v.shop_id,visit_id:v.id,owner_id:v.visitor_id,created_by:v.visitor_id,
    due_date:addDays(day,i%4-1),status:i===8?"completed":"pending",created_at:at(-2),updated_at:at(-1),version:1}));
  const start=Math.max(+new Date(`${day}T00:00:00+04:00`),+now-90*60000);
  const sessions=[1,2].map((p,i)=>({id:id(4000+i),executive_id:profiles[p].id,started_at:new Date(start).toISOString(),ended_at:null}));
  const rests=[{id:id(5000),session_id:sessions[0].id,started_at:new Date(Math.min(+now,start+5*60000)).toISOString(),ended_at:new Date(Math.min(+now,start+10*60000)).toISOString()},
    {id:id(5001),session_id:sessions[1].id,started_at:new Date(Math.max(start,+now-15*60000)).toISOString(),ended_at:null}];
  // Keep the seeded morning history in the past even if a tester opens the demo early.
  for(const v of visits) if(+new Date(v.checked_out_at)>+now){v.checked_in_at=new Date(+now-120000).toISOString();v.checked_out_at=new Date(+now-60000).toISOString();}
  for(const r of rests) if(r.ended_at&&+new Date(r.ended_at)>+now)r.ended_at=now.toISOString();
  return {version:1,revision:0,anchor:day,profileId:null,shops,visits,followups,sessions,rests,audit:[],replays:{}};
}
