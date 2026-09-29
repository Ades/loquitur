// © 2026 Anders Ive. All Rights Reserved.
// Persistent storage (Claude.ai artifact storage or localStorage) and small utilities.
"use strict";

// ---------------- Storage helpers ----------------
// Prefers the platform's persistent artifact storage (window.storage) when available.
// Falls back to this browser's localStorage otherwise, e.g. when this file is opened
// directly (double-clicked, or via file://) rather than viewed inside Claude.ai — so a
// page refresh returns to the same state either way.
const LS_PREFIX = 'campaign-codex:';
function hasPlatformStorage(){
  return typeof window!=='undefined' && !!window.storage && typeof window.storage.get==='function';
}

async function sGet(key){
  try{
    if(hasPlatformStorage()){
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : null;
    }
    const raw = localStorage.getItem(LS_PREFIX+key);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
// Writes are queued so they run one at a time, in order — overlapping saves never
// interleave, and none are dropped.
let saveQueue = Promise.resolve();
function sSet(key, val){
  const write = saveQueue.then(async ()=>{
    try{
      if(hasPlatformStorage()){
        const r = await window.storage.set(key, JSON.stringify(val));
        return !!r;
      }
      localStorage.setItem(LS_PREFIX+key, JSON.stringify(val));
      return true;
    }catch(e){ console.error("storage set failed", key, e); return false; }
  });
  saveQueue = write;
  return write;
}
async function sDel(key){
  try{
    if(hasPlatformStorage()){ await window.storage.delete(key); return; }
    localStorage.removeItem(LS_PREFIX+key);
  }catch(e){}
}

const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
const fmtBytes = (n) => n > 1024*1024 ? (n/1024/1024).toFixed(1)+' MB' : Math.round(n/1024)+' KB';
function joinSubdirPath(subdir, filename){
  const dir = (subdir||'').trim().replace(/^\/+/,'').replace(/\/+$/,'');
  return dir ? dir + '/' + filename : filename;
}
