import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/auth.js';
import middleware from '../middleware.js';
import {isOpenRequest,safeNext,createSessionToken,readSessionToken,resetAuthCache,getCookie,hashPassword,verifyPassword} from '../lib/auth.js';

const NAMES=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN','AUTH_SECRET','SIGNUP_CODE'];
const res=()=>({headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}});
// 메모리 안 가짜 Redis(SET NX / GET / EXISTS / INCR / EXPIRE)
function fakeRedis(){
 const store=new Map();
 const run=([cmd,key,value,opt])=>{
  if(cmd==='SET'){if(opt==='NX'&&store.has(key))return null;store.set(key,value);return 'OK';}
  if(cmd==='GET')return store.has(key)?store.get(key):null;
  if(cmd==='EXISTS')return store.has(key)?1:0;
  if(cmd==='INCR'){const n=Number(store.get(key)||0)+1;store.set(key,String(n));return n;}
  if(cmd==='EXPIRE')return 1;
  throw Error('unknown '+cmd);
 };
 return {store,fetch:async(url,options)=>{const body=JSON.parse(options.body);if(url.endsWith('/multi-exec'))return {ok:true,json:async()=>body.map(c=>({result:run(c)}))};return {ok:true,json:async()=>({result:run(body)})};}};
}
async function withEnv(env,fn){
 const old=NAMES.map(n=>process.env[n]),originalFetch=globalThis.fetch;
 try{for(const n of NAMES)delete process.env[n];Object.assign(process.env,env);resetAuthCache();await fn();}
 finally{globalThis.fetch=originalFetch;resetAuthCache();NAMES.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i]})}
}

test('open paths: login page and GPS device writes stay open, map and reads are locked',()=>{
 assert.equal(isOpenRequest('GET','/login.html'),true);
 assert.equal(isOpenRequest('POST','/radlot/data'),true);
 assert.equal(isOpenRequest('POST','/api/location'),true);
 assert.equal(isOpenRequest('GET','/api/location',new URLSearchParams('device=a&lat=1&lng=2')),true);
 assert.equal(isOpenRequest('GET','/api/location',new URLSearchParams('device=a')),false);
 for(const p of ['/','/index.html','/app.js','/api/history','/api/visitors'])assert.equal(isOpenRequest('GET',p),false);
 assert.equal(safeNext('/?device=a'),'/?device=a');
 for(const bad of ['//evil.example','https://evil.example','/\\evil',undefined])assert.equal(safeNext(bad),'/');
});

test('password hash and signed session token',async()=>{await withEnv({AUTH_SECRET:'test-secret-0123456789-abcdefghij'},async()=>{
 const {salt,hash}=await hashPassword('correct horse');
 assert.equal(await verifyPassword('correct horse',salt,hash),true);
 assert.equal(await verifyPassword('wrong horse',salt,hash),false);
 const token=await createSessionToken('captain');
 assert.equal((await readSessionToken(token)).username,'captain');
 assert.equal(await readSessionToken(token.slice(0,-2)+'xx'),null);
 assert.equal(await readSessionToken(token,Date.now()+8*24*3600*1000),null);
 assert.equal(getCookie('a=1; gps_session='+token+'; b=2'),token);
})});

test('signup, duplicate, login, me, logout and signup code',async()=>{await withEnv({UPSTASH_REDIS_REST_URL:'https://redis.example',UPSTASH_REDIS_REST_TOKEN:'t'},async()=>{
 const redis=fakeRedis();globalThis.fetch=redis.fetch;
 const call=async(method,action,body,cookie)=>{const r=res();await handler({method,query:{action},body,headers:{'x-real-ip':'1.1.1.1',...(cookie?{cookie}:{})}},r);return r;};
 const bad=await call('POST','signup',{username:'A!',password:'short'});assert.equal(bad.code,400);
 const created=await call('POST','signup',{username:'Captain',password:'password-1234'});assert.equal(created.code,201);assert.equal(created.data.username,'captain');
 assert.match(created.headers['set-cookie'],/HttpOnly; Secure; SameSite=Lax/);
 assert.equal(redis.store.get('auth:user:captain').includes('password-1234'),false);
 assert.equal((await call('POST','signup',{username:'captain',password:'password-9999'})).code,409);
 assert.equal((await call('POST','login',{username:'captain',password:'wrong-password'})).code,401);
 assert.equal((await call('POST','login',{username:'nobody',password:'password-1234'})).code,401);
 const login=await call('POST','login',{username:'captain',password:'password-1234'});assert.equal(login.code,200);
 const cookie=login.headers['set-cookie'].split(';')[0];
 const me=await call('GET','me',undefined,cookie);assert.equal(me.code,200);assert.equal(me.data.username,'captain');
 assert.equal((await call('GET','me')).code,401);
 const out=await call('POST','logout');assert.match(out.headers['set-cookie'],/Max-Age=0/);
 process.env.SIGNUP_CODE='invite-code';
 assert.equal((await call('POST','signup',{username:'guest1',password:'password-1234'})).code,401);
 assert.equal((await call('POST','signup',{username:'guest1',password:'password-1234',signupCode:'invite-code'})).code,201);
 for(let i=0;i<5;i++)await call('POST','login',{username:'captain',password:'wrong-password'});
 assert.equal((await call('POST','login',{username:'captain',password:'password-1234'})).code,429);
})});

test('middleware redirects pages, blocks API reads, lets members and devices through',async()=>{await withEnv({AUTH_SECRET:'test-secret-0123456789-abcdefghij'},async()=>{
 const page=await middleware(new Request('https://site.example/?device=abc'));
 assert.equal(page.status,302);assert.equal(page.headers.get('location'),'/login.html?next='+encodeURIComponent('/?device=abc'));
 const api=await middleware(new Request('https://site.example/api/history?device=abc'));assert.equal(api.status,401);
 assert.equal(await middleware(new Request('https://site.example/radlot/data',{method:'POST',body:'x'})),undefined);
 assert.equal(await middleware(new Request('https://site.example/login.html')),undefined);
 const token=await createSessionToken('captain');
 assert.equal(await middleware(new Request('https://site.example/',{headers:{cookie:'gps_session='+token}})),undefined);
 const forged=await middleware(new Request('https://site.example/',{headers:{cookie:'gps_session='+token.slice(0,-3)+'abc'}}));assert.equal(forged.status,302);
})});
