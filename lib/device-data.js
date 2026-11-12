// Terminal status (s) and info (i) packets: fixed-width digits, no separators.
// IMEI and phone number (MSISDN) in the info packet are identifiers and are never stored.
import {createHash,timingSafeEqual} from 'node:crypto';
const STATUS_HEAD=16,STATUS_RECORD=22,HISTORY_LIMIT=2000;
const digest=value=>createHash('sha256').update(String(value)).digest();
// W-016 캡틴 결정(2026-11-12): 단말기 수신은 기본적으로 전송키 없이 받는다.
// Vercel 환경변수 GPS_REQUIRE_KEY=1 을 넣으면 코드 수정 없이 전송키 검사가 다시 켜진다.
// 주의: 로그인은 화면 보기만 막고, 단말기 수신 주소(/radlot/data, /api/location 쓰기)는 로그인 없이 열려 있다.
export function deviceKeyRequired(){return process.env.GPS_REQUIRE_KEY==='1';}
export function keyMatches(given,expected){return typeof given==='string'&&typeof expected==='string'&&expected.length>0&&timingSafeEqual(digest(given),digest(expected));}
function terminalTime(text){
 const [y,mo,d,h,mi,s]=[[0,4],[4,6],[6,8],[8,10],[10,12],[12,14]].map(([a,b])=>Number(text.slice(a,b)));
 if(y<2000||mo<1||mo>12||d<1||d>31||h>23||mi>59||s>59)throw Error('수집시각 값이 올바르지 않습니다.');
 return text;
}
export function parseStatusPacket(packet){
 const text=String(packet).trim();
 const head=/^s(\d{15})/.exec(text);
 if(!head)throw Error('상태 패킷은 s와 IMSI 15자리로 시작해야 합니다.');
 const body=text.slice(STATUS_HEAD);
 if(!body.length||body.length%STATUS_RECORD!==0)throw Error('상태 패킷 길이가 규격(기록당 22자)과 맞지 않습니다.');
 const records=[];
 for(let i=0;i<body.length;i+=STATUS_RECORD){
  const m=/^(\d{14})(\d{4})(\d)([01])([01])([01])$/.exec(body.slice(i,i+STATUS_RECORD));
  if(!m)throw Error(`상태 기록 ${records.length+1}번째 형식이 올바르지 않습니다.`);
  records.push({collectedAt:terminalTime(m[1]),radiation:Number(m[2]),battery:Number(m[3]),sensorActive:m[4]==='1',batteryAttached:m[5]==='1',detectorAttached:m[6]==='1'});
 }
 return {type:'status',imsi:head[1],records};
}
export function parseInfoPacket(packet){
 const m=/^i(\d{15})(\d{15})(\d{11})(\d{3})(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(String(packet).trim());
 if(!m)throw Error('설정 패킷은 i로 시작하는 55자 규격이어야 합니다.');
 return {type:'info',imsi:m[2],activeMinutes:Number(m[4]),sleepMinutes:Number(m[5]),sleepAfterMinutes:Number(m[6]),rssi:Number(m[7]),networkMode:m[8]};
}
// Locate (l) packet: "l" + IMSI 15 + [time 14 + lat 24 + lng 24 + mode 1 + error 1] repeated (64 chars).
// Coordinates are plain decimal for now (not encrypted yet). Spaces/NUL around the value are allowed.
const LOCATE_HEAD=16,LOCATE_RECORD=64;
function plainCoordinate(raw,min,max,name){
 const text=raw.replace(/^[\s\u0000]+|[\s\u0000]+$/g,'');
 if(/^[A-Za-z0-9+/]{22}==$/.test(raw)&&!/^[+-]?\d+(?:\.\d+)?$/.test(text))throw Error(name+'가 암호화되어 있어 아직 해독할 수 없습니다. 평문 좌표로 보내 주세요.');
 if(!/^[+-]?\d+(?:\.\d+)?$/.test(text))throw Error(name+' 칸(24자)에 십진수 좌표가 필요합니다.');
 const value=Number(text);
 if(!Number.isFinite(value)||value<min||value>max)throw Error(name+' 범위가 올바르지 않습니다.');
 return value;
}
export function parseLocatePacket(packet){
 const text=String(packet).replace(/^[\r\n]+|[\r\n]+$/g,'');
 const head=/^l(\d{15})/.exec(text);
 if(!head)throw Error('위치 패킷은 l과 IMSI 15자리로 시작해야 합니다.');
 const body=text.slice(LOCATE_HEAD);
 if(!body.length||body.length%LOCATE_RECORD!==0)throw Error('위치 패킷 길이가 규격(기록당 64자)과 맞지 않습니다.');
 const points=[],errors=[];
 for(let i=0;i<body.length;i+=LOCATE_RECORD){
  const record=body.slice(i,i+LOCATE_RECORD),n=points.length+errors.length+1;
  const m=/^(\d{14})([\s\S]{24})([\s\S]{24})(\d)(\d)$/.exec(record);
  if(!m)throw Error(`위치 기록 ${n}번째 형식이 올바르지 않습니다.`);
  const collectedAt=terminalTime(m[1]);
  if(m[5]!=='0'){errors.push({code:m[5],mode:m[4],collectedAt});continue;}
  const point={lat:plainCoordinate(m[2],-90,90,'위도'),lng:plainCoordinate(m[3],-180,180,'경도'),collectedAt};
  if(m[4]==='1'||m[4]==='2')point.mode=m[4];
  points.push(point);
 }
 return {type:'locate',imsi:head[1],device:'l'+head[1],points,errors};
}
// Home page device IDs look like "l" + IMSI (locate packet prefix); status/info are keyed by IMSI.
export function terminalIdFromDevice(device){const m=/^l?(\d{15})$/.exec(device);return m?m[1]:device;}
export async function redis(commands,transaction=false){
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
 const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(!url||!token)throw Error('Storage unavailable');
 const r=await fetch(url.replace(/\/$/,'')+(transaction?'/multi-exec':''),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(commands),signal:AbortSignal.timeout(8000)});
 const data=await r.json();
 if(!r.ok||data.error||(transaction&&(!Array.isArray(data)||data.some(x=>x.error))))throw Error('Storage failure');
 return transaction?data.map(x=>x.result):data.result;
}
export async function storeDeviceData(req,res,data){
 if(!(process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL)||!(process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN))return res.status(503).json({error:'실시간 수신용 저장소가 아직 연결되지 않았습니다.',code:'STORAGE_NOT_CONFIGURED'});
 if(deviceKeyRequired()){
  if(!process.env.GPS_WRITE_KEY)return res.status(503).json({error:'서버 GPS_WRITE_KEY를 설정하세요.'});
  if(!keyMatches(req.headers?.['x-gps-key']||data.key,process.env.GPS_WRITE_KEY))return res.status(401).json({error:'전송 키가 일치하지 않습니다.'});
 }
 const receivedAt=new Date().toISOString(),id=data.imsi;
 let commands,count=1;
 if(data.type==='locate'){
  // Same keys as the existing location API, so the map, log and history keep working.
  const rows=data.points.map(p=>JSON.stringify({device:data.device,...p,receivedAt}));count=rows.length;
  commands=[];
  if(rows.length)commands.push(['SET','gps:'+data.device,rows[rows.length-1]],['LPUSH','gps-history:'+data.device,...rows],['LTRIM','gps-history:'+data.device,0,9999]);
  if(data.errors.length)commands.push(['SET','device-locate-error:'+id,JSON.stringify({...data.errors[data.errors.length-1],count:data.errors.length,receivedAt})]);
  try{await redis(commands,true);}catch{return res.status(502).json({error:'저장소 연결에 실패했습니다. 잠시 후 다시 시도하세요.'});}
  return res.status(200).json({ok:true,type:'locate',device:data.device,count,skipped:data.errors.length});
 }
 if(data.type==='status'){
  const rows=data.records.map(r=>JSON.stringify({...r,receivedAt}));count=rows.length;
  commands=[['SET','device-status:'+id,rows[rows.length-1]],['LPUSH','device-status-history:'+id,...rows],['LTRIM','device-status-history:'+id,0,HISTORY_LIMIT-1]];
 }else{
  const {type,key,imsi,...info}=data;
  commands=[['SET','device-info:'+id,JSON.stringify({...info,receivedAt})]];
 }
 try{await redis(commands,true);}catch{return res.status(502).json({error:'저장소 연결에 실패했습니다. 잠시 후 다시 시도하세요.'});}
 return res.status(200).json({ok:true,type:data.type,device:id,count});
}
