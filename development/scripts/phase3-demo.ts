import {mkdir,writeFile,access} from "node:fs/promises";
import {resolve} from "node:path";
import {openDatabase,migrate} from "../src/database.js";
import {seedDemonstration} from "../src/demo-fixtures.js";

const root=resolve(".data/phase3-demo"),credentials=resolve(".local/phase3-demo-accounts.json");
for(const path of [root,credentials]){
  let exists=false;try{await access(path);exists=true;}catch{}
  if(exists)throw Error("Phase 3 demonstration already exists. Its data and credentials were preserved. Start demo:start instead.");
}
const db=await openDatabase(root);
try{
  await migrate(db);const fixture=await seedDemonstration(db);
  await mkdir(".local",{recursive:true});
  await writeFile(credentials,JSON.stringify({purpose:"Synthetic local demonstration only",dataDir:root,...fixture},null,2),{flag:"wx",mode:0o600});
  console.log("Prepared 700 synthetic demonstration shops and five local accounts. Credentials: .local/phase3-demo-accounts.json (gitignored). Original database preserved.");
}finally{await db.close();}
