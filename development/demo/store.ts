import { businessDay, addDays, dayRange, calendarDate, checkinInput, checkoutInput, leadInput, followupInput, followupCreateInput, followupAssignInput, shopUpdateInput, shopTransferInput, nextDuty, executive, management, owns, Fault, type Actor, type DutyAction } from "../src/domain.js";
import { createData, profiles, id, type Row, type Source, type DemoState } from "./data.js";
import { attendanceForRange } from "./attendance.js";
import {upgradeCollections,saveDelivery,collectionReport} from './collections.js';
export const STORAGE_KEY="emerald-client-demo-v1";
type StorageLike=Pick<Storage,"getItem"|"setItem"|"removeItem">;
const sorted=(rows:Row[],key:string)=>[...rows].sort((a,b)=>String(b[key]).localeCompare(String(a[key]))||String(a.id).localeCompare(String(b.id)));
function need(yes:unknown,message:string,status=409):asserts yes {if(!yes)throw new Fault(status,"DEMO_ACTION",message);}
export class DemoStore {
  constructor(private storage:StorageLike,private source:Source,private clock=()=>new Date(),private uuid=()=>crypto.randomUUID()){}
  reset(){try{this.storage.removeItem(STORAGE_KEY);}catch{throw new Error("Browser storage is unavailable. Allow site storage, then try again.");}}
  private read():DemoState {
    let raw:string|null;
    try{raw=this.storage.getItem(STORAGE_KEY);}catch{throw new Error("Browser storage is unavailable. Allow site storage to use this demo.");}
    if(!raw){const data=upgradeCollections(createData(this.source,this.clock())) as DemoState;this.save(data);return data;}
    let data:Row;
    try{data=JSON.parse(raw);if(!Number.isInteger(data.revision)||!["shops","visits","followups","sessions","rests","audit"].every(k=>Array.isArray(data[k]))||!data.replays)throw 0;data=upgradeCollections(data);}
    catch{throw new Error("The local demo data could not be read. Use Reset Demo Data to restore the samples.");}
    if(JSON.parse(raw).version===1)this.save(data as DemoState);
    return data as DemoState;
  }
  private save(data:DemoState){try{this.storage.setItem(STORAGE_KEY,JSON.stringify(data));}catch{throw new Error("This browser could not save the demo. Free some site storage and retry. No change was saved.");}}
  select(profileId:string){need(profiles.some(p=>p.id===profileId),"Choose a sample profile.");const s=this.read();s.profileId=profileId;this.save(s);}
  private actor(s:DemoState):Actor{const p=profiles.find(p=>p.id===s.profileId);if(!p)throw new Fault(401,"DEMO_ROLE_REQUIRED","Choose a demo role to begin.");return {...p,role:p.role as Actor["role"],organizationId:id(9)};}
  private person(personId:string){return profiles.find(p=>p.id===personId)?.name??"Sample executive";}
  private shop(s:DemoState,shopId:string){const row=s.shops.find(x=>x.id===shopId);need(row,"Shop not found.",404);return row!;}
  private visitRow(s:DemoState,v:Row):Row{const shop=this.shop(s,v.shop_id);return {...v,shop_name:shop.name,area:shop.area,visitor_name:this.person(v.visitor_id)};}
  private followRow(s:DemoState,f:Row):Row{const shop=this.shop(s,f.shop_id);return {...f,shop_name:shop.name,area:shop.area,owner_name:this.person(f.owner_id)};}
  private page(rows:Row[],p:URLSearchParams){const page=Number(p.get("page")||0),pageSize=Number(p.get("pageSize")||40);need(Number.isInteger(page)&&page>=0&&Number.isInteger(pageSize)&&pageSize>0&&pageSize<=100,"Choose a valid page.",400);return {rows:rows.slice(page*pageSize,(page+1)*pageSize),total:rows.length,page,pageSize};}
  private dates(p:URLSearchParams){const today=businessDay(this.clock()),from=calendarDate.parse(p.get("from")||today),to=calendarDate.parse(p.get("to")||from);need(from<=to,"The start date must be on or before the end date.",400);need((+new Date(to)-+new Date(from))/86400000<=366,"Choose a date range of one year or less.",422);return {from,to};}
  private version(row:Row,version:unknown){need(row.version===version,"This record changed. Refresh before trying again.");}
  private future(day:string){need(day>=businessDay(this.clock()),"Choose today or a future UAE date.",422);}
  private audit(s:DemoState,a:Actor,action:string,shopId:string,details:Row={}){s.audit.unshift({id:this.uuid(),actor_id:a.id,actor_name:a.name,shop_id:shopId,action,details,happened_at:this.clock().toISOString()});}
  private follow(s:DemoState,a:Actor,v:Row,due:string){this.future(due);const f={id:this.uuid(),shop_id:v.shop_id,visit_id:v.id,owner_id:a.id,created_by:a.id,due_date:due,status:"pending",version:1,created_at:this.clock().toISOString(),updated_at:this.clock().toISOString()};s.followups.push(f);this.audit(s,a,"followup.create",v.shop_id,{dueDate:due,visitId:v.id});return f;}
  report(kind:string,p:URLSearchParams,all=false):any {
    const s=this.read(),a=this.actor(s);management(a);need(["activity","duty","followups","attendance"].includes(kind),"Report not found.",404);
    const {from,to}=this.dates(p),person=p.get("person"),asOf=this.clock().toISOString();
    if(person)need(profiles.some(x=>x.id===person&&(x.role==="executive"||x.role==="delivery")),"Staff member not found.",404);
    const [start,end]=dayRange(from,to),inside=(value:string)=>value>=new Date(start).toISOString()&&value<new Date(end).toISOString()&&value<=asOf;
    const choose=(row:Row,key:string)=>!person||row[key]===person;
    const attendance=attendanceForRange(s.sessions,s.rests,profiles.filter(x=>!person||x.id===person),from,to,asOf,s.visits);
    let rows:Row[];
    if(kind==="activity")rows=sorted(s.visits.filter(v=>choose(v,"visitor_id")&&inside(v.checked_in_at)).map(v=>this.visitRow(s,v)),"checked_in_at");
    else if(kind==="attendance")rows=attendance.rows;
    else if(kind==="duty")rows=sorted(attendance.sessions.map(d=>({...d,elapsed_minutes:d.duty_ms/60000,rest_minutes:d.break_ms/60000,active_minutes:d.net_ms/60000})),"started_at");
    else {const status=p.get("status")||"pending",scope=p.get("scope")||"range";need(["pending","completed","cancelled","all"].includes(status)&&["range","outstanding"].includes(scope),"Choose valid follow-up filters.",400);rows=s.followups.filter(f=>choose(f,"owner_id")&&f.due_date<=to&&(scope==="outstanding"?f.status==="pending":f.due_date>=from&&(status==="all"||f.status===status))).map(f=>this.followRow(s,f)).sort((a,b)=>a.due_date.localeCompare(b.due_date));}
    const result:any={...this.page(rows,p),from,to,person,timeZone:"Asia/Dubai",asOf,status:p.get("status")||"pending",scope:p.get("scope")||"range"};
    if(all)result.rows=rows;
    if(kind==="duty")result.summary=attendance.totals;
    if(kind==="attendance")Object.assign(result,{totalsByExecutive:attendance.totalsByExecutive,session_details:attendance.sessions,sessions:attendance.sessions,summary:attendance.totals});
    if(kind==="activity"){
      result.staff=profiles.filter(x=>(x.role==="executive"||x.role==="delivery")&&(!person||x.id===person)).map(x=>{
        const recorded=attendance.totalsByExecutive.find(d=>d.executive_id===x.id)!;
        return {...x,...recorded,attendance_status:recorded.status,attendance_rows:attendance.rows.filter(d=>d.executive_id===x.id),session_details:recorded.sessions,checked_in:s.visits.filter(v=>v.visitor_id===x.id&&inside(v.checked_in_at)).length,completed_visits:s.visits.filter(v=>v.visitor_id===x.id&&v.checked_out_at&&inside(v.checked_out_at)).length,open_visits:s.visits.filter(v=>v.visitor_id===x.id&&v.lifecycle==="open").length,pending_followups:s.followups.filter(f=>f.owner_id===x.id&&f.status==="pending").length,due_followups:s.followups.filter(f=>f.owner_id===x.id&&f.status==="pending"&&f.due_date<=to).length,duty_status:recorded.current_status};
      });
      for(const person of result.staff)person.confirmed_order_fils=s.visits.filter(v=>v.visitor_id===person.id&&v.order_status==="Order Received"&&v.checked_out_at&&inside(v.checked_out_at)).reduce((n,v)=>n+Math.round((v.order_value??0)*100),0);
      const sum=(key:string)=>result.staff.reduce((n:number,r:Row)=>n+r[key],0);
      result.summary={...attendance.totals,confirmed_order_fils:sum("confirmed_order_fils"),executives:result.staff.filter((x:Row)=>x.role==="executive").length,checked_in:sum("checked_in"),completed_visits:sum("completed_visits"),open_visits:sum("open_visits"),pending_followups:sum("pending_followups"),due_followups:sum("due_followups"),recorded_sessions:sum("recorded_sessions")};
    }
    return structuredClone(result);
  }
  request(path:string,body?:any,key?:string):any {
    const url=new URL(path,"https://demo.invalid"),route=url.pathname,p=url.searchParams,s=this.read();
    if(route==="/logout"){s.profileId=null;this.save(s);return {};}
    const a=this.actor(s),now=this.clock().toISOString(),today=businessDay(now);
    if(body===undefined){
      if(route==="/me")return {actor:a,csrf:"demo-local-only",policies:{visit:"approved-v2",duty:"approved-v1"}};
      if(route==="/metadata")return {team:profiles,areas:[...new Set(s.shops.map(x=>x.area))].sort()};
      if(route==="/collections")return structuredClone(collectionReport(s,a,p,profiles,now));
      if(route==="/duty"){
        const visible=profiles.filter(x=>(x.role==="executive"||x.role==="delivery")&&((a.role==="manager"||a.role==="admin")||x.id===a.id)),stored=s.sessions.filter(d=>visible.some(x=>x.id===d.executive_id)),first=stored.filter(d=>Number.isFinite(+new Date(d.started_at))).map(d=>businessDay(d.started_at)).sort()[0]??today;
        const history=attendanceForRange(stored,s.rests,visible,first>today?today:first,today,now,s.visits,false),daily=attendanceForRange(stored,s.rests,visible,today,today,now,s.visits);
        const sessions=sorted(history.sessions.map((d):Row=>({...d,name:this.person(d.executive_id)})),"started_at").slice(0,100);
        return {sessions,rests:s.rests.filter(r=>sessions.some(d=>d.id===r.session_id)),today:a.role==="executive"||String(a.role)==="delivery"?daily.rows[0]:null,attendance_rows:daily.rows,totalsByExecutive:daily.totalsByExecutive,asOf:now,timeZone:"Asia/Dubai"};
      }
      if(route==="/shops"){
        const q=(p.get("q")||"").toLocaleLowerCase(),rows=s.shops.filter(x=>[x.name,x.contact,x.phone,x.area,x.location].join(" ").toLocaleLowerCase().includes(q)&&(!p.get("person")||x.assigned_executive_id===p.get("person"))&&(!p.get("area")||x.area===p.get("area"))&&(!p.get("status")||x.status===p.get("status"))&&(p.get("lead")!=="true"||x.status!=="Customer")&&(!p.get("when")||(p.get("when")==="due"?s.followups.some(f=>f.shop_id===x.id&&f.status==="pending"):p.get("when")==="visited"?s.visits.some(v=>v.shop_id===x.id):!s.visits.some(v=>v.shop_id===x.id)))).map(x=>({...x,last_visit:sorted(s.visits.filter(v=>v.shop_id===x.id),"checked_in_at")[0]?.checked_in_at,next_followup:s.followups.filter(f=>f.shop_id===x.id&&f.status==="pending").map(f=>f.due_date).sort()[0],visit_count:s.visits.filter(v=>v.shop_id===x.id).length}));return this.page(rows,p);
      }
      if(route==="/visits")return this.page(sorted(s.visits.map(v=>this.visitRow(s,v)).filter(v=>(!p.get("person")||v.visitor_id===p.get("person"))&&(!p.get("from")||businessDay(v.checked_in_at)>=p.get("from")!)&&(!p.get("to")||businessDay(v.checked_in_at)<=p.get("to")!)&&(!p.get("area")||v.area===p.get("area"))&&(!p.get("status")||(v.outcome??"Currently Visiting")===p.get("status"))&&[v.shop_name,v.visitor_name,v.notes].join(" ").toLowerCase().includes((p.get("q")||"").toLowerCase())),"checked_in_at"),p);
      const shopMatch=route.match(/^\/shops\/([^/]+)(\/audit)?$/);
      if(shopMatch){const shop=this.shop(s,shopMatch[1]);return shopMatch[2]?this.page(s.audit.filter(x=>x.shop_id===shop.id),p):{shop,visits:sorted(s.visits.filter(v=>v.shop_id===shop.id),"checked_in_at"),followups:s.followups.filter(f=>f.shop_id===shop.id).sort((a,b)=>a.due_date.localeCompare(b.due_date))};}
      if(route==="/dashboard"){
        const mine=(r:Row,k:string)=>a.role!=="executive"||r[k]===a.id,visits=s.visits.filter(v=>mine(v,"visitor_id")),pending=s.followups.filter(f=>mine(f,"owner_id")&&f.status==="pending");
        return {metrics:{day:today,server_time:now,executives:3,today:visits.filter(v=>businessDay(v.checked_in_at)===today).length,completed:visits.filter(v=>businessDay(v.checked_in_at)===today&&v.lifecycle==="completed").length,new_shops:s.shops.filter(x=>mine(x,"created_by")&&businessDay(x.created_at)===today).length,pending:pending.length},active:visits.filter(v=>v.lifecycle==="open").map(v=>this.visitRow(s,v)),today:this.page(visits.filter(v=>businessDay(v.checked_in_at)===today).map(v=>this.visitRow(s,v)),new URLSearchParams()),followups:pending.filter(f=>f.due_date<=addDays(today,3)).map(f=>this.followRow(s,f)),team:profiles.filter(x=>x.role==="executive").map(x=>({...x,completed:s.visits.filter(v=>v.visitor_id===x.id&&businessDay(v.checked_in_at)===today&&v.lifecycle==="completed").length,active:s.visits.filter(v=>v.visitor_id===x.id&&v.lifecycle==="open").length,week:s.visits.filter(v=>v.visitor_id===x.id&&businessDay(v.checked_in_at)>=addDays(today,-6)).length,leads:s.shops.filter(y=>y.created_by===x.id&&y.status!=="Customer").length,pending:s.followups.filter(f=>f.owner_id===x.id&&f.status==="pending").length})),recent:sorted(s.shops,"created_at").slice(0,4)};
      }
      if(route.startsWith("/reports/"))return this.report(route.split("/")[2],p);
      throw new Fault(404,"DEMO_ROUTE","This action is not part of the client demonstration.");
    }
    need(key,"Please retry the same demo save.",400);
    if(route==="/delivery-records"){
      const prior=Object.hasOwn(s.collection_operations!,a.id+':'+key);
      const result=saveDelivery(s,a,body,key,now,this.uuid);if(!prior){s.revision++;this.save(s);}return structuredClone(result);
    }
    const replayKey=a.id+":"+key,signature=JSON.stringify([route,body]),previous=s.replays[replayKey];
    if(previous){need(previous.signature===signature,"This retry belongs to a different action.");return structuredClone(previous.result);}
    let result:any={};
    const checkout=route.match(/^\/visits\/([^/]+)\/checkout$/),followup=route.match(/^\/followups\/([^/]+)(\/assign)?$/),shopAction=route.match(/^\/shops\/([^/]+)\/(update|transfer)$/);
    if(route==="/checkin"){
      executive(a);const data=checkinInput.parse(body);this.shop(s,data.shopId);need(!s.visits.some(v=>v.visitor_id===a.id&&v.lifecycle==="open"),"Finish your current visit before starting another.");
      const visit={id:this.uuid(),shop_id:data.shopId,visitor_id:a.id,checked_in_at:now,checked_out_at:null,lifecycle:"open",outcome:null,notes:"",order_status:"No Order",order_value:null,order_note:"",location:{availability:"not_requested"},version:1};s.visits.push(visit);this.audit(s,a,"visit.checkin",visit.shop_id);result={visit};
    }else if(checkout){
      executive(a);const data=checkoutInput.parse(body),v=s.visits.find(v=>v.id===checkout[1]);need(v,"Visit not found.",404);owns(a,v!.visitor_id);need(v!.lifecycle==="open","This visit is already complete. Its history is kept.");if(data.followUpDate)this.future(data.followUpDate);
      Object.assign(v!,{checked_out_at:now,lifecycle:"completed",outcome:data.outcome,notes:data.notes,order_status:data.orderStatus,order_note:data.orderNote,order_value:data.orderValue,version:v!.version+1});result={visit:v,followup:data.followUpDate?this.follow(s,a,v!,data.followUpDate):null};this.audit(s,a,"visit.checkout",v!.shop_id);
    }else if(route==="/followups"){
      executive(a);const data=followupCreateInput.parse(body),v=s.visits.find(v=>v.id===data.visitId);need(v&&v.lifecycle==="completed","Choose your completed visit.");owns(a,v!.visitor_id);result={followup:this.follow(s,a,v!,data.dueDate)};
    }else if(followup){
      const f=s.followups.find(f=>f.id===followup[1]);need(f,"Follow-up not found.",404);need(f!.status==="pending","This follow-up is already closed.");this.version(f!,body.version);
      if(followup[2]){management(a);const data=followupAssignInput.parse(body);need(profiles.some(x=>x.id===data.ownerId&&x.role==="executive"),"Choose a sample executive.");f!.owner_id=data.ownerId;this.audit(s,a,"followup.assign",f!.shop_id,{reason:data.reason});}
      else{executive(a);owns(a,f!.owner_id);const data=followupInput.parse(body);if(data.action==="reschedule"){this.future(data.dueDate);f!.due_date=data.dueDate;}else f!.status=data.action==="complete"?"completed":"cancelled";this.audit(s,a,"followup."+data.action,f!.shop_id,{reason:data.reason});}
      f!.version++;f!.updated_at=now;result={followup:f};
    }else if(route.startsWith("/duty/")){
      if(String(a.role)!=="delivery")executive(a);const action=route.split("/")[2] as DutyAction,session=s.sessions.find(d=>d.executive_id===a.id&&!d.ended_at),rest=session?s.rests.find(r=>r.session_id===session.id&&!r.ended_at):undefined;need((session?.id??null)===body.expectedSessionId,"Duty changed. Refresh before trying again.");const state=nextDuty(!session?"off":rest?"rest":"on",action);
      let sessionId=session?.id;if(action==="start"){sessionId=this.uuid();s.sessions.push({id:sessionId,executive_id:a.id,started_at:now,ended_at:null});}else if(action==="rest")s.rests.push({id:this.uuid(),session_id:sessionId,started_at:now,ended_at:null});else if(action==="return")rest!.ended_at=now;else if(action==="end")session!.ended_at=now;result={state,sessionId};
    }else if(route==="/leads"){
      executive(a);const data=leadInput.parse({...body,location:body.location??"",notes:body.notes??""});owns(a,data.assignedExecutiveId);need(!data.checkIn,"Save the sample shop, then check in.");const shop={id:this.uuid(),name:data.name,contact:data.contact,phone:data.phone,area:data.area,location:data.location,notes:data.notes,status:"New Lead",assigned_executive_id:a.id,created_by:a.id,created_at:now,synthetic:true,version:1};s.shops.push(shop);this.audit(s,a,"shop.create",shop.id);result={shop};
    }else if(shopAction){
      management(a);const shop=this.shop(s,shopAction[1]);this.version(shop,body.version);
      if(shopAction[2]==="transfer"){const data=shopTransferInput.parse(body);need(profiles.some(x=>x.id===data.assignedExecutiveId&&x.role==="executive"),"Choose a sample executive.");const previousOwner=shop.assigned_executive_id;shop.assigned_executive_id=data.assignedExecutiveId;this.audit(s,a,"shop.transfer",shop.id,{reason:data.reason,previousOwner,newOwner:data.assignedExecutiveId});}
      else{const {version,reason,...data}=shopUpdateInput.parse(body);Object.assign(shop,data);this.audit(s,a,"shop.update",shop.id,{reason});}shop.version++;result={shop};
    }else throw new Fault(404,"DEMO_ROUTE","This action is not part of the client demonstration.");
    s.replays[replayKey]={signature,result};for(const old of Object.keys(s.replays).slice(0,-200))delete s.replays[old];s.revision++;this.save(s);return structuredClone(result);
  }
}
