import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/tm800.js';
import {normalizeTm800} from '../lib/tm800-input.js';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}});
test('JSON, form, and query decimal coordinates normalize',()=>{
 assert.deepEqual(normalizeTm800({latitude:35,longitude:129,device:'tm800-test'}),{lat:35,lng:129,device:'tm800-test',key:undefined});
 const form=normalizeTm800('lat=35.2&lon=129.1&key=sample',{},'application/x-www-form-urlencoded');assert.equal(form.lng,'129.1');assert.equal(form.key,'sample');
 assert.equal(normalizeTm800(undefined,{lat:'0',lng:'0'}).device,'tm800-01');
 assert.equal(normalizeTm800('{"lat":35,"lng":129}',{},'application/json').lat,35);
});
test('conflicting fields, duplicate form values, raw NMEA and arrays rejected',()=>{
 assert.throws(()=>normalizeTm800({lng:129,lon:128}));assert.throws(()=>normalizeTm800('lat=35&lat=36',{},'application/x-www-form-urlencoded'));assert.throws(()=>normalizeTm800('$GPGGA,...',{},'text/plain'));assert.throws(()=>normalizeTm800({lat:[35]}));assert.throws(()=>normalizeTm800([]));
});
test('route diagnostics do not write a location and unknown packet fails clearly',async()=>{
 const r=response();await handler({method:'GET',headers:{},query:{}},r);assert.equal(r.code,200);assert.equal(r.data.endpoint,'/radlot/data');assert.equal(r.data.authentication.includes('X-GPS-Key'),true);
 const invalid=response();await handler({method:'POST',headers:{'content-type':'application/json'},body:{unknown:'packet'}},invalid);assert.equal(invalid.code,400);assert.equal(invalid.data.code,'COORDINATES_REQUIRED');
});
test('normalized TM800 packets preserve auth and storage, returning stored location',async()=>{
 const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','GPS_WRITE_KEY'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;let saved;
 try{
  process.env.UPSTASH_REDIS_REST_URL='https://redis.example';process.env.UPSTASH_REDIS_REST_TOKEN='test';process.env.GPS_WRITE_KEY='test-key';
  globalThis.fetch=async(url,options)=>{const commands=JSON.parse(options.body);saved=commands[0];return {ok:true,json:async()=>commands.map(()=>({result:'OK'}))}};
  const rejected=response();await handler({method:'POST',headers:{},body:{lat:35,lng:129,key:'wrong'}},rejected);assert.equal(rejected.code,401);assert.equal(saved,undefined);
  const accepted=response();await handler({method:'POST',headers:{'x-gps-key':'test-key'},body:{latitude:35,longitude:129}},accepted);assert.equal(accepted.code,200);assert.equal(accepted.data.ok,true);assert.equal(saved[1],'gps:tm800-01');assert.equal(JSON.parse(saved[2]).lng,129);
 }finally{globalThis.fetch=originalFetch;for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}}
});

test('actual text/plain TM800 sample and Buffer parse, key from query',()=>{
 const packet='l450061222243141|TEST=1|KST=20261028170635|LAT=35.176583|LON=129.125880|MODE=1|ERR=0';
 for(const body of [packet,Buffer.from(packet)]){
 const p=normalizeTm800(body,{key:'test-key'},'text/plain');assert.equal(p.device,'l450061222243141');assert.equal(p.lat,'35.176583');assert.equal(p.lng,'129.125880');assert.equal(p.key,'test-key');
 }
 for(const body of [packet+'|LAT=1',packet.replace('ERR=0','ERR=1'),packet.replace('35.176583','NaN'),packet.replace('|LON=129.125880','')])assert.throws(()=>normalizeTm800(body,{},'text/plain'));
});
