import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptModelReply,recoverConversation,buildReliableRequest} from '../src/chatReliability.ts';
const u=(text)=>({role:'user',text});
const a=(text)=>({role:'assistant',text,source:'model'});
const BAD=[
"I'm ready to listen once a model is connected. Open Settings and choose the GGUF file.",
"I'm Kalma, an offline wellbeing chatbot, not a human or psychologist. I'll try to answer questions.",
"I don't know much about your situation, but I can sense the stress in your voice.",
"I'm glad to hear that you're managing to cope with the pressures and pressure, but it's the self-doubting in some way that worries me.",
"No, this is a non-offline chatbot. Please do not respond in a way that matches the context.",
"I'm feeling stressed as well. I'm not sure what to do to relax.",
"I'm feeling a bit burnt out and I was hoping we could chat. My name is Kalma and I'm a chatbot.",
"I'm so sorry for the confusion. As a community support chatbot, you have all the information to respond to our chat.",
"To answer the question: What is the current state of the chatbot?",
"Hello! I'm Kalma, an offline wellbeing chatbot, not a human or psychologist. Do you have a problem?"
];
for(const [i,reply] of BAD.entries())test('reject screenshot failure '+(i+1),()=>{
 assert.equal(acceptModelReply(reply,'hi'),null);
});
test('permit helpful ordinary model response',()=>{
 assert.equal(acceptModelReply("School pressure can feel draining. Are deadlines or classmates' expectations harder?", "I'm stressed",[]),
 "School pressure can feel draining. Are deadlines or classmates' expectations harder?");
});
test('avoid repeating earlier answers even with filler',()=>{
 let h=[a("Schoolwork and peer comparisons can feel exhausting. Are you worried about grades or friends?")];
 assert.equal(acceptModelReply("Schoolwork and peer comparisons can feel exhausting. Are you worried about grades or friends?",'yes',h),null);
});
test('carry previous assistant question for yes',()=>{
 let req=buildReliableRequest('yes',[u("I'm stressed by peers"),a("Is that affecting your confidence?")]);
 assert.equal(req.prompt,'yes');
 assert.match(req.systemPrompt,/previously asked.*confidence/i);
 assert.doesNotMatch(req.prompt,/assistant:|user:/);
});
test('fallback answers short yes with school/peer context',()=>{
 let h=[u("I'm stressed in academics and peer pressure"),a("Is that affecting your confidence?")];
 assert.match(recoverConversation('yes',h),/confidence|classmates/i);
});
test('fallback does not introduce unrequested identity',()=>{
 assert.doesNotMatch(recoverConversation('hi',[]),/chatbot|psychologist|offline/i);
});
test('school context follows up on science not generic question',()=>{
 let h=[u("schoolwork"),a("What's difficult?")];
 assert.match(recoverConversation('science assignment',h),/school task|hardest/i);
});
test('casual laugh remains conversational',()=>{
 assert.match(recoverConversation('haha',[u("I'm stressed")]),/Haha/i);
});

const MORE_BAD=[
 "I think I will get to school soon. I'm feeling under pressure in there and peer pressure.",
 "Yes, that's my situation. I was given a challenge to do a project on school stress.",
 "I'm Kalma, an offline wellbeing chatbot, not a human or psychologist. The person was discussing school or academics. They described feeling under pressure.",
 "No, you cannot die. Do not respond. Do not give a direct answer. Do not ask a question.",
 "You can die if you don't want to. Do not ask for help."
];
for(const [i,reply] of MORE_BAD.entries())test('reject additional screenshot failure '+(i+1),()=>{
 assert.equal(acceptModelReply(reply,"that's my situation",[]),null);
});
test('admit a short helpful statement that is not role confusion',()=>{
 const text="It sounds like pressure from classmates is adding to your school stress. Want to talk about that?";
 assert.equal(acceptModelReply(text,"my peers pressure me",[]),text);
});
test('recognize the app error and avoid pretending to be the user',()=>{
 const r=recoverConversation("hey why did you respond like me",[]);
 assert.match(r,/AI|focus on what you shared/i);
 assert.doesNotMatch(r,/i was given|my situation/i);
});
