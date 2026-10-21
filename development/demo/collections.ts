import {z} from 'zod';
import {businessDay,calendarDate,Fault} from '../src/domain.js';
import {id,type Row} from './data.js';

export const DELIVERY_ID=id(5),REFERENCE_DAY='2026-10-17';
export const REFERENCE_CASH=[298,135,82,76,278,300,336,105];
export const REFERENCE_CREDIT=[447,307,1465,227,116];
export const money=(fils:number)=>(fils/100).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2});
export function fils(value:unknown):number {
  const s=String(value??'').trim();
  if(!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(s))throw new Fault(422,'AMOUNT','Enter a positive AED amount with at most two decimal places.');
  const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));
}
const text=(n:number)=>z.string().trim().max(n);
const input=z.object({shopId:z.string().uuid(),invoice:text(100).min(1),voucher:text(100).default(''),mode:z.enum(['delivery','old_bill']),completed:z.boolean(),outcome:z.enum(['cash','partial','credit','cheque','mixed','none']),cash:text(30).default(''),credit:text(30).default(''),cheque:text(30).default(''),chequeNo:text(100).default(''),chequeDate:z.union([calendarDate,z.literal('')]).default(''),notes:text(2000).default('')}).strict();

/** Atomic additive upgrade: no existing records, timestamps, roles or replay keys are replaced. */
export function upgradeCollections(state:Row):Row {
  if(state.version===1){
    const copy=structuredClone(state);copy.version=2;copy.deliveries=[];copy.collections=[];copy.collection_operations={};
    [...REFERENCE_CASH,...REFERENCE_CREDIT].forEach((amount,i)=>copy.collections.push({id:id(6000+i),delivery_id:null,performer_id:DELIVERY_ID,shop_id:copy.shops[600+i]?.id??copy.shops[i].id,shop_name:copy.shops[600+i]?.name??`Fictional Shop ${i+1}`,invoice:`DEMO-INV-${String(i+1).padStart(3,'0')}`,voucher:i<8?`DEMO-RV-${String(i+1).padStart(3,'0')}`:'',component:i<8?'cash':'credit',amount_fils:amount*100,purpose:'reference',cheque_no:'',cheque_date:'',collected_at:`${REFERENCE_DAY}T08:00:00+04:00`,created_at:`${REFERENCE_DAY}T08:00:00+04:00`,notes:'Synthetic reference amounts only; no settlement status or invoice balance inferred.'}));
    return copy;
  }
  if(state.version!==2||!Array.isArray(state.deliveries)||!Array.isArray(state.collections)||!state.collection_operations)throw new Error('The local demo data could not be read. Use Reset Demo Data to restore the samples.');
  return state;
}
export function saveDelivery(s:Row,actor:Row,body:unknown,key:string,now:string,uuid:()=>string){
  if(actor.role!=='delivery')throw new Fault(403,'DELIVERY_ROLE','Only delivery staff can record their deliveries and collections.');
  const operation=actor.id+':'+key,signature=JSON.stringify(body),prior=s.collection_operations[operation];
  if(prior){if(prior.signature!==signature)throw new Fault(409,'RETRY','This retry belongs to a different action.');return prior.result;}
  const d=input.parse(body),shop=s.shops.find((r:Row)=>r.id===d.shopId);
  if(!shop)throw new Fault(404,'SHOP','Choose a saved shop.');
  const cash=d.cash?fils(d.cash):0,credit=d.credit?fils(d.credit):0,cheque=d.cheque?fils(d.cheque):0;
  const valid=d.outcome==='cash'?cash>0&&!credit&&!cheque:d.outcome==='partial'?cash>0&&credit>0&&!cheque:d.outcome==='credit'?credit>0&&!cash&&!cheque:d.outcome==='cheque'?cheque>0&&!cash&&!credit:d.outcome==='mixed'?[cash,credit,cheque].filter(n=>n>0).length>=2:!cash&&!credit&&!cheque;
  if(!valid||d.mode==='old_bill'&&(credit>0||cash+cheque===0))throw new Fault(422,'SPLIT','Check the amounts for the selected payment outcome. Old-bill collections cannot create new credit.');
  if(cheque>0&&(!d.chequeNo||!d.chequeDate))throw new Fault(422,'CHEQUE','Enter the cheque number and cheque date.');
  const delivery=d.mode==='delivery'?{id:uuid(),performer_id:actor.id,shop_id:shop.id,shop_name:shop.name,invoice:d.invoice,voucher:d.voucher,completed:d.completed,outcome:d.outcome,notes:d.notes,created_at:now}:null;
  if(delivery)s.deliveries.push(delivery);
  const records:Row[]=[];
  for(const [component,amount] of [['cash',cash],['credit',credit],['cheque',cheque]] as const)if(amount){const r={id:uuid(),delivery_id:delivery?.id??null,performer_id:actor.id,shop_id:shop.id,shop_name:shop.name,invoice:d.invoice,voucher:d.voucher,component,amount_fils:amount,purpose:d.mode==='old_bill'?'old_bill':'current',cheque_no:component==='cheque'?d.chequeNo:'',cheque_date:component==='cheque'?d.chequeDate:'',collected_at:now,created_at:now,notes:d.notes};s.collections.push(r);records.push(r);}
  const result={delivery,collections:records};
  s.audit.unshift({id:uuid(),actor_id:actor.id,actor_name:actor.name,shop_id:shop.id,action:'delivery.record',happened_at:now,details:{deliveryId:delivery?.id??null,collectionIds:records.map(r=>r.id),invoice:d.invoice,purpose:d.mode}});
  s.collection_operations[operation]={signature,result};return result;
}
export function collectionReport(s:Row,actor:Row,p:URLSearchParams,profiles:Row[],now:string){
  if(!['manager','admin','delivery'].includes(actor.role))throw new Fault(403,'REPORT','Only delivery staff and managers can view collection records.');
  const date=calendarDate.parse(p.get('date')||businessDay(now)),person=actor.role==='delivery'?actor.id:p.get('person')||'';
  if(person&&!profiles.some(r=>r.id===person&&r.role==='delivery'))throw new Fault(404,'PERSON','Choose a delivery person.');
  const rows=s.collections.filter((r:Row)=>(!person||r.performer_id===person)&&businessDay(r.collected_at)===date&&+new Date(r.collected_at)<=+new Date(now));
  const deliveries=s.deliveries.filter((r:Row)=>(!person||r.performer_id===person)&&businessDay(r.created_at)===date&&+new Date(r.created_at)<=+new Date(now));
  const sum=(component:string,old=false)=>rows.filter((r:Row)=>r.component===component&&(!old||r.purpose==='old_bill')).reduce((n:number,r:Row)=>n+r.amount_fils,0);
  const totals={cash_fils:sum('cash'),credit_fils:sum('credit'),cheque_fils:sum('cheque'),old_cash_fils:sum('cash',true),completed_deliveries:deliveries.filter((r:Row)=>r.completed).length};
  const grouped=new Map<string,Row>();
  for(const r of rows.filter((r:Row)=>r.component!=='cheque')){const k=r.delivery_id??r.id;const entry:Row=grouped.get(k)??{...r,received_fils:0,credit_fils:0};grouped.set(k,entry);entry[r.component==='cash'?'received_fils':'credit_fils']+=r.amount_fils;}
  return {date,person,staff:profiles.find(r=>r.id===person)?.name??'All delivery staff',rows,deliveries,cashRows:[...grouped.values()],cheques:rows.filter((r:Row)=>r.component==='cheque'),totals,asOf:now,staffTotals:profiles.filter(r=>r.role==='delivery'&&(!person||r.id===person)).map(person=>({id:person.id,name:person.name,cash_fils:rows.filter((r:Row)=>r.performer_id===person.id&&r.component==='cash').reduce((n:number,r:Row)=>n+r.amount_fils,0),credit_fils:rows.filter((r:Row)=>r.performer_id===person.id&&r.component==='credit').reduce((n:number,r:Row)=>n+r.amount_fils,0),cheque_fils:rows.filter((r:Row)=>r.performer_id===person.id&&r.component==='cheque').reduce((n:number,r:Row)=>n+r.amount_fils,0)}))};
}
