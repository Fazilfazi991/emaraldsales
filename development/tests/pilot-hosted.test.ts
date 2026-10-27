import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pilotConfig, verifyPilotWorkspace } from "../src/pilot-hosted.js";
import { hostedConfig } from "../src/hosted-config.js";
import type { Queryable } from "../src/database.js";

test("real pilot has an independent approval gate and rejects synthetic workspaces",async()=>{
  const id=randomUUID(), env={VERCEL:"1",NODE_ENV:"production",CRM_PILOT_STAGE:"approved-real-data-pilot",CRM_PILOT_ORGANIZATION_ID:id,APP_ORIGIN:"https://pilot.example.invalid",VISIT_POLICY:"approved-v2",DUTY_POLICY:"approved-v1",DATABASE_URL:"postgresql://test:test@db.example.invalid/pilot"};
  assert.equal(pilotConfig(env).organizationId,id);
  assert.throws(()=>pilotConfig({...env,CRM_PILOT_STAGE:""}));
  assert.throws(()=>pilotConfig({...env,APP_ORIGIN:"http://localhost"}));
  assert.throws(()=>pilotConfig({...env,DATABASE_URL:"postgresql://test:test@db.example.invalid/pilot?sslmode=disable"}));
  assert.throws(()=>hostedConfig(env));
  const fake=(orgs:unknown[],n:number):Queryable=>({query:(async(sql:string)=>({rows:sql.includes("FROM organizations")?orgs:[{n}]})) as Queryable["query"]});
  await verifyPilotWorkspace(fake([{id,name:"Private pilot"}],0),id);
  await assert.rejects(()=>verifyPilotWorkspace(fake([{id,name:"Emerald Interlink · Synthetic review workspace"}],0),id));
  await assert.rejects(()=>verifyPilotWorkspace(fake([{id,name:"Private pilot"}],1),id));
  await assert.rejects(()=>verifyPilotWorkspace(fake([{id:randomUUID(),name:"Private pilot"}],0),id));
  await assert.rejects(()=>verifyPilotWorkspace(fake([{id,name:"Private pilot"},{id:randomUUID(),name:"Other"}],0),id));
});
