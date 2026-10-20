import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='../reference/emerald-field-sales-crm-source/';
const manifest=await readFile(root+'SHA256SUMS.txt','utf8'),checks=[];
for(const line of manifest.trim().split(/\r?\n/)){
  const match=line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);if(!match)throw new Error('Unexpected manifest line: '+line);
  const bytes=await readFile(root+match[2]);const actual=createHash('sha256').update(bytes).digest('hex');
  checks.push({path:match[2],sha256:actual,match:actual===match[1].toLowerCase()});
}
await writeFile('evidence/integrity.json',JSON.stringify({executedAt:new Date().toISOString(),checks},null,2));
if(checks.some(c=>!c.match))throw new Error('Reference integrity failure');console.log(`${checks.length} reference file hashes match the supplied manifest.`);
