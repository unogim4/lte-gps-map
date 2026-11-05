// W-023 머리줄에 "○○님" + 로그아웃 버튼
(()=>{
 const header=document.querySelector('header');if(!header)return;
 const box=document.createElement('div');box.className='account';
 const name=document.createElement('span');name.className='account-name';
 const out=document.createElement('button');out.type='button';out.className='account-logout';out.textContent='로그아웃';
 box.append(name,out);header.append(box);
 fetch('/api/auth?action=me',{cache:'no-store',credentials:'same-origin'}).then(async r=>{
  if(r.status===401){location.replace('/login.html?next='+encodeURIComponent(location.pathname+location.search));return;}
  const d=await r.json();if(d.username)name.textContent=d.username+'님';
 }).catch(()=>{});
 out.onclick=async()=>{
  out.disabled=true;
  try{await fetch('/api/auth?action=logout',{method:'POST',credentials:'same-origin'});}catch{}
  location.replace('/login.html');
 };
})();
