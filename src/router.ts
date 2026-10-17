/** Distinguish safety, explicit exercises, and ordinary model-powered chat. */
export type ResponseRoute='model'|'guided'|'safety';
export function routeMessage(input:string):ResponseRoute{
 const text=input.trim();
 const urgent=/suicid|kill myself|end my life|hurt myself|self.harm|magpakamatay|saktan ang sarili|harm myself/i;
 if(urgent.test(text))return 'safety';
 if(/^(?:help me unwind|guide me through (?:breathing|grounding)|start (?:breathing|grounding)(?: exercise)?|breathing exercise|grounding exercise)[.! ]*$/i.test(text))return 'guided';
 return 'model';
}
