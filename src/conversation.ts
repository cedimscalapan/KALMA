/**
 * KALMA offline conversation controller.
 * General-purpose tiny models are not reliable psychological counselors.
 * High-confidence wellness requests use short, reviewed-style guided support;
 * other requests can use the local GGUF model with a compact context summary.
 */
export type ChatTurn={role:'user'|'assistant';text:string;source?:'guided'|'model'};
type Topic='school'|'relationships'|'general';
type Language='en'|'fil';
type Context={topic:Topic;lang:Language;school:boolean;family:boolean;peers:boolean;workload:boolean;grades:boolean;stress:boolean;lastAssistant:string;lastUser:string};
const norm=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const find=(s:string,r:RegExp)=>r.test(s);
const school=/\b(?:academics?|academic|school|college|university|study|studies|studying|exam|quiz|homework|class|subject|grades?|assignment|deadline|requirements?|coursework|project|thesis)\b|pag.?aaral|pagaaral|mag.?aral|nag.?aaral|aralin|eskwela|paaralan/i;
const stress=/\b(?:stress|stressed|stressing|pressure|pressured|overwhelmed|burnout|worried|anxious|anxiety)\b|nahihirapan|hirap|bigat|pagod|nape.?pressure|kinakabahan/i;
const family=/\b(?:family|parent|parents|mother|father|mom|dad|siblings?)\b|pamilya|magulang|nanay|tatay/i;
const peers=/\b(?:peers?|friends?|classmates?|comparison|compare|competitive)\b|kaibigan|barkada|kaklase|ikumpara/i;
const workload=/\b(?:deadlines?|assignments?|requirements?|tasks?|projects?|homework|exams?|quizzes?|time|schedule|workload)\b|gawain|tambak|marami|oras/i;
const grades=/\b(?:grades?|scores?|honors?|expectations?|expect|achievement|performance|passing|failure|fail|disappoint)\b|marka|mataas|magaling|expectation|pressure/i;
const greeting=/^(?:hi+|hello+|hey+|yo+|kumusta|kamusta|good (?:morning|afternoon|evening))[!. ]*$/i;
const yes=/^(?:yes|yeah|yep|yup|oo|opo|sure|exactly|correct)[!. ]*$/i;
const no=/^(?:no|nope|nah|hindi)[!. ]*$/i;
const vague=/^(?:idk|i don.t know|not sure|maybe|i guess|nothing|i.m not sure)[!. ]*$/i;
const thanks=/^(?:thanks|thank you|salamat|thank u|ty)[!. ]*$/i;
const help=/\b(?:can you help|help me|need help|help with|what should i do|any advice)\b|tulungan|patulong|paano/i;
const unwind=/\b(?:unwind|relax|calm down|breathing|take a break|grounding)\b|pahinga|kumalma|mag.?relax/i;
const fil=/\b(?:ako|sa|pag|aral|pamilya|magulang|nahihirapan|ang|ko|mo|kasi|opo|oo|tulungan|hirap|pagod|marami|paano|sobra|kaklase)\b|pag.?aaral/i;
const personClaim=/\b(?:i(?:'m| am) (?:a|an) (?:\d{1,3}[- ]year[- ]old|male|female|student|therapist|psychologist|freelancer|doctor)|i(?:'m| am) currently (?:taking|studying|enrolled)|i(?:'m| am) (?:self.employed|working as|attending)|i (?:study|attend|work at|live in|have a passion for|have been struggling with|suffer from|was diagnosed with)|as (?:a|an) (?:licensed|professional) therapist)\b/i;
const metaLeak=/\b(?:you are kalma|system prompt|system instruction|offline emotional.wellbeing companion|gguf|import (?:the |a )?model|model (?:is not|is) (?:working|connected)|open settings|assistant\s*:|user\s*:|person\s*:|human\s*:|kalma\s*:)\b/i;
const normalize=(s:string)=>s.trim().replace(/\s+/g,' ');
export function contextFor(input:string,history:ChatTurn[]):Context {
 const previous=history.filter(m=>m.role==='user').slice(-8).map(m=>m.text);
 const recent=previous.join(' ')+' '+input;
 const lastAssistant=history.filter(m=>m.role==='assistant').at(-1)?.text||'';
 return {topic:find(recent,school)?'school':find(recent,family)||find(recent,peers)?'relationships':'general',
  lang:find(input,fil)?'fil':'en',school:find(recent,school),family:find(recent,family),peers:find(recent,peers),
  workload:find(recent,workload),grades:find(recent,grades),stress:find(recent,stress),
  lastAssistant,lastUser:previous.at(-1)||''};
}
function choose(options:string[],history:ChatTurn[]):string {
 const recent=history.filter(x=>x.role==='assistant').slice(-5).map(x=>norm(x.text));
 return options.find(x=>!recent.includes(norm(x)))??options[options.length-1];
}
function phrase(ctx:Context,en:string,tag:string):string{return ctx.lang==='fil'?tag:en;}
/** Grounded, stage-aware support; no clinical claims. Returns null for general chat. */
export function guidedResponse(input:string,history:ChatTurn[]):string|null {
 const value=input.trim();
 const ctx=contextFor(value,history);
 const schoolNow=find(value,school),familyNow=find(value,family),peerNow=find(value,peers);
 const stressNow=find(value,stress),workloadNow=find(value,workload);
 const gradesNow=find(value,grades);
 const recentSchool=ctx.school, schoolPressure=ctx.school&&(ctx.stress||ctx.family||ctx.peers);
 const pastUser=history.filter(m=>m.role==='user').slice(-5);
 const asked=ctx.lastAssistant.toLowerCase();
 if(find(value,greeting)) return history.length && ctx.stress
  ? phrase(ctx,'Hey. We were talking about what has been weighing on you. Would you like to continue or start somewhere else?',
   'Hi! Napag-usapan natin ang pressure na nararamdaman mo. Gusto mo bang ituloy o ibang topic muna?')
  : phrase(ctx,'Hey! How has your day been so far?','Kumusta! Kamusta ang araw mo?');
 if(find(value,thanks))return phrase(ctx,"You're welcome. Would you like to keep talking or take a little break?",'Walang anuman. Gusto mo pang magkwento o magpahinga muna?');
 if(find(value,unwind))return phrase(ctx,
  "Sure. You could loosen your shoulders and take a few slow, comfortable breaths. Would you prefer a quick grounding exercise or to talk about what's bothering you?",
  'Sige. Relax mo muna ang balikat at huminga nang dahan-dahan kung komportable. Gusto mo ng grounding exercise o magkwento muna?');
 // The user just provided the cause of pressure; acknowledge it, never ask for the cause again.
 if(recentSchool&&(familyNow||peerNow)){
   if(familyNow&&peerNow)return phrase(ctx,
    "Having expectations from both family and peers while managing school can feel exhausting. Are you being pushed about grades, compared with others, or both?",
    "Ang bigat kapag may pressure sa pag-aaral mula sa pamilya at mga kaklase. Sa grades ba, pagkukumpara sa iba, o pareho?");
   if(familyNow)return phrase(ctx,
    "Family expectations on top of schoolwork can be tough. Do they focus more on your grades or on what they hope you'll achieve?",
    "Ang hirap kapag may expectations ang pamilya sa pag-aaral. Mas tungkol ba ito sa grades o sa mga inaasahan nilang maabot mo?");
   return phrase(ctx,
    "Being compared with classmates or peers can add pressure to school. Is it competition, comments from others, or something else?",
    "Nakakadagdag ng pressure kapag may comparison sa mga kaklase. Tungkol ba sa competition, sinasabi nila, o iba pa?");
 }
 if(find(value,help)&&schoolPressure)return phrase(ctx,
  "Yes. Let's make this manageable: we can sort your nearest deadline, plan one study task, or think about how to respond to others' expectations. Which would help most?",
  "Oo. Pwede nating ayusin ang pinaka-urgent na requirement, gumawa ng maliit na study plan, o pag-usapan ang expectations ng iba. Alin ang uunahin?");
 if(find(value,yes)&&schoolPressure)return phrase(ctx,
  "Okay. Since school pressure is the issue, would you like to focus first on assignments and deadlines, or on expectations from people around you?",
  "Sige. Dahil school pressure ito, uunahin ba natin ang requirements at deadlines o ang expectations ng ibang tao?");
 if(find(value,no)&&schoolPressure)return phrase(ctx,
  "That's okay. We can approach it differently. Would you rather talk about what happened at school, or try a short calming break?",
  "Okay lang. Gusto mo bang magkwento tungkol sa school o magpahinga muna sandali?");
 if(find(value,vague)&&schoolPressure)return phrase(ctx,
  "You don't have to know the answer yet. What happened most recently that made school feel heavy?",
  "Okay lang kung hindi mo pa alam. Ano ang pinakahuling nangyari na nagpadagdag ng bigat sa school?");
 // An academic clarification is an answer, not a new question about the cause.
 if(schoolNow&&ctx.stress&&(pastUser.length>0||!stressNow)){
   if((gradesNow||ctx.grades)&&ctx.family)return phrase(ctx,
    "That sounds like a lot of expectations to carry. Is there one grade or subject you're especially worried about?",
    "Ang daming expectations na dala mo. May isang grade o subject bang pinaka-kinakabahan ka?");
   return choose([
     phrase(ctx,"Got it, the stress is about school. Is it deadlines, grades, or pressure to meet others' expectations?",
      "Gets ko, sa pag-aaral ang stress mo. Deadlines ba, grades, o expectations ng iba?"),
     phrase(ctx,"Thanks for clarifying that it's academic pressure. Which class or requirement feels most urgent?",
      "Salamat sa paglilinaw. Aling subject o requirement ang pinaka-urgent?"),
     phrase(ctx,"Let's focus on one part of school at a time. What's the most difficult task on your plate?",
      "Isa-isahin natin ang school concerns. Ano ang pinakamahirap na gawain ngayon?")
   ],history);
 }
 if(stressNow&&recentSchool){
   if(ctx.workload&&workloadNow)return phrase(ctx,
    "It sounds like the school workload is piling up. What's the nearest deadline? We can break that task into smaller steps.",
    "Parang tambak ang schoolwork. Ano ang pinakamalapit na deadline? Pwede natin itong hatiin sa maliliit na steps.");
   return phrase(ctx,
    "School pressure can be a lot. Is it mainly assignments, exams, or other people's expectations?",
    "Nakakabigat ang pressure sa pag-aaral. Mas dahil ba sa requirements, exams, o expectations ng iba?");
 }
 if(stressNow)return choose([
  phrase(ctx,"That sounds tiring. What's been putting the most pressure on you today?",
   "Ang bigat niyan. Ano ang pinaka-nagpapastress sa'yo ngayon?"),
  phrase(ctx,"I hear that you're dealing with a lot. Was there a particular moment today when it felt harder?",
   "Mukhang marami kang dinadala. May nangyari ba ngayon na lalo kang nahirapan?")
 ],history);
 if(find(value,help))return phrase(ctx,
  "I can help you think through it. What's the situation you'd like us to work on first?",
  "Pwede kitang tulungang mag-isip ng next step. Anong sitwasyon ang gusto mong unahin?");
 if(find(value,/^(?:i need someone to listen|can i talk|i need to vent|i want to talk)$/i))return phrase(ctx,
  "Of course. You can tell me what's been happening, at your own pace. What's on your mind?",
  "Sige, pwede kang magkwento sa sarili mong pace. Anong nasa isip mo?");
 if(find(value,yes)&&recentSchool)return phrase(ctx,
  "Okay. What part of your school situation would you like us to sort through first?",
  "Sige. Aling bahagi ng school situation ang gusto mong unahin?");
 if(find(value,yes))return phrase(ctx,"Okay, I'm following. What happened next?",'Sige, nakikinig ako. Ano ang sumunod?');
 if(find(value,no))return phrase(ctx,"That's okay. What would be more helpful for us to discuss?",'Okay lang. Ano ang mas makakatulong na pag-usapan natin?');
 if(find(value,vague))return phrase(ctx,"That's alright. We can start small. What was one thing on your mind today?",
  'Okay lang. Simulan natin sa maliit na bagay. Ano ang isang bagay na iniisip mo ngayon?');
 if(ctx.stress&&recentSchool&&value.length<45){
   return choose([
     phrase(ctx,"I remember you mentioned school pressure. Would it help to plan one next step or just talk it through?",
      "Nabanggit mo ang school pressure. Mas gusto mo bang gumawa ng maliit na plano o magkwento muna?"),
     phrase(ctx,"I'm following. Are the school requirements still the main concern, or has something else come up?",
      "Nakikinig ako. School requirements pa rin ba ang mabigat o may iba nang nangyari?")
   ],history);
 }
 return null;
}
export function cleanModelReply(raw:string,latestMessage:string,history:ChatTurn[]=[]):string|null{
 if(!raw||typeof raw!=='string')return null;
 let text=raw.replace(/<\|(?:im_start|im_end|endoftext|eot_id|start_header_id|end_header_id)\|>/gi,'').trim()
 .replace(/^(?:assistant|kalma|answer|response)\s*:\s*/i,'');
 text=text.split(/\n\s*(?:user|human|assistant|system|person|kalma)\s*:/i)[0]
  .replace(/^["'“”]+|["'“”]+$/g,'').trim();
 if(text.length<9||text.length>600||metaLeak.test(text)||personClaim.test(text))return null;
 if(find(text,/^\s*(?:you are|your role|instructions|the user|reply to)\b/i))return null;
 if(norm(text)===norm(latestMessage))return null;
 if(find(text,/(.{14,})\1/i))return null;
 if(history.filter(m=>m.role==='assistant').slice(-4).some(m=>norm(m.text)===norm(text)))return null;
 // Do not show a fabricated personal identity or first-person patient account from a fine-tuned model.
 if(find(text,/\bi(?:'m| am) (?:a|an) \d|(?:i(?:'m| am)|i have) (?:diagnosed|struggling with (?:depression|anxiety))/i))return null;
 return text.slice(0,360).trim();
}
export function buildModelRequest(input:string,history:ChatTurn[]):{prompt:string;systemPrompt:string;maxTokens:number}{
 const c=contextFor(input,history);
 const facts:string[]=[];
 if(c.school)facts.push('The person is discussing school or academics');
 if(c.stress)facts.push('They described feeling under pressure');
 if(c.family)facts.push('They mentioned family expectations');
 if(c.peers)facts.push('They mentioned peers or classmates');
 if(c.workload)facts.push('Assignments, time or workload may be involved');
 const summary=facts.slice(0,4).join('. ');
 const previous=history.filter(m=>m.role==='user').slice(-2).map(m=>normalize(m.text).slice(0,110)).join(' / ');
 const context=[summary,previous?'Recent context: '+previous:''].filter(Boolean).join('. ');
 return {prompt:input.trim().slice(0,450),
 systemPrompt:'You are Kalma, an offline wellbeing chatbot, not a human or psychologist. '+
  (context?context+'. ':'')+'Answer the current message as a supportive companion in 1-2 short sentences. '+
  'Do not speak as the user. Do not invent your age, background, experiences or credentials. Ask at most one relevant question. '+
  (c.lang==='fil'?'Reply in conversational Filipino or Taglish.':'Reply in natural English.'),
 maxTokens:110};
}
export function fallbackReply(input:string,history:ChatTurn[]):string{
 const c=contextFor(input,history);
 if(c.school&&c.family&&c.peers)return phrase(c,
  "It sounds like both family and classmates add pressure around school. Would you rather talk about their expectations or make a plan for schoolwork?",
  "Parang may pressure mula sa pamilya at kaklase. Gusto mo bang pag-usapan ang expectations nila o gumawa ng study plan?");
 if(c.school)return choose([
  phrase(c,"We can take the school situation one step at a time. What's the most urgent requirement you're dealing with?",
   "Isa-isahin natin ang school concerns. Anong requirement ang pinaka-urgent?"),
  phrase(c,"Let's figure out one manageable next step for school. Is a deadline or someone's expectations bothering you more?",
   "Pili tayo ng maliit na next step sa school. Deadline ba o expectations ng iba ang mas mabigat?")
 ],history);
 if(c.stress)return choose([
  phrase(c,"That sounds tough. Do you want to talk about what happened, or pause for a calming exercise?",
   "Ang hirap niyan. Gusto mo bang magkwento o mag-try ng calming exercise?"),
  phrase(c,"I'm following. What part of today has been the hardest?",
   "Nakikinig ako. Anong bahagi ng araw mo ang pinakamahirap?")
 ],history);
 return choose([
  phrase(c,"I'm not sure I understood that correctly. Could you tell me a little more?",'Hindi ko pa masyadong naintindihan. Pwede mo bang dagdagan?'),
  phrase(c,"I'd like to understand what you mean. What's the main thing you'd like to talk about?",'Gusto kong maintindihan. Ano ang gusto mong pag-usapan?')
 ],history);
}
// Compatibility with previous interface; high confidence turns never require the model.
export const cannedFirstResponse=guidedResponse;
export const supportiveReply=fallbackReply;
