// One-time research only. No geocoder is called by the deployed app.
// https://operations.osmfoundation.org/policies/nominatim/ : 1 request/sec, cached, single thread.
import {readFile,writeFile} from 'node:fs/promises';
import {setTimeout} from 'node:timers/promises';
const root=new URL('../',import.meta.url),rows=JSON.parse(await readFile(new URL('data/spots.json',root),'utf8'));
const queries={magome:'馬籠宿',aoyama:'青山高原',nakatajima:'中田島砂丘',kisosansen:'木曽三川公園センター',tower138:'138タワーパーク',mikawawan:'三河湾スカイライン'};
const yoro=rows.find(s=>s.slug==='yoro');Object.assign(yoro,{latitude:35.2821734,longitude:136.5357423,location_source_url:'https://www.yoro-park.com/facility-map/yoro-falls/index.html'});
for(const [slug,q] of Object.entries(queries)){
  const cache=new URL('.runtime/research/'+slug+'-geocode.json',root);let results;
  try{results=JSON.parse(await readFile(cache,'utf8'));}catch{await setTimeout(1100);const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=jp&limit=3&q='+encodeURIComponent(q),{headers:{'User-Agent':'TripRandLocalResearch/1.0 (one-time public tourism research)'},signal:AbortSignal.timeout(15000)});if(!r.ok){console.log(slug,r.status);continue;}results=await r.json();await writeFile(cache,JSON.stringify(results,null,2));}
  console.log(slug,results.map(r=>({lat:r.lat,lon:r.lon,name:r.display_name,osm_type:r.osm_type,osm_id:r.osm_id})));
  if(results.length===1){const r=results[0];Object.assign(rows.find(s=>s.slug===slug),{latitude:Number(r.lat),longitude:Number(r.lon),location_source_url:`https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`});}
}
await writeFile(new URL('data/spots.json',root),JSON.stringify(rows,null,2)+'\n');
