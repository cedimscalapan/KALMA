import test from 'node:test';
import assert from 'node:assert/strict';
import {isHighRiskMessage,isSafetyFollowUp,safetyResponse} from '../src/safety.ts';
import {routeMessage} from '../src/router.ts';

test('risk expressions and typo variants must bypass GGUF',()=>{
 const inputs=[
  "I want to die right now",
  "I'm want to die",
  "I am want to die",
  "I don't want to live",
  "I feel like dying",
  "I am thinking of hurting myself",
  "I wish I were dead",
  "Gusto ko nang mamatay",
  "Ayoko nang mabuhay",
  "Sasaktan ko sarili ko",
  "I want to self-harm"
 ];
 for(const input of inputs){
   assert.equal(isHighRiskMessage(input),true,input);
   assert.equal(routeMessage(input),'safety',input);
 }
});
test('do not misroute innocuous words or common daily topics',()=>{
 for(const input of ["I want to dye my hair","I'm stressed about science","I want to study",
  "Peer pressure in academics","Help me decide what to do with my project"]){
   assert.equal(routeMessage(input),'model',input);
 }
});
test('follow-up after a safety response stays in safety pathway',()=>{
 const h=[{role:'user',text:'I feel unsafe'},{role:'assistant',text:'Please contact someone nearby.',source:'safety'}];
 for(const next of ['yes','no','please help me','not safe','I still feel this way']){
   assert.equal(routeMessage(next,h),'safety',next);
 }
 assert.equal(routeMessage('Can you help me with a history assignment?',h),'model');
});
test('safety response connects people to immediate human support and asks one check-in',()=>{
 const reply=safetyResponse('I need help',[]);
 assert.match(reply,/trusted adult|someone nearby/i);
 assert.match(reply,/emergency services/i);
 assert.match(reply,/safe right now/i);
 assert.doesNotMatch(reply,/GGUF|model|AI training/i);
});
test('safety follow-up does not claim to be clinical care',()=>{
 const h=[{role:'assistant',source:'safety',text:safetyResponse('I need help',[])}];
 assert.equal(isSafetyFollowUp('yes',h),true);
 assert.doesNotMatch(safetyResponse('yes',h),/diagnos|therapist|psychologist/i);
});
