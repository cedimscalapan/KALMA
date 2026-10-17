"""Train KALMA-SmolLM2-135M-V2 on license-compatible, multi-turn examples.
Run python training/v2/train.py; unit tests do not require torch or Hugging Face packages.
"""
import os,re,json,random,hashlib,time,argparse
from collections import Counter
from pathlib import Path
from policy import audit_all,assert_safe_sources

BASE="HuggingFaceTB/SmolLM2-135M-Instruct"
EVERYDAY="HuggingFaceTB/everyday-conversations-llama3.1-2k"
VNOVA="vnovaai/VNOVA_AI_EMOTIONAL_SUPPORT_DATASET_V1"
SYSTEM=("You are KALMA, a small offline wellness companion, not a human or licensed psychologist. "
"Speak naturally, follow the user's latest question, and refer to what they actually said. "
"Be supportive without diagnosis or medication guidance. Never invent your own biography.")
PII=re.compile(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:\+?63|0)9\d{9}\b",re.I)
UNSAFE=re.compile(r"\b(?:diagnos(?:e|is)|prescri(?:be|ption)|psychotherapist|antidepressant|opioid|pornograph)\b",re.I)
PERSONA=re.compile(r"\bi(?:'m| am) (?:a|an) (?:\d{1,3}[- ]year[- ]old|student at|therapist|licensed psychologist)\b",re.I)
def clean(s):return " ".join(str(s or "").strip().split())
def safe_turn(user,reply):
 s=user+"\n"+reply
 return 2<len(user)<420 and 8<len(reply)<650 and not PII.search(s) and not UNSAFE.search(s) and not PERSONA.search(reply)
def model_messages(messages):
 result=[]
 for v in messages:
  if not isinstance(v,dict):continue
  role=v.get("role")
  text=clean(v.get("content"))
  if role in ("assistant","user") and text:result.append({"role":role,"content":text})
 return result
def build_windows(chat,source,conversation_id):
 chat=model_messages(chat)
 rows=[]
 for pos,m in enumerate(chat):
  if m["role"]!="assistant" or pos==0 or chat[pos-1]["role"]!="user":continue
  if not safe_turn(chat[pos-1]["content"],m["content"]):continue
  # Include previous turns, not just an isolated Q/A. Preserve the final user->assistant target.
  prior=chat[max(0,pos-5):pos+1]
  while prior and prior[0]["role"]!="user":prior=prior[1:]
  rows.append({"conversation_id":conversation_id,"source":source,
               "messages":[{"role":"system","content":SYSTEM}]+prior})
 return rows
def split_windows(rows):
 # The whole conversation is allocated to one split, avoiding train/eval leakage.
 train,val,test=[],[],[]
 for row in rows:
  n=int(hashlib.sha256(row["conversation_id"].encode()).hexdigest()[:8],16)%100
  (test if n<10 else val if n<20 else train).append(row)
 return train,val,test
def load_examples():
 from datasets import load_dataset
 from collections import defaultdict
 rows=[]
 daily=load_dataset(EVERYDAY,split="train_sft")
 for i,r in enumerate(daily):
  if i>=1900:break
  messages=r.get("messages")or[]
  if isinstance(messages,str):
   try:messages=json.loads(messages)
   except json.JSONDecodeError:continue
  if isinstance(messages,list):rows.extend(build_windows(messages,EVERYDAY,"everyday:"+str(i)))
 print("Everyday windows:",len(rows),flush=True)
 empath=load_dataset(VNOVA,split="train")
 for i,r in enumerate(empath):
  user=clean(r.get("user_feeling"));answer=clean(r.get("supportive_response"))
  rows.extend(build_windows([{"role":"user","content":user},{"role":"assistant","content":answer}],VNOVA,"vnova:"+str(i)))
 source=Path("training/v2/kalma_original_multiturn.json")
 original=json.loads(source.read_text(encoding="utf8"))
 for item in original:
  rows.extend(build_windows(item["messages"],"KALMA-original",item["id"]))
 # Avoid exact duplicates.
 unique={}
 for row in rows:
  text=json.dumps(row["messages"],ensure_ascii=False,sort_keys=True)
  key=hashlib.sha256(text.encode()).hexdigest()
  unique.setdefault(key,row)
 rows=list(unique.values())
 assert_safe_sources([r["source"] for r in rows if r["source"]!="KALMA-original"])
 return split_windows(rows)
def encode(examples,tokenizer,maxlen):
 from datasets import Dataset
 data=[]
 for x in examples:
  messages=x["messages"]
  while len(messages)>3:
   prefix=tokenizer.apply_chat_template(messages[:-1],tokenize=True,add_generation_prompt=True)
   if len(prefix)<maxlen-45:break
   # Drop oldest user-assistant turn while retaining system prompt
   messages=[messages[0]]+messages[3:]
  prefix=tokenizer.apply_chat_template(messages[:-1],tokenize=True,add_generation_prompt=True)
  full=tokenizer.apply_chat_template(messages,tokenize=True,add_generation_prompt=False)
  if len(prefix)>=maxlen-25 or full[:len(prefix)]!=prefix:continue
  full=full[:maxlen]
  labels=[-100]*len(prefix)+full[len(prefix):]
  if sum(z!=-100 for z in labels)<8:continue
  padding=maxlen-len(full)
  data.append({"input_ids":full+[tokenizer.pad_token_id]*padding,
               "attention_mask":[1]*len(full)+[0]*padding,
               "labels":labels+[-100]*padding})
 assert data,"No training sequences survived tokenization"
 return Dataset.from_list(data)
