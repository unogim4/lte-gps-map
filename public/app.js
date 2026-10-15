const $=id=>document.getElementById(id);
let map,marker,point,timer,live=false,busy=false,geoRequest=0;
function status(message){$('status').textContent=message;}
if(window.L){map=L.map('map').setView([37.5665,126.978],12);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map).on('tileerror',()=>status('지도 타일을 불러오지 못했습니다. 인터넷 연결을 확인하세요.'));}else{status('지도 라이브러리를 불러오지 못했습니다. 연결을 확인 후 새로고침하세요.');}
function show(lat,lng,mode,time){if(lat===null||lng===null||String(lat).trim()===''||String(lng).trim()==='')throw Error('위도와 경도를 모두 입력하세요.');lat=Number(lat);lng=Number(lng);if(!Number.isFinite(lat)||lat < -90||lat>90||!Number.isFinite(lng)||lng < -180||lng>180)throw Error('위도 -90~90, 경도 -180~180 범위로 입력하세요.');point={lat,lng};$('latitude').textContent=lat.toFixed(6);$('longitude').textContent=lng.toFixed(6);$('lat').value=lat;$('lng').value=lng;$('mode').textContent=mode;$('updated').textContent=time?new Date(time).toLocaleString('ko-KR'):'URL / 직접 입력';$('map-note').textContent=`${lat.toFixed(6)}, ${lng.toFixed(6)} · ${mode}`;if(map){if(marker)marker.setLatLng([lat,lng]);else marker=L.marker([lat,lng],{icon:L.divIcon({className:'',html:'<div class="gps-pin"></div>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map);map.setView([lat,lng],15);}status(mode==='장치 수신'?'GPS 장치 위치를 수신했습니다.':'좌표 위치를 표시했습니다. 링크를 복사해 공유하세요.');}
function stop(){geoRequest++;clearTimeout(timer);live=false;$('live').textContent='장치 위치 수신 시작';}
$('point-form').addEventListener('submit',e=>{e.preventDefault();stop();try{show($('lat').value,$('lng').value,'직접 입력');const u=new URL(location.href);u.search='';u.searchParams.set('lat',point.lat);u.searchParams.set('lng',point.lng);history.replaceState(null,'',u);}catch(e){status(e.message);}});
$('share').onclick=async()=>{if(!point)return status('먼저 위치를 표시하세요.');const u=new URL(location.href);u.search='';u.searchParams.set('lat',point.lat);u.searchParams.set('lng',point.lng);try{await navigator.clipboard.writeText(u.href);status('위치 URL을 복사했습니다.');}catch{status('주소창의 URL을 복사해 주세요.');history.replaceState(null,'',u);}};
$('center').onclick=()=>{if(map&&point)map.setView([point.lat,point.lng],15);else status('먼저 좌표를 입력하세요.');};
async function poll(){if(!live||busy)return;busy=true;try{const r=await fetch('/api/location?device='+encodeURIComponent($('device').value),{cache:'no-store',signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok){if(r.status===503||r.status===400)stop();throw Error(d.error||'수신 실패');}if(live){if(d.location)show(d.location.lat,d.location.lng,'장치 수신',d.location.receivedAt);else status('아직 수신된 위치가 없습니다. GPS 장치에서 좌표를 전송하세요.');}}catch(e){status(e.name==='TimeoutError'?'수신 시간이 초과되었습니다. 다시 연결합니다.':e.message);}finally{busy=false;if(live)timer=setTimeout(poll,5000);}}
$('live').onclick=()=>{if(live){stop();status('자동 수신을 중지했습니다.');return;}if(!/^[a-zA-Z0-9_-]{1,40}$/.test($('device').value))return status('장치 ID는 영문·숫자·밑줄·하이픈 1~40자입니다.');live=true;$('live').textContent='자동 수신 중지';status('장치 위치를 확인하는 중입니다…');poll();};
$('device').oninput=()=>{if(live){stop();status('장치 ID가 변경되었습니다. 수신을 다시 시작하세요.');}};
const params=new URLSearchParams(location.search);if(params.has('device'))$('device').value=params.get('device');if(params.has('lat')||params.has('lng')){try{show(params.get('lat'),params.get('lng'),'URL 좌표');}catch(e){status(e.message);}}
$('sample').textContent=location.origin+'/?lat=37.5665&lng=126.9780';

if(params.has('device') && !params.has('lat') && !params.has('lng')) $('live').click();

function locateMe(){
  stop();
  const request=geoRequest;
  if(!navigator.geolocation){status('이 브라우저는 현재 위치 기능을 지원하지 않습니다. 좌표를 직접 입력하세요.');return;}
  if(!window.isSecureContext){status('현재 위치는 HTTPS 주소에서 사용할 수 있습니다.');return;}
  status('현재 위치를 확인하는 중입니다. 브라우저의 위치 요청을 허용해 주세요.');
  navigator.geolocation.getCurrentPosition(position=>{
    if(request!==geoRequest || live)return;
    show(position.coords.latitude,position.coords.longitude,'내 현재 위치',position.timestamp);
    const accuracy=Number.isFinite(position.coords.accuracy)?` (정확도 약 ${Math.round(position.coords.accuracy)}m)`:'';
    status('현재 위치를 표시했습니다.'+accuracy);
  },error=>{
    if(request!==geoRequest || live)return;
    const messages={1:'위치 권한이 차단되었습니다. 주소창의 사이트 설정에서 위치를 허용한 뒤 ‘내 위치 찾기’를 눌러주세요.',2:'현재 위치를 확인할 수 없습니다. 기기의 위치 서비스와 네트워크 연결을 확인한 뒤 다시 시도하세요.',3:'위치 확인 시간이 초과되었습니다. ‘내 위치 찾기’를 눌러 다시 시도하세요.'};
    status(messages[error.code] || '위치를 가져오지 못했습니다. 다시 시도하세요.');
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
$('my-location').onclick=locateMe;
if(!params.has('device') && !params.has('lat') && !params.has('lng'))locateMe();
