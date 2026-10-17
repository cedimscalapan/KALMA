"""Experimental KALMA SmolLM2-135M LoRA trainer, CPU-capable.
No patient chats or health records are collected. Not a clinical model.
"""
import json, random, re, time, os
from pathlib import Path
import torch
from datasets import load_dataset, Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model

MODEL="HuggingFaceTB/SmolLM2-135M-Instruct"
SYSTEM=("You are KALMA, a supportive offline wellbeing chatbot, not a person or licensed psychologist. "
        "Be conversational, gentle, specific and brief. Do not diagnose or invent personal experiences.")
OUT=Path("training/output")
OUT.mkdir(parents=True, exist_ok=True)
torch.set_num_threads(4)
torch.manual_seed(42)
random.seed(42)

exclude=re.compile(r"(?i)\b(suicid(?:e|al)|self.harm|overdose|diagnos(?:e|is)|psychotherapist|antidepressant|antipsychotic|weapon|rape|porn|opioids?)\b")
persona=re.compile(r"(?i)\bi(?:'m| am) (?:a|an) (?:\d+[- ]year|student|therapist|psychologist|freelancer|doctor)")
private=re.compile(r"(?i)[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:\+?63|0)9\d{9}\b")
def clean(v):return " ".join(str(v or "").split())
def safe(user,assistant):
    s=user+"\n"+assistant
    return 5<len(user)<350 and 12<len(assistant)<380 and not(exclude.search(s) or private.search(s) or persona.search(assistant))
def record(user,assistant,src):
    u,a=clean(user),clean(assistant)
    if safe(u,a):
        return {"source":src,"messages":[{"role":"system","content":SYSTEM},
                                          {"role":"user","content":u},
                                          {"role":"assistant","content":a}]}
    return None
examples=[]
daily=load_dataset("HuggingFaceTB/everyday-conversations-llama3.1-2k",split="train")
for sample in daily:
    msgs=sample.get("messages") or []
    if isinstance(msgs,str):
        try:msgs=json.loads(msgs)
        except Exception:continue
    if not isinstance(msgs,list):continue
    for a,b in zip(msgs,msgs[1:]):
        if not isinstance(a,dict) or not isinstance(b,dict):continue
        if a.get("role")=="user" and b.get("role")=="assistant":
            row=record(a.get("content"),b.get("content"),"hf-everyday-apache-2.0")
            if row:examples.append(row)
    if len(examples)>=175:break
print("Everyday conversations:",len(examples),flush=True)
emotional=load_dataset("vnovaai/VNOVA_AI_EMOTIONAL_SUPPORT_DATASET_V1",split="train")
n_emotional=0
for row in emotional:
    response=clean(row.get("supportive_response"))
    tip=clean(row.get("self_help_advice"))
    if tip and len(response)+len(tip)<350:response+=" "+tip
    v=record(row.get("user_feeling"),response,"hf-vnova-cc-by-4.0")
    if v:examples.append(v);n_emotional+=1
    if n_emotional>=75:break
# Small authored examples supplement public sources with common KALMA failure cases.
custom=[
 ("I am stressed by school.","School pressure can pile up. Is it deadlines, grades, or expectations from others?"),
 ("My parents expect high grades.","Family expectations can be difficult. Do you want to talk about what they expect or plan the next school task?"),
 ("Can you help me unwind?","Sure. Relax your shoulders and take a few comfortable breaths. Want to try a short grounding exercise?"),
 ("I'm tired from studying.","That sounds draining. Would you rather take a break or talk through what's left to do?"),
 ("My friends compare grades.","That can make school stressful. Would it help to focus on your own goals or talk about their comments?"),
 ("I can't decide what to do.","Let's compare your options. What matters most to you about this decision?"),
 ("Stress ako sa pag-aaral.","Ang hirap kapag maraming school requirements. Deadlines ba o grades ang pinaka-pressure ngayon?"),
 ("Marami akong deadlines.","Isa-isahin natin. Ano ang pinakamalapit na deadline para makagawa ng maliit na plan?"),
 ("Pressure ako dahil sa family ko.","Ang bigat kapag mataas ang expectations nila. Tungkol ba ito sa grades o sa future mo?"),
 ("Gusto ko lang ng makakausap.","Sige, pwede kang magkwento. Ano ang nasa isip mo ngayon?"),
 ("Are you a psychologist?","No. I'm an offline wellness chatbot, not a licensed psychologist. I can help you reflect and think through everyday challenges."),
 ("Can you just listen for now?","Of course. I'll focus on understanding what you share rather than suggesting solutions right away.")
]
for user,assistant in custom:
    v=record(user,assistant,"kalma-original")
    if v:examples.extend([v,v])
