/** Explicit offline safety and guided routes; normal conversations reach the local model. */
import {isHighRiskMessage,isSafetyFollowUp} from './safety.ts';
export type ResponseRoute='model'|'guided'|'safety';
type PriorTurn={role:string;text:string;source?:string};
export function routeMessage(input:string,history:PriorTurn[]=[]):ResponseRoute{
 const text=input.trim();
 if(isHighRiskMessage(text)||isSafetyFollowUp(text,history))return 'safety';
 if(/^(?:help me unwind|guide me through (?:breathing|grounding)|start (?:breathing|grounding)(?: exercise)?|breathing exercise|grounding exercise)[.! ]*$/i.test(text))return 'guided';
 return 'model';
}
