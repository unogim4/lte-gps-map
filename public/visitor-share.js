(()=>{
 const el=id=>document.getElementById(id), consent=el('visitor-consent'),send=el('visitor-send'),message=el('visitor-status');
 let receipt=null,busy=false;
 consent.onchange=()=>{send.disabled=busy||!!receipt||!consent.checked};
 send.onclick=()=>{
  if(busy||!!receipt||!consent.checked)return;
  if(!navigator.geolocation){message.textContent='이 브라우저는 위치 기능을 지원하지 않습니다.';return;}
  busy=true;send.disabled=true;message.textContent='공유할 현재 위치를 확인하는 중입니다. 위치 권한을 허용해 주세요.';
  navigator.geolocation.getCurrentPosition(async position=>{
   try{
    if(!consent.checked){message.textContent='동의가 해제되어 위치를 전송하지 않았습니다.';return;}
    const response=await fetch('/api/visitors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,name:el('visitor-name').value,lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||'위치를 공유하지 못했습니다.');
    receipt={id:data.id,deleteToken:data.deleteToken};el('visitor-revoke').hidden=false;
    message.textContent='관리자에게 위치를 한 번 공유했습니다. '+new Date(data.expiresAt).toLocaleString('ko-KR')+'까지 보관합니다. 페이지를 닫으면 이 화면의 삭제 버튼은 사용할 수 없습니다.';
    consent.checked=false;
   }catch(e){message.textContent=e.name==='TimeoutError'?'응답을 확인하지 못했습니다. 전송이 완료되었을 수 있으며 위치는 최대 24시간 보관됩니다.':e.message;}
   finally{busy=false;send.disabled=!!receipt||!consent.checked;}
  },error=>{busy=false;send.disabled=!!receipt||!consent.checked;message.textContent=error.code===1?'위치 권한이 거부되어 전송하지 않았습니다.':'현재 위치를 확인하지 못해 전송하지 않았습니다. 다시 시도하세요.';},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 };
 el('visitor-revoke').onclick=async()=>{
  if(!receipt||busy)return;busy=true;send.disabled=true;el('visitor-revoke').disabled=true;
  try{const response=await fetch('/api/visitors',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(receipt),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.error);receipt=null;el('visitor-revoke').hidden=true;message.textContent='공유한 위치를 삭제했습니다.';}
  catch(e){message.textContent='삭제를 확인하지 못했습니다. 다시 시도하세요.';}
  finally{busy=false;send.disabled=!!receipt||!consent.checked;el('visitor-revoke').disabled=false;}
 };
})();
