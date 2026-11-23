import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceKm,NAGOYA,selectDestinations} from '../lib/spots.mjs';
test('great circle distances are symmetric and handle unknown positions',()=>{
 const tokyo={latitude:35.6812,longitude:139.7671};
 assert.equal(distanceKm(NAGOYA,NAGOYA),0);assert.ok(Math.abs(distanceKm(NAGOYA,tokyo)-267)<3);
 assert.equal(distanceKm(tokyo,NAGOYA),distanceKm(NAGOYA,tokyo));assert.equal(distanceKm(null,tokyo),Infinity);
});
const rows=[{slug:'near',name:'近い',...NAGOYA,parking_free:false,nagoya_minutes_max:30},{slug:'far',name:'遠い',latitude:36,longitude:137,parking_free:true,scenic_road:true,nagoya_minutes_max:null},{slug:'unknown',name:'未確認',...NAGOYA,parking_free:null,nagoya_minutes_max:null}];
test('default is unvisited; all results still place visited last',()=>{
 const visits=new Map([['near',{visited:true}]]);
 assert.deepEqual(selectDestinations(rows,{visits}).map(s=>s.slug),['unknown','far']);
 assert.equal(selectDestinations(rows,{visits,visitFilter:''}).at(-1).slug,'near');
 assert.deepEqual(selectDestinations(rows,{visits,visitFilter:'visited'}).map(s=>s.slug),['near']);
});
test('distance and driving filters do not treat unknown values as zero or free',()=>{
 assert.deepEqual(selectDestinations(rows,{freeParking:true}).map(s=>s.slug),['far']);
 assert.deepEqual(selectDestinations(rows,{maxMinutes:60}).map(s=>s.slug),['near']);
 assert.equal(selectDestinations(rows,{maxDistance:50}).length,2);
 assert.equal(selectDestinations(rows,{origin:rows[1],maxDistance:10})[0].slug,'far');
});
