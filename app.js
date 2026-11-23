import {L} from './vendor/sdk.mjs';
import {photoJpeg} from './lib/photos.mjs';
import {filterSpots,pickSpot,safeUrl,unvisitedSpots,NAGOYA,distanceKm,selectDestinations} from './lib/spots.mjs';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let spotImages={}, spots=[], previousSlug=null, favoriteStorageAvailable=true;
let favorites=new Set();
try { const saved=JSON.parse(localStorage.getItem('trip-rand-favorites')||'[]'); favorites=new Set(Array.isArray(saved)?saved.filter(s=>typeof s==='string'):[]); } catch {favoriteStorageAvailable=false;}
const baseSelection=()=>filterSpots(spots,{search:$('search').value,prefecture:$('prefecture').value,category:$('category').value,favoritesOnly:$('favoritesOnly').checked,favorites});
function populate(id,field,label){const current=$(id).value;const prompt=id==='prefecture'||id==='category'?'すべて':label;$(id).innerHTML=`<option value="">${prompt}</option>`+[...new Set(spots.map(s=>s[field]))].sort((a,b)=>a.localeCompare(b,'ja')).map(v=>`<option value="${escape(v)}">${escape(v)}</option>`).join('');$(id).value=current;}

function spotPhoto(s,detail=false){const p=spotImages[s.slug];if(!p)return '';return `<img class="spot-photo" src="${escape(p.path)}" alt="${escape(p.alt||s.name)}" width="${p.width}" height="${p.height}" loading="${detail?'eager':'lazy'}" decoding="async">`;}
function photoCredit(s){const p=spotImages[s.slug];if(!p)return '';return `<div class="photo-credit">${p.caption?`<strong>${escape(p.caption)}</strong><br>`:''}写真：${escape(p.author)} · <a target="_blank" rel="noopener noreferrer" href="${escape(safeUrl(p.source_url))}" title="${escape(p.title)}">Wikimedia Commons</a> · <a target="_blank" rel="noopener noreferrer" href="${escape(safeUrl(p.license_url))}">${escape(p.license)}</a><span>一覧は表示枠に合わせてトリミング</span></div>`;}

