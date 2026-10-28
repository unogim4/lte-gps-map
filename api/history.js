import {createHash,timingSafeEqual} from 'node:crypto';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET을 사용하세요.'});}
 const key=process.env.ADMIN_ACCESS_KEY;
 if(!key)return res.status(503).json({error:'관리자 키가 설정되지 않았습니다.'});
 const hash=value=>createHash('sha256').update(value).digest();
 if(!timingSafeEqual(hash(String(req.headers.authorization||'')),hash('Bearer '+key)))return res.status(401).json({error:'관리자 인증키가 일치하지 않습니다.'});
 const {device,offset='0'}=req.query||{};
 if(typeof device!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(device)||typeof offset!=='string'||!/^\d{1,5}$/.test(offset)||Number(offset)>9999)return res.status(400).json({error:'장치 ID 또는 조회 범위가 올바르지 않습니다.'});
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(!url||!token)return res.status(503).json({error:'저장소가 연결되지 않았습니다.'});
 try{
  const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(['LRANGE','gps-history:'+device,Number(offset),Math.min(Number(offset)+499,9999)]),signal:AbortSignal.timeout(8000)});
  const d=await r.json();if(!r.ok||d.error||!Array.isArray(d.result))throw Error();
  const points=d.result.map(p=>JSON.parse(p));
  return res.status(200).json({device,points,nextOffset:points.length===500&&Number(offset)+500<10000?Number(offset)+500:null,limit:10000});
 }catch{return res.status(502).json({error:'이력 조회에 실패했습니다.'});}
}
