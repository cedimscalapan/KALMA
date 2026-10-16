import {registerPlugin} from '@capacitor/core';
export type ModelInfo={name:string;size:number;path:string};
export interface OfflineLLMPlugin {
 importModel():Promise<ModelInfo>;
 getModel():Promise<{model:ModelInfo|null}>;
 unloadModel():Promise<void>;
 generate(opts:{prompt:string;systemPrompt:string;maxTokens:number}):Promise<{text:string}>;
}
export const OfflineLLM=registerPlugin<OfflineLLMPlugin>('OfflineLLM');