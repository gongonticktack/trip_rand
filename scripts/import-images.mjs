import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const candidates=JSON.parse(await readFile(new URL('.runtime/image-candidates.json',root),'utf8'));
const exact=JSON.parse(await readFile(new URL('.runtime/exact-images.json',root),'utf8'));
const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).trim();
const exactByTitle={};
for(const p of Object.values(exact.query.pages)){const i=p.imageinfo?.[0],m=i?.extmetadata||{};exactByTitle[p.title]={title:p.title,url:i?.thumburl||i?.url,original_url:i?.url,source_url:i?.descriptionurl,width:i?.thumbwidth,height:i?.thumbheight,mime:i?.mime,author:clean(m.Artist?.value),license:clean(m.LicenseShortName?.value),license_url:m.LicenseUrl?.value,description:clean(m.ImageDescription?.value)};}
const picked={irago:2,noma:0,sangane:1,korankei:0,chausuyama:4,inuyama:1,tsukechi:0,yoro:0,gozaisho:5,aoyama:0,kanzanji:0,nakatajima:0,iwayado:2,kariya:0,shinmaiko:3,meijimura:4,satoyama:0,nabana:3,kisosansen:4,tower138:2};
const named={takeshima:'File:Take Island and Bridge.jpg',tokoname:'File:Tokoname Yakimono Sanpomichi 2020 ac (3).jpg',magome:'File:Magome-juku.jpg',jokoji:'File:Jokoji temple in autumn - 1.jpg',kuragaike:'File:Kuragaike Park 01, Toyota 2019.jpg',toyotamuseum:'File:Toyota Automobile Museum entrance 2013 September.jpg',aichiranch:'File:愛知牧場.jpg'};
const manifest=await readFile(new URL('data/spot-images.json',root),'utf8').then(JSON.parse).catch(()=>({}));
await mkdir(new URL('images/spots/',root),{recursive:true});
const spots=JSON.parse(await readFile(new URL('data/spots.json',root),'utf8'));
for(const s of spots){
 let photo=named[s.slug]?exactByTitle[named[s.slug]]:candidates[s.slug]?.[picked[s.slug]];
 if(s.slug==='mikawawan')photo={...candidates.sangane[1],caption:'周辺の三河湾（三ヶ根山からの眺め）'};
 if(!photo||!photo.author||!/^CC BY(?:-SA)? [234]\.0$|^CC0$/.test(photo.license))throw Error('Review required: '+s.slug);
 const path='images/spots/'+s.slug+'.jpg',dest=new URL(path,root);
 if(!await stat(dest).catch(()=>null)){
  await new Promise(r=>setTimeout(r,900));
  const r=await fetch(photo.url,{headers:{'User-Agent':'TripRand/1.0 (licensed tourism photo download)'}});if(!r.ok)throw Error(s.slug+': HTTP '+r.status);
  const bytes=new Uint8Array(await r.arrayBuffer());if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('Not JPEG: '+s.slug);
  if(bytes.length>5*1024*1024)throw Error('Image too large: '+s.slug);
  await writeFile(dest,bytes);
 }
 manifest[s.slug]={path,title:photo.title,alt:photo.caption||s.name+'の風景',caption:photo.caption||'',author:photo.author,license:photo.license,license_url:photo.license_url?.replace(/^http:/,'https:')||'https://creativecommons.org/publicdomain/zero/1.0/',source_url:photo.source_url,download_url:photo.url,original_url:photo.original_url,width:photo.width,height:photo.height,retrieved_on:'2026-10-10'};
 await writeFile(new URL('data/spot-images.json',root),JSON.stringify(manifest,null,2)+'\n');
 console.log(s.slug,photo.title,(await stat(dest)).size);
}
