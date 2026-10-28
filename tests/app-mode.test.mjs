import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isTestMode,acceptsOrders} from '../src/lib/app-mode.ts';
function configured(mode,client,real,check){const keys=['KASTELYDOMB_MODE','CLIENT_TEST_ORDERS_ENABLED','ORDER_INTAKE_ENABLED'];const old=keys.map(k=>process.env[k]);try{[mode,client,real].forEach((v,i)=>v===undefined?delete process.env[keys[i]]:process.env[keys[i]]=v);check()}finally{old.forEach((v,i)=>v===undefined?delete process.env[keys[i]]:process.env[keys[i]]=v)}}
test('Missing mode defaults to test and closed intake',()=>configured(undefined,undefined,undefined,()=>{assert.equal(isTestMode(),true);assert.equal(acceptsOrders(),false)}));
test('Client testing enables only test orders while real intake is off',()=>configured('test','true','false',()=>{assert.equal(isTestMode(),true);assert.equal(acceptsOrders(),true)}));
test('Real order switch cannot enable intake in client mode',()=>configured('test','false','true',()=>assert.equal(acceptsOrders(),false)));
test('Client testing switch cannot enable real ordering',()=>configured('production','true','false',()=>{assert.equal(isTestMode(),false);assert.equal(acceptsOrders(),false)}));
test('Real ordering requires explicit production mode and real switch',()=>configured('production','false','true',()=>assert.equal(acceptsOrders(),true)));
