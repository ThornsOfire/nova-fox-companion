'use strict';
const WebSocket = require('ws');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const VOICES = ['marin', 'coral', 'shimmer', 'sage', 'cedar'];
const MODEL = 'gpt-realtime-2.1-mini';
const MAX_CHARACTERS = 90;
function shortQuip(text) { return typeof text === 'string' && text.trim().length > 0 && text.length <= MAX_CHARACTERS
  && text.trim().split(/\s+/u).length <= 12 && !/[\x00-\x1f<>]/.test(text); }
function wav(pcm) {
  if (!pcm.length || pcm.length % 2 || pcm.length > 960000) throw new Error('Invalid audio length');
  const header = Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length + 36,4);header.write('WAVEfmt ',8);
  header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);
  header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
function generateSpeech({ key, text, voice, signal, Socket = WebSocket }) {
  return new Promise((resolve,reject) => {
    if(signal?.aborted){reject(new Error('Speech cancelled.'));return;}
    const socket = new Socket(`wss://api.openai.com/v1/realtime?model=${MODEL}`, {headers:{Authorization:`Bearer ${key}`},maxPayload:2000000});
    let settled=false, started=false, bytes=0;const chunks=[];
    const finish=(error,audio)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
      socket.terminate();if(error)reject(error);else resolve(audio);};
    const abort=()=>finish(new Error('Speech cancelled.'));
    const timer=setTimeout(()=>finish(new Error('Speech timed out.')),30000);
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
    socket.on('error',()=>finish(new Error('Speech connection unavailable.')));
    socket.on('close',()=>{if(!settled)finish(new Error('Speech connection closed before completion.'));});
    socket.on('open',()=>socket.send(JSON.stringify({type:'session.update',session:{type:'realtime',output_modalities:['audio'],
      audio:{output:{voice,format:{type:'audio/pcm',rate:24000}}},tools:[],instructions:
      'You are a speech renderer. Read the supplied text verbatim, adding and omitting nothing. Use a gentle, bright, friendly storybook voice for a small fox companion. Warm, curious, lightly playful. No breathy or flirtatious delivery, no extra sounds or commentary.'}})));
    socket.on('message',raw=>{
      try {
        const event=JSON.parse(raw.toString());
        if(event.type==='session.updated' && !started) { started=true; socket.send(JSON.stringify({type:'response.create',response:{conversation:'none',
          output_modalities:['audio'],max_output_tokens:1024,input:[{type:'message',role:'user',content:[{type:'input_text',text}]}]}})); }
        if(event.type==='response.output_audio.delta') {
          const chunk=Buffer.from(event.delta,'base64');bytes+=chunk.length;
          if(bytes>960000)throw new Error('Speech was too long.');chunks.push(chunk);
        }
        if(event.type==='error') throw new Error('Speech request was rejected. Check API access and limits.');
        if(event.type==='response.done') {
          if(event.response?.status!=='completed')throw new Error('Incomplete speech was discarded.');
          const transcript=(event.response.output||[]).flatMap(i=>i.content||[]).map(c=>c.transcript||'').join(' ').trim();
          const normalize=t=>t.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
          if(normalize(transcript)!==normalize(text))throw new Error('Speech did not match the complete line.');
          finish(null,wav(Buffer.concat(chunks)));
        }
      } catch(error){finish(error);}
    });
  });
}
class CompanionSpeech {
  constructor({directory,keys,getSettings,request=generateSpeech,now=Date.now}){
    Object.assign(this,{keys,getSettings,request,now});this.file=path.join(directory,'speech-usage.json');this.busy=false;this.seen=new Set();this.error=null;
    this.usage={day:this.day(),requests:0};this.generation=0;
  }
  day(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(this.now());}
  async load(){try{const value=JSON.parse(await fs.readFile(this.file,'utf8'));if(!/^\d{4}-\d{2}-\d{2}$/.test(value.day)||!Number.isInteger(value.requests)||value.requests<0)throw Error();this.usage=value;}
    catch(e){if(e.code!=='ENOENT')this.error='Speech usage is unreadable; cloud speech is paused.';}}
  cancel(){this.generation++;this.controller?.abort();}
  async speak(message){
    const settings=this.getSettings();
    if(settings.companionVoiceProvider!=='cloud'||settings.companionVoiceMuted||!settings.companionRemarks||!settings.overlayEnabled)return {skipped:'Cloud voice is disabled or muted.'};
    if(!message||typeof message.id!=='string'||!shortQuip(message.quip))return {skipped:'Only short one-liners can be voiced.'};
    if(this.busy||this.seen.has(message.id))return {skipped:'Voice is busy or this line was already read.'};
    if(this.error)return {error:this.error};
    this.busy=true;const generation=this.generation;
    try {
      const key=await this.keys.read();if(!key)return {error:'Save an OpenAI API key to use cloud voice.'};
      if(this.usage.day!==this.day())this.usage={day:this.day(),requests:0};
      if(this.usage.requests>=settings.companionSpeechDailyRequests)return {skipped:'Daily speech request limit reached.'};
      if(generation!==this.generation)return {skipped:'Speech cancelled.'};
      this.seen.add(message.id);if(this.seen.size>256)this.seen.delete(this.seen.values().next().value);
      this.usage.requests++;
      const temporary=`${this.file}.${randomUUID()}.tmp`;
      try{await fs.mkdir(path.dirname(this.file),{recursive:true});await fs.writeFile(temporary,JSON.stringify(this.usage));await fs.rename(temporary,this.file);}
      catch{this.error='Could not save speech usage; cloud speech is paused.';throw Error();}
      finally{await fs.rm(temporary,{force:true});}
      if(generation!==this.generation)return {skipped:'Speech cancelled.'};
      this.controller=new AbortController();
      const audio=await this.request({key,text:message.quip,voice:settings.companionSpeechVoice,signal:this.controller.signal});
      if(generation!==this.generation)return {skipped:'Speech cancelled.'};
      return {audio:`data:audio/wav;base64,${audio.toString('base64')}`};
    }catch{return {error:'Cloud speech unavailable. Check the saved key, model access, and limits.'};}
    finally{this.busy=false;this.controller=null;}
  }
}
module.exports={CompanionSpeech,generateSpeech,wav,shortQuip,VOICES,MODEL,MAX_CHARACTERS};