function render(){const selected=selection(),candidates=randomCandidates();$('count').textContent=`${selected.length} / ${spots.length}`;$('randomCount').textContent=`抽選対象 ${candidates.length}件`;$('random').disabled=candidates.length===0||(user&&!synced);renderMap(selected);$('empty').hidden=selected.length>0;$('spots').innerHTML=selected.map(s=>`<article class="card"><div class="card-art ${spotImages[s.slug]?'has-photo':''} ${s.category==='海・湖'?'sea':s.category==='街・文化'?'town':s.category==='絶景道路'?'road':'mountain'}">${spotPhoto(s)}<span class="type">${escape(s.category)}</span><button class="favorite" data-favorite="${escape(s.slug)}" aria-label="${escape(s.name)}を${favorites.has(s.slug)?'行きたいリストから外す':'行きたいリストに追加'}" aria-pressed="${favorites.has(s.slug)}">${favorites.has(s.slug)?'♥':'♡'}</button></div>${photoCredit(s)}<div class="card-body"><p class="location">${escape(s.prefecture)} / ${escape(s.area)}</p><h3>${escape(s.name)}</h3><p class="drive-time">${escape(distanceLabel(s))}${s.nagoya_minutes_min?`<br><small>名古屋から車で約${driveTime(s)}（概算）</small>`:""}</p>${visits.get(s.slug)?.visited?'<span class="visited-badge">✓ 訪問済み</span>':''}<p class="description">${escape(s.description)}</p><div class="tags">${s.tags.map(t=>`<span class="tag">${escape(t)}</span>`).join('')}</div><div class="card-bottom"><span class="stay">滞在目安 ${s.stay_minutes}分</span><button class="detail-button" data-detail="${escape(s.slug)}">詳細を見る ↗<span class="sr-only">：${escape(s.name)}</span></button></div></div></article>`).join('');}
function detail(s,random=false){if(!s)return;previousSlug=s.slug;$('detailLabel').textContent=random?'YOUR NEXT LITTLE TRIP':'SPOT GUIDE';const facts=[['出発点からの距離',distanceLabel(s)],['名古屋から車で片道',s.nagoya_minutes_min?'約'+driveTime(s)+'（概算）':'未算定・ルート案内で確認'],['ドライブの見どころ',s.drive_highlight||s.recommendation],['時間の条件',s.travel_note],['エリア',s.prefecture+' / '+s.area],['住所',s.address],['車でのアクセス',s.access],['駐車場',s.parking],['営業時間',s.hours],['料金',s.fees],['季節の楽しみ',s.season],['滞在目安',s.stay_minutes+'分（編集上の目安・移動時間を含みません）'],['出発前に',s.cautions]];$('detailContent').innerHTML=`<h2>${escape(s.name)}</h2>${spotImages[s.slug]?`<figure class="detail-photo">${spotPhoto(s,true)}<figcaption>${photoCredit(s)}</figcaption></figure>`:''}<p class="description">${escape(s.description)}</p><p class="recommendation">${escape(s.recommendation)}</p><dl>${facts.map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')}</dl><div class="detail-links"><a target="_blank" rel="noopener noreferrer" href="${escape('https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(originPoint().latitude+','+originPoint().longitude)+'&destination='+encodeURIComponent(s.name+' '+s.address)+'&travelmode=driving')}">車のルートを確認 ↗</a><a target="_blank" rel="noopener noreferrer" href="${escape(safeUrl(s.source_url))}">公式の観光情報 ↗</a></div><div class="sources">調査日 ${escape(s.verified_on)} · 出典：${escape(s.source_name)}${s.extra_sources.map(source=>`<a target="_blank" rel="noopener noreferrer" href="${escape(safeUrl(source.url))}">${escape(source.name)} ↗</a>`).join('')}<p>料金・営業・通行状況は変更される場合があります。出発前に公式情報をご確認ください。</p></div>`;currentSpot=s;appendVisit(s);if(!$('detail').open)$('detail').showModal();}
function validate(rows){if(!Array.isArray(rows)||!rows.length)throw new Error('スポットデータが空です');for(const s of rows){for(const key of ['slug','name','prefecture','area','category','description','recommendation','address','access','parking','hours','fees','season','cautions','source_url','source_name','verified_on'])if(typeof s[key]!=='string')throw new Error('データ形式が不正です');if(!Array.isArray(s.tags)||!s.tags.every(v=>typeof v==='string')||!Array.isArray(s.extra_sources)||!s.extra_sources.every(v=>typeof v.name==='string'&&typeof v.url==='string')||!Number.isInteger(s.stay_minutes)||s.stay_minutes<=0)throw new Error('データ形式が不正です');}return rows;}
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
async function load(){ $('reload').disabled=true;$('status').textContent='Supabaseから読み込んでいます…';document.querySelector('.connection').classList.remove('error');let dbError;try{const config=await json('./supabase-config.json');const {url,key}=config.supabase;const parsed=new URL(url);if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co'))throw new Error('DB接続先が不正です');let all=[];for(let offset=0;offset<10000;offset+=500){const batch=await json(`${url.replace(/\/$/,'')}/rest/v1/trip_rand_spots?select=*&order=name.asc,slug.asc&limit=500&offset=${offset}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!Array.isArray(batch))throw new Error('DB応答が不正です');all.push(...batch);if(batch.length<500)break;if(offset===9500)throw new Error('スポット件数が上限を超えています');}spots=validate(all);$('status').textContent=`● Supabase接続済み · ${spots.length}件の保存済みスポット`;}catch(error){dbError=error;try{spots=validate(await json('./data/spots.json'));$('status').textContent=`○ オフライン用の調査データを表示中 · DB読込失敗（${error.message}）`;}catch{$('status').textContent='読み込みに失敗しました。接続を確認して再読み込みしてください。';spots=[];}}if(dbError)document.querySelector('.connection').classList.add('error');$('verified').textContent=spots.length?`調査日 ${[...new Set(spots.map(s=>s.verified_on))].sort().at(-1)}`:'';populate('prefecture','prefecture','すべての県');populate('category','category','すべての過ごし方');render();$('reload').disabled=false;}
function reset(){$('search').value='';$('prefecture').value='';$('category').value='';$('favoritesOnly').checked=false;$('duration').value='';$('visitFilter').value='unvisited';$('radius').value='';$('freeParking').checked=false;$('scenicOnly').checked=false;$('sort').value='distance';render();}
for(const id of ['search','prefecture','category','favoritesOnly','duration','visitFilter','radius','sort','freeParking','scenicOnly'])$(id).addEventListener('input',render);
for(const id of ['reset','emptyReset'])$(id).addEventListener('click',reset);
$('reload').addEventListener('click',load);$('random').addEventListener('click',()=>detail(pickSpot(randomCandidates(),previousSlug),true));$('closeDetail').addEventListener('click',()=>{if(!operation)$('detail').close();});$('detail').addEventListener('click',e=>{if(!operation&&e.target===$('detail')){const r=$('detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail').close();}});
$('spots').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.detail)detail(spots.find(s=>s.slug===button.dataset.detail));if(button.dataset.favorite){const slug=button.dataset.favorite;favorites.has(slug)?favorites.delete(slug):favorites.add(slug);try{localStorage.setItem('trip-rand-favorites',JSON.stringify([...favorites]));}catch{favoriteStorageAvailable=false;}render();document.querySelector(`[data-favorite="${slug}"]`)?.focus();if(!favoriteStorageAvailable)$('status').textContent+=' · 行きたいリストは今回の表示中のみ保持されます';}});

