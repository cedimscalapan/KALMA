import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from policy import SOURCES,TRAIN_IDS,assert_safe_sources,audit_all
from train import build_windows,split_windows,safe_turn,model_messages

class DatasetTests(unittest.TestCase):
 def test_sources_all_six(self):self.assertEqual(len(SOURCES),6)
 def test_restricted_blocked(self):
  with self.assertRaises(ValueError):assert_safe_sources(["facebook/empathetic_dialogues"])
  with self.assertRaises(ValueError):assert_safe_sources(["roskoN/dailydialog"])
 def test_allowed(self):assert_safe_sources(["HuggingFaceTB/everyday-conversations-llama3.1-2k"])
 def test_no_real_people_pii(self):self.assertFalse(safe_turn("Contact me at test@example.com","Hello"))
 def test_multiturn_windows(self):
  records=[{"role":"user","content":"I'm stressed about school."},{"role":"assistant","content":"What's been hard about school?"},{"role":"user","content":"My science assignment."},{"role":"assistant","content":"What's confusing about it?"}]
  samples=build_windows(records,"test-source","abc")
  self.assertEqual(len(samples),2)
  self.assertEqual(samples[-1]["messages"][-3]["content"],"What's been hard about school?")
  self.assertEqual(samples[-1]["messages"][-2]["content"],"My science assignment.")
 def test_group_split_no_leak(self):
  rows=[{"conversation_id":str(i),"messages":[{"role":"user","content":"hi there"},{"role":"assistant","content":"hello there"}]} for i in range(200)]
  splits=split_windows(rows)
  ids=[{r["conversation_id"] for r in part} for part in splits]
  self.assertFalse(ids[0]&ids[1] or ids[0]&ids[2] or ids[1]&ids[2])
 def test_audit_excludes_nc(self):
  v=audit_all("/tmp/kalma-v2-license-test.json",online=False)
  self.assertFalse(v["uses_all_six_for_training"])
  self.assertEqual(sum(x["status"]=="excluded" for x in v["sources"]),3)

if __name__=="__main__":unittest.main()
