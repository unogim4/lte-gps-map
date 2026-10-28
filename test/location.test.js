import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler,{parsePoint} from '../api/location.js';
test('WGS84 coordinates and zero accepted',()=>{assert.equal(parsePoint({lat:'0',lng:'0'}).lat,0);assert.equal(parsePoint({lat:'37.5',lng:'127'}).lng,127);});
test('invalid values rejected',()=>{for(const input of [{lat:'',lng:0},{lat:91,lng:0},{lat:0,lng:181},{lat:'NaN',lng:0},{lat:[],lng:0},{lat:0,lng:0,device:'../x'}])assert.throws(()=>parsePoint(input));});
test('missing storage returns explicit 503, never fake success',async()=>{const env=process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_URL;const res={setHeader(){},status(s){this.code=s;return this},json(d){this.data=d;}};await handler({method:'GET',query:{device:'gps-01'},headers:{}},res);assert.equal(res.code,503);assert.equal(res.data.code,'STORAGE_NOT_CONFIGURED');if(env)process.env.UPSTASH_REDIS_REST_URL=env;});
test('Redis write, cross-client read, and authentication with Vercel KV names',async()=>{
 const names=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN','GPS_WRITE_KEY'];
 const old=Object.fromEntries(names.map(k=>[k,process.env[k]])), originalFetch=globalThis.fetch;
 let saved=null;
 const response=()=>({setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}});
 try{
  delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.KV_REST_API_URL='https://redis.example';process.env.KV_REST_API_TOKEN='test-token';process.env.GPS_WRITE_KEY='test-key';
  globalThis.fetch=async(url,options)=>{const command=JSON.parse(options.body);if(url.endsWith('/multi-exec')){saved=command[0][2];assert.equal(command[1][0],'LPUSH');assert.deepEqual(command[2],['LTRIM','gps-history:test',0,9999]);return {ok:true,json:async()=>command.map(()=>({result:'OK'}))};}return {ok:true,json:async()=>({result:saved})}};
  const denied=response();await handler({method:'GET',query:{device:'test',lat:'37',lng:'127',key:'wrong'},headers:{}},denied);assert.equal(denied.code,401);assert.equal(saved,null);
  const writer=response();await handler({method:'POST',body:{device:'test',lat:37,lng:127},headers:{'x-gps-key':'test-key'}},writer);assert.equal(writer.code,200);
  const reader=response();await handler({method:'GET',query:{device:'test'},headers:{}},reader);assert.equal(reader.data.location.lat,37);assert.equal(reader.data.location.lng,127);
 }finally{globalThis.fetch=originalFetch;for(const k of names){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
