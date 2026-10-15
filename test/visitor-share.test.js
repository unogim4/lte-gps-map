import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../public/visitor-share.js',import.meta.url),'utf8');
function load(){const nodes=new Map();let callback,geoCalls=0,posts=0;const el=id=>{if(!nodes.has(id))nodes.set(id,{checked:false,disabled:id==='visitor-send',hidden:true,value:'',textContent:''});return nodes.get(id)};const context={document:{getElementById:el},navigator:{geolocation:{getCurrentPosition(ok){geoCalls++;callback=ok}}},AbortSignal,fetch:async()=>{posts++;return {ok:true,json:async()=>({id:'test',deleteToken:'test',expiresAt:new Date(Date.now()+86400000).toISOString()})}}};vm.runInNewContext(source,context);return {el,get geoCalls(){return geoCalls},get posts(){return posts},success:()=>callback({coords:{latitude:35,longitude:129,accuracy:30}})}};
test('visiting page and pressing share without consent never transmits',()=>{const app=load();assert.equal(app.posts,0);assert.equal(app.geoCalls,0);app.el('visitor-send').onclick();assert.equal(app.geoCalls,0);assert.equal(app.posts,0)});
test('withdrawing consent while acquiring location cancels transmission',async()=>{const app=load();app.el('visitor-consent').checked=true;app.el('visitor-send').onclick();app.el('visitor-consent').checked=false;await app.success();assert.equal(app.posts,0)});
test('explicit share transmits once and offers deletion',async()=>{const app=load();app.el('visitor-consent').checked=true;app.el('visitor-send').onclick();await app.success();assert.equal(app.posts,1);assert.equal(app.el('visitor-revoke').hidden,false);app.el('visitor-consent').checked=true;app.el('visitor-send').onclick();assert.equal(app.geoCalls,1)});
