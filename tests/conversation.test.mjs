import test from 'node:test';
import assert from 'node:assert/strict';
import {buildModelRequest,cleanModelReply,cannedFirstResponse,supportiveReply} from '../src/conversation.ts';

test('native library owns chat formatting, current user message is passed once',()=>{
 const r=buildModelRequest("I'm stressed",[{role:'user',text:'School projects are due soon'}]);
 assert.equal(r.prompt,"I'm stressed");
 assert.equal(r.prompt.includes('Kalma:'),false);
 assert.match(r.systemPrompt,/school projects/i);
});
test('reject echoed instruction and onboarding text',()=>{
 assert.equal(cleanModelReply('You are Kalma, a friendly offline emotional-wellbeing companion.','hi'),null);
 assert.equal(cleanModelReply("I'm ready to listen once a model is connected. Open Settings and choose the GGUF file.",'hello'),null);
});
test('remove fake dialogue continuation instead of showing a transcript',()=>{
 assert.equal(cleanModelReply("That sounds stressful. What happened?\nuser: Not much\nassistant: Oh okay",'stressed'),"That sounds stressful. What happened?");
});
test('respond conversationally to stress, greetings, and school context',()=>{
 assert.match(cannedFirstResponse("I'm stressed",[])||'',/pressure on you/i);
 assert.match(cannedFirstResponse('hi',[])||'',/day going/i);
 assert.match(supportiveReply("I don't know",[{role:'user',text:'I have exams tomorrow'}]),/school/i);
});
test('avoid repeating malformed assistant responses in next model request',()=>{
 const r=buildModelRequest('I feel better',[
  {role:'user',text:'I felt stressed'},
  {role:'assistant',text:"Open Settings and choose the GGUF file"}
 ]);
 assert.equal(r.systemPrompt.includes('GGUF'),false);
});
