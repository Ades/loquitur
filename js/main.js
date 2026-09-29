// © 2026 Anders Ive. All Rights Reserved.
// Startup: loads everything from storage and renders the app. Load this file last.
"use strict";

// ---------------- Load ----------------
async function loadAll(){
  const gameIndex = await sGet('game-index') || [];
  games = [];
  for(const id of gameIndex){ const g = await sGet('game:'+id); if(g) games.push(g); }
  nodesByGame = {};
  for(const g of games){
    const nodeIndex = await sGet('node-index:'+g.id) || [];
    const list = [];
    for(const nid of nodeIndex){ const n = await sGet('node:'+nid); if(n) list.push(n); }
    nodesByGame[g.id] = list;
  }
  progress = await sGet('progress') || {completed:{}};
  settings = Object.assign({}, DEFAULT_SETTINGS, await sGet('settings') || {});
  applyTheme();
  applyLargeFont();
  // seed with everything already available so nothing "unlock-animates" on first load —
  // only genuinely new unlocks during this session should get the animation.
  games.forEach(g=>{
    (nodesByGame[g.id]||[]).forEach(n=>{ if(isAvailable(n)) seenAvailableIds.add(n.id); });
  });
  render();
}

function applyTheme(){
  document.body.classList.toggle('light', settings.theme==='light');
}
function applyLargeFont(){
  document.body.classList.toggle('large-font', !!settings.largeFont);
}

loadAll();
