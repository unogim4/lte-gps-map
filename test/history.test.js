import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/history.js';
const res=()=>({setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}});
test('history requires admin key, validates pagination and returns persisted points',async()=>{
 const names=['ADMIN_ACCESS_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'];const old=names.map(n=>process.env[n]);const original=globalThis.fetch;let calls=0;
 try{process.env.ADMIN_ACCESS_KEY='admin-test';process.env.UPSTASH_REDIS_REST_URL='https://redis.example';process.env.UPSTASH_REDIS_REST_TOKEN='test';
 globalThis.fetch=async(url,options)=>{calls++;assert.deepEqual(JSON.parse(options.body),['LRANGE','gps-history:tm-test',0,499]);return {ok:true,json:async()=>({result:[JSON.stringify({device:'tm-test',lat:35,lng:129,receivedAt:'2026-10-28T08:00:00Z'})]})}};
 const denied=res();await handler({method:'GET',headers:{},query:{device:'tm-test'}},denied);assert.equal(denied.code,401);assert.equal(calls,0);
 const bad=res();await handler({method:'GET',headers:{authorization:'Bearer admin-test'},query:{device:'tm-test',offset:'-1'}},bad);assert.equal(bad.code,400);assert.equal(calls,0);
 const ok=res();await handler({method:'GET',headers:{authorization:'Bearer admin-test'},query:{device:'tm-test'}},ok);assert.equal(ok.code,200);assert.equal(ok.data.points[0].lat,35);assert.equal(ok.data.nextOffset,null);
 globalThis.fetch=async()=>({ok:false,json:async()=>({error:'failure'})});const failed=res();await handler({method:'GET',headers:{authorization:'Bearer admin-test'},query:{device:'tm-test'}},failed);assert.equal(failed.code,502);
 }finally{globalThis.fetch=original;names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i]})}
});
