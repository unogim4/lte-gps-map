import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseStatusPacket,parseInfoPacket,parseLocatePacket,terminalIdFromDevice} from '../lib/device-data.js';
import {normalizeTm800} from '../lib/tm800-input.js';
import tm800 from '../api/tm800.js';
import device from '../api/device.js';
// 시험용 가짜 번호만 사용한다(실제 IMSI·IMEI·전화번호 아님).
const IMSI='999990000000001';
const STATUS='s'+IMSI+'20250820105712'+'0012'+'9111'+'20250820105833'+'0034'+'5100';
const INFO='i'+'111111111111111'+IMSI+'00000000000'+'005'+'240'+'010'+'34'+'03';
// 위치(l): 시각 14 + 위도 24 + 경도 24 + 모드 1 + 에러 1 = 64자. 좌표는 평문(빈칸 채움 방식은 미확인이라 두 가지로 시험).
const LOCATE='l'+IMSI
 +'20251126184425'+'35.176583'.padEnd(24,' ')+'129.125880'.padEnd(24,' ')+'1'+'0'
 +'20251126184435'+'35.177'.padStart(24,'0')+'129.126'.padStart(24,'0')+'2'+'0'
 +'20251126184445'+' '.repeat(24)+' '.repeat(24)+'1'+'3';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}});

test('status packet splits 22-character records',()=>{
 const p=parseStatusPacket(STATUS);
 assert.equal(p.type,'status');assert.equal(p.imsi,IMSI);assert.equal(p.records.length,2);
 assert.deepEqual(p.records[0],{collectedAt:'20250820105712',radiation:12,battery:9,sensorActive:true,batteryAttached:true,detectorAttached:true});
 assert.equal(p.records[1].radiation,34);assert.equal(p.records[1].sensorActive,true);assert.equal(p.records[1].batteryAttached,false);assert.equal(p.records[1].detectorAttached,false);
 for(const bad of [STATUS+'1','x'+STATUS.slice(1),STATUS.replace('9111','9211'),STATUS.replace('20250820105712','20251320105712')])assert.throws(()=>parseStatusPacket(bad));
});

test('info packet keeps periods and signal, drops IMEI and phone number',()=>{
 const p=parseInfoPacket(INFO);
 assert.deepEqual(p,{type:'info',imsi:IMSI,activeMinutes:5,sleepMinutes:240,sleepAfterMinutes:10,rssi:34,networkMode:'03'});
 assert.throws(()=>parseInfoPacket(INFO+'0'));assert.throws(()=>parseInfoPacket(INFO.slice(0,-1)));
});

test('fixed-width locate packet: plain coordinates, mode, error records skipped, encrypted rejected',()=>{
 const p=parseLocatePacket(LOCATE);
 assert.equal(p.type,'locate');assert.equal(p.device,'l'+IMSI);assert.equal(p.points.length,2);
 assert.deepEqual(p.points[0],{lat:35.176583,lng:129.12588,collectedAt:'20251126184425',mode:'1'});
 assert.equal(p.points[1].lat,35.177);assert.equal(p.points[1].mode,'2');
 assert.deepEqual(p.errors,[{code:'3',mode:'1',collectedAt:'20251126184445'}]);
 const encrypted='l'+IMSI+'20251126184425'+'NO1EcbAbAb1ElsKAW2+owQ=='+'F/Pi5XTA8R3LQtYbSji0Ww=='+'1'+'0';
 assert.throws(()=>parseLocatePacket(encrypted),/암호화/);
 assert.throws(()=>parseLocatePacket(LOCATE+'1'));
 assert.throws(()=>parseLocatePacket('l'+IMSI+'20251126184425'+'95'.padEnd(24,' ')+'129'.padEnd(24,' ')+'10'));
 assert.equal(normalizeTm800(LOCATE,{},'text/plain').type,'locate');
 assert.equal(normalizeTm800('l'+IMSI+'|LAT=35.1|LON=129.1|ERR=0',{},'text/plain').type,undefined);
});

test('real-format samples parse without depending on Content-Type',()=>{
 // 캡틴이 준 실제 상태 패킷 형식(2026-11-12). IMSI는 이미 쓰는 장치 ID와 같은 값.
 const real='s450061222243141'+['20261112150717','20261112150817','20261112150917','20261112151017','20261112151117'].map(t=>t+'00009111').join('');
 for(const type of ['text/plain','','application/octet-stream']){const p=normalizeTm800(real,{key:'k'},type);assert.equal(p.type,'status');assert.equal(p.records.length,5);assert.equal(p.imsi,'450061222243141');assert.equal(p.key,'k');}
 assert.equal(normalizeTm800(Buffer.from(real),{},'').records[4].collectedAt,'20261112151117');
 assert.equal(normalizeTm800({[real]:''},{},'application/x-www-form-urlencoded').type,'status');
 // 설정 패킷 형식(IMEI만 가짜 값): 전화번호 칸 0, 활성 5분, 슬립 240분, 슬립 전환 10분, RSSI 31, 망 모드 02
 const info=normalizeTm800('i'+'1'.repeat(15)+'450061222243141'+'00000000000'+'0052400103102',{},'');
 assert.deepEqual([info.type,info.activeMinutes,info.sleepMinutes,info.sleepAfterMinutes,info.rssi,info.networkMode],['info',5,240,10,31,'02']);
});

