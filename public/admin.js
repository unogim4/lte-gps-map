(()=>{
 const el=id=>document.getElementById(id);let key='',timer,sequence=0,markers=[],first=true,follow=true; 
 const map=window.L?L.map('map').setView([36,128],7):null;
 const mapMessage=text=>{el('map-status').textContent=text;el('map-status').hidden=!text};
 if(map){L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>mapMessage('지도 이미지를 불러오지 못했습니다. 연결을 확인하세요.')).on('tileload',()=>mapMessage('')).addTo(map);if(window.ResizeObserver)new ResizeObserver(()=>map.invalidateSize({pan:false})).observe(el('map'));}
 else mapMessage('지도 프로그램을 불러오지 못했습니다. 새로고침해 주세요.');
 function clear(){markers.forEach(m=>m.remove());markers=[];el('admin-list').replaceChildren();}
 function logout(){key='';sequence++;clearTimeout(timer);clear();el('admin-key').value='';el('admin-login').hidden=false;el('admin-logout').hidden=true;first=true;}
 function fit(){if(map&&markers.length)map.fitBounds(L.featureGroup(markers).getBounds().pad(.2),{maxZoom:16});}
 async function refresh(run){
  try{
   const r=await fetch('/api/visitors',{headers:{Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await r.json();if(run!==sequence)return;
   if(r.status===401){logout();el('admin-message').textContent='관리자 인증키가 일치하지 않습니다.';return;}
   if(!r.ok)throw Error(data.error||'위치를 불러오지 못했습니다.');
   el('admin-login').hidden=true;el('admin-key').value='';el('admin-logout').hidden=false;clear();
   data.visitors.forEach(v=>{
    const text=v.name+' · '+new Date(v.receivedAt).toLocaleString('ko-KR')+' · 정확도 약 '+Math.round(v.accuracy)+'m';
    if(map){const popup=document.createElement('div');popup.textContent=text;const m=L.marker([v.lat,v.lng],{icon:L.divIcon({className:'',html:'<div class="gps-pin"></div>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map).bindPopup(popup);markers.push(m);}
    const button=document.createElement('button');button.type='button';button.textContent=v.name;const small=document.createElement('small');small.textContent=new Date(v.receivedAt).toLocaleString('ko-KR')+' · 정확도 약 '+Math.round(v.accuracy)+'m';button.append(small);button.onclick=()=>{if(map)map.setView([v.lat,v.lng],16)};el('admin-list').append(button);
   });
   el('admin-message').textContent=data.visitors.length?data.visitors.length+'건 · 마지막 확인 '+new Date().toLocaleTimeString('ko-KR'):'아직 공유된 위치가 없습니다.';
   if((first||follow)&&markers.length){fit();first=false;}
  }catch(e){if(run===sequence)el('admin-message').textContent='조회 실패: '+(e.name==='TimeoutError'?'연결 시간이 초과되었습니다.':e.message);}
  finally{if(key&&run===sequence)timer=setTimeout(()=>refresh(run),5000);}
 }
 el('admin-login').onsubmit=e=>{e.preventDefault();clearTimeout(timer);sequence++;key=el('admin-key').value.trim();if(!key)return;first=true;el('admin-message').textContent='인증 및 위치 조회 중입니다…';refresh(sequence)};
 el('admin-logout').onclick=()=>{logout();el('admin-message').textContent='로그아웃했습니다.'};el('admin-fit').onclick=fit;el('admin-follow').onclick=()=>{follow=!follow;el('admin-follow').textContent=follow?'위치 따라가기 켜짐':'위치 따라가기 꺼짐';el('admin-follow').setAttribute('aria-pressed',String(follow));if(follow)fit();};
})();
