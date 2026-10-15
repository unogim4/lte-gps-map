import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler,{validateShare} from '../api/visitors.js';
const good={consent:true,name:'테스트 방문자',lat:35.2,lng:129.1,accuracy:30};
const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},json(data){this.data=data;return this}});
test('sharing requires explicit consent and valid coordinates',()=>{assert.throws(()=>validateShare({...good,consent:false}));assert.throws(()=>validateShare({...good,lat:100}));assert.throws(()=>validateShare({...good,accuracy:-1}));assert.throws(()=>validateShare({...good,lat:'35.2'}));assert.equal(validateShare(good).lat,35.2);});
test('unauthenticated readers are rejected before storage access',async()=>{const old=process.env.ADMIN_ACCESS_KEY;process.env.ADMIN_ACCESS_KEY='test-admin';const r=response();await handler({method:'GET',headers:{}},r);assert.equal(r.code,401);assert.deepEqual(Object.keys(r.data),['error']);if(old===undefined)delete process.env.ADMIN_ACCESS_KEY;else process.env.ADMIN_ACCESS_KEY=old;});
test('private sharing lifecycle: rate limit, expiring storage, authenticated listing, revoke',async()=>{
 const keys=['ADMIN_ACCESS_KEY','KV_REST_API_URL','KV_REST_API_TOKEN'];const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;const commands=[],records=new Map(),ids=new Set();let count=0;
 process.env.ADMIN_ACCESS_KEY='test-admin';process.env.KV_REST_API_URL='https://redis.example';process.env.KV_REST_API_TOKEN='test-token';
 function command(c){commands.push(c);switch(c[0]){case 'INCR':return ++count;case 'EXPIRE':return 1;case 'SET':assert.equal(c[3],'EX');assert.equal(c[4],86400);records.set(c[1],c[2]);return 'OK';case 'GET':return records.get(c[1])||null;case 'MGET':return c.slice(1).map(k=>records.get(k)||null);case 'ZADD':ids.add(c[3]);return 1;case 'ZREVRANGE':return [...ids];case 'ZREM':ids.delete(c[2]);return 1;case 'DEL':return records.delete(c[1])?1:0;default:return 0;}}
 globalThis.fetch=async(url,options)=>{const c=JSON.parse(options.body);return {ok:true,json:async()=>url.endsWith('/multi-exec')?c.map(row=>({result:command(row)})):{result:command(c)}}};
 try{
  const noConsent=response();await handler({method:'POST',body:{...good,consent:false},headers:{}},noConsent);assert.equal(noConsent.code,400);assert.equal(commands.length,0);
  const writer=response();await handler({method:'POST',body:good,headers:{'x-real-ip':'127.0.0.1'}},writer);assert.equal(writer.code,201);assert.ok(writer.data.deleteToken);assert.equal(records.size,1);
  const list=response();await handler({method:'GET',headers:{authorization:'Bearer test-admin'}},list);assert.equal(list.data.visitors.length,1);assert.equal(list.data.visitors[0].name,good.name);assert.equal(list.data.visitors[0].deleteHash,undefined);assert.equal(list.data.visitors[0].deleteToken,undefined);
  const badRevoke=response();await handler({method:'DELETE',body:{id:writer.data.id,deleteToken:'wrong'},headers:{}},badRevoke);assert.equal(badRevoke.code,401);assert.equal(records.size,1);
  const revoke=response();await handler({method:'DELETE',body:{id:writer.data.id,deleteToken:writer.data.deleteToken},headers:{}},revoke);assert.equal(revoke.code,200);assert.equal(records.size,0);assert.equal(ids.size,0);
  count=10;const throttled=response();await handler({method:'POST',body:good,headers:{}},throttled);assert.equal(throttled.code,429);assert.equal(records.size,0);
 }finally{globalThis.fetch=oldFetch;for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}}
});
