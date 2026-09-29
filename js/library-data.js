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
        resolve({games: parsed.games, nodesByGame: parsed.nodesByGame, settings: (parsed.settings && typeof parsed.settings==='object') ? parsed.settings : null});
      }catch(e){ reject(new Error('That file is not valid JSON.')); }
    };
    r.readAsText(file);
  });
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
    const loaded = await response.json();
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
// or null if it couldn't be stored. prerequisites defaults to a copy of the original's.
async function duplicateNode(original, prerequisites){
  const siblings = (nodesByGame[original.gameId]||[]).filter(x=> (x.groupId||null) === (original.groupId||null));
  const copy = {
    ...original,
    id: uid(),
    title: original.title + ' (copy)',
    choices: (original.choices||[]).map(c=> ({...c, id: uid()})),
    prerequisites: prerequisites || (original.prerequisites||[]).map(p=> ({...p})),
    order: siblings.length ? Math.max(...siblings.map(s=>s.order||0)) + 1 : 0,
    createdAt: Date.now()
  };
  if(!await sSet('node:'+copy.id, copy)) return null;
  const nodeIndex = await sGet('node-index:'+original.gameId) || [];
  nodeIndex.push(copy.id);
  await sSet('node-index:'+original.gameId, nodeIndex);
  nodesByGame[original.gameId].push(copy);
  return copy;
}
