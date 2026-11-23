import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const queries={irago:'Irago lighthouse',noma:'Noma lighthouse',takeshima:'Takeshima island -aquarium -School',sangane:'Mount Sangane',mikawawan:'?????????',korankei:'Korankei',chausuyama:'Chausuyama',inuyama:'Inuyama Castle',tokoname:'Tokoname pottery path',tsukechi:'Tsukechi Gorge',magome:'Magome juku',yoro:'Yoro Falls',gozaisho:'Mount Gozaisho',aoyama:'Aoyama Plateau',kanzanji:'Kanzanji',nakatajima:'Nakatajima dunes',iwayado:'Iwayado Park',jokoji:'Jokoji Seto',kariya:'Kariya Highway Oasis',shinmaiko:'Shinmaiko Marine Park',meijimura:'Meiji mura',kuragaike:'Kuragaike Park',toyotamuseum:'Toyota Automobile Museum exterior',aichiranch:'Aichi Farm',satoyama:'Gifu Seiryu Satoyama Park',nabana:'Nabana no Sato',kisosansen:'Kiso Sansen Park Center',tower138:'138 Tower Park'};
const spots=JSON.parse(await readFile(new URL('data/spots.json',root),'utf8'));
const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).trim();
const results=await readFile(new URL('.runtime/image-candidates.json',root),'utf8').then(JSON.parse).catch(()=>({}));
for(let start=0;start<spots.length;start+=1){
 await Promise.all(spots.slice(start,start+1).map(async s=>{
  if(results[s.slug]?.length)return; await new Promise(r=>setTimeout(r,1200));
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  url.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:queries[s.slug],gsrnamespace:'6',gsrlimit:'6',prop:'imageinfo',iiprop:'url|extmetadata|size|mime',iiurlwidth:'1000'});
  let r;for(let attempt=0;attempt<4;attempt++){r=await fetch(url,{headers:{'User-Agent':'TripRand/1.0 (tourism image attribution research)'}});if(r.ok)break;await new Promise(resolve=>setTimeout(resolve,5000));}if(!r.ok){console.log(s.slug+': '+r.status);return;}
  const body=await r.json();results[s.slug]=Object.values(body.query?.pages||{}).sort((a,b)=>a.index-b.index).map(p=>{const i=p.imageinfo?.[0],m=i?.extmetadata||{};return {title:p.title,url:i?.thumburl||i?.url,original_url:i?.url,source_url:i?.descriptionurl,width:i?.thumbwidth,height:i?.thumbheight,mime:i?.mime,author:clean(m.Artist?.value),license:clean(m.LicenseShortName?.value),license_url:m.LicenseUrl?.value,description:clean(m.ImageDescription?.value),categories:m.Categories?.value};});
  await writeFile(new URL('.runtime/image-candidates.json',root),JSON.stringify(results,null,2));
  console.log(s.slug,results[s.slug].map(x=>x.title+' ['+x.license+']').join(' | '));
 }));
}
await mkdir(new URL('.runtime/',root),{recursive:true});
await writeFile(new URL('.runtime/image-candidates.json',root),JSON.stringify(results,null,2));
