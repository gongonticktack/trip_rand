import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../backend/api.mjs';
test('memory API rejects missing session before reading photos',async()=>{
 let calls=0;const response=await handleApi(new Request('https://trip.test/api/memories'),{},'127.0.0.1',async()=>{calls++;});
 assert.equal(response.status,401);assert.equal(calls,0);
});
test('memories use existing owner-scoped APIs, latest image and exclude unvisited',async()=>{
 const token='a'.repeat(64),calls=[];
 const response=await handleApi(new Request('https://trip.test/api/memories',{headers:{cookie:'trip_rand_session='+token}}),{},'127.0.0.1',async(env,name,args)=>{
  calls.push({name,args});
  if(name==='trip_rand_id_session')return {user:{id:'owner'}};
  assert.equal(args.p_token,token);
  if(name==='trip_rand_visit_list')return [{spot_slug:'yes',visited:true,visited_on:'2026-10-11'},{spot_slug:'empty',visited:true},{spot_slug:'no',visited:false}];
  assert.equal(name,'trip_rand_photo_list');assert.notEqual(args.p_slug,'no');
  return args.p_slug==='empty'?[]:[{id:'old',created_at:'2026-10-09'},{id:'new',created_at:'2026-10-11'}];
 });
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),[{id:'new',created_at:'2026-10-11',spot_slug:'yes',visited_on:'2026-10-11',photo_count:2}]);
 assert.equal(calls.filter(c=>c.name==='trip_rand_photo_list').length,2);
});
