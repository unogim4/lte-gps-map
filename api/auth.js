// W-023 회원가입·로그인·로그아웃·내 정보. POST /api/auth?action=signup|login|logout, GET /api/auth?action=me
import {redis,equalText,validateCredentials,hashPassword,verifyPassword,createSessionToken,readSessionToken,getCookie,sessionCookie,clearSessionCookie} from '../lib/auth.js';
import {createHash} from 'node:crypto';

const RATE_LIMIT=10;
const fail=(res,code,error,extra={})=>res.status(code).json({error,...extra});
function storageError(res,e){
 if(e?.code==='STORAGE_NOT_CONFIGURED')return fail(res,503,'회원 저장소가 아직 연결되지 않았습니다.',{code:'STORAGE_NOT_CONFIGURED'});
 return fail(res,502,'회원 저장소에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const action=req.query?.action;
 if(action==='me'){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return fail(res,405,'GET을 사용하세요.');}
  try{
   const session=await readSessionToken(getCookie(req.headers?.cookie));
   if(!session)return fail(res,401,'로그인이 필요합니다.',{code:'LOGIN_REQUIRED'});
   const exists=await redis(['EXISTS','auth:user:'+session.username]);
   if(!exists){res.setHeader('Set-Cookie',clearSessionCookie());return fail(res,401,'회원 정보를 찾을 수 없습니다. 다시 로그인하세요.',{code:'LOGIN_REQUIRED'});}
   return res.status(200).json({username:session.username,expiresAt:new Date(session.expiresAt).toISOString()});
  }catch(e){return storageError(res,e);}
 }
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return fail(res,405,'POST를 사용하세요.');}
 if(action==='logout'){res.setHeader('Set-Cookie',clearSessionCookie());return res.status(200).json({ok:true});}
 if(action!=='signup'&&action!=='login')return fail(res,400,'action은 signup, login, logout, me 중 하나입니다.');
 let credentials;
 try{credentials=validateCredentials(req.body);}catch(e){return fail(res,400,e.message);}
 try{
  const ip=String(req.headers?.['x-real-ip']||req.headers?.['x-forwarded-for']||'unknown').split(',')[0].trim();
  const rateKey='auth:rate:'+createHash('sha256').update(ip).digest('hex');
  const [count]=await redis([['INCR',rateKey],['EXPIRE',rateKey,60,'NX']],true);
  if(count>RATE_LIMIT){res.setHeader('Retry-After','60');return fail(res,429,'시도가 너무 많습니다. 1분 뒤 다시 시도하세요.');}
  const key='auth:user:'+credentials.username;
  if(action==='signup'){
   const signupCode=process.env.SIGNUP_CODE;
   if(signupCode&&!equalText(req.body?.signupCode,signupCode))return fail(res,401,'가입 코드가 맞지 않습니다.',{code:'SIGNUP_CODE'});
   const {salt,hash}=await hashPassword(credentials.password);
   const created=await redis(['SET',key,JSON.stringify({username:credentials.username,salt,hash,createdAt:new Date().toISOString()}),'NX']);
   if(created!=='OK')return fail(res,409,'이미 사용 중인 아이디입니다.');
  }else{
   const raw=await redis(['GET',key]);
   let user=null;try{user=raw?JSON.parse(raw):null;}catch{user=null;}
   // 없는 아이디도 같은 시간만큼 계산해 아이디 존재 여부가 드러나지 않게 한다.
   const ok=user?await verifyPassword(credentials.password,user.salt,user.hash):(await hashPassword(credentials.password),false);
   if(!ok)return fail(res,401,'아이디 또는 비밀번호가 맞지 않습니다.');
  }
  res.setHeader('Set-Cookie',sessionCookie(await createSessionToken(credentials.username)));
  return res.status(action==='signup'?201:200).json({ok:true,username:credentials.username});
 }catch(e){return storageError(res,e);}
}
