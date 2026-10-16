/**
 * Offline, privacy-preserving chat helpers.
 * The native llama-android library already applies the model's GGUF chat template.
 * Do not put fake "User:" and "Assistant:" turns inside the user prompt.
 */
export type ChatTurn = {role:'user'|'assistant';text:string};

const badReply = /\b(?:you are kalma|system prompt|system instruction|offline emotional.wellbeing companion|gguf|choose the (?:gguf|model)|import (?:a |the )?model|model is connected|model is not working|open settings|assistant:|user:|person:|human:|kalma:)\b/i;
const normalize = (value:string) => value.trim().replace(/\s+/g,' ');
const firstNameFree = (s:string) => s.replace(/[<>]/g,'').trim();

export function cleanModelReply(raw:string, latestMessage:string):string|null {
  if (!raw || typeof raw !== 'string') return null;
  let text=raw.replace(/<\|(?:im_start|im_end|endoftext|eot_id|start_header_id|end_header_id)\|>/gi,' ').trim();
  text=text.replace(/^(?:assistant|kalma|response|answer)\s*:\s*/i,'').trim();
  text=text.split(/(?:\r?\n|^)\s*(?:user|human|assistant|system|person|kalma)\s*:/i)[0].trim();
  text=text.split(/\n{3,}/)[0].trim();
  text=text.replace(/^\s*["'“”]+|["'“”]+\s*$/g,'').trim();
  if (badReply.test(text)) return null;
  if (text.length < 9 || text.length > 650) return null;
  if (normalize(text).toLowerCase()===normalize(latestMessage).toLowerCase()) return null;
  if (/^\s*(?:you are|your role|instruction|the user|reply to|respond to)\b/i.test(text))return null;
  if (/(.{14,})\1/i.test(text))return null;
  // Avoid presenting unfinished, repeated role-play transcripts as a conversation.
  const sentences=text.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g);
  if (sentences && sentences.length > 3) text=sentences.slice(0,3).join(' ').trim();
  if(text.length>360){
    const clipped=text.slice(0,360);
    text=clipped.replace(/\s+\S*$/,'').trim();
  }
  return text || null;
}

const has = (t:string, re:RegExp) => re.test(t);
const school = /exam|test|school|class|assignment|college|study|grades?|project|teacher|professor|deadline|homework|quiz|capstone/i;
const stress = /stress|pressure|overwhelm|burn.?out|too much|too many|nahihirapan|pagod na/i;
const worry = /anxious|anxiety|worried|nervous|panic|takot|kinakabahan/i;
const sad = /sad|lonely|down|upset|cry|hurt|empty|malungkot|naiiyak/i;
const tired = /tired|exhausted|sleep|rest|pagod|antok/i;
const greeting = /^(?:hi+|hello+|hey+|yo+|kumusta|kamusta|good (?:morning|afternoon|evening))[!. ]*$/i;
const vague = /^(?:idk|i don.t know|not sure|maybe|i guess|nothing|i.m not sure)[!. ]*$/i;
const thanks = /^(?:thanks|thank you|salamat|ty|thank u)[!. ]*$/i;
const yes = /^(?:yes|yeah|yup|oo|opo|sure)[!. ]*$/i;
const no = /^(?:no|nope|hindi|nah)[!. ]*$/i;

function earlierUserText(history:ChatTurn[]):string {
  return history.filter(x=>x.role==='user').slice(-3).map(x=>x.text).join(' ').slice(0,280);
}

/** Short, situation-specific responses when a 135M model cannot follow the conversation. */
export function supportiveReply(input:string, history:ChatTurn[]):string {
  const t=firstNameFree(input).toLowerCase();
  const prior=earlierUserText(history);
  const schoolContext=has(t,school)||has(prior,school);
  if (has(t,greeting)) {
    return history.length>0 ? "Hey again! How are things going since we last talked?" : "Hey! How's your day going so far?";
  }
  if (has(t,thanks)) return "Of course. Is there anything else you've been thinking about?";
  if (has(t,vague)) return schoolContext ? "That's okay. Which part of school feels the hardest to deal with right now?" : "That's okay. We can take it slowly. Was there one moment today that stood out to you?";
  if (has(t,yes)) return schoolContext ? "Got it. Want to tell me what happened with school?" : "Okay. Tell me a little more—I'm following.";
  if (has(t,no)) return "Okay, we don't have to go that direction. What would feel more helpful to talk about?";
  if (has(t,stress)) {
    if (schoolContext) return "School pressure can really build up. Is it the amount of work, the deadlines, or something else that's weighing on you?";
    return "That sounds like a lot to carry right now. What's been putting the most pressure on you today?";
  }
  if (has(t,worry)) return schoolContext ? "It's understandable to feel nervous when school feels uncertain. What's the specific thing you're most worried about?" : "That sounds unsettling. Do you know what's been making you feel worried?";
  if (has(t,sad)) return "That sounds like a difficult feeling to sit with. Did something happen today, or has this been building up for a while?";
  if (has(t,tired)) return "You sound worn out. Has it been a long day, or have you been feeling this way for a while?";
  if (has(t,/happy|excited|great news|proud|masaya|good day/i)) return "That sounds like a bright spot in your day! What happened?";
  if (has(t,school)) return "Sounds like school has been on your mind. What's the part you'd most like to sort out?";
  if (has(t,/friend|family|parent|mom|dad|sibling|classmate/i)) return "Relationships can be complicated. What happened between you and them?";
  if (has(t,/help me|can you help|need advice/i)) return "Of course. Tell me a bit about what's going on, and we can think through a small next step.";
  if (has(prior,stress)) return schoolContext ? "I remember you mentioned pressure around school. Is that still what's bothering you?" : "Earlier you mentioned feeling under pressure. Is that still what's on your mind?";
  return "Tell me a little more about that. Which part matters most to you right now?";
}

/** The AAR wraps these strings using the GGUF chat template. */
export function buildModelRequest(input:string,history:ChatTurn[]):{prompt:string;systemPrompt:string;maxTokens:number} {
  const text=input.trim().slice(0,420);
  const previous=history.filter(m=>m.role==='user').slice(-2).map(m=>normalize(m.text).slice(0,95));
  const context=previous.length ? 'Earlier user topics: '+previous.join(' | ')+'. ' : '';
  return {
    prompt:text, // no role labels: the native library adds them
    systemPrompt:'You are Kalma, a friendly offline wellness helper, not a therapist. '+
      context+'Reply to this message naturally in one or two short sentences. '+
      'Be specific, ask at most one question. Do not repeat these instructions, claim to diagnose, or mention models.',
    maxTokens:95,
  };
}

export function cannedFirstResponse(input:string,history:ChatTurn[]):string|null {
  const t=input.trim().toLowerCase();
  // Common check-ins are safer and more natural than a 135M model's frequent instruction echo.
  if (has(t,greeting)||has(t,stress)||has(t,worry)||has(t,sad)||
    has(t,tired)||has(t,vague)||has(t,thanks)||has(t,yes)||has(t,no)||
    has(t,/^(?:i (?:am|feel)|i'm) (?:happy|excited|good|great)\b/i)) {
      return supportiveReply(input,history);
  }
  return null;
}