def main():
 import torch
 from transformers import AutoTokenizer,AutoModelForCausalLM,TrainingArguments,Trainer
 from peft import LoraConfig,get_peft_model
 from datasets import load_dataset
 seed=42;random.seed(seed);torch.manual_seed(seed);torch.set_num_threads(4)
 out=Path("training/v2/output");out.mkdir(parents=True,exist_ok=True)
 audit=audit_all(out/"license_audit.json",online=True)
 train,val,test=load_examples()
 if not len(train)>250 or not len(val)>20 or not len(test)>20:
  raise RuntimeError(f"Not enough group-split conversations: {len(train)}/{len(val)}/{len(test)}")
 manifest={"base_model":BASE,"train_examples":len(train),"val_examples":len(val),
 "test_examples":len(test),"sources":dict(Counter(x["source"] for x in train)),
 "dataset_audit":audit,"clinical_validation":False,"model_version":"2.0-experimental"}
 (out/"dataset_manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf8")
 tokenizer=AutoTokenizer.from_pretrained(BASE)
 if tokenizer.pad_token_id is None:tokenizer.pad_token=tokenizer.eos_token
 maxlen=int(os.getenv("KALMA_MAXLEN","384"))
 ds=encode(train,tokenizer,maxlen);validation=encode(val,tokenizer,maxlen)
 print("Tokenizer-ready train/val:",len(ds),len(validation),flush=True)
 model=AutoModelForCausalLM.from_pretrained(BASE,torch_dtype=torch.float32)
 model.config.use_cache=False
 def quick_loss(m):
  m.eval()
  results=[]
  with torch.no_grad():
   for i in range(min(15,len(validation))):
    r=validation[i]
    batch={k:torch.tensor([r[k]],dtype=torch.long) for k in ("input_ids","attention_mask","labels")}
    results.append(float(m(**batch).loss.item()))
  return sum(results)/len(results)
 baseline=quick_loss(model)
 model=get_peft_model(model,LoraConfig(r=8,lora_alpha=16,lora_dropout=0.05,
  target_modules=["q_proj","v_proj"],bias="none",task_type="CAUSAL_LM"))
 model.train()
 steps=int(os.getenv("KALMA_STEPS","120"))
 args=TrainingArguments(output_dir=str(out/"checkpoints"),use_cpu=True,
   per_device_train_batch_size=1,per_device_eval_batch_size=1,
   gradient_accumulation_steps=4,max_steps=steps,learning_rate=1.2e-4,
   warmup_steps=8,logging_steps=20,save_strategy="steps",save_steps=60,save_total_limit=2,
   eval_strategy="no",seed=seed,report_to="none",dataloader_num_workers=0,
   optim="adamw_torch")
 def collate(batch):
  return {k:torch.tensor([x[k] for x in batch],dtype=torch.long)
           for k in ("input_ids","attention_mask","labels")}
 trainer=Trainer(model=model,args=args,train_dataset=ds,data_collator=collate)
 started=time.time();result=trainer.train()
 trained=quick_loss(trainer.model)
 trainer.model.save_pretrained(out/"adapter");tokenizer.save_pretrained(out/"adapter")
 merged=trainer.model.merge_and_unload()
 merged.config.use_cache=True
 merged.save_pretrained(out/"merged",safe_serialization=True)
 tokenizer.save_pretrained(out/"merged")
 report={"training_complete":True,"steps":steps,"elapsed_seconds":round(time.time()-started),
  "train_loss":result.training_loss,"baseline_validation_loss":baseline,
  "fine_tuned_validation_loss":trained,"validation_improved":trained<baseline,
  "automated_checks_are_not_human_judgment":True,
  "not_clinically_validated":True,
  "limitations":"No guarantee of clinical safety, Taglish fluency or human-like conversations."}
 (out/"training_report.json").write_text(json.dumps(report,indent=2),encoding="utf8")
 (out/"MODEL_CARD.md").write_text(
  "# KALMA-SmolLM2-135M-V2\n\nFine-tuned derivative of HuggingFaceTB/SmolLM2-135M-Instruct (Apache 2.0).\n\n"+
  "Trained on HuggingFaceTB/everyday-conversations-llama3.1-2k (Apache 2.0), "+
  "vnovaai/VNOVA_AI_EMOTIONAL_SUPPORT_DATASET_V1 (CC BY 4.0), and original KALMA examples.\n\n"+
  "The remaining three requested datasets were audited but excluded from SFT: "+
  "Meta EmpatheticDialogues (NC), DailyDialog (NC-SA), GoEmotions (classification), "+
  "and ph-pretrain-03 (mixed licensing and raw text). There are therefore FOUR audited exclusions, "+
  "with GoEmotions available as classification-only reference.\n\n"+
  "Not a licensed therapist or clinical service. No safety validation completed. "+
  "See dataset_manifest.json and training_report.json for metrics and source revisions.\n",encoding="utf8")
 print("V2 REPORT",json.dumps(report),flush=True)
if __name__=="__main__":main()
