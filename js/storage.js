// © 2026 Anders Ive. All Rights Reserved.
// Persistent storage (Claude.ai artifact storage, IndexedDB or localStorage) and small utilities.
"use strict";

// ---------------- Storage helpers ----------------
// Prefers the platform's persistent artifact storage (window.storage) when viewed inside
// Claude.ai. Otherwise data lives in this browser's IndexedDB, which holds hundreds of MB
// (localStorage only holds about 5 MB — a couple of uploaded audio clips). If IndexedDB
// isn't available at all, localStorage is used as a last resort.
const LS_PREFIX = 'campaign-codex:';
const IDB_NAME = 'loquitur';
const IDB_STORE = 'kv';
function hasPlatformStorage(){
  return typeof window!=='undefined' && !!window.storage && typeof window.storage.get==='function';
}

// Opens the database once; resolves to null if IndexedDB can't be used.
let idbPromise = null;
function openIdb(){
  if(!idbPromise){
    idbPromise = new Promise(resolve=>{
      if(!window.indexedDB){ resolve(null); return; }
      let req;
      try{ req = indexedDB.open(IDB_NAME, 1); }catch(e){ resolve(null); return; }
      req.onupgradeneeded = ()=>{ req.result.createObjectStore(IDB_STORE); };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> resolve(null);
      req.onblocked = ()=> resolve(null);
    }).then(migrateFromLocalStorage);
  }
  return idbPromise;
}
// Runs one request against the key/value store and resolves once its transaction is done.
function idbRequest(db, mode, makeRequest){
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, mode);
    const req = makeRequest(tx.objectStore(IDB_STORE));
    tx.oncomplete = ()=> resolve(req.result);
    tx.onerror = tx.onabort = ()=> reject(tx.error || req.error);
  });
}
// One-time copy of data saved by earlier versions (which used localStorage) into IndexedDB.
// The localStorage copy is left in place, untouched, as a backup.
async function migrateFromLocalStorage(db){
  if(!db) return db;
  try{
    if(await idbRequest(db, 'readonly', st=>st.get('__migrated'))) return db;
    const entries = [];
    for(let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.startsWith(LS_PREFIX)) entries.push([k.slice(LS_PREFIX.length), JSON.parse(localStorage.getItem(k))]);
    }
    await new Promise((resolve, reject)=>{
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const st = tx.objectStore(IDB_STORE);
      entries.forEach(([k, v])=> st.put(v, k));
      st.put(true, '__migrated');
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = ()=> reject(tx.error);
    });
  }catch(e){ console.error('Could not copy earlier data from localStorage', e); }
  return db;
}

async function sGet(key){
  try{
    if(hasPlatformStorage()){
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : null;
    }
    const db = await openIdb();
    if(db){
      const v = await idbRequest(db, 'readonly', st=>st.get(key));
      return v===undefined ? null : v;
    }
    const raw = localStorage.getItem(LS_PREFIX+key);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
// Writes are queued so they run one at a time, in order — overlapping saves never
// interleave, and none are dropped. Each value is snapshotted when its turn comes.
let saveQueue = Promise.resolve();
function sSet(key, val){
  const write = saveQueue.then(async ()=>{
    try{
      if(hasPlatformStorage()){
        const r = await window.storage.set(key, JSON.stringify(val));
        return !!r;
      }
      const db = await openIdb();
      if(db){
        // a JSON round trip keeps stored values plain data, exactly as before
        await idbRequest(db, 'readwrite', st=>st.put(JSON.parse(JSON.stringify(val)), key));
        return true;
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
    const db = await openIdb();
    if(db){ await idbRequest(db, 'readwrite', st=>st.delete(key)); return; }
    localStorage.removeItem(LS_PREFIX+key);
  }catch(e){}
}
// Asks the browser not to clear this site's data when disk space runs low. Browsers may
// decide silently (or ask the user); either way the app works the same.
function requestPersistentStorage(){
  if(!hasPlatformStorage() && navigator.storage && navigator.storage.persist){
    navigator.storage.persist().catch(()=>{});
  }
}

const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
const fmtBytes = (n) => n > 1024*1024 ? (n/1024/1024).toFixed(1)+' MB' : Math.round(n/1024)+' KB';
function joinSubdirPath(subdir, filename){
  const dir = (subdir||'').trim().replace(/^\/+/,'').replace(/\/+$/,'');
  return dir ? dir + '/' + filename : filename;
}
