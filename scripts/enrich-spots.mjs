import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
let rows=JSON.parse(await readFile(new URL('data/spots.json',root),'utf8'));
const additional=JSON.parse(await readFile(new URL('data/nearby-spots.json',root),'utf8'));
for(const s of additional)if(!rows.some(r=>r.slug===s.slug))rows.push(s);
const minutes={irago:[150,180],noma:[60,90],takeshima:[70,100],sangane:[80,110],mikawawan:[70,100],korankei:[60,90],chausuyama:[150,180],inuyama:[45,65],tokoname:[45,65],tsukechi:[120,150],magome:[90,120],yoro:[50,75],gozaisho:[60,85],aoyama:[120,150],kanzanji:[90,120],nakatajima:[110,140],iwayado:[50,75],jokoji:[45,65],kariya:[35,55],shinmaiko:[40,60],meijimura:[45,65],kuragaike:[50,70],toyotamuseum:[35,55],aichiranch:[35,55],satoyama:[60,85],nabana:[30,50],kisosansen:[40,60],tower138:[35,55]};
const alternative={mikawawan:'https://www.google.com/maps?q=三河湾スカイライン',gozaisho:'https://www.gozaisho.co.jp/access/',magome:'https://www.kankou-gifu.jp/spot/index_1_2____0__馬籠宿___.html',shinmaiko:'https://www.marine-park.jp/'};
const cacheDir=new URL('.runtime/research/',root);await mkdir(cacheDir,{recursive:true});
for(const s of rows){
  [s.nagoya_minutes_min,s.nagoya_minutes_max]=minutes[s.slug];
  s.travel_note='名古屋駅周辺発・車で片道の編集上の概算。高速道路利用を含み、渋滞・休憩・駐車待ちは含みません。最新の経路と時間は地図で確認。';
  if(Number.isFinite(s.latitude)&&Number.isFinite(s.longitude))continue;
  let urls=[s.source_url,...s.extra_sources.map(x=>x.url)];if(alternative[s.slug]&&!alternative[s.slug].includes('google.com'))urls.unshift(alternative[s.slug]);
  for(const url of urls){try{let text;const cache=new URL(s.slug+'-'+urls.indexOf(url)+'.html',cacheDir);try{text=await readFile(cache,'utf8');}catch{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)continue;text=await r.text();await writeFile(cache,text);}
    const patterns=[/[?&](?:q|ll)=([3][0-9]\.\d+),\s*([1][3-4][0-9]\.\d+)/,/!3d([3][0-9]\.\d+)!4d([1][3-4][0-9]\.\d+)/,/!2d([1][3-4][0-9]\.\d+)!3d([3][0-9]\.\d+)/];
    for(let i=0;i<patterns.length;i++){const m=text.match(patterns[i]);if(m){s.latitude=Number(m[i===2?2:1]);s.longitude=Number(m[i===2?1:2]);s.location_source_url=url;break;}}
    if(s.latitude)break;
  }catch(e){console.log(s.slug,'source unavailable:',e.name);}}
  console.log(s.slug,s.latitude??'NEEDS LOCATION',s.longitude??'');
}
await writeFile(new URL('data/spots.json',root),JSON.stringify(rows,null,2)+'\n');
console.log(`${rows.length} spots; ${rows.filter(s=>s.latitude).length} mapped`);
