// W-023 로그인 공통 기능: 비밀번호 해시, 서명 쿠키, 로그인 없이 열리는 주소 목록.
// Node 내장 기능만 사용(추가 설치 없음).
import {randomBytes,scrypt as scryptCallback,createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const scrypt=promisify(scryptCallback);
export const COOKIE_NAME='gps_session';
export const SESSION_SECONDS=7*24*60*60;
export const USERNAME_PATTERN=/^[a-z0-9_]{3,20}$/;

export async function redis(commands,transaction=false){
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
 const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(!url||!token){const error=Error('Storage unavailable');error.code='STORAGE_NOT_CONFIGURED';throw error;}
 const r=await fetch(url.replace(/\/$/,'')+(transaction?'/multi-exec':''),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(commands),signal:AbortSignal.timeout(8000)});
 const data=await r.json();
 if(!r.ok||data.error||(Array.isArray(data)&&data.some(x=>x&&x.error)))throw Error('Storage failure');
 return transaction?data.map(x=>x.result):data.result;
}

const digest=value=>createHash('sha256').update(String(value)).digest();
export function equalText(a,b){return typeof a==='string'&&typeof b==='string'&&timingSafeEqual(digest(a),digest(b));}

export function validateCredentials(body){
 const username=typeof body?.username==='string'?body.username.trim().toLowerCase():'';
 const password=typeof body?.password==='string'?body.password:'';
 if(!USERNAME_PATTERN.test(username))throw Error('아이디는 영문 소문자·숫자·밑줄(_) 3~20자로 입력하세요.');
 if(password.length<8||password.length>128)throw Error('비밀번호는 8~128자로 입력하세요.');
 return {username,password};
}

export async function hashPassword(password,salt=randomBytes(16).toString('hex')){
 const hash=(await scrypt(password,salt,64)).toString('hex');
 return {salt,hash};
}
export async function verifyPassword(password,salt,hash){
 if(typeof salt!=='string'||typeof hash!=='string'||!/^[a-f0-9]{128}$/.test(hash))return false;
 const {hash:candidate}=await hashPassword(password,salt);
 return timingSafeEqual(Buffer.from(candidate,'hex'),Buffer.from(hash,'hex'));
}

// 서명 키: Vercel 환경변수 AUTH_SECRET 우선. 없으면 처음 한 번 임의로 만들어 Redis에 보관하고 메모리에 기억.
let cachedSecret='';
export function resetAuthCache(){cachedSecret='';}
export async function getSecret(){
 if(process.env.AUTH_SECRET)return process.env.AUTH_SECRET;
 if(cachedSecret)return cachedSecret;
 await redis(['SET','auth:secret',randomBytes(32).toString('hex'),'NX']);
 const value=await redis(['GET','auth:secret']);
 if(typeof value!=='string'||value.length<32)throw Error('Secret unavailable');
 cachedSecret=value;
 return value;
}

export async function createSessionToken(username,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({u:username,exp:now+SESSION_SECONDS*1000})).toString('base64url');
 const signature=createHmac('sha256',await getSecret()).update(payload).digest('base64url');
 return payload+'.'+signature;
}
export async function readSessionToken(token,now=Date.now()){
 if(typeof token!=='string'||!token||token.length>512)return null;
 const parts=token.split('.');
 if(parts.length!==2||!parts[0]||!parts[1])return null;
 const expected=createHmac('sha256',await getSecret()).update(parts[0]).digest();
 const given=Buffer.from(parts[1],'base64url');
 if(given.length!==expected.length||!timingSafeEqual(given,expected))return null;
 try{
  const data=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  if(typeof data.u!=='string'||!USERNAME_PATTERN.test(data.u)||typeof data.exp!=='number'||data.exp<=now)return null;
  return {username:data.u,expiresAt:data.exp};
 }catch{return null;}
}

export function getCookie(header,name=COOKIE_NAME){
 if(typeof header!=='string')return '';
 for(const part of header.split(';')){
  const i=part.indexOf('=');
  if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim();
 }
 return '';
}
export const sessionCookie=token=>`${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
export const clearSessionCookie=()=>`${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

// 로그인 없이 열리는 요청. GPS 단말기 수신은 기존 GPS 전송키가 지키므로 열어 둔다.
const OPEN_PATHS=new Set(['/login.html','/auth.js','/style.css','/favicon.ico','/api/auth']);
const DEVICE_PATHS=new Set(['/radlot/data','/radlot/data/','/api/tm800']);
export function isOpenRequest(method,pathname,searchParams=new URLSearchParams()){
 if(OPEN_PATHS.has(pathname)||pathname.startsWith('/vendor/leaflet/'))return true;
 if(DEVICE_PATHS.has(pathname))return true;
 if(pathname==='/api/location'&&(method==='POST'||searchParams.has('lat')||searchParams.has('lng')))return true;
 return false;
}

// 로그인 뒤 돌아갈 주소: 이 사이트 안 주소만 허용(다른 사이트로 보내기 방지).
export function safeNext(value){
 return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!value.startsWith('/\\')&&value.length<=300?value:'/';
}
