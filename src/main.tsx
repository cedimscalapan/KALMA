import React,{useEffect,useMemo,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {IonApp,IonButton,IonTextarea,IonSpinner,setupIonicReact} from '@ionic/react';
import '@ionic/react/css/core.css';
import {Capacitor} from '@capacitor/core';
import {OfflineLLM,ModelInfo} from './native';
import './style.css';
import {guidedResponse} from './conversation';
import {buildReliableRequest,acceptModelReply,recoverConversation} from './chatReliability';
import {routeMessage} from './router';
import {safetyResponse} from './safety';
setupIonicReact();
type Tab='Today'|'Companion'|'Journal'|'Explore'|'Settings';
type Message={role:'user'|'assistant';text:string;time:string;source?:'model'|'guided'|'fallback'|'safety'};
type Entry={text:string;date:string};
type Mood={label:string;icon:string;date:string};
const store=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const prompts=['I need someone to listen','Help me unwind','I want to reflect','I feel overwhelmed'];
const icons:Record<Tab,string>={Today:'✿',Companion:'◉',Journal:'▤',Explore:'◇',Settings:'⚙'};
const moods=[{label:'Great',icon:'✦'},{label:'Good',icon:'☀'},{label:'Okay',icon:'◡'},{label:'Low',icon:'☂'},{label:'Anxious',icon:'〰'}];
function App(){
 const[tab,setTab]=useState<Tab>('Today');
 const[model,setModel]=useState<ModelInfo|null>(null);
 const[messages,setMessages]=useState<Message[]>(()=>store('kalma-messages',[]));
 const[moodHistory,setMoodHistory]=useState<Mood[]>(()=>store('kalma-moods',[]));
 const[entries,setEntries]=useState<Entry[]>(()=>store('kalma-journal',[]));
 const[message,setMessage]=useState('');const[note,setNote]=useState('');
 const[loading,setLoading]=useState(false);const[error,setError]=useState('');const[showSources,setShowSources]=useState(false);
 const[exercise,setExercise]=useState<'breathing'|'grounding'|null>(null);
 const[cycle,setCycle]=useState(0);const threadRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(Capacitor.isNativePlatform())OfflineLLM.getModel().then(r=>setModel(r.model)).catch(e=>setError(String(e)))},[]);
 useEffect(()=>{localStorage.setItem('kalma-messages',JSON.stringify(messages))},[messages]);
 useEffect(()=>{localStorage.setItem('kalma-moods',JSON.stringify(moodHistory))},[moodHistory]);
 useEffect(()=>{localStorage.setItem('kalma-journal',JSON.stringify(entries))},[entries]);
 useEffect(()=>{if(exercise!=='breathing')return;const id=setInterval(()=>setCycle(n=>(n+1)%3),4000);return()=>clearInterval(id)},[exercise]);
 useEffect(()=>{if(tab==='Companion')threadRef.current?.scrollTo({top:threadRef.current.scrollHeight,behavior:'smooth'})},[messages,loading,tab]);
 const latest=moodHistory[0];
 const greeting=useMemo(()=>{const h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening'},[]);
 function chooseMood(m:typeof moods[number]){setMoodHistory(h=>[{...m,date:new Date().toISOString()},...h])}
 async function chooseModel(){setError('');if(!Capacitor.isNativePlatform()){setError('Model importing works in the installed Android app, not the web preview.');return}try{setModel(await OfflineLLM.importModel())}catch(e){setError(String(e))}}
 async function send(text=message){
 const value=text.trim();
 if(!value||loading)return;
 setMessage('');
 const next:Message={role:'user',text:value,time:new Date().toISOString()};
 setMessages(items=>[...items,next]);
 // Safety routing happens before any model-loading or GGUF generation.
 // For short answers after a safety response, preserve the safety pathway.
 const route=routeMessage(value,messages);
 if(route==='safety'){
   setMessages(items=>[...items,{role:'assistant',source:'safety',time:new Date().toISOString(),
     text:safetyResponse(value,messages)}]);
   return;
 }
 // A guided wellness exercise is available offline even if the model is not connected.
 if(route==='guided'){
   const guidance=guidedResponse(value,messages);
   if(guidance){setMessages(items=>[...items,{role:'assistant',text:guidance,time:new Date().toISOString(),source:'guided'}]);return;}
 }
 setLoading(true);setError('');
 try{
   // The Android model may finish initializing after the chat screen is mounted.
   let currentModel=model;
   if(!currentModel&&Capacitor.isNativePlatform()){
     const info=await OfflineLLM.getModel();
     currentModel=info.model;
     if(currentModel)setModel(currentModel);
   }
   if(!currentModel){
     setMessages(items=>[...items,{role:'assistant',source:'fallback',time:new Date().toISOString(),
      text:'No local model is selected yet. Open Settings and choose a downloaded GGUF model to start chatting.'}]);
     return;
   }
   const result=await OfflineLLM.generate(buildReliableRequest(value,messages));
   const generated=acceptModelReply(result.text,value,messages);
   // Reject confused or fabricated output from small local models and recover using known context.
   setMessages(items=>[...items,{role:'assistant',text:generated??recoverConversation(value,messages),
    time:new Date().toISOString(),source:generated?'model':'fallback'}]);
 }catch(e){
   setError('Local model could not generate: '+String(e));
   setMessages(items=>[...items,{role:'assistant',text:recoverConversation(value,messages),
    time:new Date().toISOString(),source:'fallback'}]);
 }finally{setLoading(false)}
 }
 const date=new Intl.DateTimeFormat('en',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
 return <IonApp><div className="shell">
 <header className="topbar"><div className="identity"><div className="mark">✳</div><div><div className="brand">kalma<span>.</span></div><div className="brand-sub">A little space for you</div></div></div><button className="model-status" onClick={()=>setTab('Settings')}><span className={'status-dot '+(model?'connected':'')}/>{model?'Model imported':'Set up AI'} <span>›</span></button></header>
 <main className={'content '+(tab==='Companion'?'chat-content':'')}>
 {tab==='Today'&&<section className="fade"><div className="eyebrow">{date.toUpperCase()}</div><h1 className="headline">{greeting}<span className="period">.</span><br/><em>How's your heart today?</em></h1><p className="lead">You don't have to have it all figured out. Let's take today one moment at a time.</p>
 <div className="mood-panel"><div className="panel-top"><span className="eyebrow">DAILY CHECK-IN</span><span className="tiny">Just for you ♡</span></div><h2>How are you feeling?</h2><div className="mood-options">{moods.map(m=><button className={'mood '+(latest?.date.slice(0,10)===new Date().toISOString().slice(0,10)&&latest.label===m.label?'active':'')} onClick={()=>chooseMood(m)} key={m.label}><span className="mood-icon">{m.icon}</span><span>{m.label}</span></button>)}</div>{latest&&<div className="saved-mood">✓ Today you checked in feeling <b>{latest.label.toLowerCase()}</b></div>}</div>
 <button className="feature-chat" onClick={()=>setTab('Companion')}><div className="small-caps">YOUR PERSONAL SPACE</div><div className="chat-illustration">✿</div><h2>Some things are easier<br/>said out loud.</h2><p>Share what's on your mind with your offline companion.</p><div className="feature-link">Start a conversation <span>↗</span></div></button>
 <div className="section-header"><h2>A moment for yourself</h2><span>TAKE IT SLOW</span></div><div className="quick-grid"><button onClick={()=>{setTab('Explore');setExercise('breathing')}}><div className="quick-symbol">◌</div><b>Just breathe</b><small>A calming 1-minute pause</small><span>↗</span></button><button onClick={()=>setTab('Journal')}><div className="quick-symbol">✎</div><b>Write it out</b><small>Your private daily journal</small><span>↗</span></button></div>
 <div className="quote">“Small steps are still steps.”<span>— A GENTLE REMINDER</span></div></section>}
 {tab==='Companion'&&<section className="chat-screen fade"><div className="page-head"><span className="eyebrow">A SAFE SPACE TO REFLECT</span><h1>Let's talk<span className="period">.</span></h1><p>I'm here to listen, without judgment.</p></div><div className="ai-intro"><div className="ai-avatar">✳</div><div><strong>Kalma companion</strong><span>{model?'Offline model imported':'Import a model to start'}</span></div><div className="private-tag">⌁ Local</div><button className="new-chat" aria-label="Start a new conversation" onClick={()=>{if(window.confirm("Start a fresh conversation? Previous chat messages will be cleared."))setMessages([])}}>New chat</button></div>
 <div className="thread" ref={threadRef} role="log">{messages.length===0&&<><div className="bubble assistant">Hello there! 🌿 You can share whatever is on your mind. What would you like to talk about today?</div><div className="prompt-grid">{prompts.map(p=><button key={p} onClick={()=>send(p)}>{p} <span>↗</span></button>)}</div></>}{messages.map((m,i)=><div key={i} className={'bubble '+(m.role==='user'?'person':'assistant')} >{m.text}{showSources&&m.role==='assistant'&&<span className="response-source">{m.source||'legacy'}</span>}</div>)}{loading&&<div className="bubble assistant"><IonSpinner name="dots"/> Thinking on your device…</div>}</div>
 <div className="composer"><IonTextarea aria-label="Type a message" placeholder="What's on your mind?" autoGrow value={message} onIonInput={e=>setMessage(String(e.detail.value||''))}/><button className="send" disabled={!message.trim()||loading} onClick={()=>send()} aria-label="Send message">↑</button></div><p className="under-composer">Supportive AI, not medical or psychological treatment.</p></section>}
 {tab==='Journal'&&<section className="fade"><div className="eyebrow">YOUR PRIVATE PAGES</div><h1 className="page-title">The journal<span className="period">.</span></h1><p className="lead">A place to put your thoughts into words. No perfect sentences needed.</p><div className="journal-card"><div className="journal-date">✎ &nbsp; {date}</div><h2>What's on your mind?</h2><IonTextarea aria-label="Journal entry" rows={7} value={note} onIonInput={e=>setNote(String(e.detail.value||''))} placeholder="Today, I've been thinking about…"/><button className="primary-button" disabled={!note.trim()} onClick={()=>{setEntries(e=>[{text:note,date:new Date().toISOString()},...e]);setNote('')}}>Save my reflection <span>↗</span></button></div><div className="section-header"><h2>Past reflections</h2><span>{entries.length} ENTRIES</span></div>{entries.length===0?<div className="empty">Your journal begins with one little thought. ♡</div>:entries.map((e,i)=><article className="entry" key={i}><div>{new Date(e.date).toLocaleDateString()}</div><p>{e.text}</p></article>)}</section>}
 {tab==='Explore'&&<section className="fade"><span className="eyebrow">YOUR WELLNESS TOOLKIT</span><h1 className="page-title">Find your calm<span className="period">.</span></h1><p className="lead">Simple exercises for whenever you need a little room to breathe.</p><div className="explore-grid"><button className="explore-card green" onClick={()=>{setExercise('breathing');setCycle(0)}}><span>01 / BREATHE</span><div className="explore-symbol">◎</div><h2>A quiet minute</h2><p>Slow down with a guided breathing pause.</p><b>Start exercise ↗</b></button><button className="explore-card cream" onClick={()=>setExercise('grounding')}><span>02 / GROUND</span><div className="explore-symbol">✺</div><h2>Come back to now</h2><p>A sensory check-in for the present moment.</p><b>Try grounding ↗</b></button></div>{exercise&&<div className="exercise"><button className="close" onClick={()=>setExercise(null)}>Close ✕</button>{exercise==='breathing'?<><span className="eyebrow">BREATHE AT YOUR OWN PACE</span><div className="breathing-orb">{['Breathe in','Breathe out','Rest'][cycle]}</div><p>Follow the rhythm only if it feels comfortable. You can stop any time.</p></>:<><h2>5–4–3–2–1 grounding</h2><p>Name 5 things you can see, 4 you can feel, 3 you can hear, 2 you can smell, and 1 you can taste.</p></>}</div>}</section>}
 {tab==='Settings'&&<section className="fade"><span className="eyebrow">MAKE THIS SPACE YOURS</span><h1 className="page-title">Your settings<span className="period">.</span></h1><p className="lead">Your conversations and reflections stay on this device.</p><div className="settings-card"><span className="eyebrow">LOCAL AI MODEL</span><div className="settings-icon">◈</div><h2>{model?'Your companion is ready':'Bring your own AI'}</h2><p>{model?model.name+' · '+(model.size/1048576).toFixed(1)+' MB':'Choose the .gguf language model you downloaded to enable offline chat.'}</p><button className="primary-button" onClick={chooseModel}>{model?'Change model':'Import GGUF model'} <span>↗</span></button>{model&&<button className="plain-button" onClick={async()=>{try{await OfflineLLM.unloadModel();setModel(null)}catch(e){setError(String(e))}}}>Remove imported model</button>}</div>
 <div className="settings-card white"><span className="eyebrow">DEVELOPER DIAGNOSTICS</span><h2>Response source</h2><p>Check whether each answer came from the downloaded GGUF model, a guided exercise, a safety rule, or a fallback. No message contents are uploaded.</p><button className="list-action" onClick={()=>setShowSources(v=>!v)}>{showSources?"Hide response sources":"Show response sources"} <span>›</span></button></div><div className="settings-card white"><span className="eyebrow">PRIVACY & DATA</span><h2>Keep your space yours</h2><p>Entries and messages are stored in local app data, not uploaded. Data is not encrypted. Avoid shared devices for sensitive notes.</p><button className="list-action" onClick={()=>{if(confirm('Delete all messages on this device?'))setMessages([])}}>Clear conversation history <span>›</span></button><button className="list-action" onClick={()=>{if(confirm('Delete all journal entries and mood check-ins?')){setEntries([]);setMoodHistory([])}}}>Delete wellness records <span>›</span></button></div><div className="disclaimer"><strong>Good to know</strong><p>Kalma is a supportive self-care tool, not a psychologist, counselor, crisis service, or medical device. For urgent support, contact someone you trust or local emergency services.</p></div></section>}
 {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>✕</button></div>}
 </main>
 <nav className="bottom-nav">{(['Today','Companion','Journal','Explore','Settings'] as Tab[]).map(t=><button key={t} className={tab===t?'selected':''} onClick={()=>{setTab(t);setError('')}}><span className="nav-icon">{icons[t]}</span><span>{t}</span></button>)}</nav></div></IonApp>;
}
createRoot(document.getElementById('root')!).render(<App/>);
