import {z} from 'zod';
import {readQuery,type Database} from './database.js';
import {Fault,type Actor} from './domain.js';

export function administrator(actor:Actor) {
  if(actor.role!=='admin') throw new Fault(403,'FORBIDDEN','Only Admin can manage employee accounts and company administration.');
}
const pageOf=(p:URLSearchParams)=>z.coerce.number().int().min(0).max(10000).parse(p.get('page')??0);
export class Administration {
  constructor(private db:Database){}
  async overview(actor:Actor,p:URLSearchParams){
    administrator(actor);const page=pageOf(p);
    // One bounded snapshot: aggregate today's records once, with only one page of employees.
    return (await readQuery<any>(this.db,`WITH clock AS (
      SELECT now() AS at, (now() AT TIME ZONE 'Asia/Dubai')::date AS day,
        date_trunc('day',now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai' AS start
    ), staff AS (SELECT u.id,u.name,u.active,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=$1),
    today_visits AS (SELECT v.visitor_id,count(*)::int AS visits,
      count(*) FILTER(WHERE lifecycle='completed')::int AS completed,
      COALESCE(sum(order_value) FILTER(WHERE lifecycle='completed' AND order_status='Order Received'),0) AS confirmed
      FROM visits v,clock c WHERE v.organization_id=$1 AND v.checked_in_at>=c.start AND v.checked_in_at<c.start+interval '1 day' GROUP BY v.visitor_id),
    pending AS (SELECT owner_id,count(*)::int AS pending FROM followups WHERE organization_id=$1 AND status='pending' GROUP BY owner_id),
    duty AS (SELECT d.executive_id,
      bool_or(d.ended_at IS NULL) AS on_duty,
      bool_or(d.ended_at IS NULL AND EXISTS(SELECT 1 FROM rest_intervals r WHERE r.session_id=d.id AND r.ended_at IS NULL)) AS on_break,
      sum(greatest(0,extract(epoch FROM least(COALESCE(d.ended_at,c.at),c.at)-greatest(d.started_at,c.start)))) AS seconds,
      sum(COALESCE((SELECT sum(greatest(0,extract(epoch FROM least(COALESCE(r.ended_at,c.at),COALESCE(d.ended_at,c.at),c.at)-greatest(r.started_at,d.started_at,c.start)))) FROM rest_intervals r WHERE r.session_id=d.id AND r.organization_id=$1),0)) AS break_seconds
      FROM duty_sessions d,clock c WHERE d.organization_id=$1 AND d.started_at<c.at AND COALESCE(d.ended_at,c.at)>=c.start GROUP BY d.executive_id),
    employees AS (SELECT s.*,CASE WHEN d.on_break THEN 'On break' WHEN d.on_duty THEN 'On duty' ELSE 'Off duty' END AS duty_status,
      floor(greatest(0,COALESCE(d.seconds,0)-COALESCE(d.break_seconds,0))/60)::int AS working_minutes,
      COALESCE(v.visits,0) AS visits,COALESCE(v.completed,0) AS completed,COALESCE(v.confirmed,0) AS confirmed,
      COALESCE(f.pending,0) AS pending FROM staff s LEFT JOIN duty d ON d.executive_id=s.id LEFT JOIN today_visits v ON v.visitor_id=s.id LEFT JOIN pending f ON f.owner_id=s.id),
    paged AS (SELECT * FROM employees ORDER BY lower(name),id LIMIT 25 OFFSET $2)
    SELECT (SELECT day::text FROM clock) AS day,(SELECT at FROM clock) AS as_of,
      (SELECT jsonb_build_object('employees',count(*),'active',count(*) FILTER(WHERE active),'disabled',count(*) FILTER(WHERE NOT active),
        'on_duty',count(*) FILTER(WHERE duty_status='On duty'),'on_break',count(*) FILTER(WHERE duty_status='On break'),'off_duty',count(*) FILTER(WHERE duty_status='Off duty'),
        'visits',COALESCE(sum(visits),0),'completed',COALESCE(sum(completed),0),'confirmed',COALESCE(sum(confirmed),0),'pending',COALESCE(sum(pending),0)) FROM employees) AS totals,
      (SELECT count(*)::int FROM shops WHERE organization_id=$1 AND status='Customer') AS customers,
      (SELECT count(*)::int FROM shops WHERE organization_id=$1 AND status<>'Customer') AS enquiries,
      COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY lower(name),id) FROM paged),'[]'::jsonb) AS rows`,[actor.organizationId,page*25])).rows[0];
  }
  async employees(actor:Actor,p:URLSearchParams){
    administrator(actor);const page=pageOf(p),q=z.string().max(120).parse(p.get('q')??''),status=z.enum(['all','active','disabled']).parse(p.get('status')??'all');
    const result=(await readQuery<any>(this.db,`WITH filtered AS (
      SELECT u.id,u.name,u.email,u.active,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=$1
      AND ($2='%%' OR concat_ws(' ',u.name,u.email) ILIKE $2) AND ($3='all' OR u.active=($3='active'))
    ), paged AS (SELECT * FROM filtered ORDER BY lower(name),id LIMIT 25 OFFSET $4)
    SELECT (SELECT count(*)::int FROM filtered) AS total,COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY lower(name),id) FROM paged),'[]'::jsonb) AS rows`,[actor.organizationId,`%${q.replace(/[\\%_]/g,'\\$&')}%`,status,page*25])).rows[0];
    return {...result,page,pageSize:25};
  }
  async history(actor:Actor,p:URLSearchParams){
    administrator(actor);const page=pageOf(p);
    const result=(await readQuery<any>(this.db,`WITH events AS (
      SELECT a.id,a.action,a.entity_id,a.happened_at,u.name AS actor_name,t.name AS employee_name,
      jsonb_build_object('role',a.details->>'role','from',a.details->>'from','to',a.details->>'to','active',a.details->'active') AS details
      FROM audit_events a JOIN users u ON u.id=a.actor_id LEFT JOIN users t ON t.id=a.entity_id
      WHERE a.organization_id=$1 AND a.entity_type='user' AND a.action LIKE 'account.%'
    ), paged AS (SELECT * FROM events ORDER BY happened_at DESC,id DESC LIMIT 25 OFFSET $2)
    SELECT (SELECT count(*)::int FROM events) AS total,COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY happened_at DESC,id DESC) FROM paged),'[]'::jsonb) AS rows`,[actor.organizationId,page*25])).rows[0];
    return {...result,page,pageSize:25};
  }
}