test('device IDs map to IMSI and pipe MODE is kept',()=>{
 assert.equal(terminalIdFromDevice('l'+IMSI),IMSI);assert.equal(terminalIdFromDevice(IMSI),IMSI);assert.equal(terminalIdFromDevice('tm800-01'),'tm800-01');
 assert.equal(normalizeTm800(STATUS,{key:'k'},'text/plain').type,'status');
 assert.equal(normalizeTm800(INFO,{},'text/plain').type,'info');
 assert.equal(normalizeTm800('l'+IMSI+'|LAT=35.1|LON=129.1|MODE=2|ERR=0',{},'text/plain').mode,'2');
 assert.equal('mode' in normalizeTm800('l'+IMSI+'|LAT=35.1|LON=129.1|ERR=0',{},'text/plain'),false);
});

test('status/info packets need the GPS key and are stored, then readable',async()=>{
 const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN','GPS_WRITE_KEY','GPS_REQUIRE_KEY'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 const store=new Map(),lists=new Map();let calls=0;
 function run(c){switch(c[0]){case 'SET':store.set(c[1],c[2]);return 'OK';case 'GET':return store.get(c[1])??null;case 'LPUSH':{const l=lists.get(c[1])||[];l.unshift(...c.slice(2).reverse());lists.set(c[1],l);return l.length;}case 'LTRIM':return 'OK';case 'LRANGE':return (lists.get(c[1])||[]).slice(c[2],c[3]+1);default:return null;}}
 try{
  delete process.env.KV_REST_API_URL;delete process.env.KV_REST_API_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL='https://redis.example';process.env.UPSTASH_REDIS_REST_TOKEN='test';process.env.GPS_WRITE_KEY='test-key';process.env.GPS_REQUIRE_KEY='1';
  globalThis.fetch=async(url,options)=>{calls++;const c=JSON.parse(options.body);return {ok:true,json:async()=>url.endsWith('/multi-exec')?c.map(row=>({result:run(row)})):{result:run(c)}}};
  const denied=response();await tm800({method:'POST',headers:{'content-type':'text/plain','x-gps-key':'wrong'},query:{},body:STATUS},denied);assert.equal(denied.code,401);assert.equal(calls,0);
  const saved=response();await tm800({method:'POST',headers:{'content-type':'text/plain','x-gps-key':'test-key'},query:{},body:STATUS},saved);assert.equal(saved.code,200);assert.equal(saved.data.count,2);
  const info=response();await tm800({method:'POST',headers:{'content-type':'text/plain'},query:{key:'test-key'},body:INFO},info);assert.equal(info.code,200);assert.equal(info.data.type,'info');
  const stored=JSON.parse(store.get('device-info:'+IMSI));assert.equal(stored.imei,undefined);assert.equal(stored.activeMinutes,5);
  const read=response();await device({method:'GET',query:{device:'l'+IMSI}},read);
  assert.equal(read.code,200);assert.equal(read.data.status.radiation,34);assert.equal(read.data.history.length,2);assert.equal(read.data.history[0].radiation,34);assert.equal(read.data.info.sleepMinutes,240);
  const bad=response();await device({method:'GET',query:{device:'../x'}},bad);assert.equal(bad.code,400);
  const located=response();await tm800({method:'POST',headers:{'content-type':'text/plain','x-gps-key':'test-key'},query:{},body:LOCATE},located);
  assert.equal(located.code,200);assert.equal(located.data.count,2);assert.equal(located.data.skipped,1);
  const latest=JSON.parse(store.get('gps:l'+IMSI));assert.equal(latest.lat,35.177);assert.equal(latest.mode,'2');assert.equal(lists.get('gps-history:l'+IMSI).length,2);
  const withError=response();await device({method:'GET',query:{device:'l'+IMSI}},withError);assert.equal(withError.data.locateError.code,'3');
  // W-016: GPS_REQUIRE_KEY가 없으면(기본) 전송키 없이도 저장한다.
  delete process.env.GPS_REQUIRE_KEY;
  const keyless=response();await tm800({method:'POST',headers:{},query:{},body:STATUS},keyless);assert.equal(keyless.code,200);assert.equal(keyless.data.type,'status');
 }finally{globalThis.fetch=originalFetch;for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}}
});