let user=null,synced=false,visits=new Map(),currentSpot=null,operation=false,generation=0,photoUrls=[],photoGeneration=0;
const map=L.map('map',{scrollWheelZoom:false}).setView([NAGOYA.latitude,NAGOYA.longitude],11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{$('mapStatus').textContent='地図画像を読み込めません。接続を確認してください。スポット一覧は利用できます。';}).addTo(map);
const markers=L.featureGroup().addTo(map);
function driveTime(s){const f=m=>m<60?m+'分':Math.floor(m/60)+'時間'+(m%60?m%60+'分':'');return f(s.nagoya_minutes_min)+'〜'+f(s.nagoya_minutes_max);}
function selection(){return selectDestinations(baseSelection(),{visits,visitFilter:$('visitFilter').value,origin:originPoint(),maxDistance:Number($('radius').value),maxMinutes:Number($('duration').value),freeParking:$('freeParking').checked,scenic:$('scenicOnly').checked,sort:$('sort').value});}
function randomCandidates(){return unvisitedSpots(selection(),visits);}
function renderMap(rows){
 markers.clearLayers();const memories=$('visitFilter').value==='visited';
 $('mapHeading').textContent=memories?'旅の思い出マップ':'地図';
 $('mapLegend').textContent=memories?'撮った写真を地図に重ねています。写真を押すと旅の記録が開きます。写真がない場所はオレンジの点です。':'緑：未訪問 / オレンジ：訪問済み。地点は代表位置です。';
 if(memories&&user&&synced)loadMemories();else $('memoryStatus').textContent=memories?'ユーザーIDで開くと、訪問した場所と写真が表示されます。':'';
 for(const s of rows){if(!Number.isFinite(s.latitude)||!Number.isFinite(s.longitude))continue;
 const b=document.createElement('button');b.className='detail-button';b.textContent=s.name+' · '+distanceLabel(s);b.onclick=()=>detail(s);
 const p=memoryIndex.get(s.slug),image=memories&&p&&memoryImages.get(p.id);
 const marker=image?L.marker([s.latitude,s.longitude],{icon:L.divIcon({className:'memory-marker',html:'<img src="'+image+'" alt="'+escape(s.name)+'の訪問写真"><span>'+escape(p.visited_on)+' · '+p.photo_count+'枚</span>',iconSize:[90,84],iconAnchor:[45,84]}),title:s.name+'の思い出'}):L.circleMarker([s.latitude,s.longitude],{radius:8,color:visits.get(s.slug)?.visited?'#f5a453':'#58ba91',fillOpacity:.9,weight:2});
 marker.bindPopup(b).bindTooltip(s.name).addTo(markers);if(image)marker.on('click',()=>detail(s));
 }
 if(memories)queueMemoryImages(rows);
}
$('fitMap').onclick=()=>{if(markers.getLayers().length)map.fitBounds(markers.getBounds(),{paddingTopLeft:[55,$('visitFilter').value==='visited'?105:35],paddingBottomRight:[55,40],maxZoom:12});};
function revokePhotos(){photoGeneration++;photoUrls.forEach(URL.revokeObjectURL);photoUrls=[];}
$('detail').addEventListener('cancel',e=>{if(operation)e.preventDefault();});
$('detail').addEventListener('close',()=>{revokePhotos();currentSpot=null;});

