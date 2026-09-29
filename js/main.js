// © 2026 Anders Ive. All Rights Reserved.
// Startup: loads everything from storage and renders the app. Load this file last.
"use strict";

// ---------------- Load ----------------
// Reads are issued in parallel rather than one at a time — with hundreds of narrations
// that makes startup much faster.
async function loadAll(){
  requestPersistentStorage();
  const gameIndex = await sGet('game-index') || [];
  games = (await Promise.all(gameIndex.map(id=>sGet('game:'+id)))).filter(Boolean);
  nodesByGame = {};
  await Promise.all(games.map(async g=>{
    const nodeIndex = await sGet('node-index:'+g.id) || [];
    nodesByGame[g.id] = (await Promise.all(nodeIndex.map(nid=>sGet('node:'+nid)))).filter(Boolean);
  }));
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
