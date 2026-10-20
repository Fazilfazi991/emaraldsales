import type { Database } from "./database.js";
import { seedSynthetic, syntheticId } from "./fixtures.js";

/** Empty, isolated demonstration databases only. Never run against client records. */
export async function seedDemonstration(db:Database){
  const fixture=await seedSynthetic(db,700);
  await db.transaction(async tx=>{
    for(const [slug,name]of [["ahmed","Ahmed Hassan / أحمد حسن"],["naseer","Naseer / നസീർ മുഹമ്മദ്"],["manager","Demonstration Manager"]]){
      const account=fixture.accounts.find(a=>a.email===`${slug}@local.invalid`)!;
      account.name=name;await tx.query("UPDATE users SET name=$1 WHERE id=$2",[name,account.id]);
    }
    for(const [label,name,contact]of [["shop-1","Al Noor Building Materials / النور لمواد البناء","أحمد خالد"],["shop-2","Malabar Hardware / മലബാർ ഹാർഡ്‌വെയർ","നസീർ മുഹമ്മദ്"],["shop-3","D’Souza Tools – Démo","Élodie D’Souza"]])
      await tx.query("UPDATE shops SET name=$1,contact=$2,notes='Fictional Phase 3 demonstration customer. No real client data.' WHERE id=$3 AND synthetic=true",[name,contact,syntheticId(label)]);
  });
  return fixture;
}