function authView(){
 $('account').textContent=user?'ユーザー: '+user.username+' / 切り替え':'ユーザー切り替え / 新規登録';
 $('currentUser').textContent=user?'現在のユーザー：'+user.username:'初めての方は新規登録、登録済みの方はログインを選んでください。';
 $('signOut').hidden=!user;
}
function applyUser(next){const changed=user?.id!==next?.id;user=next;if(changed){generation++;visits=new Map();synced=false;clearMemories();revokePhotos();$('detail').close();}authView();render();}
async function api(path,body){
 const requestUser=user?.id;const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const data=await r.json();if(!r.ok){if(r.status===401&&path!=='login'&&requestUser===user?.id){applyUser(null);$('authStatus').textContent=data.error;if(!$('authDialog').open)$('authDialog').showModal();}throw Error(data.error||'処理に失敗しました。');}return data;
}
async function sync(){
 if(operation)return;const ticket=++generation;synced=false;render();
 if(!user){visits=new Map();$('syncStatus').textContent='IDで記録を同期・訪問済みを除外';render();return;}
 $('syncStatus').textContent='訪問記録を同期中…';
 try{const rows=await api('visits');if(ticket!==generation)return;visits=new Map(rows.map(v=>[v.spot_slug,v]));synced=true;invalidateMemoryIndex();$('syncStatus').textContent='同期済み · '+rows.filter(v=>v.visited).length+'か所訪問済み';render();}
 catch(e){if(ticket===generation)$('syncStatus').textContent=e.message+' 再読み込みで再試行できます。';}
}
async function sessionCheck(prompt=false){
 try{const data=await api('session');applyUser(data.user);await sync();if(!user&&(prompt||data.reason==='ip_changed')){$('authStatus').textContent=data.reason==='ip_changed'?'アクセス元のIPが変わりました。ログインまたは新規登録を選んでください。':'';if(!$('authDialog').open)$('authDialog').showModal();}}
 catch(e){$('syncStatus').textContent='ユーザー情報を確認できませんでした。'+e.message;}
}
async function initialize(){try{spotImages=await json('./data/spot-images.json');}catch{spotImages={};}await load();await sessionCheck(true);$('fitMap').click();}
$('reload').addEventListener('click',()=>sessionCheck());
$('account').onclick=()=>{authView();$('authStatus').textContent='';$('authDialog').showModal();};
$('closeAuth').onclick=()=>$('authDialog').close();
function setAuthMode(mode){$('authMode').value=mode;$('authSubmit').textContent=mode==='register'?'新規登録して使う':'このIDで使う';$('registerChoice').setAttribute('aria-pressed',String(mode==='register'));$('loginChoice').setAttribute('aria-pressed',String(mode==='login'));}
$('loginChoice').onclick=()=>setAuthMode('login');$('registerChoice').onclick=()=>setAuthMode('register');
$('accountForm').onsubmit=async e=>{
 e.preventDefault();e.submitter.disabled=true;
 try{const data=await api($('authMode').value,{username:$('username').value.trim()});applyUser(data.user);$('authDialog').close();await sync();}
 catch(e){$('authStatus').textContent=e.message;}finally{e.submitter.disabled=false;}
};
$('signOut').onclick=async()=>{if(operation)return;try{await api('logout',{});applyUser(null);await sync();$('authStatus').textContent='別のユーザーでこのIDで使うか、新規登録してください。';}catch(e){$('authStatus').textContent=e.message;}};
function appendVisit(s){revokePhotos();const box=document.createElement('section');box.className='visit-section';box.innerHTML=`<h3>この場所の旅の記録</h3>${user?`<label>訪問日<input id="visitDate" type="date" value="${escape(visits.get(s.slug)?.visited_on||new Date().toLocaleDateString('sv-SE'))}"></label><button id="visitButton" class="primary" ${!synced||operation?'disabled':''}>${visits.get(s.slug)?.visited?'訪問日を保存':'行った！ 訪問済みにする'}</button>${visits.get(s.slug)?.visited?'<button id="unvisit" class="quiet">未訪問に戻す（写真は残ります）</button>':''}<label>旅の写真を追加<input id="photoInput" type="file" accept="image/jpeg,image/png,image/webp" multiple ${!visits.get(s.slug)?.visited||operation?'disabled':''}></label><p>JPEG・PNG・WebP、1枚20MB以内。位置情報を除き、最大1600pxのJPEGで本人用に保存します。1か所10枚まで。</p>`:'<p>このIDで使うと、訪問記録と写真を端末間で同期できます。</p><button id="visitLogin" class="primary">このIDで使う</button>'}<p id="visitStatus" role="status"></p><div id="photos" class="photo-grid"></div>`;$('detailContent').append(box);if(!user){$('visitLogin').onclick=()=>{$('detail').close();$('account').click();};return;}$('visitButton').onclick=()=>saveVisit(s,true);if($('unvisit'))$('unvisit').onclick=()=>saveVisit(s,false);$('photoInput').onchange=e=>upload(s,[...e.target.files]);loadPhotos(s);}

