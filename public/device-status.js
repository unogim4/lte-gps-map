// W-016: 단말기 상태(s)·설정(i) 패킷 표시. 값은 모두 textContent로 넣는다.
(()=>{
 const el=id=>document.getElementById(id);let timer,busy=false;
 const terminalTime=t=>typeof t==='string'&&t.length===14?`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)} ${t.slice(8,10)}:${t.slice(10,12)}:${t.slice(12,14)}`:'—';
 function ago(iso){const m=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));return m<1?'방금':m<60?m+'분 전':Math.floor(m/60)+'시간 '+(m%60)+'분 전';}
 function item(label,value,state,wide){const box=document.createElement('div');box.className='dev-item'+(state?' '+state:'')+(wide?' wide':'');const small=document.createElement('small');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;box.append(small,strong);return box;}
 // 마지막 수신 뒤 경과 시간과 전송주기로 연결 상태를 짐작한다.
 function connection(last,info){
  if(!last)return ['수신 기록 없음','warn'];
  const minutes=(Date.now()-new Date(last).getTime())/60000;
  if(!info)return ['주기 정보 없음 (설정 패킷 대기)',''];
  if(info.activeMinutes&&minutes<=info.activeMinutes*2)return ['정상 · 활성 주기 '+info.activeMinutes+'분','ok'];
  if(info.sleepMinutes&&minutes<=info.sleepMinutes*1.2)return ['절전 중일 수 있음 · 슬립 주기 '+info.sleepMinutes+'분',''];
  return ['연락 없음','warn'];
 }
 function render(d){
  const box=el('device-state'),list=el('device-radiation'),s=d.status,i=d.info;
  box.replaceChildren();list.replaceChildren();
  const last=[s?.receivedAt,i?.receivedAt].filter(Boolean).sort().pop();
  const [conn,connState]=connection(last,i);
  box.append(item('연결 상태',conn,connState,true),item('마지막 수신',last?new Date(last).toLocaleString('ko-KR')+' · '+ago(last):'—','',true));
  if(s){
   box.append(
    item('방사선량 (원값, 규격 mSv)',String(s.radiation).padStart(4,'0')),
    item('배터리 (원값)',String(s.battery)),
    item('센서',s.sensorActive?'활성':'비활성',s.sensorActive?'ok':'warn'),
    item('배터리 부착',s.batteryAttached?'부착':'미부착',s.batteryAttached?'ok':'warn'),
    item('조사기 부착',s.detectorAttached?'부착':'미부착',s.detectorAttached?'ok':'warn'),
    item('단말기 수집시각',terminalTime(s.collectedAt)));
  }
  if(d.locateError)box.append(item('최근 위치 오류 (저장 안 함)','에러코드 '+d.locateError.code+' · '+terminalTime(d.locateError.collectedAt)+' · '+new Date(d.locateError.receivedAt).toLocaleString('ko-KR')+' 수신','warn',true));
  if(i)box.append(item('신호 세기 RSSI (원값)',String(i.rssi)),item('망 접속 모드',String(i.networkMode)),item('전송주기','활성 '+i.activeMinutes+'분 · 슬립 '+i.sleepMinutes+'분 · 슬립 전환 '+i.sleepAfterMinutes+'분','',true));
  const rows=(d.history||[]).slice(0,30);
  const max=Math.max(1,...rows.map(r=>Number(r.radiation)||0));
  for(const r of rows){const row=document.createElement('div');row.className='dev-bar';const label=document.createElement('span');label.textContent=terminalTime(r.collectedAt)+' · '+String(r.radiation).padStart(4,'0');const bar=document.createElement('i');bar.style.width=Math.round((Number(r.radiation)||0)/max*100)+'%';row.append(label,bar);list.append(row);}
  if(!rows.length){const p=document.createElement('p');p.className='hint';p.textContent='방사선량 기록이 아직 없습니다.';list.append(p);}
  el('device-state-status').textContent=(s||i)?'마지막 확인 '+new Date().toLocaleTimeString('ko-KR'):'이 장치의 상태·설정 패킷이 아직 없습니다.';
 }
 async function refresh(){
  if(busy)return;busy=true;clearTimeout(timer);
  const device=el('device').value;
  try{
   if(!/^[a-zA-Z0-9_-]{1,40}$/.test(device))throw Error('장치 ID를 입력하세요.');
   const r=await fetch('/api/device?device='+encodeURIComponent(device),{cache:'no-store',signal:AbortSignal.timeout(15000)});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'조회 실패');
   if(device===el('device').value)render(d);
  }catch(e){el('device-state-status').textContent='단말기 상태 조회 실패: '+(e.name==='TimeoutError'?'연결 시간이 초과되었습니다.':e.message);}
  finally{busy=false;timer=setTimeout(refresh,30000);}
 }
 el('device').addEventListener('change',refresh);
 refresh();
})();
