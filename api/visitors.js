import {randomUUID,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const RETENTION=86400, INDEX='visitor-sharing:index';
const digest=value=>createHash('sha256').update(value).digest();
function equal(a,b){return typeof a==='string' && typeof b==='string' && timingSafeEqual(digest(a),digest(b));}
async function redis(commands,transaction=false){
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
 const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(!url||!token)throw Error('Storage unavailable');
 const r=await fetch(url.replace(/\/$/,'')+(transaction?'/multi-exec':''),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(commands),signal:AbortSignal.timeout(8000)});
 const data=await r.json();if(!r.ok||data.error||(Array.isArray(data)&&data.some(x=>x.error)))throw Error('Storage failure');
 return transaction?data.map(x=>x.result):data.result;
}
export function validateShare(body){
 if(!body||body.consent!==true)throw Error('위치 공유 동의가 필요합니다.');
 for(const field of ['lat','lng','accuracy'])if(typeof body[field]!=='number'||!Number.isFinite(body[field]))throw Error('올바른 위치 정보를 보내세요.');
 if(body.lat < -90 || body.lat > 90 || body.lng < -180 || body.lng > 180 || body.accuracy < 0 || body.accuracy > 1000000)throw Error('위치 정보 범위를 확인하세요.');
 const name=typeof body.name==='string'?body.name.trim():'';
 if(name.length>40)throw Error('이름은 40자 이내로 입력하세요.');
 return {name:name||'익명 방문자',lat:body.lat,lng:body.lng,accuracy:body.accuracy};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Authorization');
 if(!['GET','POST','DELETE'].includes(req.method)){res.setHeader('Allow','GET, POST, DELETE');return res.status(405).json({error:'지원하지 않는 요청입니다.'});}
 const adminKey=process.env.ADMIN_ACCESS_KEY;
 if(!adminKey)return res.status(503).json({error:'관리자 위치 공유 기능을 준비 중입니다.'});
 if(req.method==='GET'&&!equal(req.headers.authorization,`Bearer ${adminKey}`))return res.status(401).json({error:'관리자 인증키를 확인하세요.'});
 let point;
 if(req.method==='POST'){try{point=validateShare(req.body)}catch(e){return res.status(400).json({error:e.message})}}
 if(req.method==='DELETE'&&(!/^[a-f0-9-]{36}$/.test(req.body?.id||'')||typeof req.body?.deleteToken!=='string'))return res.status(400).json({error:'공유 취소 정보가 올바르지 않습니다.'});
 try{
  const now=Date.now();
  if(req.method==='GET'){
   await redis(['ZREMRANGEBYSCORE',INDEX,'-inf',now-RETENTION*1000]);
   const ids=await redis(['ZREVRANGE',INDEX,0,199]);
   const rows=ids.length?await redis(['MGET',...ids.map(id=>'visitor-sharing:record:'+id)]):[];
   const visitors=rows.filter(Boolean).map(row=>{const {deleteHash,...publicData}=JSON.parse(row);return publicData}).filter(x=>new Date(x.expiresAt).getTime()>now);
   return res.status(200).json({visitors});
  }
  if(req.method==='DELETE'){
   const key='visitor-sharing:record:'+req.body.id;
   const raw=await redis(['GET',key]);
   if(!raw)return res.status(200).json({ok:true});
   if(!equal(JSON.parse(raw).deleteHash,digest(req.body.deleteToken).toString('hex')))return res.status(401).json({error:'공유 취소 키가 일치하지 않습니다.'});
   await redis([['DEL',key],['ZREM',INDEX,req.body.id]],true);
   return res.status(200).json({ok:true});
  }
  const ip=String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  const rateKey='visitor-sharing:rate:'+digest(adminKey+':'+ip).toString('hex');
  const [count]=await redis([['INCR',rateKey],['EXPIRE',rateKey,60]],true);
  if(count>10){res.setHeader('Retry-After','60');return res.status(429).json({error:'요청이 너무 많습니다. 1분 뒤 다시 시도하세요.'});}
  const id=randomUUID(),deleteToken=randomBytes(32).toString('hex');
  const record={id,...point,receivedAt:new Date(now).toISOString(),expiresAt:new Date(now+RETENTION*1000).toISOString(),consentVersion:'location-sharing-v1',deleteHash:digest(deleteToken).toString('hex')};
  await redis([['SET','visitor-sharing:record:'+id,JSON.stringify(record),'EX',RETENTION],['ZADD',INDEX,now,id],['ZREMRANGEBYSCORE',INDEX,'-inf',now-RETENTION*1000],['ZREMRANGEBYRANK',INDEX,0,-201],['EXPIRE',INDEX,RETENTION]],true);
  return res.status(201).json({ok:true,id,deleteToken,expiresAt:record.expiresAt});
 }catch{return res.status(502).json({error:'위치 저장소에 연결하지 못했습니다. 잠시 후 다시 시도하세요.'})}
}
