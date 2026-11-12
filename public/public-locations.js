(()=>{
 const el=id=>document.getElementById(id);let busy=false,timer,markers=[],initial=true;
 function fitPublic(){if(map&&markers.length){stop();map.fitBounds(L.featureGroup(markers).getBounds().pad(.2),{maxZoom:16});status("공개된 위치를 지도에 표시했습니다.");}}
 // W-016: device를 주면(단말기 기록) 그 기록 위치의 말풍선에 단말기 정보를 띄운다.
 function button(text,p,device){const b=document.createElement('button');b.className='secondary';b.textContent=text;b.onclick=()=>{stop();show(p.lat,p.lng,p.name?'공개 위치':'장치 기록',p.receivedAt,p);if(device){deviceView={device,point:p};marker?.openPopup();}};return b;}
 const POPUP={maxWidth:320,minWidth:250,maxHeight:380};
 // 방문자 공개 위치 말풍선: 이름·위도·경도·정확도·시각. 방문자에게는 배터리·방사선 정보가 없다.
 function visitorPopup(p){
  const box=document.createElement('div');box.className='dp-popup';
  const title=document.createElement('strong');title.className='dp-popup-title';title.textContent=p.name;box.append(title);
  for(const [label,value] of [['위도',p.lat.toFixed(6)],['경도',p.lng.toFixed(6)],['정확도',Number.isFinite(p.accuracy)?'약 '+Math.round(p.accuracy)+' m':'—'],['수신 시각',new Date(p.receivedAt).toLocaleString('ko-KR')]]){const row=document.createElement('div');row.className='dp-row';const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=value;row.append(a,b);box.append(row);}
  const note=document.createElement('p');note.className='dp-popup-note';note.textContent='방문자가 공유한 위치입니다. 배터리·방사선량·단말기 상태는 단말기 위치를 누르면 보입니다.';box.append(note);
  return box;
 }
 const extra=p=>(Number.isFinite(p.alt)?' · 고도 '+p.alt.toFixed(1)+'m':'')+(Number.isFinite(p.battery)?' · 배터리 '+Math.round(p.battery)+'%':'');
 async function refresh(){
  if(busy)return;busy=true;clearTimeout(timer);
  const device=el('device').value;
  try{
   const r=await fetch('/api/visitors?scope=public',{cache:'no-store',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error);
   markers.forEach(m=>m.remove());markers=[];el('public-list').replaceChildren();
   for(const p of d.visitors){el('public-list').append(button(p.name+' · '+p.lat.toFixed(6)+', '+p.lng.toFixed(6)+' · '+new Date(p.receivedAt).toLocaleString('ko-KR'),p));if(map){markers.push(L.marker([p.lat,p.lng]).addTo(map).bindPopup(()=>visitorPopup(p),POPUP));}}
   if(initial&&markers.length&&!params.has('lat')&&!params.has('lng')&&!params.has('device')){fitPublic();initial=false;}
   el('public-status').textContent=d.visitors.length+'명이 공개 중 · 마지막 확인 '+new Date().toLocaleTimeString('ko-KR');
  }catch(e){el('public-status').textContent='공개 위치 조회 실패: '+e.message;}
  try{
   if(!/^[a-zA-Z0-9_-]{1,40}$/.test(device))throw Error('장치 ID를 입력하세요.');
   const r=await fetch('/api/history?device='+encodeURIComponent(device),{cache:'no-store',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error);
   if(device===el('device').value){el('public-log').replaceChildren();if(map&&d.points.length){const p=d.points[0];const m=L.marker([p.lat,p.lng]).addTo(map);m.bindPopup(()=>window.devicePopupContent?window.devicePopupContent(device,p,()=>m.getPopup()?.update()):device,POPUP);markers.push(m);}for(const p of d.points)el('public-log').append(button(new Date(p.receivedAt).toLocaleString('ko-KR')+' · LAT '+p.lat.toFixed(6)+' · LON '+p.lng.toFixed(6)+extra(p),p,device));el('public-log-status').textContent=d.points.length+'건 · 마지막 확인 '+new Date().toLocaleTimeString('ko-KR');}
  }catch(e){el('public-log-status').textContent='로그 조회 실패: '+e.message;}
  finally{busy=false;timer=setTimeout(refresh,30000);}
 }
 el('public-fit').onclick=fitPublic;el('public-refresh').onclick=refresh;el('device').addEventListener('change',refresh);refresh();
})();
