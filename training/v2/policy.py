"""KALMA v2 public dataset license audit.
All six sources are catalogued; restrictive sources are NOT silently added to distributed weights.
"""
from pathlib import Path
import json

SOURCES = [
    {"id":"HuggingFaceTB/everyday-conversations-llama3.1-2k","license":"apache-2.0","use":"sft","status":"allowed","notes":"Synthetic English multi-turn SFT."},
    {"id":"vnovaai/VNOVA_AI_EMOTIONAL_SUPPORT_DATASET_V1","license":"cc-by-4.0","use":"sft","status":"allowed","notes":"Small synthetic emotional support set; attribution required."},
    {"id":"facebook/empathetic_dialogues","license":"cc-by-nc-4.0","use":"audit_only","status":"excluded","notes":"Noncommercial restrictions. Do not use for distributable/startup weights without permission."},
    {"id":"roskoN/dailydialog","license":"cc-by-nc-sa-4.0","use":"audit_only","status":"excluded","notes":"Noncommercial + share-alike restrictions; no permission on file."},
    {"id":"google-research-datasets/go_emotions","license":"apache-2.0","use":"classification_audit","status":"evaluation_only","notes":"Reddit-derived emotion classification, NOT assistant response supervision."},
    {"id":"jpaulpoliquit/ph-pretrain-03","license":"mixed","use":"audit_only","status":"excluded","notes":"Mixed original copyrights and train-only sources; per-row audit needed before optional language pretraining. Not conversational SFT."}
]
TRAIN_IDS={x["id"] for x in SOURCES if x["use"]=="sft"}
def assert_safe_sources(source_ids):
    if not set(source_ids).issubset(TRAIN_IDS):
        raise ValueError("A dataset is not approved for redistributed SFT weights; check license policy.")
def audit_all(output,online=True):
    report=[]
    for source in SOURCES:
        item=dict(source)
        item["revision"]="not checked"
        if online:
            try:
                from huggingface_hub import HfApi
                info=HfApi().dataset_info(source["id"])
                item["revision"]=info.sha
                card=info.cardData
                item["reported_license"]=str(card.get("license","unknown")) if card is not None else "unknown"
            except Exception as ex:
                item["revision"]="unavailable"
                item["metadata_error"]=str(ex)[:170]
        report.append(item)
    data={"uses_all_six_for_training":False,
      "why":"Noncommercial and mixed-license sources are intentionally excluded from downloadable model training; GoEmotions is labels, not conversation output.",
      "commercial_use_cleared_by_dataset_audit":False,
      "human_review_required":True,
      "sources":report}
    Path(output).parent.mkdir(parents=True,exist_ok=True)
    Path(output).write_text(json.dumps(data,indent=2),encoding="utf8")
    return data
if __name__=="__main__":
    audit_all("training/v2/output/license_audit.json")
