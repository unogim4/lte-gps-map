(()=>{
 const $=id=>document.getElementById(id);let key='',device='',timer,run=0,points=[],offset=0,next=null,layers=[];
 const map=window.L?L.map('map').setView([36,128],7):null;
 if(map){L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© OpenStreetMap contributors'}).on('tileerror',()=>{$('map-note').textContent='지도 이미지 연결을 확인하세요.'}).addTo(map);if(window.ResizeObserver)new ResizeObserver(()=>map.invalidateSize()).observe($('map'));}
 function draw(){
  layers.forEach(l=>l.remove());layers=[];$('records').replaceChildren();
  for(const p of points){const row=document.createElement('p');row.textContent=new Date(p.receivedAt).toLocaleString('ko-KR')+' · '+p.lat+', '+p.lng;$('records').append(row);}
  if(map&&points.length){layers.push(L.polyline(points.map(p=>[p.lat,p.lng]),{color:'#138577'}).addTo(map));layers.push(L.marker([points[0].lat,points[0].lng]).addTo(map));if(offset===0)map.setView([points[0].lat,points[0].lng],16);else map.fitBounds(layers[0].getBounds(),{maxZoom:16});}
  $('export').disabled=!points.length;$('older').disabled=next===null;
 }
 async function refresh(seq){
  try{const r=await fetch('/api/history?device='+encodeURIComponent(device)+'&offset='+offset,{headers:{Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(15000)});const d=await r.json();if(seq!==run)return;if(!r.ok)throw Error(d.error);points=d.points;next=d.nextOffset;draw();$('status').textContent=points.length+'건 조회 · 수신 시각 기준 · 최근 10,000건 보관';$('map-note').textContent=points.length?'마지막 수신 '+new Date(points[0].receivedAt).toLocaleString('ko-KR'):'이 장치에서 받은 기록이 없습니다.';}
  catch(e){if(seq===run)$('status').textContent='조회 실패: '+e.message;}
  finally{if(key&&seq===run&&offset===0)timer=setTimeout(()=>refresh(seq),30000);}
 }
 $('history-form').onsubmit=e=>{e.preventDefault();clearTimeout(timer);run++;device=$('device').value.trim();key=$('key').value.trim();$('key').value='';$('key').required=false;offset=0;refresh(run);};
 $('older').onclick=()=>{if(next===null)return;clearTimeout(timer);offset=next;run++;refresh(run);};
 $('stop').onclick=()=>{clearTimeout(timer);run++;key='';points=[];next=null;draw();$('key').value='';$('key').required=true;$('status').textContent='조회가 중지되었습니다.';};
 $('export').onclick=()=>{const csv='\ufeffdevice,receivedAt,lat,lng\r\n'+points.map(p=>[p.device,p.receivedAt,p.lat,p.lng].join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=device+'-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();
