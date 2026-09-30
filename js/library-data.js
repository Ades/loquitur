// © 2026 Anders Ive. All Rights Reserved.
// Game library data: structure import/export, default codex, deleting and copying.
"use strict";

function exportLibrary(){
  const payload = { type:'campaign-codex-library', exportedAt: new Date().toISOString(), games, nodesByGame, settings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `campaign-codex-structure-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function importLibraryFromFile(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onerror = ()=>reject(new Error('Could not read that file.'));
    r.onload = ()=>{
      try{
        const parsed = JSON.parse(r.result);
        if(!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.games) || typeof parsed.nodesByGame !== 'object'){
          reject(new Error('That file doesn\'t look like a Campaign Codex structure export.'));
          return;
        }
        resolve(cleanLibrary(parsed));
      }catch(e){ reject(new Error('That file is not valid JSON.')); }
    };
    r.readAsText(file);
  });
}
// ---------------- Cleaning loaded data ----------------
// Structure files can come from anyone. Ids, colors and option values end up inside HTML
// attributes and CSS, so anything that could break out of those is dropped here, before
// the data is used or stored. (Free text — titles, descriptions — is sanitized when
// rendered instead; see sanitizeHtml.)
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_WORD = /^[A-Za-z0-9_-]{0,40}$/;
const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const NODE_OPTION_FIELDS = ['logMode','mapShape','mapLabel','mapTooltip','imagePosition'];
const GAME_OPTION_FIELDS = ['stylePreset','titleFont','textFont'];

const safeId = (v)=> (typeof v==='string' && SAFE_ID.test(v)) ? v : null;
const safeText = (v)=> typeof v==='string' ? v : '';
function keepSafeWords(obj, fields){
  fields.forEach(f=>{ if(f in obj && !(typeof obj[f]==='string' && SAFE_WORD.test(obj[f]))) delete obj[f]; });
}

function cleanGame(raw){
  if(!raw || typeof raw!=='object' || !safeId(raw.id)) return null;
  const g = {...raw, name: safeText(raw.name), description: safeText(raw.description), image: safeText(raw.image)};
  keepSafeWords(g, GAME_OPTION_FIELDS);
  g.groups = (Array.isArray(raw.groups) ? raw.groups : [])
    .filter(gr=> gr && typeof gr==='object' && safeId(gr.id))
    .map(gr=> ({...gr, name: safeText(gr.name)}));
  const colors = {};
  ['dark','light'].forEach(mode=>{
    const src = raw.customColors && raw.customColors[mode];
    if(!src || typeof src!=='object') return;
    const kept = {};
    COLOR_ROLES.forEach(role=>{ if(typeof src[role]==='string' && SAFE_COLOR.test(src[role])) kept[role] = src[role]; });
    if(Object.keys(kept).length) colors[mode] = kept;
  });
  g.customColors = colors;
  // custom font family names are always generated from the game id, never taken from the file
  [['customTitleFont','title'],['customTextFont','text']].forEach(([key, slot])=>{
    const cf = raw[key];
    g[key] = (cf && typeof cf.source==='string' && cf.source) ? {family: customFontFamily(g.id, slot), source: cf.source} : null;
  });
  return g;
}
function cleanNode(raw, gameId){
  if(!raw || typeof raw!=='object' || !safeId(raw.id)) return null;
  const n = {...raw, gameId, title: safeText(raw.title), text: safeText(raw.text), audio: safeText(raw.audio), image: safeText(raw.image)};
  n.groupId = safeId(raw.groupId);
  n.order = Number(raw.order) || 0;
  keepSafeWords(n, NODE_OPTION_FIELDS);
  n.choices = (Array.isArray(raw.choices) ? raw.choices : [])
    .filter(c=> c && typeof c==='object' && safeId(c.id))
    .map(c=> ({id: c.id, label: safeText(c.label), resultText: safeText(c.resultText)}));
  // prerequisites are always stored as a condition tree; older files' flat lists are converted
  const legacy = {
    prerequisiteMode: raw.prerequisiteMode,
    prerequisites: (Array.isArray(raw.prerequisites) ? raw.prerequisites : []).filter(p=> p && typeof p==='object'),
  };
  n.requires = cleanRequires(isReqGroup(raw.requires) ? raw.requires : legacyRequires(legacy), 0) || emptyRequires();
  delete n.prerequisites;
  delete n.prerequisiteMode;
  return n;
}
// A condition tree with only and/or groups and conditions on valid ids; anything else is left
// out. Nesting is capped so a hostile file can't make evaluation recurse without end.
const MAX_REQUIRES_DEPTH = 12;
function cleanRequires(item, depth){
  if(!item || typeof item!=='object') return null;
  if(isReqGroup(item)){
    if(depth >= MAX_REQUIRES_DEPTH) return null;
    const items = (Array.isArray(item.items) ? item.items : []).map(i=>cleanRequires(i, depth+1)).filter(Boolean);
    return {op: item.op, items};
  }
  const nodeId = safeId(item.nodeId);
  return nodeId ? {nodeId, choiceId: safeId(item.choiceId)} : null;
}
// Only known settings, each of the same type as its default; string settings must be plain words.
function cleanSettings(raw){
  if(!raw || typeof raw!=='object') return null;
  const s = {};
  Object.keys(DEFAULT_SETTINGS).forEach(k=>{
    const v = raw[k];
    if(typeof v!==typeof DEFAULT_SETTINGS[k]) return;
    if(typeof v==='string' && !SAFE_WORD.test(v)) return;
    s[k] = v;
  });
  return s;
}
// Returns a cleaned copy of a loaded library: games, narrations, choices, groups and
// prerequisites with unusable ids are left out.
function cleanLibrary(loaded){
  const gamesOut = (Array.isArray(loaded.games) ? loaded.games : []).map(cleanGame).filter(Boolean);
  const nodesOut = {};
  gamesOut.forEach(g=>{
    const list = loaded.nodesByGame && Array.isArray(loaded.nodesByGame[g.id]) ? loaded.nodesByGame[g.id] : [];
    nodesOut[g.id] = list.map(n=>cleanNode(n, g.id)).filter(Boolean);
  });
  return {games: gamesOut, nodesByGame: nodesOut, settings: cleanSettings(loaded.settings)};
}

async function applyImportedLibrary(loaded){
  // wipe existing games/nodes from storage
  const oldIndex = await sGet('game-index') || [];
  for(const gid of oldIndex){
    const nIdx = await sGet('node-index:'+gid) || [];
    for(const nid of nIdx){ await sDel('node:'+nid); }
    await sDel('node-index:'+gid);
    await sDel('game:'+gid);
  }
  // write new games/nodes
  const newIndex = loaded.games.map(g=>g.id);
  for(const g of loaded.games){ await sSet('game:'+g.id, g); }
  await sSet('game-index', newIndex);
  for(const gid of newIndex){
    const nodeList = loaded.nodesByGame[gid] || [];
    await sSet('node-index:'+gid, nodeList.map(n=>n.id));
    for(const n of nodeList){ await sSet('node:'+n.id, n); }
  }
  games = loaded.games;
  nodesByGame = {};
  newIndex.forEach(gid=>{ nodesByGame[gid] = loaded.nodesByGame[gid] || []; });
  if(loaded.settings){
    settings = Object.assign({}, DEFAULT_SETTINGS, loaded.settings);
    await sSet('settings', settings);
    applyTheme();
    applyLargeFont();
  }
}

// Offers the games in default_codex.json (next to this page) on the Shelf, once per
// page load. Silently does nothing if the file isn't there, e.g. when opened via file://.
async function loadDefaultCodex(){
  try{
    const response = await fetch('./default_codex.json');
    if(!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const loaded = cleanLibrary(await response.json());
    const existingIds = new Set(games.map(g=>g.id));
    importCandidates = loaded.games
      .filter(g=>!existingIds.has(g.id))
      .map(g=>({game:g, nodes: loaded.nodesByGame[g.id]||[]}));
    if(importCandidates.length===0){
      toast('Every game in that file is already in Your Games.');
      importCandidates = null;
    }
    render();
  }catch(error){ console.error('Failed to fetch default codex:', error); }
}

async function deleteGame(game){
  for(const n of (nodesByGame[game.id]||[])){ await sDel('node:'+n.id); }
  await sDel('node-index:'+game.id);
  await sDel('game:'+game.id);
  const idx = await sGet('game-index') || [];
  await sSet('game-index', idx.filter(x=>x!==game.id));
  games = games.filter(g=>g.id!==game.id);
  delete nodesByGame[game.id];
}

// Saves a copy of a narration (fresh ids, placed last in its group) and returns it,
// or null if it couldn't be stored. requires (a condition tree) defaults to a copy of the original's.
async function duplicateNode(original, requires){
  const siblings = (nodesByGame[original.gameId]||[]).filter(x=> (x.groupId||null) === (original.groupId||null));
  const copy = {
    ...original,
    id: uid(),
    title: original.title + ' (copy)',
    choices: (original.choices||[]).map(c=> ({...c, id: uid()})),
    requires: requires || JSON.parse(JSON.stringify(prereqExpr(original))),
    order: siblings.length ? Math.max(...siblings.map(s=>s.order||0)) + 1 : 0,
    createdAt: Date.now()
  };
  delete copy.prerequisites;
  delete copy.prerequisiteMode;
  if(!await sSet('node:'+copy.id, copy)) return null;
  const nodeIndex = await sGet('node-index:'+original.gameId) || [];
  nodeIndex.push(copy.id);
  await sSet('node-index:'+original.gameId, nodeIndex);
  nodesByGame[original.gameId].push(copy);
  return copy;
}
