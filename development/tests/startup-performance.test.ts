import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'esbuild';
test('ordinary hosted startup does not initialize local storage or report engines',async()=>{
 const source=`import {registerHooks} from 'node:module';registerHooks({resolve(specifier,context,next){if(['exceljs','fontkit','playwright','playwright-core','@sparticuz/chromium','@electric-sql/pglite'].includes(specifier))throw Error('Heavy dependency initialized during ordinary startup: '+specifier);return next(specifier,context);}});await import('./src/pilot-hosted.ts');`;
 await promisify(execFile)(process.execPath,['--import','tsx','--input-type=module','-e',source],{cwd:process.cwd(),windowsHide:true});
});
test('production browser payload stays small and excludes server validation dependencies',async()=>{
 const result=await build({entryPoints:['client/app.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,metafile:true,minify:true});
 assert.ok(result.outputFiles[0].contents.length<100000,'Browser script exceeds its 100 KB startup budget');
 assert.ok(!Object.keys(result.metafile.inputs).some(path=>/node_modules\/.*zod/.test(path)),'Server validators leaked into the browser bundle');
});
