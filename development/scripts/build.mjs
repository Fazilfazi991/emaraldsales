import {build} from 'esbuild';
import {mkdir,copyFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
await mkdir('dist',{recursive:true});
// Vercel's Node builder treats dist/app.js as a precompiled server entrypoint.
// Remove only this known obsolete generated file, including when a cache restores it.
await rm('dist/app.js',{force:true});
await build({entryPoints:['client/app.ts'],bundle:true,format:'esm',target:'es2022',outfile:'dist/emerald-client.js',sourcemap:false,minify:true});
for(const name of ['index.html','style.css','brand.png','favicon.svg'])await copyFile(`client/${name}`,`dist/${name}`);
for(const name of ['app','index','server','main','src/app','src/index','src/server','src/main'])
  for(const extension of ['js','cjs','mjs','ts','cts','mts'])
    if(existsSync(`dist/${name}.${extension}`))throw new Error('Browser output contains a server entrypoint name. Remove the stale generated file before building.');
console.log('Client built.');
