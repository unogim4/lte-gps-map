import location,{parsePoint} from './location.js';
import {normalizeTm800} from '../lib/tm800-input.js';
import {storeDeviceData} from '../lib/device-data.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'GET 또는 POST를 사용하세요.'})}
 const query=req.query||{};
 const coordinateNames=['lat','latitude','lng','lon','longitude'];
 if(req.method==='GET'&&!coordinateNames.some(name=>query[name]!==undefined))return res.status(200).json({service:'GPS Link hardware receiver',status:'ready',endpoint:'/radlot/data',methods:['GET','POST'],formats:['text/plain (device|LAT=...|LON=...|MODE=1|ERR=0)','text/plain status packet (s + IMSI + 22-digit records)','text/plain info packet (i + 54 digits)','text/plain locate packet (l + IMSI + 64-char records: time14 lat24 lng24 mode1 err1, plain decimal)','application/json','application/x-www-form-urlencoded','URL query'],coordinates:'WGS84 decimal degrees',fields:{device:'optional; default tm800-01',lat:'required; latitude accepted',lng:'required; lon or longitude accepted',alt:'optional; altitude in meters (-1000~20000), alt/altitude or ALT= in text/plain',battery:'optional; battery percent (0~100), battery/bat or BAT= in text/plain'},authentication:'Not required by default. If the server sets GPS_REQUIRE_KEY=1, send the X-GPS-Key header or key field with the GPS device write key',viewer:'https://lte-gps-map.vercel.app/?device=tm800-01',note:'This confirms the route only. Firmware packet compatibility requires a real sample.'});
 let input;
 try{
  input=normalizeTm800(req.method==='POST'?req.body:undefined,query,String(req.headers['content-type']||'').toLowerCase());
  if(!['status','info','locate'].includes(input.type)){
   if(input.lat===undefined||input.lng===undefined)return res.status(400).json({error:'위도·경도 필드가 필요합니다. lat/lng 또는 latitude/longitude를 보내세요.',code:'COORDINATES_REQUIRED'});
   parsePoint(input);
  }
 }catch(e){return res.status(400).json({error:e.message,code:'INVALID_PACKET'})}
 // Status (s) / info (i) / fixed-width locate (l) packets: same GPS write key.
 if(['status','info','locate'].includes(input.type))return storeDeviceData(req,res,input);
 // Preserve the existing authentication and durable storage behavior.
 return location({...req,method:'POST',body:input,headers:req.headers},res);
}
