// W-023 문지기(Vercel Routing Middleware): 로그인한 회원만 화면·조회 API에 들어온다.
// 아무것도 돌려주지 않으면(return) 원래 요청이 그대로 진행된다(공식 문서 조건문 예시 기준, 실제 동작 미검증).
import {isOpenRequest,getCookie,readSessionToken} from './lib/auth.js';

export const config={runtime:'nodejs'};

export default async function middleware(request){
 const url=new URL(request.url);
 if(isOpenRequest(request.method,url.pathname,url.searchParams))return;
 let session=null;
 try{session=await readSessionToken(getCookie(request.headers.get('cookie')||''));}
 catch{return new Response('로그인 확인 저장소에 연결하지 못했습니다. 잠시 후 다시 시도하세요.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});}
 if(session)return;
 if(url.pathname.startsWith('/api/'))return new Response(JSON.stringify({error:'로그인이 필요합니다.',code:'LOGIN_REQUIRED'}),{status:401,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
 const back=url.pathname+url.search;
 const target='/login.html'+(back==='/'?'':'?next='+encodeURIComponent(back));
 return new Response(null,{status:302,headers:{location:target,'cache-control':'no-store'}});
}
