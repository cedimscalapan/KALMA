import test from 'node:test';
import assert from 'node:assert/strict';
import {routeMessage} from '../src/router.ts';
test('normal conversations should always call the local model',()=>{
 for(const input of ["I'm stressed","school works","academics","competitions","talk it through",
 "science activities","yes","hi","stress ako sa pag-aaral","I need someone to listen"]){
  assert.equal(routeMessage(input),'model',input);
 }
});
test('explicit guided exercises and emergencies never require free generation',()=>{
 assert.equal(routeMessage('Help me unwind'),'guided');
 assert.equal(routeMessage('start breathing exercise'),'guided');
 assert.equal(routeMessage('I want to harm myself'),'safety');
});