async function saveVisit(s,visited){
 if(operation||!user||!synced)return;const date=$('visitDate').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){$('visitStatus').textContent='訪問日を入力してください。';return;}
 operation=true;$('visitButton').disabled=true;
 try{const row=await api('visits',{slug:s.slug,visited,visited_on:date});visits.set(s.slug,row);invalidateMemoryIndex();render();detail(s);$('syncStatus').textContent='同期済み · '+[...visits.values()].filter(v=>v.visited).length+'か所訪問済み';}
 catch(e){if($('visitStatus'))$('visitStatus').textContent=e.message;}
 finally{operation=false;if(currentSpot?.slug===s.slug){$('visitButton').disabled=!synced;$('photoInput').disabled=!visits.get(s.slug)?.visited;}}
}
async function loadPhotos(s){
 const ticket=photoGeneration,id=user?.id;if(!id)return;
 try{const data=await api('photos?slug='+encodeURIComponent(s.slug));
 for(const p of data){const photo=await api('photos/'+p.id);if(ticket!==photoGeneration||currentSpot?.slug!==s.slug||user?.id!==id)return;
 const blob=new Blob([Uint8Array.from(atob(photo.jpeg),c=>c.charCodeAt(0))],{type:'image/jpeg'}),url=URL.createObjectURL(blob);photoUrls.push(url);const img=document.createElement('img');img.src=url;img.alt=s.name+'の訪問写真';img.loading='lazy';$('photos').append(img);}}
 catch(e){if(currentSpot?.slug===s.slug&&$('visitStatus'))$('visitStatus').textContent=e.message;}
}
async function upload(s,files){
 if(operation||!user||!synced||!visits.get(s.slug)?.visited)return;const id=user.id;operation=true;$('photoInput').disabled=true;
 try{const photos=await api('photos?slug='+encodeURIComponent(s.slug));if(files.length>5||photos.length+files.length>10)throw Error('一度に5枚、1か所合計10枚までです。');
 for(let i=0;i<files.length;i++){$('visitStatus').textContent='写真を保存中… '+(i+1)+'/'+files.length;const blob=await photoJpeg(files[i]);if(user?.id!==id)throw Error('ユーザーが変更されました。');const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let j=0;j<bytes.length;j+=8192)binary+=String.fromCharCode(...bytes.subarray(j,j+8192));await api('photos',{slug:s.slug,jpeg:btoa(binary)});}
 if(currentSpot?.slug===s.slug){revokePhotos();$('photos').replaceChildren();await loadPhotos(s);$('visitStatus').textContent='写真を保存しました。';invalidateMemoryIndex();render();}}
 catch(e){if(currentSpot?.slug===s.slug&&$('visitStatus'))$('visitStatus').textContent=e.message;}
 finally{operation=false;if(currentSpot?.slug===s.slug)$('photoInput').disabled=!visits.get(s.slug)?.visited;}
}
window.addEventListener('focus',()=>{if(!operation)sessionCheck();});
let currentLocation=null,locationMarker=null,locating=false;
function originPoint(){return $('origin').value==='current'&&currentLocation?currentLocation:NAGOYA;}
function distanceLabel(s){const km=distanceKm(originPoint(),s);return ($('origin').value==='current'?'現在地':'名古屋駅')+'から直線 約'+(Number.isFinite(km)?Math.round(km).toLocaleString('ja-JP'):'—')+'km';}
function acquireLocation(){
 if(locating)return;
 if(!navigator.geolocation){$('origin').value='nagoya';$('locationStatus').textContent='このブラウザでは位置情報を利用できません。名古屋駅を使用します。';return;}
 locating=true;$('locate').disabled=true;$('locationStatus').textContent='現在地を取得中… ブラウザの位置情報利用を許可してください。';
 navigator.geolocation.getCurrentPosition(position=>{
  locating=false;$('locate').disabled=false;currentLocation={latitude:position.coords.latitude,longitude:position.coords.longitude};$('origin').value='current';
  if(locationMarker)map.removeLayer(locationMarker);locationMarker=L.circleMarker([currentLocation.latitude,currentLocation.longitude],{radius:7,color:'#8fb9ff',fillOpacity:1}).bindTooltip('現在地').addTo(map);
  $('locationStatus').textContent='現在地を取得しました（精度 約'+Math.round(position.coords.accuracy)+'m）。距離は直線距離です。位置情報は保存しません。';render();
 },error=>{locating=false;$('locate').disabled=false;$('origin').value='nagoya';$('locationStatus').textContent=(error.code===1?'位置情報の利用が許可されませんでした。':error.code===3?'現在地の取得が時間切れになりました。':'現在地を取得できませんでした。')+'名古屋駅を出発点にしています。';render();},{enableHighAccuracy:false,timeout:15000,maximumAge:60000});
}
$('locate').onclick=acquireLocation;
$('origin').onchange=()=>{if($('origin').value==='current'&&!currentLocation)acquireLocation();else render();};
$('memories').onclick=()=>{$('visitFilter').value='visited';render();$('fitMap').click();document.querySelector('.map-section').scrollIntoView({behavior:'smooth'});};
let memoryIndex=new Map(),memoryImages=new Map(),memoryPending=new Set(),memoryEpoch=0,memoryReady=false,memoryLoading=false,memoryFailed=false;
function clearMemories(){memoryEpoch++;memoryImages.forEach(URL.revokeObjectURL);memoryImages.clear();memoryPending.clear();memoryIndex.clear();memoryReady=false;memoryLoading=false;memoryFailed=false;}
function invalidateMemoryIndex(){clearMemories();}
async function loadMemories(){
 if(memoryReady||memoryLoading||memoryFailed)return;const epoch=memoryEpoch,owner=user?.id;memoryLoading=true;$('memoryStatus').textContent='思い出の写真を読み込んでいます…';
 try{const rows=await api('memories');if(epoch!==memoryEpoch||owner!==user?.id)return;memoryIndex=new Map(rows.map(p=>[p.spot_slug,p]));memoryReady=true;memoryLoading=false;renderMap(selection());}
 catch(e){if(epoch===memoryEpoch){memoryLoading=false;memoryFailed=true;$('memoryStatus').textContent='写真を読み込めませんでした。データを再読み込みすると再試行できます。';}}
}
async function queueMemoryImages(rows){
 if(!memoryReady||!user||$('visitFilter').value!=='visited')return;
 const eligible=rows.filter(s=>memoryIndex.has(s.slug)&&map.getBounds().contains([s.latitude,s.longitude]));
 $('memoryStatus').textContent=memoryIndex.size?'写真のある訪問先 '+memoryIndex.size+'か所。地図を拡大すると写真を見やすくできます。':'訪問先で写真を登録すると、ここに思い出が並びます。';
 const wanted=eligible.slice(0,24).map(s=>memoryIndex.get(s.slug)).filter(p=>!memoryImages.has(p.id)&&!memoryPending.has(p.id));
 const batch=wanted.slice(0,Math.max(0,3-memoryPending.size));
 batch.forEach(p=>memoryPending.add(p.id));
 await Promise.all(batch.map(async p=>{
  const epoch=memoryEpoch,owner=user.id;
  try{const photo=await api('photos/'+p.id);if(epoch!==memoryEpoch||owner!==user?.id)return;
   const blob=new Blob([Uint8Array.from(atob(photo.jpeg),c=>c.charCodeAt(0))],{type:'image/jpeg'});
   const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=180;canvas.height=140;const ctx=canvas.getContext('2d'),scale=Math.max(180/bitmap.width,140/bitmap.height);ctx.drawImage(bitmap,(180-bitmap.width*scale)/2,(140-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);bitmap.close();
   const thumb=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));if(epoch!==memoryEpoch||owner!==user?.id)return;if(thumb)memoryImages.set(p.id,URL.createObjectURL(thumb));
  }catch{if(epoch===memoryEpoch){memoryFailed=true;$('memoryStatus').textContent='一部の写真を読み込めませんでした。データを再読み込みすると再試行できます。';}}
  finally{if(epoch===memoryEpoch){memoryPending.delete(p.id);if(!memoryFailed)renderMap(selection());}}
 }));
}
map.on('moveend',()=>{if($('visitFilter').value==='visited')queueMemoryImages(selection());});
initialize();
