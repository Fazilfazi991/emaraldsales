import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join,relative} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url)),app=resolve(root,'../development'),output=join(root,'dist');
if(relative(root,output)!=='dist')throw new Error('Refusing to clean an unexpected build directory');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await build({entryPoints:[join(app,'client/app.ts')],bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',splitting:true,
  outdir:output,entryNames:'emerald-demo',chunkNames:'chunks/[name]-[hash]',nodePaths:[join(root,'node_modules')],
  plugins:[{name:'isolated-demo',setup(builder){
    builder.onResolve({filter:/\/transport\.js$/},args=>args.importer.replaceAll('\\','/').endsWith('client/app.ts')?{path:join(app,'demo/transport.ts')}:undefined);
    builder.onResolve({filter:/^demo:fixtures$/},()=>({path:'fixtures',namespace:'demo'}));
    builder.onLoad({filter:/.*/,namespace:'demo'},async()=>({contents:await readFile(join(app,'fixtures/reference-synthetic.json'),'utf8'),loader:'json'}));
  }}],metafile:true}).then(async result=>{
    const inputs=Object.keys(result.metafile.inputs);
    if(!inputs.some(p=>p.replaceAll('\\','/').endsWith('demo/transport.ts'))||inputs.some(p=>p.replaceAll('\\','/').endsWith('client/transport.ts')))throw new Error('The static demo must use only the browser-local adapter');
    if(inputs.some(p=>/src\/(?:auth|database|postgres|hosted|server)\./.test(p)))throw new Error('A backend module entered the static demo bundle');
    await writeFile(join(root,'build-manifest.json'),JSON.stringify({static:true,functions:0,inputs,outputs:Object.keys(result.metafile.outputs)},null,2));
  });
const html=(await readFile(join(app,'client/index.html'),'utf8')).replace('/app.js','/emerald-demo.js').replace('<title>Emerald Field Sales CRM</title>','<title>Emerald Sales CRM — Client Demo</title>');
await writeFile(join(output,'index.html'),html);
for(const name of ['style.css','brand.png','favicon.svg'])await copyFile(join(app,'client',name),join(output,name));
await writeFile(join(output,'demo.css'),await readFile(join(app,'demo/demo.css')));
await writeFile(join(output,'index.html'),html.replace('</head>','<link rel="stylesheet" href="/demo.css"></head>'));
await copyFile(join(app,'demo/print.css'),join(output,'demo-print.css'));
await mkdir(join(output,'fonts'),{recursive:true});
for(const name of ['NotoSans-Regular.ttf','NotoSans-Bold.ttf','NotoSansArabic-Regular.ttf','NotoSansMalayalam-Regular.ttf','OFL.txt'])await copyFile(join(app,'assets/fonts',name),join(output,'fonts',name));
console.log('Static Emerald demo built. No functions, backend or credentials.');
