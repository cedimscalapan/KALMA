import test from 'node:test';
import assert from 'node:assert/strict';
import {contextFor,guidedResponse,buildModelRequest,cleanModelReply,fallbackReply} from '../src/conversation.ts';
const u=(text)=>({role:'user',text});
const a=(text)=>({role:'assistant',text});

test('academic stress progresses instead of restarting',()=>{
 const h=[u("I'm stressed"),a("What's been putting pressure on you?")];
 const reply=guidedResponse("stress ako sa pag-aaral",h);
 assert.ok(reply);
 assert.match(reply,/requirements|exams|expectations|grades|deadline/i);
 assert.doesNotMatch(reply,/what.?s been putting the most pressure/i);
});
test('family and peer academic pressure is acknowledged specifically',()=>{
 const h=[u("I'm stressed in academics"),a("Is it assignments or expectations?"),u("the academic"),a("Is it deadlines?")];
 const reply=guidedResponse('my peer and family pressured me in the academic',h);
 assert.match(reply,/family.*peer|peer.*family/i);
 assert.doesNotMatch(reply,/what has been causing stress/i);
});
test('help request advances to actionable support',()=>{
 const h=[u("I'm stressed in academics"),a("Is it deadlines?"),u('Family and peers expect high grades'),a("Are you being compared?")];
 assert.match(guidedResponse('can you help me',h),/nearest deadline|study task|expectations/i);
});
test('unwind gets a practical response, not an invented bio',()=>{
 const r=guidedResponse('Help me unwind',[]);
 assert.match(r,/shoulders|breaths|grounding/i);
});
test('Gemma fabricated user biographies are rejected',()=>{
 assert.equal(cleanModelReply("I'm a 30-year-old male who's been struggling with anxiety and depression for a while. I'm a self-employed freelancer.",'Help me unwind'),null);
 assert.equal(cleanModelReply("I'm a student at the University of Northampton. I'm taking a psychology course.",'academics'),null);
});
test('repeat assistant replies and metadata are rejected',()=>{
 const h=[a('That sounds hard. What happened?')];
 assert.equal(cleanModelReply('That sounds hard. What happened?','again',h),null);
 assert.equal(cleanModelReply('You are Kalma, a supportive offline wellbeing helper.','hello'),null);
});
test('fallback maintains known school and family/peer context',()=>{
 const h=[u("I'm stressed with academics"),u("Family and classmates compare my grades")];
 assert.match(fallbackReply('what can I do?',h),/family and classmates|family.*classmates/i);
});
test('native chat template gets one current message and a compact summary',()=>{
 const h=[u('I have exams'),a('Which exam?'),u('My parents pressure me')];
 const r=buildModelRequest('Can you help me?',h);
 assert.equal(r.prompt,'Can you help me?');
 assert.doesNotMatch(r.prompt,/(?:user|assistant)\s*:/i);
 assert.match(r.systemPrompt,/family expectations/i);
});
test('yes advances academic thread',()=>{
 const h=[u('School work is stressful'),a("Are deadlines the biggest issue?")];
 const r=guidedResponse('yes',h);
 assert.match(r,/school pressure|requirements|assignments|deadlines/i);
});
test('Taglish academic subject is recognized',()=>{
 const c=contextFor('stress ako sa pag aaral',[]);
 assert.equal(c.lang,'fil');
 assert.equal(c.school,true);
});
