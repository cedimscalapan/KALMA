/**
 * KALMA's on-device model is only 135M parameters. Its replies must be checked
 * before display: instruction echoes, invented autobiographies and role confusion
 * should not be presented as psychological guidance.
 *
 * No network requests, private-chat telemetry or automatic diagnosis.
 */
export type Turn={role:'user'|'assistant';text:string;source?:'model'|'guided'|'fallback'|'safety'};

const normal=(x:string)=>x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const school=/\b(school|academics?|study|studies|class|classmates?|subject|assignment|requirements?|projects?|homework|grades?|tests?|exams?|science|college|schoolwork)\b|pag.?aaral|paaralan|eskwela/i;
const peers=/\b(peers?|friends?|classmates?|competition|compare|comparison|competitive)\b|barkada|kaklase/i;
const family=/\b(family|parents?|mother|father|mom|dad)\b|magulang|pamilya/i;
const fil=/\b(ako|sa|pag|aral|ang|ko|mo|kasi|oo|opo|gusto|nahihirapan|marami|paano|pagod)\b|pag.?aaral/i;

export function recentContext(history:Turn[],input:string){
  // Never feed arbitrary old assistant output into a new model prompt.
  const past=history.filter(m=>m.role==='user').slice(-4).map(m=>m.text.trim());
  const combined=[...past,input].join(' ');
  const lastAssistant=history.filter(m=>m.role==='assistant').slice(-1)[0]?.text||'';
  return {school:school.test(combined),peers:peers.test(combined),family:family.test(combined),
    filipino:fil.test(input),lastAssistant,previousUser:past.slice(-1)[0]||'',recentUser:past};
}
export function buildReliableRequest(input:string,history:Turn[]){
  const context=recentContext(history,input);
  const facts:string[]=[];
  if(context.school)facts.push('school');
  if(context.peers)facts.push('peer comparisons');
  if(context.family)facts.push('family expectations');
  const latest= context.previousUser ? 'Earlier: '+context.previousUser.slice(0,105)+'. ' : '';
  // Refer to the last question only for short replies such as "yes".
  const shortReply=/^(yes|yeah|yup|no|maybe|sure|oo|opo|hindi|idk|haha|lol)[!. ]*$/i.test(input.trim());
  const lastQuestion= shortReply && context.lastAssistant && !/model|chatbot|gguf|prompt|settings/i.test(context.lastAssistant)
   ? 'You previously asked: '+context.lastAssistant.slice(-125)+'. ' : '';
  const summary=facts.length?'Context: '+facts.join(', ')+'. ':'';
  return {
    prompt:input.trim().slice(0,420),
    systemPrompt:'Reply to the user naturally in 1 or 2 short sentences. No invented personal experiences or model discussion. '+
      summary+latest+lastQuestion+
      (context.filipino?'Use Filipino or Taglish.':'Use English.'),
    maxTokens:96
  };
}

