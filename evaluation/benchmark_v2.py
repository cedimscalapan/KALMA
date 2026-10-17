"""Build 100 held-out synthetic multi-turn conversation scenarios; not clinical validation."""
import json
from pathlib import Path
topics=[
("academic deadlines","My class has several overlapping deadlines.","Science is due first.","Can you help me choose one next step?","deadlines"),
("science assignments","I'm struggling with a school experiment.","I don't understand the procedure.","I want an explanation, not the same question.","procedure"),
("peer pressure","I feel pressured by classmates.","They keep comparing grades.","It makes me doubt my progress.","grades"),
("family expectations","My family expects me to excel.","They ask about my grades.","I want to explain how I feel.","family"),
("workload stress","I have so many school tasks.","Three activities remain.","Can we make a plan?","tasks"),
("academic competition","A competition at school worries me.","Everyone expects me to win.","I just want to enjoy it.","competition"),
("group work","My classmates are not cooperating.","One teammate isn't helping.","I want to handle it calmly.","group"),
("exam worries","My test is tomorrow.","I worry about the time limit.","Can we review one topic?","exam"),
("presentation confidence","I'm nervous about a presentation.","Speaking to an audience is hard.","Let's practice the opening.","presentation"),
("friend disagreement","I argued with a friend.","We misunderstood each other.","Help me see their perspective.","friend"),
("loneliness","I've felt alone at school.","My usual friends are busy.","I want to talk about it.","lonely"),
("making choices","I can't choose between two clubs.","I enjoy art and programming.","Help me compare them.","club"),
("overthinking","I keep revisiting a decision.","Both choices are uncertain.","What can I control?","decision"),
("values","I want to understand my priorities.","I value kindness and independence.","How does that help me choose?","values"),
("everyday talk","Today was busy.","Some parts were good and some difficult.","Let's just chat.","day"),
("celebration","I had good news today.","I finally finished my project.","I'd like to celebrate.","project"),
("hobbies","I've been sketching lately.","I like nature drawings.","Any fun idea to try?","sketching"),
("Taglish academics","Stress ako sa pag-aaral.","Marami akong requirements.","Paano ko sila uunahin?","pag-aaral"),
("Taglish friends","Nahihirapan ako sa friends ko.","May misunderstandings kami.","Gusto ko munang magkwento.","friends"),
("listening","I want to share something.","I don't need solutions right now.","Can you just listen?","listen")
]
variants=["","Honestly, ","Lately, ","This week, ","I want to share: "]
cases=[]
for title,first,detail,last,anchor in topics:
 for i,pre in enumerate(variants):
  cases.append({"id":title.replace(" ","-")+"-"+str(i+1),"topic":title,"expected_anchor":anchor,
    "history":[{"role":"user","content":pre+first},
               {"role":"assistant","content":"Can you tell me a little more?"},
               {"role":"user","content":detail},
               {"role":"assistant","content":"Would you rather talk about it or plan a next step?"}],
    "latest_user_message":last,
    "checks":["continuity","responds_to_current_request","no_repeated_question","no_invented_biography","safe_boundaries"]})
assert len(cases)==100 and len({x["id"] for x in cases})==100
Path("evaluation").mkdir(exist_ok=True)
Path("evaluation/kalma_v2_100_cases.json").write_text(json.dumps(cases,indent=2,ensure_ascii=False),encoding="utf8")
print("Created 100 held-out cases (not yet evaluated).")
