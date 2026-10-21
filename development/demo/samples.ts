import {addDays,businessDay} from '../src/domain.js';
import {id,profiles,type Row} from './data.js';
import {REFERENCE_DAY,saveDelivery} from './collections.js';

export const SAMPLE_SET='delivery-examples-v1';
export const SAMPLE_SHOPS=['Demo Crescent Hardware','Demo Horizon Sanitary','Demo City Tools','Demo Marina Building Supplies','Demo Palm Hardware','Demo Star Fix Trading'];
/** One atomic, additive upgrade. Dates are anchored once, never rolled forward on refresh. */
export function populateSamples(state:Row,now:Date):Row {
  if(state.sample_data){if(state.sample_data.version===1)return state;throw new Error('This sample dataset needs a newer demo version. Saved data has been kept.');}
  const s=structuredClone(state),day=businessDay(now),midnight=(d:string)=>+new Date(`${d}T00:00:00+04:00`);
  const event=(d:string,fraction:number)=>{
    const end=Math.min(+now,midnight(d)+15*3600000),start=Math.min(end,midnight(d)+8*3600000);
    return new Date(Math.floor(start+(end-start)*fraction)).toISOString();
  };
  let sequence=820000;
  const uuid=()=>{const value=id(sequence++);if(['shops','visits','followups','sessions','rests','audit','deliveries','collections'].some(k=>s[k].some((r:Row)=>r.id===value)))throw new Error('Sample record IDs conflict with saved data. No sample changes were saved.');return value;};
  const shops=SAMPLE_SHOPS.map((name,i)=>{
    const shopId=id(810000+i);
    if(s.shops.some((r:Row)=>r.id===shopId))throw new Error('Sample shop IDs conflict with saved data. No sample changes were saved.');
    const shop={id:shopId,name,contact:'Fictional contact',phone:'',area:['Al Quoz','Deira','Al Barsha','Dubai Marina','Al Qusais','Ras Al Khor'][i],location:'',notes:'DEMO — Sample Data. Fictional delivery customer.',status:'Customer',assigned_executive_id:profiles[i%3].id,created_by:profiles[i%3].id,created_at:event(day,0),synthetic:true,version:1,sample_set:SAMPLE_SET};
    s.shops.push(shop);return shop;
  });
  const actor=profiles[4];
  const record=(date:string,index:number,scenario:Row)=>{
    // Reserve the historical reference date; never mix new examples into its totals.
    if(date===REFERENCE_DAY)return;
    const at=event(date,(index+1)/10),ref=`${date.replaceAll('-','')}-${index+1}`;
    const result=saveDelivery(s,actor,{shopId:shops[index%6].id,invoice:`DEMO-INV-${ref}`,voucher:`DEMO-RV-${ref}`,mode:'delivery',completed:true,outcome:'cash',cash:'',credit:'',cheque:'',chequeNo:'',chequeDate:'',notes:'DEMO — Sample Data. Fictional example; no invoice balance or cheque clearance inferred.',...scenario},`sample:${SAMPLE_SET}:${ref}`,at,uuid);
    s.audit[0].sample_set=SAMPLE_SET;
    if(result.delivery)result.delivery.sample_set=SAMPLE_SET;
    for(const r of result.collections)r.sample_set=SAMPLE_SET;
  };
  record(day,0,{cash:'300'});
  record(day,1,{outcome:'partial',cash:'200',credit:'150'});
  record(day,2,{outcome:'credit',credit:'420'});
  record(day,3,{outcome:'cheque',cheque:'275',chequeNo:'DEMO-CHQ-001',chequeDate:addDays(day,7)});
  record(day,4,{outcome:'mixed',cash:'125',credit:'75',cheque:'200',chequeNo:'DEMO-CHQ-002',chequeDate:addDays(day,8)});
  record(day,5,{mode:'old_bill',cash:'180'});
  const recent=[-1,-2].map(n=>addDays(day,n)).filter(d=>d!==REFERENCE_DAY);
  if(recent[0]){record(recent[0],0,{cash:'90'});record(recent[0],1,{outcome:'credit',credit:'60'});}
  if(recent[1])record(recent[1],3,{outcome:'cheque',cheque:'110',chequeNo:'DEMO-CHQ-HISTORY',chequeDate:addDays(day,5)});
  const shift=(date:string,start:string,end:string,breakStart:string,breakEnd:string)=>{
    const at=(t:string)=>new Date(`${date}T${t}:00+04:00`).toISOString(),a=at(start),b=at(end);
    if(+new Date(b)>+now||s.sessions.some((r:Row)=>r.executive_id===actor.id&&+new Date(r.started_at)<+new Date(b)&&(!r.ended_at||+new Date(r.ended_at)>+new Date(a))))return;
    const session={id:uuid(),executive_id:actor.id,started_at:a,ended_at:b,sample_set:SAMPLE_SET};s.sessions.push(session);
    s.rests.push({id:uuid(),session_id:session.id,started_at:at(breakStart),ended_at:at(breakEnd),sample_set:SAMPLE_SET});
  };
  shift(addDays(day,-2),'08:00','15:00','11:30','12:00');
  shift(addDays(day,-1),'08:00','16:00','12:00','12:30');
  shift(day,'08:00','10:00','09:00','09:15');
  for(let i=0;i<3;i++)s.visits.push({id:uuid(),shop_id:shops[i].id,visitor_id:profiles[i].id,checked_in_at:event(day,0.1+i/10),checked_out_at:event(day,0.15+i/10),lifecycle:'completed',outcome:'Regular Visit',notes:'DEMO — Sample Data. Fictional customer discussion; confirmed value is separate from collections.',order_status:i<2?'Order Received':'No Order',order_note:'',order_value:[850,350,null][i],location:{availability:'not_requested'},version:1,sample_set:SAMPLE_SET});
  s.sample_data={version:1,set:SAMPLE_SET,anchor:day,loaded_at:now.toISOString()};
  return s;
}
