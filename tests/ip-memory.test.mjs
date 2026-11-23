import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi,rememberedIpToken} from '../backend/api.mjs';
test('remembered IP tokens require a server secret and differ between IPs',async()=>{
 const secret='test-secret-'.repeat(4);
 assert.equal(await rememberedIpToken('', '203.0.113.1'),null);
 assert.equal(await rememberedIpToken(secret,'unknown'),null);
 assert.match(await rememberedIpToken(secret,'203.0.113.1'),/^[a-f0-9]{64}$/);
 assert.notEqual(await rememberedIpToken(secret,'203.0.113.1'),await rememberedIpToken(secret,'203.0.113.2'));
 assert.notEqual(await rememberedIpToken(secret,'203.0.113.1'),await rememberedIpToken(secret+'other','203.0.113.1'));
});
test('same IP restores a user without cookies, another IP does not; logout remains explicit',async()=>{
 const users=new Map(),sessions=new Map();
 const mock=async(env,name,a)=>{
  if(name==='trip_rand_id_session'){const row=sessions.get(a.p_token_hash);return !row?{user:null,reason:null}:row.ip===a.p_ip_hash?{user:row.user,reason:null}:{user:null,reason:'ip_changed'};}
  if(name==='trip_rand_id_login'){
   let user=users.get(a.p_username);if(!user){assert.equal(a.p_register,true);user={id:crypto.randomUUID(),username:a.p_username};users.set(a.p_username,user);}
   if(sessions.has(a.p_token_hash))throw Error('duplicate token');
   sessions.set(a.p_token_hash,{user,ip:a.p_ip_hash});return {user};
  }
  if(name==='trip_rand_id_logout'){sessions.delete(a.p_token_hash);return {user:null};}
  if(name==='trip_rand_visit_list')return [];
  throw Error(name);
 };
 const req=(path,{ip='203.0.113.1',cookie,body,secret='test-secret-'.repeat(4)}={})=>handleApi(new Request('https://trip.test/api/'+path,{method:body?'POST':'GET',headers:{...(body?{Origin:'https://trip.test','Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}),{TRIP_RAND_IP_SECRET:secret},ip,mock);
 const getCookie=r=>r.headers.get('set-cookie')?.split(';')[0];
 assert.equal((await (await req('session')).json()).user,null);
 const registration=await req('register',{body:{username:'alice'}}),cookieA=getCookie(registration),alice=(await registration.json()).user;
 const restored=await req('session');assert.equal((await restored.json()).user.id,alice.id);const cookieB=getCookie(restored);assert.notEqual(cookieA,cookieB);
 assert.equal((await req('visits',{cookie:cookieB})).status,200);
 assert.equal((await (await req('session',{ip:'203.0.113.2'})).json()).user,null);
 assert.equal((await (await req('session',{ip:'203.0.113.2',cookie:cookieB})).json()).reason,'ip_changed');
 const signedOut=await req('logout',{body:{},cookie:cookieB});
 assert.equal((await (await req('session',{cookie:getCookie(signedOut)})).json()).user,null);
 assert.equal((await (await req('session')).json()).user.id,alice.id);
 const b=await req('register',{body:{username:'bob'}}),bob=(await b.json()).user;
 assert.equal((await (await req('session')).json()).user.id,bob.id);
 assert.equal((await (await req('session',{cookie:cookieA})).json()).user.id,alice.id);
 assert.equal((await (await req('session')).json()).user.id,bob.id);
 // Existing pre-update cookie learns the IP upon its next successful session check.
 const old=await req('login',{body:{username:'alice'},ip:'203.0.113.3',secret:''});
 await req('session',{cookie:getCookie(old),ip:'203.0.113.3'});
 assert.equal((await (await req('session',{ip:'203.0.113.3'})).json()).user.id,alice.id);
});
