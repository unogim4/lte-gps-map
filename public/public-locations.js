(()=>{
 const el=id=>document.getElementById(id);let busy=false,timer,markers=[],initial=true;
 function fitPublic(){if(map&&markers.length){stop();map.fitBounds(L.featureGroup(markers).getBounds().pad(.2),{maxZoom:16});status("공개된 위치를 지도에 표시했습니다.");}}
 // W-016: device를 주면(단말기 기록) 누를 때 옆 정보 창도 연다.
 function button(text,p,device){const b=document.createElement('button');b.className='secondary';b.textContent=text;b.onclick=()=>{stop();show(p.lat,p.lng,p.name?'공개 위치':'장치 기록',p.receivedAt,p);if(device&&window.openDevicePanel)window.openDevicePanel(device,p);};return b;}
 const extra=p=>(Number.isFinite(p.alt)?' · 고도 '+p.alt.toFixed(1)+'m':'')+(Number.isFinite(p.battery)?' · 배터리 '+Math.round(p.battery)+'%':'');
 async function refresh(){
  if(busy)return;busy=true;clearTimeout(timer);
  const device=el('device').value;
  try{
   const r=await fetch('/api/visitors?scope=public',{cache:'no-store',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error);
   markers.forEach(m=>m.remove());markers=[];el('public-list').replaceChildren();
   for(const p of d.visitors){el('public-list').append(button(p.name+' · '+p.lat.toFixed(6)+', '+p.lng.toFixed(6)+' · '+new Date(p.receivedAt).toLocaleString('ko-KR'),p));if(map){const popup=document.createElement('div');popup.textContent=p.name;markers.push(L.marker([p.lat,p.lng]).addTo(map).bindPopup(popup));}}
   if(initial&&markers.length&&!params.has('lat')&&!params.has('lng')&&!params.has('device')){fitPublic();initial=false;}
   el('public-status').textContent=d.visitors.length+'명이 공개 중 · 마지막 확인 '+new Date().toLocaleTimeString('ko-KR');
  }catch(e){el('public-status').textContent='공개 위치 조회 실패: '+e.message;}
  try{
   if(!/^[a-zA-Z0-9_-]{1,40}$/.test(device))throw Error('장치 ID를 입력하세요.');
   const r=await fetch('/api/history?device='+encodeURIComponent(device),{cache:'no-store',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error);
   if(device===el('device').value){el('public-log').replaceChildren();if(map&&d.points.length){const p=d.points[0];const popup=document.createElement('div');popup.textContent=device;markers.push(L.marker([p.lat,p.lng]).addTo(map).bindPopup(popup).on('click',()=>window.openDevicePanel?.(device)));}for(const p of d.points)el('public-log').append(button(new Date(p.receivedAt).toLocaleString('ko-KR')+' · LAT '+p.lat.toFixed(6)+' · LON '+p.lng.toFixed(6)+extra(p),p,device));el('public-log-status').textContent=d.points.length+'건 · 마지막 확인 '+new Date().toLocaleTimeString('ko-KR');}
  }catch(e){el('public-log-status').textContent='로그 조회 실패: '+e.message;}
  finally{busy=false;timer=setTimeout(refresh,30000);}
 }
 el('public-fit').onclick=fitPublic;el('public-refresh').onclick=refresh;el('device').addEventListener('change',refresh);refresh();
})();