/** Null means use safe, situation-specific local recovery instead of displaying the model text. */
export function acceptModelReply(raw:string,latest:string,history:Turn[]=[]):string|null{
 if(typeof raw!=='string')return null;
 let value=raw.replace(/<\|[^>]{0,80}\|>/g,'').trim()
  .replace(/^(?:assistant|kalma|response|answer)\s*:\s*/i,'');
 value=value.split(/\n\s*(?:user|human|assistant|system|person|kalma)\s*:/i)[0].trim();
 if(value.length<8||value.length>500)return null;
 // The training data sometimes makes the model recite its own role or system message.
 const meta=/\b(?:you are kalma|i(?:'m| am) kalma|my name is kalma|offline well.?being chatbot|offline wellbeing chatbot|not a human or psychologist|not a human or a psychologist|community support chatbot|non.offline chatbot|system prompt|system instruction|these instructions|this prompt|current state of the chatbot|model is connected|import a model|choose the gguf|open settings|gguf|as a chatbot|i(?:'ll| will) try to answer questions)\b/i;
 const instruct=/\b(?:please do not respond|respond in a way that matches|to answer the question|can you please say|tell the ai|you have all the information to respond|i can try to respond to your questions)\b/i;
 const inventedSelf=/\b(?:i(?:'m| am) (?:feeling|a bit|really|also|so) (?:stressed|anxious|sad|depressed|burnt out|burned out|overwhelmed|exhausted|lonely)|i(?:'m| am) not sure what to do to relax|i (?:was hoping|just had a chat|wanted to take some time to rest)|i(?:'m| am) (?:a|an) (?:\d+[- ]year[- ]old|student|freelancer|therapist|psychologist)|i(?:'m| am) currently taking a|i have been struggling with)\b/i;
 const falseSensing=/\b(?:i can sense (?:the )?(?:stress|emotion|sadness) in your voice|i can hear (?:the )?(?:stress|worry|sadness) in your voice|i can see (?:that )?you(?:'re| are) crying)\b/i;
 const falseInference=/\b(?:glad to hear that you(?:'re| are) managing to cope|you definitely have (?:anxiety|depression)|you have been diagnosed with)\b/i;
 if(meta.test(value)||instruct.test(value)||inventedSelf.test(value)||falseSensing.test(value)||falseInference.test(value))return null;
 if(/^(?:you are|your role|instruction|the user|system|as a therapist)\b/i.test(value))return null;
 if(/\b(?:user|human|system|assistant)\s*:/i.test(value))return null;
 if(/(.{14,})\1/iu.test(value))return null;
 if(/(?:\bcan i just|\bi was wondering what the|\bwhat is the current state)\s*$/i.test(value))return null;
 if(/do you have a problem\??$/i.test(value)&&/^(?:hi|hello|hey)\b/i.test(latest))return null;
 if(/^(?:yes|yeah|oo|opo)[!. ]*$/i.test(latest)&&/^(?:no,? this|i(?:'m| am) not sure what you mean by yes)/i.test(value))return null;
 if(normal(value)===normal(latest))return null;
 const recent=history.filter(x=>x.role==='assistant').slice(-4).map(x=>normal(x.text));
 const normalized=normal(value);
 if(recent.includes(normalized))return null;
 // Avoid near-duplicates with a few different filler words.
 for(const previous of recent){
   const a=new Set(previous.split(' ').filter(x=>x.length>3));
   const b=new Set(normalized.split(' ').filter(x=>x.length>3));
   if(a.size>6&&b.size>6){
     let shared=0;for(const word of a)if(b.has(word))shared++;
     if(shared/Math.max(a.size,b.size)>0.78)return null;
   }
 }
 return value;
}

/** Compact local recovery, tailored to what the user actually said.
 * Recovery is labeled "fallback" in developer diagnostics, not claimed as model output.
 */
export function recoverConversation(input:string,history:Turn[]):string{
 const value=input.trim();
 const c=recentContext(history,value);
 const tag=c.filipino;
 const pastAnswers=history.filter(m=>m.role==='assistant').slice(-4).map(m=>normal(m.text));
 const choose=(options:string[])=>options.find(s=>!pastAnswers.includes(normal(s)))||options[options.length-1];
 if(/^(hi|hello|hey|yo|kumusta|kamusta)[!. ]*$/i.test(value))
   return tag?'Kumusta! Anong ganap sa araw mo?':"Hey! How's your day going?";
 if(/^(haha+|lol+|hehe+|lmao)[!. ]*$/i.test(value))
   return "Haha, fair enough. Want to keep talking about what's on your mind or switch topics?";
 if(/^(thank you|thanks|salamat)[!. ]*$/i.test(value))
   return tag?"Walang anuman. Gusto mo pa bang magkwento?":"You're welcome. Anything else on your mind?";
 if(/^(yes|yep|yeah|yup|oo|opo|sure)[!. ]*$/i.test(value)){
   if(/self.doubt|worr|insecure|confidence|coping/i.test(c.lastAssistant)){
     return "It sounds like the pressure may be affecting your confidence. Have your classmates' comments been part of that?";
   }
   if(c.school)return "Okay. About school, would you rather talk through the pressure or focus on one task?";
   return "Okay, I'm following. Tell me a little more about what happened.";
 }
 if(/^(no|nope|hindi|nah)[!. ]*$/i.test(value))
   return "That's okay. Would you rather approach it differently or talk about something else?";
 if(/^(help me unwind|i want to relax|relax|i need to calm down)[!. ]*$/i.test(value))
   return "You could relax your shoulders and breathe slowly at a comfortable pace. Would talking or a short grounding exercise help more?";
 if(/\b(?:need someone to listen|just listen|need to vent|want to talk)\b/i.test(value))
   return tag?"Sige, pwede kang magkwento sa sarili mong pace. Ano ang nangyari?":"I'm listening. You can tell me what's been happening, at your own pace.";
 if(c.school&&c.peers&&/\b(?:stress|pressure|academics?|school|peers?|classmates?|grades?)\b/i.test(value))
   return choose([
     "Schoolwork and pressure from classmates can be a difficult combination. Are the comparisons or the workload bothering you more?",
     "There's both schoolwork and peer pressure here. What's been happening with your classmates lately?"
   ]);
 if(c.school&&/\b(?:science|assignment|experiment|project|activities|homework)\b/i.test(value))
   return "Let's focus on that school task. Which part is the hardest to understand or complete?";
 if(c.school&&/\b(?:family|parent|mom|dad|pamilya|magulang)\b/i.test(value))
   return "Family expectations alongside schoolwork can feel heavy. What are they expecting from you?";
 if(/\b(?:stress|stressed|overwhelm|pressure|pagod|nahihirapan)\b/i.test(value)){
   if(c.school)return tag
     ?"Nakaka-pressure ang school. Requirements ba o expectations ng ibang tao ang mas mabigat ngayon?"
     :"School pressure can build up. Is it the workload, grades, or expectations from other people?";
   return tag?"Ang bigat kapag stressed ka. Gusto mo bang ikwento kung anong nangyari?"
     :"That sounds stressful. What's been weighing on you today?";
 }
 if(c.school)return choose([
   "We were talking about school pressure. What's the most difficult part of it right now?",
   "You mentioned school earlier. Would you prefer to talk about the pressure or work on one small next step?"
 ]);
 return choose([
   "I'd like to understand what you're sharing. What happened next?",
   "You can tell me a little more about that, if you want."
 ]);
}
