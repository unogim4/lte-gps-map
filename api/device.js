import {redis,terminalIdFromDevice} from '../lib/device-data.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET을 사용하세요.'});}
 const device=req.query?.device;
 if(typeof device!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(device))return res.status(400).json({error:'장치 ID는 영문·숫자·밑줄·하이픈 1~40자입니다.'});
 const id=terminalIdFromDevice(device);
 try{
  const [status,history,info,locateError]=await redis([['GET','device-status:'+id],['LRANGE','device-status-history:'+id,0,99],['GET','device-info:'+id],['GET','device-locate-error:'+id]],true);
  return res.status(200).json({device:id,status:status?JSON.parse(status):null,history:Array.isArray(history)?history.map(row=>JSON.parse(row)):[],info:info?JSON.parse(info):null,locateError:locateError?JSON.parse(locateError):null});
 }catch(e){
  if(e.message==='Storage unavailable')return res.status(503).json({error:'저장소가 연결되지 않았습니다.',code:'STORAGE_NOT_CONFIGURED'});
  return res.status(502).json({error:'단말기 상태 조회에 실패했습니다.'});
 }
}
