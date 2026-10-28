// WGS84 decimal degrees only. Raw NMEA/binary packets need a firmware-specific parser.
function field(source,names){
 const values=names.filter(name=>source[name]!==undefined).map(name=>source[name]);
 if(values.some(value=>!['string','number'].includes(typeof value)))throw Error('매개변수는 단일 문자열 또는 숫자여야 합니다.');
 if(values.length>1 && values.some(value=>String(value)!==String(values[0])))throw Error('같은 좌표의 여러 필드에 서로 다른 값이 있습니다.');
 return values[0];
}
export function normalizeTm800(body,query={},contentType=''){
 let payload=Buffer.isBuffer(body)?body.toString('utf8'):body;
 if(typeof payload==='string' && payload.length>4096)throw Error('패킷은 4096자 이하여야 합니다.');
 if(typeof payload==='string'){
  if(contentType.includes('text/plain')){
   const parts=payload.trim().split('|');const device=parts.shift();
   if(!/^[a-zA-Z0-9_-]{1,40}$/.test(device))throw Error('단말기 ID가 올바르지 않습니다.');
   const fields={};
   for(const part of parts){const match=/^([A-Z]+)=(.*)$/.exec(part);if(!match||Object.hasOwn(fields,match[1]))throw Error('잘못되거나 중복된 패킷 필드입니다.');fields[match[1]]=match[2];}
   if(fields.ERR!==undefined&&fields.ERR!=='0')throw Error('단말기가 GPS 오류를 보고했습니다.');
   for(const name of ['LAT','LON'])if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(fields[name]||''))throw Error('LAT와 LON 십진수 좌표가 필요합니다.');
   if(fields.KST!==undefined&&!/^\d{14}$/.test(fields.KST))throw Error('KST는 YYYYMMDDhhmmss 형식이어야 합니다.');
   payload={device,lat:fields.LAT,lng:fields.LON};
  }else if(contentType.includes('application/x-www-form-urlencoded')){
   const params=new URLSearchParams(payload);payload={};
   for(const [key,value] of params){if(Object.hasOwn(payload,key))throw Error('중복 매개변수는 사용할 수 없습니다.');payload[key]=value;}
  }else if(contentType.includes('application/json')){
   try{payload=JSON.parse(payload)}catch{throw Error('JSON 형식이 올바르지 않습니다.')}
  }else throw Error('JSON 또는 application/x-www-form-urlencoded 형식으로 보내세요.');
 }
 if(payload===undefined||payload===null)payload={};
 if(typeof payload!=='object'||Array.isArray(payload)||Buffer.isBuffer(payload))throw Error('JSON 객체 또는 폼 데이터로 보내세요.');
 const lat=field(payload,['lat','latitude'])??field(query,['lat','latitude']);
 const lng=field(payload,['lng','lon','longitude'])??field(query,['lng','lon','longitude']);
 return {lat,lng,device:field(payload,['device'])??field(query,['device'])??'tm800-01',key:field(payload,['key'])??field(query,['key'])};
}
