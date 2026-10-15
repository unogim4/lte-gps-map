import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function load(search=''){
 const elements=new Map();let success,failure,calls=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'gps-01',textContent:'',addEventListener(type,fn){this[type]=fn},click(){this.onclick?.()}});return elements.get(id)};
 const context={document:{getElementById:element},window:{isSecureContext:true},location:{href:'https://example.com/'+search,origin:'https://example.com',search},navigator:{geolocation:{getCurrentPosition(ok,err,options){calls++;success=ok;failure=err;assert.equal(options.enableHighAccuracy,true)}}},URL,URLSearchParams,setTimeout,clearTimeout,history:{replaceState(){}}};
 vm.runInNewContext(source,context);
 return {element,get calls(){return calls},success:(coords)=>success({coords,timestamp:Date.now()}),failure:code=>failure({code})};
}
test('plain URL requests device location and displays result without API key',()=>{const app=load();assert.equal(app.calls,1);app.success({latitude:37.5,longitude:127,accuracy:20});assert.equal(app.element('latitude').textContent,'37.500000');assert.match(app.element('status').textContent,/정확도 약 20m/);});
test('explicit coordinate links preserve their coordinates without location prompt',()=>{const app=load('?lat=35&lng=129');assert.equal(app.calls,0);assert.equal(app.element('latitude').textContent,'35.000000');});
test('denied location provides retry instructions and button requests again',()=>{const app=load();app.failure(1);assert.match(app.element('status').textContent,/위치 권한이 차단/);app.element('my-location').click();assert.equal(app.calls,2);});
test('late location result does not replace a manually entered coordinate',()=>{const app=load();app.element('lat').value='35';app.element('lng').value='129';app.element('point-form').submit({preventDefault(){}});app.success({latitude:37.5,longitude:127,accuracy:20});assert.equal(app.element('latitude').textContent,'35.000000');});
