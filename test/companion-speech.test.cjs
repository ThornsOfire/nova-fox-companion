const test=require('node:test');const assert=require('node:assert/strict');const {EventEmitter}=require('node:events');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {CompanionSpeech,generateSpeech,shortQuip,wav}=require('../src/core/companion-speech.cjs');
const {CompanionVoice}=require('../src/renderer/companion-voice.js');
async function fixture(t,request){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nova-speech-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const settings={companionVoiceProvider:'cloud',companionVoiceMuted:false,companionRemarks:true,overlayEnabled:true,companionSpeechDailyRequests:1,companionSpeechVoice:'marin'};
 const service=new CompanionSpeech({directory,keys:{read:async()=>'test-key'},getSettings:()=>settings,request});await service.load();return {service,settings,directory};}
test('speech admits only short one-liners; no status text or long passages',()=>{
 assert.equal(shortQuip('Tiny paws. Big plans.'),true);assert.equal(shortQuip('a'.repeat(91)),false);
 assert.equal(shortQuip(Array(13).fill('fox').join(' ')),false);
 const audio=wav(Buffer.alloc(2400));assert.equal(audio.toString('ascii',0,4),'RIFF');assert.equal(audio.length,2444);
});
test('cloud speech obeys mute/provider gates and preserves its daily cap across restart',async t=>{
 let calls=0;const f=await fixture(t,async()=>{calls++;return wav(Buffer.alloc(200));});
 f.settings.companionVoiceMuted=true;assert.ok((await f.service.speak({id:'1',quip:'Hi!'})).skipped);
 f.settings.companionVoiceMuted=false;assert.ok((await f.service.speak({id:'status',text:'Working'})).skipped);
 assert.match((await f.service.speak({id:'1',quip:'Hello!'})).audio,/^data:audio\/wav;base64,/);assert.equal(calls,1);
 const next=new CompanionSpeech({directory:f.directory,keys:f.service.keys,getSettings:()=>f.settings,request:()=>assert.fail()});await next.load();
 assert.match((await next.speak({id:'2',quip:'Hello!'})).skipped,/Daily/);
});
test('cancelled speech is discarded; provider failures never leak credentials',async t=>{
 let finish;const f=await fixture(t,()=>new Promise(r=>finish=r));
 const pending=f.service.speak({id:'1',quip:'Tiny paws.'});while(!finish)await new Promise(r=>setImmediate(r));
 f.service.cancel();finish(Buffer.alloc(8));assert.ok((await pending).skipped);
});
test('Realtime adapter buffers complete audio and checks the full spoken transcript',async()=>{
 let sent=[];
 class Socket extends EventEmitter {
  constructor(url,options){super();assert.match(url,/gpt-realtime-2.1-mini/);assert.equal(options.headers.Authorization,'Bearer fake');queueMicrotask(()=>this.emit('open'));}
  send(raw){const e=JSON.parse(raw);sent.push(e);if(e.type==='session.update')queueMicrotask(()=>this.emit('message',Buffer.from('{"type":"session.updated"}')));
   if(e.type==='response.create')queueMicrotask(()=>{this.emit('message',Buffer.from(JSON.stringify({type:'response.output_audio.delta',delta:Buffer.alloc(4800).toString('base64')})));
    this.emit('message',Buffer.from(JSON.stringify({type:'response.done',response:{status:'completed',output:[{content:[{transcript:'Tiny paws!'}]}]}})));});}
  terminate(){this.emit('close');}
 }
 const audio=await generateSpeech({key:'fake',text:'Tiny paws.',voice:'marin',Socket});assert.equal(audio.length,4844);assert.equal(sent[1].response.input[0].content[0].text,'Tiny paws.');
 await assert.rejects(generateSpeech({key:'fake',text:'Different words.',voice:'marin',Socket}),/complete line/);
});
test('renderer holds local utterances alive and cancels only on a mute transition',()=>{
 let cancellations=0;const voice=new CompanionVoice({synthesis:{speak:()=>{},cancel:()=>cancellations++},createUtterance:text=>({text}),now:()=>0});
 voice.setMuted(false);voice.offer({id:'1',quip:'An entire line.',expiresAt:100});assert.equal(voice.activeUtterance.text,'An entire line.');
 voice.setMuted(true);voice.setMuted(true);assert.equal(cancellations,1);assert.equal(voice.activeUtterance,null);
});
test('renderer buffers cloud playback once and mute interrupts active audio',async()=>{
 let pauses=0,plays=0;const voice=new CompanionVoice({requestSpeech:async()=>({audio:'data:audio/wav;base64,AAAA'}),createAudio:()=>({play(){plays++;return Promise.resolve();},pause(){pauses++;this.onpause?.();}}),synthesis:null,now:()=>0});
 voice.configure({companionVoiceProvider:'cloud'});voice.setMuted(false);
 assert.equal(voice.offer({id:'1',quip:'Tiny paws.',expiresAt:100}),true);await new Promise(r=>setImmediate(r));
 assert.equal(plays,1);assert.equal(voice.busy,true);voice.setMuted(true);assert.equal(pauses,1);
});
