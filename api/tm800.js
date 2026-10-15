import location,{parsePoint} from './location.js';
import {normalizeTm800} from '../lib/tm800-input.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'GET 또는 POST를 사용하세요.'})}
 const query=req.query||{};
 const coordinateNames=['lat','latitude','lng','lon','longitude'];
 if(req.method==='GET'&&!coordinateNames.some(name=>query[name]!==undefined))return res.status(200).json({service:'GPS Link hardware receiver',status:'ready',endpoint:'/radlot/data',methods:['GET','POST'],formats:['application/json','application/x-www-form-urlencoded','URL query'],coordinates:'WGS84 decimal degrees',fields:{device:'optional; default tm800-01',lat:'required; latitude accepted',lng:'required; lon or longitude accepted'},authentication:'X-GPS-Key header or key field; use the existing GPS device write key',viewer:'https://lte-gps-map.vercel.app/?device=tm800-01',note:'This confirms the route only. Firmware packet compatibility requires a real sample.'});
 let input;
 try{
  input=normalizeTm800(req.method==='POST'?req.body:undefined,query,String(req.headers['content-type']||'').toLowerCase());
  if(input.lat===undefined||input.lng===undefined)return res.status(400).json({error:'위도·경도 필드가 필요합니다. lat/lng 또는 latitude/longitude를 보내세요.',code:'COORDINATES_REQUIRED'});
  parsePoint(input);
 }catch(e){return res.status(400).json({error:e.message,code:'INVALID_PACKET'})}
 // Preserve the existing authentication and durable storage behavior.
 return location({...req,method:'POST',body:input,headers:req.headers},res);
}
