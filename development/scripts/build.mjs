import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['client/app.ts'],bundle:true,format:'esm',target:'es2022',outfile:'dist/app.js',sourcemap:false});
for(const name of ['index.html','style.css','brand.png','favicon.svg'])await copyFile(`client/${name}`,`dist/${name}`);
console.log('Client built.');
