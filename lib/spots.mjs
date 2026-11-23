export function filterSpots(spots, {search='', prefecture='', category='', favoritesOnly=false, favorites=new Set()}={}) {
  const terms = search.normalize('NFKC').toLocaleLowerCase('ja').trim().split(/\s+/).filter(Boolean);
  return spots.filter(s => (!prefecture || s.prefecture === prefecture) && (!category || s.category === category) && (!favoritesOnly || favorites.has(s.slug)) && terms.every(term => [s.name,s.prefecture,s.area,s.description,s.recommendation,...s.tags].join(' ').normalize('NFKC').toLocaleLowerCase('ja').includes(term)));
}
export function pickSpot(spots, previousSlug, random=Math.random) {
  const candidates = spots.length > 1 ? spots.filter(s => s.slug !== previousSlug) : spots;
  return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null;
}
export function safeUrl(url) { try {const u=new URL(url);return u.protocol==='https:'?u.href:'#';} catch{return '#';} }

export function unvisitedSpots(spots,visits){return spots.filter(s=>!visits.get(s.slug)?.visited);}

export const NAGOYA={latitude:35.1709,longitude:136.8815};
export function distanceKm(a,b){
  if(!a||!b||![a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite))return Infinity;
  const r=Math.PI/180,dlat=(b.latitude-a.latitude)*r,dlon=(b.longitude-a.longitude)*r;
  const h=Math.sin(dlat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dlon/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function selectDestinations(rows,{visits=new Map(),visitFilter='unvisited',origin=NAGOYA,maxDistance=0,maxMinutes=0,freeParking=false,scenic=false,sort='distance'}={}){
  return rows.filter(s=>(!visitFilter||(visitFilter==='visited')===!!visits.get(s.slug)?.visited)&&(!maxDistance||distanceKm(origin,s)<=maxDistance)&&(!maxMinutes||(Number.isFinite(s.nagoya_minutes_max)&&s.nagoya_minutes_max<=maxMinutes))&&(!freeParking||s.parking_free===true)&&(!scenic||s.scenic_road===true)).sort((a,b)=>Number(!!visits.get(a.slug)?.visited)-Number(!!visits.get(b.slug)?.visited)||(sort==='recommended'?(Number(b.parking_free===true)+Number(b.scenic_road===true))-(Number(a.parking_free===true)+Number(a.scenic_road===true)):0)||distanceKm(origin,a)-distanceKm(origin,b)||a.name.localeCompare(b.name,'ja'));
}
