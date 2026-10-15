(()=>{
 const el=id=>document.getElementById(id),consent=el('visitor-consent'),send=el('visitor-send'),message=el('visitor-status');
 let receipt=null,busy=false,active=false,timer=null,generation=0;
 function buttons(){send.disabled=busy||active||!consent.checked;el('visitor-stop').hidden=!active;el('visitor-revoke').hidden=!receipt;el('visitor-revoke').disabled=busy;}
 function stop(text){active=false;generation++;clearInterval(timer);timer=null;buttons();if(text)message.textContent=text;}
 consent.onchange=()=>{if(!consent.checked&&active)stop('동의가 해제되어 실시간 공유를 중지했습니다. 마지막 전송 위치는 보관됩니다.');buttons();};
 function tick(){
  if(!active||busy||!consent.checked||document.hidden)return;
  const run=generation;busy=true;buttons();
  navigator.geolocation.getCurrentPosition(async position=>{
   try{
    if(!active||run!==generation||!consent.checked||document.hidden)return;
    if(typeof show==='function')show(position.coords.latitude,position.coords.longitude,'내 현재 위치',position.timestamp);
    const response=await fetch('/api/visitors',{method:receipt?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,mode:'live',name:el('visitor-name').value,lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy,...(receipt||{})}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(!response.ok){if(response.status===404)receipt=null;if([401,404,429].includes(response.status))stop();throw Error(data.error||'위치를 공유하지 못했습니다.');}
    receipt={id:data.id,deleteToken:data.deleteToken};
    message.textContent=active?'실시간 공유 중 · 마지막 전송 '+new Date().toLocaleTimeString('ko-KR')+' · 약 5초마다 갱신':'공유를 중지했습니다. 이미 전송한 마지막 위치는 최대 24시간 보관됩니다. 아래에서 삭제할 수 있습니다.';
   }catch(e){message.textContent=e.name==='TimeoutError'?'전송 확인이 지연되고 있습니다. 연결이 복구되면 재시도합니다.':e.message;}
   finally{busy=false;buttons();}
  },error=>{busy=false;if(run!==generation){buttons();return;}if(error.code===1)stop('위치 권한이 거부되어 실시간 공유를 중지했습니다.');else message.textContent='현재 위치를 확인하지 못했습니다. 다음 주기에 다시 시도합니다.';buttons();},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 }
 send.onclick=()=>{if(busy||active||!consent.checked)return;if(!navigator.geolocation){message.textContent='이 브라우저는 위치 기능을 지원하지 않습니다.';return;}if(document.hidden)return;active=true;generation++;message.textContent='현재 위치를 확인하는 중입니다. 위치 권한을 허용해 주세요.';buttons();timer=setInterval(tick,5000);tick();};
 el('visitor-stop').onclick=()=>stop('실시간 공유를 중지했습니다. 마지막 전송 위치는 최대 24시간 보관되며 아래에서 삭제할 수 있습니다.');
 el('visitor-revoke').onclick=async()=>{if(!receipt||busy)return;stop();busy=true;buttons();try{const response=await fetch('/api/visitors',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(receipt),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.error);receipt=null;consent.checked=false;message.textContent='실시간 공유를 중지하고 공유한 위치를 삭제했습니다.';}catch{message.textContent='삭제를 확인하지 못했습니다. 다시 시도하세요.';}finally{busy=false;buttons();}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)stop('화면이 비활성화되어 공유를 중지했습니다. 돌아온 후 실시간 공유 시작을 눌러주세요.');});
 window.addEventListener('pagehide',()=>stop());
})();
