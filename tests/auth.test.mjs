import test from 'node:test';import assert from 'node:assert/strict';
import {handleApi,hash} from '../backend/api.mjs';
test('ID-only registration, shared ID, IP re-selection and logout',async()=>{
 const users=new Map(),sessions=new Map();
 const mock=async(_env,name,a)=>{
 if(name==='trip_rand_id_session'){const row=sessions.get(a.p_token_hash);return !row?{user:null,reason:null}:row.ip===a.p_ip_hash?{user:row.user,reason:null}:{user:null,reason:'ip_changed'};}
 if(name==='trip_rand_id_login'){let user=users.get(a.p_username);if(a.p_register&&user)throw Object.assign(Error('registered'),{status:409});if(!a.p_register&&!user)throw Object.assign(Error('not found'),{status:404});if(!user){user={id:crypto.randomUUID(),username:a.p_username};users.set(a.p_username,user);}sessions.set(a.p_token_hash,{user,ip:a.p_ip_hash});return {user};}
 if(name==='trip_rand_id_logout'){sessions.delete(a.p_token_hash);return {user:null};}
 if(name==='trip_rand_visit_list')return [];
 return {ok:true};};
 const request=(path,body,token,ip='203.0.113.1',origin='https://trip.example')=>handleApi(new Request('https://trip.example/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:origin}),...(token?{Cookie:token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),{},ip,mock);
 assert.equal((await request('session')).status,200);assert.equal((await request('register',{username:'x'})).status,400);
 const register=await request('register',{username:'User_A'});assert.equal(register.status,200);const firstUser=(await register.json()).user;assert.equal(firstUser.username,'user_a');const cookie=register.headers.get('set-cookie').split(';')[0];assert.match(register.headers.get('set-cookie'),/HttpOnly.*Secure/);
 assert.equal((await request('register',{username:'user_a'})).status,409);
 assert.equal((await request('login',{username:'unknown'})).status,404);
 assert.equal((await (await request('session',undefined,cookie)).json()).user.id,firstUser.id);
 assert.deepEqual(await (await request('session',undefined,cookie,'203.0.113.2')).json(),{user:null,reason:'ip_changed'});
 assert.equal((await request('visits',undefined,cookie,'203.0.113.2')).status,401);
 const otherDevice=await request('login',{username:'USER_A'},undefined,'203.0.113.2');assert.equal((await otherDevice.json()).user.id,firstUser.id);
 const secondCookie=otherDevice.headers.get('set-cookie').split(';')[0];assert.equal((await request('visits',undefined,secondCookie,'203.0.113.2')).status,200);
 assert.equal((await request('visits',{slug:'noma',visited:true,visited_on:'2026-10-10'},cookie,'203.0.113.1','https://other.example')).status,403);
 assert.equal((await request('logout',{},cookie)).status,200);assert.equal((await request('visits',undefined,cookie)).status,401);
 assert.equal((await request('visits')).status,401);assert.equal((await request('session',undefined,'trip_rand_session='+'a'.repeat(64))).status,200);
 assert.equal((await hash('test')).length,64);
});
