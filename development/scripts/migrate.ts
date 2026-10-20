import {openDatabase,migrate} from '../src/database.js';
import {config} from '../src/config.js';
const db=await openDatabase(config().dataDir);
try{await migrate(db);console.log('Migrations applied and checksums verified.');}finally{await db.close();}
