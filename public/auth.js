// W-023 로그인·회원가입 화면
(()=>{
 const $=id=>document.getElementById(id);
 let mode='login',busy=false;
 const params=new URLSearchParams(location.search);
 function nextUrl(){const n=params.get('next');return n&&n.startsWith('/')&&!n.startsWith('//')&&!n.startsWith('/\\')&&n.length<=300?n:'/';}
 function say(message,ok=false){$('auth-status').textContent=message;$('auth-status').classList.toggle('ok',ok);}
 function setMode(next){
  mode=next;const signup=mode==='signup';
  $('signup-fields').hidden=!signup;
  $('auth-title').textContent=signup?'회원가입':'로그인';
  $('auth-eyebrow').textContent=signup?'CREATE ACCOUNT':'MEMBER LOGIN';
  $('auth-intro').textContent=signup?'아이디와 비밀번호를 정해 가입하세요. 가입하면 바로 로그인됩니다.':'회원만 위치 지도를 볼 수 있습니다.';
  $('auth-submit').textContent=signup?'가입하고 시작하기':'로그인';
  $('auth-switch').textContent=signup?'이미 회원이신가요? 로그인':'처음이신가요? 회원가입';
  $('auth-password').autocomplete=signup?'new-password':'current-password';
  say('');
 }
 $('auth-switch').onclick=()=>setMode(mode==='login'?'signup':'login');
 $('auth-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const username=$('auth-username').value.trim().toLowerCase(),password=$('auth-password').value;
  if(!/^[a-z0-9_]{3,20}$/.test(username))return say('아이디는 영문 소문자·숫자·밑줄(_) 3~20자로 입력하세요.');
  if(password.length<8)return say('비밀번호는 8자 이상 입력하세요.');
  if(mode==='signup'&&password!==$('auth-password2').value)return say('비밀번호 확인이 같지 않습니다.');
  const body={username,password};
  if(mode==='signup'&&$('auth-code').value.trim())body.signupCode=$('auth-code').value.trim();
  busy=true;$('auth-submit').disabled=true;say(mode==='signup'?'가입하는 중입니다…':'로그인하는 중입니다…',true);
  try{
   const r=await fetch('/api/auth?action='+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin',signal:AbortSignal.timeout(15000)});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(d.error||'잠시 후 다시 시도하세요.');
   say((mode==='signup'?'가입되었습니다. ':'')+'지도로 이동합니다.',true);
   location.replace(nextUrl());
  }catch(err){say(err.name==='TimeoutError'?'응답이 늦습니다. 잠시 후 다시 시도하세요.':err.message);}
  finally{busy=false;$('auth-submit').disabled=false;}
 });
 // 이미 로그인되어 있으면 바로 지도로
 fetch('/api/auth?action=me',{cache:'no-store',credentials:'same-origin'}).then(r=>{if(r.ok)location.replace(nextUrl());}).catch(()=>{});
 if(params.get('mode')==='signup')setMode('signup');
})();
