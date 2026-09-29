// © 2026 Anders Ive. All Rights Reserved.
// Synthesized UI sounds and the inline (card / map) narration preview.
"use strict";

// All UI sounds are synthesized on one shared AudioContext — no audio files needed,
// so they work fully offline.
let sfxAudioCtx = null;
function getAudioCtx(){
  if(!sfxAudioCtx) sfxAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(sfxAudioCtx.state === 'suspended') sfxAudioCtx.resume();
  return sfxAudioCtx;
}
// A short "tick", played when a narration window opens.
function playTickSound(){
  if(!settings.tickSoundEnabled) return;
  try{
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }catch(e){ /* audio context may be blocked until a user gesture — safe to ignore */ }
}
// A short "pencil scratch" — filtered noise with a few uneven strokes,
// played when a narration is written into the log.
function playScratchSound(){
  if(!settings.scratchSoundEnabled) return;
  try{
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const duration = 0.22;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++){ data[i] = Math.random()*2-1; }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2500;
    bandpass.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    const strokes = 4;
    for(let s=0;s<strokes;s++){
      const stepLen = duration/strokes;
      const t0 = now + s*stepLen;
      gain.gain.exponentialRampToValueAtTime(0.07 + Math.random()*0.05, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + stepLen*0.85);
    }
    noise.connect(bandpass).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration + 0.02);
  }catch(e){ /* audio context may be blocked until a user gesture — safe to ignore */ }
}
// A short ascending three-note chime, played once when a group's narrations are all heard.
function playGroupCompleteSound(){
  if(!settings.groupCompleteSoundEnabled) return;
  try{
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25/2, 659.25/2, 783.99/2]; // C4, E4, G4 — a small, bright major triad
    notes.forEach((freq, i)=>{
      const t0 = now + i*0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.37);
    });
  }catch(e){ /* audio context may be blocked until a user gesture — safe to ignore */ }
}

// inline (card / map) audio preview
const inlineAudio = new Audio();
let inlinePlayingId = null;
let inlineAutoComplete = false; // true only for map "graph" plays with no choices to pick
inlineAudio.addEventListener('ended', async ()=>{
  const finishedId = inlinePlayingId;
  const shouldComplete = inlineAutoComplete;
  inlinePlayingId = null;
  inlineAutoComplete = false;
  if(shouldComplete && finishedId){
    const node = findNodeById(finishedId);
    if(node && !isCompleted(node.id) && !(node.choices && node.choices.length)){
      await markCompletedAndFindNext(node, null);
      toast('Marked as heard — new narrations may be available.');
    }
  }
  render();
});

// ---------------- Inline audio preview (play icon on cards / map nodes) ----------------
function toggleInlinePlay(node, evt, autoComplete){
  if(evt){ evt.stopPropagation(); evt.preventDefault(); }
  if(!node.audio) return;
  if(inlinePlayingId === node.id){
    inlineAudio.pause();
    inlinePlayingId = null;
    inlineAutoComplete = false;
    render();
    return;
  }
  inlineAudio.pause();
  inlineAudio.src = node.audio;
  inlineAudio.currentTime = 0;
  inlinePlayingId = node.id;
  inlineAutoComplete = !!autoComplete;
  inlineAudio.play().catch(()=>{ inlinePlayingId=null; inlineAutoComplete=false; render(); });
  render();
}
function stopInlinePlay(){
  if(inlinePlayingId){ inlineAudio.pause(); inlinePlayingId = null; inlineAutoComplete = false; }
}
