import {mkdir,copyFile,cp,readFile,writeFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
await mkdir(new URL('vendor/',root),{recursive:true});
await build({entryPoints:[fileURLToPath(new URL('lib/vendor-entry.mjs',root))],bundle:true,format:'esm',platform:'browser',outfile:fileURLToPath(new URL('vendor/sdk.mjs',root)),minify:true});
await copyFile(new URL('node_modules/leaflet/dist/leaflet.css',root),new URL('vendor/leaflet.css',root));
await cp(new URL('node_modules/leaflet/dist/images/',root),new URL('vendor/images/',root),{recursive:true});
let notices='Trip Rand third-party licenses\n\n';
const packages=['leaflet'];
for(const name of packages){const dir=new URL('node_modules/'+name+'/',root);for(const file of await readdir(dir))if(/^license/i.test(file))notices+=name+'\n'+await readFile(new URL(file,dir),'utf8')+'\n\n';}
await writeFile(new URL('vendor/THIRD-PARTY-NOTICES.txt',root),notices);
await cp(new URL('vendor/',root),new URL('dist/vendor/',root),{recursive:true});
for(const file of ['index.html','styles.css','app.js','icon.svg','lib/spots.mjs','lib/photos.mjs','data/spots.json','data/spot-images.json','supabase-config.json','_headers']){const destination=new URL('dist/'+file,root);await mkdir(new URL('.',destination),{recursive:true});await copyFile(new URL(file,root),destination);}
console.log('dist ready: application, SDK bundle, map styles, assets and licenses. SQL and local runtime excluded.');

await writeFile(new URL('dist/_routes.json',root),JSON.stringify({version:1,include:['/api/*'],exclude:[]}));

await cp(new URL('images/spots/',root),new URL('dist/images/spots/',root),{recursive:true});
