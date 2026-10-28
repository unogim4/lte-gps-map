(()=>{
 const $=id=>document.getElementById(id);let key='',device='',timer,clock,seq=0,busy=false,points=[],last=null,due=0,controller;
 const time=s=>new Date(s).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});
 function activity(text){const li=document.createElement('li');li.textContent=time(Date.now())+' · '+text;$('activity').prepend(li);while($('activity').children.length>20)$('activity').lastElementChild.remove();}
 function reset(){seq++;clearTimeout(timer);clearInterval(clock);controller?.abort();key='';busy=false;points=[];last=null;due=0;$('rows').replaceChildren();$('activity').replaceChildren();$('key').value='';$('checked').textContent='—';$('received').textContent='—';$('countdown').textContent='—';for(const id of ['refresh','stop','csv'])$(id).disabled=true;$('device').disabled=false;$('login').hidden=false;}
 async function refresh(run){
  if(busy||!key||run!==seq)return;busy=true;clearTimeout(timer);due=0;$('refresh').disabled=true;$('countdown').textContent='조회 중';controller=new AbortController();const requestController=controller;const timeout=setTimeout(()=>requestController.abort(),15000);
  try{
   const r=await fetch('/api/history?device='+encodeURIComponent(device),{headers:{Authorization:'Bearer '+key},cache:'no-store',signal:requestController.signal});const d=await r.json();if(run!==seq)return;
   if(r.status===401){reset();$('message').textContent='관리자 인증키가 일치하지 않습니다. 다시 입력하세요.';return;}
   if(!r.ok)throw Error(d.error||'조회 실패');
   const previous=last;points=d.points;last=points[0]?.receivedAt||null;$('rows').replaceChildren();
   for(const p of points){const row=document.createElement('tr');if(previous&&p.receivedAt>previous)row.className='fresh';for(const value of [time(p.receivedAt),p.device,Number(p.lat).toFixed(6),Number(p.lng).toFixed(6)]){const td=document.createElement('td');td.textContent=value;row.append(td);}$('rows').append(row);}
   const result=!points.length?'수신 기록 없음':previous===last?'새 데이터 없음 · 마지막 좌표 유지':previous?'새 좌표 수신':'최근 로그 조회 완료';
   $('message').textContent=device+' · '+result+' · '+points.length+'건';$('checked').textContent=time(Date.now());$('received').textContent=last?time(last):'—';$('csv').disabled=!points.length;activity(result);
  }catch(e){if(run===seq){$('message').textContent='조회 실패 · 표시된 로그는 이전 조회 결과입니다. '+(e.name==='AbortError'?'연결 시간 초과':e.message);activity('조회 실패');}}
  finally{clearTimeout(timeout);if(run===seq&&key){busy=false;$('refresh').disabled=false;due=Date.now()+30000;timer=setTimeout(()=>refresh(run),30000);}}
 }
 $('login').onsubmit=e=>{e.preventDefault();const entered=$('key').value.trim();const id=$('device').value.trim();if(!entered||!/^[a-zA-Z0-9_-]{1,40}$/.test(id))return;reset();key=entered;device=id;$('login').hidden=true;$('stop').disabled=false;const run=seq;clock=setInterval(()=>{if(due)$('countdown').textContent=Math.max(0,Math.ceil((due-Date.now())/1000))+'초';},1000);refresh(run);};
 $('refresh').onclick=()=>refresh(seq);$('stop').onclick=()=>{reset();$('message').textContent='중지되었습니다. 서버에 보관된 로그는 유지됩니다.';};
 $('csv').onclick=()=>{const csv='\ufeffdevice,receivedAt,lat,lng\r\n'+points.map(p=>[p.device,p.receivedAt,p.lat,p.lng].join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=device+'-logs.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 window.addEventListener('pagehide',reset);
})();