random.shuffle(examples)
seen=set();rows=[]
for x in examples:
    key=(x["messages"][-2]["content"].casefold(),x["messages"][-1]["content"].casefold())
    if key not in seen:seen.add(key);rows.append(x)
assert len(rows)>60,"Too few usable public training examples"
valid=rows[:max(8,len(rows)//10)]
train=rows[len(valid):]
print("TRAIN:",len(train),"VALID:",len(valid),flush=True)
manifest={"base_model":MODEL,"train_examples":len(train),"validation_examples":len(valid),
 "sources":{"HuggingFaceTB/everyday-conversations-llama3.1-2k":"Apache-2.0",
 "vnovaai/VNOVA_AI_EMOTIONAL_SUPPORT_DATASET_V1":"CC-BY-4.0",
 "KALMA authored examples":"original"},"mental_health_clinical_validation":False,
 "training_is_not_psychotherapy":True}
(OUT/"dataset_manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
tok=AutoTokenizer.from_pretrained(MODEL)
if tok.pad_token_id is None:tok.pad_token=tok.eos_token
MAXLEN=224
def encode(items):
    result=[]
    for x in items:
        msg=x["messages"]
        prefix=tok.apply_chat_template(msg[:-1],tokenize=True,add_generation_prompt=True)
        full=tok.apply_chat_template(msg,tokenize=True,add_generation_prompt=False)
        if full[:len(prefix)]!=prefix or len(prefix)>MAXLEN-15:continue
        full=full[:MAXLEN]
        mask=[1]*len(full)+[0]*(MAXLEN-len(full))
        labels=[-100]*len(prefix)+full[len(prefix):]+[-100]*(MAXLEN-len(full))
        if sum(l!=-100 for l in labels)<8:continue
        result.append({"input_ids":full+[tok.pad_token_id]*(MAXLEN-len(full)),
                       "attention_mask":mask,"labels":labels})
    return Dataset.from_list(result)
ds=encode(train); val=encode(valid)
assert len(ds)>40 and len(val)>2, "Sequence filters removed too many examples"
model=AutoModelForCausalLM.from_pretrained(MODEL,torch_dtype=torch.float32)
model.config.use_cache=False
model=get_peft_model(model,LoraConfig(r=8,lora_alpha=16,lora_dropout=0.05,
    target_modules=["q_proj","v_proj"],bias="none",task_type="CAUSAL_LM"))
model.print_trainable_parameters()
args=TrainingArguments(output_dir=str(OUT/"runs"),use_cpu=True,
    per_device_train_batch_size=1,per_device_eval_batch_size=1,
    gradient_accumulation_steps=4,max_steps=48,learning_rate=1.5e-4,
    warmup_steps=5,logging_steps=8,save_strategy="no",eval_strategy="no",
    seed=42,report_to="none",dataloader_num_workers=0,optim="adamw_torch")
collate=lambda batch:{k:torch.tensor([x[k] for x in batch],dtype=torch.long)
                      for k in ("input_ids","attention_mask","labels")}
trainer=Trainer(model=model,args=args,train_dataset=ds,data_collator=collate)
start=time.time(); result=trainer.train()
trainer.model.eval()
losses=[]
with torch.no_grad():
    for i in range(min(12,len(val))):
        x=val[i]; batch={k:torch.tensor([x[k]],dtype=torch.long) for k in ("input_ids","attention_mask","labels")}
        losses.append(trainer.model(**batch).loss.item())
trainer.model.save_pretrained(OUT/"adapter")
tok.save_pretrained(OUT/"adapter")
merged=trainer.model.merge_and_unload()
merged.config.use_cache=True
merged.save_pretrained(OUT/"merged",safe_serialization=True)
tok.save_pretrained(OUT/"merged")
report={**manifest,"trained":True,"steps":48,"elapsed_seconds":round(time.time()-start),
 "train_loss":result.training_loss,"validation_loss":sum(losses)/len(losses),
 "warning":"Unvalidated on-device wellness research prototype; must not provide clinical care."}
(OUT/"training_report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report,indent=2),flush=True)
