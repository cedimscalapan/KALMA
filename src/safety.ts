/**
 * KALMA offline high-priority safety pathway.
 * These messages must never be passed to unreviewed, on-device generative AI.
 * Conservative phrase matching is a minimum safeguard, not a clinical risk assessment.
 */
export type SafetyTurn={role:string;text:string;source?:string};
const normalize=(value:string)=>value.toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();

// Deliberately catches common ungrammatical variations and Tagalog.
// Keep safety decision separate from the 135M GGUF model.
const concernPatterns=[
 /\b(?:suicid(?:e|al)|self[\s-]?harm|self[\s-]?injur(?:y|ing))\b/i,
 /\b(?:i(?:'m| am)?\s*)?(?:want|wanna|wanting|need|wish|planning|plan)\s+to\s+die\b/i,
 /\bi\s+(?:don't|do not|no longer)\s+want\s+to\s+(?:live|be alive|wake up|exist)\b/i,
 /\b(?:i(?:'m| am)\s+(?:thinking|planning|going)\s+(?:about|of|to)\s+)?(?:kill|hurt|harm|killing|hurting|harming)\s+myself\b/i,
 /\bi(?:'m| am)\s+thinking\s+(?:about|of)\s+(?:hurting|harming|killing)\s+myself\b/i,
 /\b(?:end|take)\s+my\s+(?:own\s+)?life\b/i,
 /\bi\s+(?:wish|hope)\s+i\s+(?:was|were)\s+(?:dead|gone)\b/i,
 /\bi\s+(?:feel\s+like|keep\s+thinking\s+about)\s+(?:dying|not\s+being\s+alive)\b/i,
 /\b(?:i(?:'m| am)\s+afraid\s+i\s+(?:might|will)\s+hurt\s+myself)\b/i,
 /(?:gusto\s+ko\s+(?:nang?|na)\s+)?(?:magpakamatay|mamatay)\b/i,
 /(?:ayoko|hindi\s+ko\s+gusto)\s+(?:nang?|na)?\s*(?:mabuhay|gumising)\b/i,
 /(?:sasaktan|saktan|papatayin)\s+ko\s+(?:ang\s+)?sarili\s+ko\b/i
];
export function isHighRiskMessage(input:string):boolean{
 const s=normalize(input);
 return concernPatterns.some(pattern=>pattern.test(s));
}
const followUp=/^(?:(?:yes|no|yeah|yup|oo|opo|hindi|maybe|still|please|help|okay|ok)[!. ]*|(?:i(?:'m| am) not safe|not safe|i need help|please help me|what should i do|i still feel (?:like that|this way)|it's still happening|it is still happening)[!. ]*)$/i;
export function isSafetyFollowUp(input:string,history:SafetyTurn[]):boolean{
 const last=history.filter(m=>m.role==='assistant').slice(-1)[0];
 if(last?.source!=='safety')return false;
 return followUp.test(normalize(input));
}
export function safetyResponse(input:string,history:SafetyTurn[]):string{
 const follow=isSafetyFollowUp(input,history);
 if(follow)return "Thank you for replying. Please tell a trusted adult or someone nearby who can stay with you, even if it's difficult to explain. If you're in immediate danger, contact local emergency services now. Are you somewhere safe?";
 return "I'm concerned about your safety, and I'm glad you told me. Please reach out to a trusted adult or someone nearby now, and ask them to stay with you. If you might be in immediate danger, contact local emergency services. Are you safe right now?";
}
