import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler,{parsePoint} from '../api/location.js';
test('WGS84 coordinates and zero accepted',()=>{assert.equal(parsePoint({lat:'0',lng:'0'}).lat,0);assert.equal(parsePoint({lat:'37.5',lng:'127'}).lng,127);});
test('invalid values rejected',()=>{for(const input of [{lat:'',lng:0},{lat:91,lng:0},{lat:0,lng:181},{lat:'NaN',lng:0},{lat:[],lng:0},{lat:0,lng:0,device:'../x'}])assert.throws(()=>parsePoint(input));});
test('missing storage returns explicit 503, never fake success',async()=>{const env=process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_URL;const res={setHeader(){},status(s){this.code=s;return this},json(d){this.data=d;}};await handler({method:'GET',query:{device:'gps-01'},headers:{}},res);assert.equal(res.code,503);assert.equal(res.data.code,'STORAGE_NOT_CONFIGURED');if(env)process.env.UPSTASH_REDIS_REST_URL=env;});
