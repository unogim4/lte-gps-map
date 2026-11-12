// W-016: 단말기 위치를 누르면 지도 옆에 정보 창(위치·배터리·방사선량·단말기 상태)을 연다.
// 값은 모두 textContent로 넣는다. 열려 있는 동안 30초마다 새로 읽는다.
(()=>{
 const el=id=>document.getElementById(id);
 let current=null,timer,seq=0;
 const terminalTime=t=>typeof t==='string'&&t.length===14?`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)} ${t.slice(8,10)}:${t.slice(10,12)}:${t.slice(12,14)}`:'—';
 function ago(iso){const m=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));return m<1?'방금':m<60?m+'분 전':Math.floor(m/60)+'시간 '+(m%60)+'분 전';}
 function row(label,value,state){const box=document.createElement('div');box.className='dp-row'+(state?' '+state:'');const name=document.createElement('span');name.textContent=label;const text=document.createElement('strong');text.textContent=value;box.append(name,text);return box;}
 function group(title,rows){const box=document.createElement('section');box.className='dp-group';const h=document.createElement('h3');h.textContent=title;box.append(h,...rows);return box;}
 function connection(last,info){
  if(!last)return ['상태 수신 기록 없음','warn'];
  const minutes=(Date.now()-new Date(last).getTime())/60000;
  if(!info)return ['주기 정보 없음 (설정 패킷 대기)',''];
  if(info.activeMinutes&&minutes<=info.activeMinutes*2)return ['정상 · 활성 주기 '+info.activeMinutes+'분','ok'];
  if(info.sleepMinutes&&minutes<=info.sleepMinutes*1.2)return ['절전 중일 수 있음 · 슬립 주기 '+info.sleepMinutes+'분',''];
  return ['연락 없음','warn'];
 }
 // 위치·배터리·방사선량·단말기 상태 4묶음을 만든다(옆 창과 지도 말풍선이 같이 쓴다).
 function sections(point,data,compact){
  const s=data?.status,i=data?.info,p=point;
  const location=[];
  if(p){
   location.push(row('위도',Number(p.lat).toFixed(6)),row('경도',Number(p.lng).toFixed(6)),row('수집 방식',p.mode==='2'?'기지국 위치 (오차 큼)':p.mode==='1'?'GPS':'정보 없음',p.mode==='2'?'warn':p.mode==='1'?'ok':''));
   if(p.collectedAt)location.push(row('단말기 수집시각',terminalTime(p.collectedAt)));
   if(p.receivedAt)location.push(row('서버 수신',new Date(p.receivedAt).toLocaleString('ko-KR')+' · '+ago(p.receivedAt)));
   if(Number.isFinite(p.alt))location.push(row('고도',p.alt.toFixed(1)+' m'));
  }else location.push(row('위치','수신된 위치가 없습니다.','warn'));
  if(data?.locateError)location.push(row('최근 위치 오류 (저장 안 함)','코드 '+data.locateError.code+' · '+terminalTime(data.locateError.collectedAt),'warn'));
  const battery=[];
  if(s)battery.push(row('배터리 (상태 패킷 원값)',String(s.battery)),row('배터리 부착',s.batteryAttached?'부착':'미부착',s.batteryAttached?'ok':'warn'));
  if(Number.isFinite(p?.battery))battery.push(row('배터리 (위치 패킷)',Math.round(p.battery)+' %'));
  if(!battery.length)battery.push(row('배터리','정보 없음'));
  const radiation=[];
  if(s)radiation.push(row('현재 방사선량 (원값, 규격 mSv)',String(s.radiation).padStart(4,'0')),row('측정 시각',terminalTime(s.collectedAt)));
  const recent=(data?.history||[]).slice(0,compact?5:10);
  if(recent.length){
   const max=Math.max(1,...recent.map(r=>Number(r.radiation)||0)),list=document.createElement('div');list.className='dp-bars';
   for(const r of recent){const line=document.createElement('div');line.className='dev-bar';const label=document.createElement('span');label.textContent=terminalTime(r.collectedAt).slice(5)+' · '+String(r.radiation).padStart(4,'0');const bar=document.createElement('i');bar.style.width=Math.round((Number(r.radiation)||0)/max*100)+'%';line.append(label,bar);list.append(line);}
   radiation.push(list);
  }
  if(!radiation.length)radiation.push(row('방사선량','정보 없음'));
  const last=[s?.receivedAt,i?.receivedAt].filter(Boolean).sort().pop();
  const [conn,connState]=connection(last,i);
  const state=[row('연결 상태',conn,connState),row('마지막 상태 수신',last?new Date(last).toLocaleString('ko-KR')+' · '+ago(last):'—')];
  if(s)state.push(row('센서',s.sensorActive?'활성':'비활성',s.sensorActive?'ok':'warn'),row('조사기 부착',s.detectorAttached?'부착':'미부착',s.detectorAttached?'ok':'warn'));
  if(i)state.push(row('신호 세기 RSSI (원값)',String(i.rssi)),row('전송주기','활성 '+i.activeMinutes+'분 · 슬립 '+i.sleepMinutes+'분'),row('망 접속 모드',String(i.networkMode)));
  return [group('위치',location),group('배터리',battery),group('방사선량',radiation),group('단말기 상태',state)];
 }
 // 단말기 상태(/api/device)와, 기록을 주지 않았으면 최신 위치(/api/location)를 함께 읽는다.
 async function fetchInfo(device,point){
  let data=null,latest=point||null,message='';
  const get=url=>fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(async r=>({ok:r.ok,body:await r.json()}));
  try{
   const [state,place]=await Promise.all([get('/api/device?device='+encodeURIComponent(device)),point?null:get('/api/location?device='+encodeURIComponent(device))]);
   if(state.ok)data=state.body;else message=state.body.error||'단말기 상태 조회 실패';
   if(place){if(place.ok)latest=place.body.location;else message=message||place.body.error||'위치 조회 실패';}
  }catch(e){message=e.name==='TimeoutError'?'연결 시간이 초과되었습니다.':e.message;}
  return {point:latest,data,message};
 }
 const validPoint=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))?p:null;
 async function load(){
  if(!current)return;
  const run=++seq,{device,point}=current;
  clearTimeout(timer);
  el('device-panel-status').textContent='정보를 불러오는 중입니다…';
  const info=await fetchInfo(device,point);
  if(run!==seq||!current)return;
  current.shown=validPoint(info.point);
  el('device-panel-body').replaceChildren(...sections(info.point,info.data,false));
  el('device-panel-center').disabled=!current.shown;
  el('device-panel-status').textContent=info.message?'일부 정보를 불러오지 못했습니다: '+info.message:'마지막 확인 '+new Date().toLocaleTimeString('ko-KR')+' · 30초마다 갱신';
  timer=setTimeout(load,30000);
 }
 // 지도 말풍선용: 바로 "불러오는 중"을 돌려주고, 읽어 오면 내용을 채운 뒤 onUpdate()로 말풍선 크기를 맞춘다.
 window.devicePopupContent=(device,point,onUpdate)=>{
  const box=document.createElement('div');box.className='dp-popup';
  const title=document.createElement('strong');title.className='dp-popup-title';title.textContent=device;
  const note=document.createElement('p');note.className='dp-popup-note';note.textContent='정보를 불러오는 중입니다…';
  const body=document.createElement('div');
  const more=document.createElement('button');more.type='button';more.className='secondary';more.textContent='옆 창에서 크게 보기';more.onclick=()=>window.openDevicePanel(device,point);
  box.append(title,note,body,more);
  if(typeof device!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(device)){note.textContent='장치 ID가 올바르지 않습니다.';return box;}
  fetchInfo(device,point).then(info=>{
   body.replaceChildren(...sections(info.point,info.data,true));
   note.textContent=info.message?'일부 정보를 불러오지 못했습니다: '+info.message:'확인 '+new Date().toLocaleTimeString('ko-KR');
   if(typeof onUpdate==='function')onUpdate();
  });
  return box;
 };
 function close(){current=null;seq++;clearTimeout(timer);el('device-panel').hidden=true;}
 // point를 주면 그 기록의 위치를, 없으면 서버의 최신 위치를 보여 준다.
 window.openDevicePanel=(device,point)=>{
  if(typeof device!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(device))return;
  current={device,point:point||null,shown:null};
  el('device-panel-title').textContent=device;
  el('device-panel').hidden=false;
  load();
 };
 el('device-panel-close').onclick=close;
 // map은 app.js의 지도(window.map은 id="map" 요소라서 쓰지 않는다).
 el('device-panel-center').onclick=()=>{if(typeof map!=='undefined'&&map&&typeof map.setView==='function'&&current?.shown)map.setView([Number(current.shown.lat),Number(current.shown.lng)],16);};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&current)close();});
})();
