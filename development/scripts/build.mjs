import {build} from 'esbuild';
import {mkdir,copyFile,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
await mkdir('dist',{recursive:true});
// Vercel's Node builder treats dist/app.js as a precompiled server entrypoint.
// Remove only this known obsolete generated file, including when a cache restores it.
await rm('dist/app.js',{force:true});
await build({entryPoints:['client/app.ts'],bundle:true,format:'esm',target:'es2022',outfile:'dist/emerald-client.js',sourcemap:false,minify:true});
for(const name of ['index.html','style.css','brand.png','favicon.svg'])await copyFile(`client/${name}`,`dist/${name}`);
// Only public presentation assets belong on the CDN. The HTML and every API
// request keep the guarded function entrypoint; no records/configuration go here.
await mkdir('public/assets',{recursive:true});
for(const name of await readdir('public'))if(!['assets','brand.png','favicon.svg'].includes(name))throw new Error('Unexpected file in public output; refusing to publish it.');
for(const name of await readdir('public/assets'))if(!/^emerald-(client-[a-f0-9]{12}\.js|style-[a-f0-9]{12}\.css)$/.test(name))throw new Error('Unexpected file in public assets; refusing to publish it.');
const names={};
for(const [kind,file,extension] of [['client','emerald-client.js','js'],['style','style.css','css']]){
  const bytes=Buffer.from((await readFile(`dist/${file}`,'utf8')).replace(/\r\n/g,'\n')),hash=createHash('sha256').update(bytes).digest('hex').slice(0,12);
  const name=`emerald-${kind}-${hash}.${extension}`;names[kind]=`/assets/${name}`;
  // Vercel discovers public files before invoking the backend build. They must
  // be reviewed/uploaded source artifacts, rather than first appearing remotely.
  if(process.env.VERCEL==='1'&&(!existsSync(`public/assets/${name}`)||!bytes.equals(await readFile(`public/assets/${name}`))))throw new Error('Public browser assets are stale. Run pnpm build locally and commit public/.');
  await writeFile(`public/assets/${name}`,bytes);
}
for(const name of ['brand.png','favicon.svg']){
  const bytes=name.endsWith('.svg')?Buffer.from((await readFile(`client/${name}`,'utf8')).replace(/\r\n/g,'\n')):await readFile(`client/${name}`);
  if(process.env.VERCEL==='1'&&(!existsSync(`public/${name}`)||!bytes.equals(await readFile(`public/${name}`))))throw new Error('Public brand assets are stale. Run pnpm build locally and commit public/.');
  await writeFile(`public/${name}`,bytes);
}
const html=await readFile('dist/index.html','utf8');
await writeFile('dist/index.html',html.replace('src="/app.js"',`src="${names.client}"`).replace('href="/style.css"',`href="${names.style}"`));
for(const name of ['app','index','server','main','src/app','src/index','src/server','src/main'])
  for(const extension of ['js','cjs','mjs','ts','cts','mts'])
    if(existsSync(`dist/${name}.${extension}`))throw new Error('Browser output contains a server entrypoint name. Remove the stale generated file before building.');
console.log('Client built.');
