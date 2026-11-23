const encoder=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const hash=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
// The lookup token is server-keyed: public IP addresses alone cannot derive it.
export async function rememberedIpToken(secret,ip){
 if(!secret||secret.length<32||!ip||ip==='unknown')return null;
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,encoder.encode('trip-rand/remember-ip/v1/'+ip)));
}
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const response=(data,status=200,cookie)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
const cookieName='trip_rand_session';
const cookie=(request,token,age=60*60*24*90)=>`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
async function payload(request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError(415,'入力形式を確認してください。');const text=await request.text();if(text.length>7500000)throw new ApiError(413,'写真の容量が大きすぎます。');try{const parsed=JSON.parse(text);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();return parsed;}catch{throw new ApiError(400,'入力形式を確認してください。');}}
export async function rpc(env,name,args){const r=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+env.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(25000)});if(!r.ok){const error=await r.json().catch(()=>({}));if(error.message==='id already registered')throw new ApiError(409,'このIDは登録済みです。「ユーザー切り替え」で開けます。');if(error.message==='id not found')throw new ApiError(404,'このIDはまだありません。「新規登録」を選んでください。');throw new ApiError(502,'保存先に接続できませんでした。再試行してください。');}return r.json();}
export async function handleApi(request,env,ip,callRpc=rpc){
 try{
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,'');
  if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)throw new ApiError(403,'このアプリの画面から操作してください。');
  const candidate=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  const token=candidate&&/^[a-f0-9]{64}$/.test(candidate)?candidate:null;
  const tokenHash=token?await hash(token):null;
  const session=token?await callRpc(env,'trip_rand_id_session',{p_token_hash:tokenHash,p_ip_hash:await hash(ip+'|'+token)}):{user:null,reason:null};
  const rememberedToken=['session','register','login'].includes(path)?await rememberedIpToken(env.TRIP_RAND_IP_SECRET,ip):null;
  const rememberedArgs=rememberedToken?{p_token_hash:await hash(rememberedToken),p_ip_hash:await hash(ip+'|'+rememberedToken)}:null;
  async function remember(user,replace=false){
   if(!rememberedArgs)return;
   const current=await callRpc(env,'trip_rand_id_session',rememberedArgs);
   if(current.user&&(!replace||current.user.id===user.id))return;
   if(current.user)await callRpc(env,'trip_rand_id_logout',{p_token_hash:rememberedArgs.p_token_hash});
   try{await callRpc(env,'trip_rand_id_login',{p_username:user.username,p_register:false,...rememberedArgs});}
   catch(error){
    // Concurrent requests from a shared IP may have created the same lookup.
    const raced=await callRpc(env,'trip_rand_id_session',rememberedArgs);
    if(!raced.user)throw error;
   }
  }
  if(path==='session'&&request.method==='GET'){
   if(session.user){await remember(session.user);return response(session);}
   if(rememberedArgs&&candidate!=='signed-out'){
    const remembered=await callRpc(env,'trip_rand_id_session',rememberedArgs);
    if(remembered.user){
     const next=random();const restored=await callRpc(env,'trip_rand_id_login',{p_username:remembered.user.username,p_register:false,p_token_hash:await hash(next),p_ip_hash:await hash(ip+'|'+next)});
     return response({...restored,reason:null},200,cookie(request,next));
    }
   }
   return response(session,200,session.reason==='ip_changed'?cookie(request,'',0):null);
  }
  if((path==='register'||path==='login')&&request.method==='POST'){
   const b=await payload(request),username=String(b.username||'').trim().toLowerCase();
   if(!/^[a-z0-9_-]{3,32}$/.test(username))throw new ApiError(400,'IDは半角英数字・_・-の3〜32文字で入力してください。');
   const next=random();const data=await callRpc(env,'trip_rand_id_login',{p_username:username,p_register:path==='register',p_token_hash:await hash(next),p_ip_hash:await hash(ip+'|'+next)});
   await remember(data.user,true);
   if(token)await callRpc(env,'trip_rand_id_logout',{p_token_hash:tokenHash});
   return response(data,200,cookie(request,next));
  }
  if(path==='logout'&&request.method==='POST'){if(token)await callRpc(env,'trip_rand_id_logout',{p_token_hash:tokenHash});return response({user:null},200,cookie(request,'signed-out'));}
  if(!session.user)throw new ApiError(401,session.reason==='ip_changed'?'IPが変わりました。ユーザー切り替えまたは新規登録を選んでください。':'ユーザー切り替えまたは新規登録を選んでください。');
  const args={p_token:token};
  if(path==='memories'&&request.method==='GET'){
   const visited=(await callRpc(env,'trip_rand_visit_list',args)).filter(v=>v.visited),result=[];
   for(let i=0;i<visited.length;i+=4){
    const batch=await Promise.all(visited.slice(i,i+4).map(async v=>{
     const photos=await callRpc(env,'trip_rand_photo_list',{...args,p_slug:v.spot_slug});
     const latest=photos.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))[0];
     return latest?{...latest,spot_slug:v.spot_slug,visited_on:v.visited_on,photo_count:photos.length}:null;
    }));result.push(...batch.filter(Boolean));
   }
   return response(result);
  }
  if(path==='visits'&&request.method==='GET')return response(await callRpc(env,'trip_rand_visit_list',args));
  if(path==='visits'&&request.method==='POST'){const b=await payload(request);if(typeof b.slug!=='string'||typeof b.visited!=='boolean'||!/^\d{4}-\d{2}-\d{2}$/.test(b.visited_on||''))throw new ApiError(400,'スポットと訪問日を確認してください。');return response(await callRpc(env,'trip_rand_visit_save',{...args,p_slug:b.slug,p_visited:b.visited,p_date:b.visited_on}));}
  if(path==='photos'&&request.method==='GET')return response(await callRpc(env,'trip_rand_photo_list',{...args,p_slug:url.searchParams.get('slug')}));
  if(path==='photos'&&request.method==='POST'){const b=await payload(request);if(typeof b.jpeg!=='string'||b.jpeg.length>6990510||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(b.jpeg)||typeof b.slug!=='string')throw new ApiError(400,'JPEGの写真を確認してください。');return response(await callRpc(env,'trip_rand_photo_save',{...args,p_slug:b.slug,p_jpeg:b.jpeg}));}
  if(path.startsWith('photos/')&&request.method==='GET')return response(await callRpc(env,'trip_rand_photo_get',{...args,p_id:path.slice(7)}));
  throw new ApiError(404,'見つかりません。');
 }catch(e){return response({error:e.status?e.message:'処理に失敗しました。再試行してください。'},e.status||500);}
}
