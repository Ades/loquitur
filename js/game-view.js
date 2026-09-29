// © 2026 Anders Ive. All Rights Reserved.
// Game view: header with progress, Log, Shelf and List.
"use strict";

// ---------------- Game view ----------------
function renderGame(){
  const game = games.find(g=>g.id===route.gameId);
  const wrap = document.createElement('div');
  if(!game){ route={view:'library',gameId:null}; return renderLibrary(); }
  wrap.setAttribute('style', gameFontStyle(game));
  const nodes = nodesByGame[game.id]||[];

  const crumb = document.createElement('div');
  crumb.className='crumb';
  crumb.innerHTML = `<button id="backLib">← All games</button><span>/</span><span>${renderTitle(game.name)}</span>`;
  crumb.querySelector('#backLib').onclick = ()=>{ route={view:'library',gameId:null}; render(); };
  wrap.appendChild(crumb);

  // progress counts either completed groups or heard narrations, per settings
  let total = 0, completedCount = 0;
  if(settings.countGroupsCompleted){
    const groups = game.groups || [];
    const validGroupIds = groups.map(g=>g.id);
    groups.forEach(g=>{
      const list = groupMembers(g, nodes, nodes, validGroupIds);
      // with "hideUnavailableGroups", groups with nothing unlocked yet don't count
      if(list.length>0 || !settings.hideUnavailableGroups) total++;
      const counted = settings.hideUnavailableGroups ? list : list.filter(n=>!n.hidden);
      if(isGroupComplete(counted, validGroupIds, g.id)) completedCount++;
    });
  } else {
    total = nodes.length;
    completedCount = nodes.filter(n=>isCompleted(n.id)).length;
  }
  const gh = document.createElement('div');
  gh.className='game-header';
  gh.innerHTML = `
    <div class="art" style="${game.image?`background-image:url('${game.image}')`:''}"></div>
    <div class="meta">
      <h2>${renderTitle(game.name)}</h2>
      <div class="desc">${renderMarkdown(game.description||'')}</div>
      ${total>0?`<div class="progress-bar"><div class="fill" style="width:${completedCount/total*100}%"></div></div>
      <div class="progress-label">${completedCount} OF ${total} ${settings.countGroupsCompleted?'GROUPS COMPLETED':'NARRATIONS HEARD'}</div>`:''}
    </div>
  `;
  wrap.appendChild(gh);

  if(manageMode){ wrap.appendChild(renderManagePanel(game)); }

  const toolbar = document.createElement('div');
  toolbar.className='toolbar-row';
  const toggle = document.createElement('div');
  toggle.className='view-toggle';
  toggle.innerHTML = `
    <button data-v="shelf" class="${gameSubView==='shelf'?'active':''}">Shelf</button>
    <button data-v="map" class="${gameSubView==='map'?'active':''}">Campaign map</button>
    <button data-v="list" class="${gameSubView==='list'?'active':''}">List</button>
    <button data-v="log" class="${gameSubView==='log'?'active':''}">Log</button>
  `;
  toggle.querySelectorAll('button').forEach(b=>b.onclick=()=>{ gameSubView=b.dataset.v; render(); });
  toolbar.appendChild(toggle);
  wrap.appendChild(toolbar);

  if(gameSubView==='shelf'){ wrap.appendChild(renderNodeShelf(nodes, game)); }
  else if(gameSubView==='map'){ wrap.appendChild(renderCampaignMap(nodes, game)); }
  else if(gameSubView==='list'){ wrap.appendChild(renderNodeList(nodes, game)); }
  else { wrap.appendChild(renderLog(nodes)); }

  return wrap;
}

// ---------------- Log ----------------
function renderLog(nodes){
  const box = document.createElement('div');
  const visible = manageMode ? nodes : nodes.filter(n=>!n.hidden);
  const entries = visible
    .filter(n=>isCompleted(n.id))
    .filter(n=> manageMode || (n.logMode||'full') !== 'none')
    .map(n=>({node:n, record: completionRecord(n.id) || {completedAt:0, choiceId:null}}))
    .sort((a,b)=> settings.logOrder==='latestLast'
      ? (a.record.completedAt||0) - (b.record.completedAt||0)
      : (b.record.completedAt||0) - (a.record.completedAt||0));

  if(entries.length===0){
    box.className='empty';
    box.innerHTML = `<h3>The log is empty</h3><p>Choices and heard narrations will be recorded here as you play.</p>`;
    return box;
  }

  const list = document.createElement('div');
  list.className='log-list';
  entries.forEach(({node,record})=>{
    const item = document.createElement('div');
    item.className='log-item';
    const when = record.completedAt ? new Date(record.completedAt).toLocaleString() : 'Available from the start';
    const mode = node.logMode || 'full';
    const skippedNote = (manageMode && mode==='none') ? `<div class="log-result" style="color:#d99;">Not logged for players (set to "Don't log")</div>` : '';

    if(mode==='titleOnly'){
      item.innerHTML = `
        <div class="log-top">
          <span class="log-title">${renderTitle(node.title)}</span>
          <span class="log-time">${escapeHtml(when)}</span>
        </div>
        ${skippedNote}
      `;
      list.appendChild(item);
      return;
    }
    if(mode==='textOnly'){
      item.innerHTML = `
        <div class="log-top" style="align-items:flex-start;">
          <div class="log-result" style="margin:0;flex:1;">${renderMarkdown(node.text||'')}</div>
          <span class="log-time">${escapeHtml(when)}</span>
        </div>
        ${skippedNote}
      `;
      list.appendChild(item);
      return;
    }

    let choiceLine = '';
    let resultLine = '';
    let chosen = [];
    if(Array.isArray(record.choiceIds) && record.choiceIds.length){
      chosen = (node.choices||[]).filter(c=>record.choiceIds.includes(c.id));
    } else if(record.choiceId){
      chosen = (node.choices||[]).filter(c=>c.id===record.choiceId);
    }
    if(chosen.length){
      choiceLine = `<div class="log-choice"><i>${chosen.map(c=>`“${escapeHtml(c.label)}”`).join('</i><br/><i> ')}</i></div>`;
      const texts = chosen.filter(c=>c.resultText).map(c=>renderMarkdown(c.resultText));
      if(texts.length) resultLine = `<div class="log-result">${texts.join('')}</div>`;
    }
    if(mode==='choicesOnly'){
      if(chosen.length===0 && !manageMode) return; // nothing was chosen, so nothing to log
      item.innerHTML = `
        <div class="log-top" style="align-items:flex-start;">
          ${choiceLine}
          <span class="log-time">${escapeHtml(when)}</span>
        </div>
        ${skippedNote}
      `;
      list.appendChild(item);
      return;
    }

    item.innerHTML = `
      <div class="log-top">
        <span class="log-title">${renderTitle(node.title)}</span>
        <span class="log-time">${escapeHtml(when)}</span>
      </div>
      ${choiceLine}
      ${resultLine}
      ${skippedNote}
    `;
    list.appendChild(item);
  });
  box.appendChild(list);
  return box;
}

// ---------------- Shelf (card grid) and List (compact rows) ----------------
// Both views show the same narrations, filtered and grouped the same way; only the
// per-narration markup differs.
function renderNodeShelf(nodes, game){ return renderNodeCollection(nodes, game, buildShelfGrid); }
function renderNodeList(nodes, game){ return renderNodeCollection(nodes, game, buildListRows); }

// Marks a narration as seen-available, returning whether it should get the unlock animation.
function takeNewlyUnlocked(n, done){
  const wasSeen = seenAvailableIds.has(n.id);
  if(!wasSeen) seenAvailableIds.add(n.id);
  return settings.animationsEnabled && !manageMode && !done && !wasSeen;
}
function manageTags(n, spacing){
  return (manageMode && n.hidden? `<span class="tag" style="background:rgba(138,58,58,.18);color:#d99;${spacing}">Hidden</span>`:'')
    + (manageMode && n.completedByDefault? `<span class="tag" style="background:rgba(111,138,83,.18);color:var(--moss);${spacing}">Auto</span>`:'');
}
function buildShelfGrid(list){
  const grid = document.createElement('div');
  grid.className='node-grid';
  displayOrder(list).forEach(n=>{
    const done = isCompleted(n.id);
    const playing = inlinePlayingId === n.id;
    const isNew = takeNewlyUnlocked(n, done);
    const card = document.createElement('div');
    card.className = 'node-card ' + (done?'completed':'available') + (isNew?' newly-unlocked':'');
    card.innerHTML = `
      <span class="icon-row">${done?ICON_CHECK:ICON_PLAY}</span>
      <span class="tag">${done?'Heard':'Available'}</span>
      ${manageTags(n, 'margin-left:6px;')}
      <h3>${renderTitle(n.title)}</h3>
      <div class="node-card-text">${renderMarkdown(n.text||'')}</div>
      ${n.audio? `<button class="mini-play ${playing?'playing':''}" title="${playing?'Pause preview':'Play narration'}">${playing?ICON_MINI_PAUSE:ICON_MINI_PLAY}</button>` : ''}
    `;
    card.onclick = ()=>{ openReaderFor(n); };
    const playBtn = card.querySelector('.mini-play');
    if(playBtn){ playBtn.onclick = (e)=> toggleInlinePlay(n, e, true); }
    grid.appendChild(card);
  });
  return grid;
}
function buildListRows(list){
  const rows = document.createElement('div');
  rows.className='node-list';
  displayOrder(list).forEach(n=>{
    const done = isCompleted(n.id);
    const playing = inlinePlayingId === n.id;
    const isNew = takeNewlyUnlocked(n, done);
    const row = document.createElement('div');
    row.className = 'node-list-item ' + (done?'completed':'available') + (isNew?' newly-unlocked':'');
    row.innerHTML = `
      <span class="node-list-icon">${done?ICON_CHECK:ICON_PLAY}</span>
      <span class="node-list-title">${renderTitle(n.title)}</span>
      <span class="tag">${done?'Heard':'Available'}</span>
      ${manageTags(n, '')}
      ${n.audio? `<button class="mini-play static" title="${playing?'Pause preview':'Play narration'}">${playing?ICON_MINI_PAUSE:ICON_MINI_PLAY}</button>` : ''}
    `;
    row.onclick = ()=>{ openReaderFor(n); };
    const playBtn = row.querySelector('.mini-play');
    if(playBtn){ playBtn.onclick = (e)=> toggleInlinePlay(n, e, true); }
    rows.appendChild(row);
  });
  return rows;
}

function renderNodeCollection(nodes, game, buildItems){
  const box = document.createElement('div');
  const visible = manageMode ? nodes : nodes.filter(n=>!n.hidden);
  let available = visible.filter(isAvailable);
  const lockedCount = visible.length - available.length;
  if(settings.hideCompleted){ available = available.filter(n=>!isCompleted(n.id)); }

  if(visible.length===0){
    box.className='empty';
    box.innerHTML = `<h3>No narrations yet</h3><p>Use "Manage codex" above to add the first one.</p>`;
    return box;
  }
  if(available.length===0){
    box.className='empty';
    box.innerHTML = settings.hideCompleted
      ? `<h3>All caught up</h3><p>You've heard everything currently available. Uncheck "Hide narrations you've already heard" to browse them again.</p>`
      : `<h3>Nothing available yet</h3><p>${lockedCount} narration${lockedCount===1?'':'s'} will unlock as the campaign continues.</p>`;
    return box;
  }

  const groups = game.groups || [];
  if(groups.length===0){
    box.appendChild(buildItems(available));
  } else {
    const validGroupIds = groups.map(g=>g.id);
    const ungroupedList = groupMembers(null, nodes, visible, validGroupIds);
    const sections = [];
    if(ungroupedList.length) sections.push({id:null, name:'Ungrouped', collapsed:false, list:ungroupedList});
    groups.forEach(g=>{
      const list = groupMembers(g, nodes, visible, validGroupIds);
      const complete = isGroupComplete(list, validGroupIds, g.id);
      // a group chimes and collapses itself the moment it becomes complete...
      if(!manageMode){
        if(complete && !seenCompleteGroupIds.has(g.id)){
          seenCompleteGroupIds.add(g.id);
          playGroupCompleteSound();
          if(!g.collapsed){ g.collapsed = true; sSet('game:'+game.id, game); }
        } else if(!complete && seenCompleteGroupIds.has(g.id)){
          seenCompleteGroupIds.delete(g.id);
        }
      }
      if(list.length){
        // ...and re-opens itself when something new unlocks inside it
        if(g.collapsed && !manageMode && !complete && list.some(n=> !isCompleted(n.id) && !seenAvailableIds.has(n.id))){
          g.collapsed = false;
          sSet('game:'+game.id, game);
        }
        sections.push({id:g.id, name:g.name, collapsed:!!g.collapsed, list});
      }
    });
    sections.forEach(sec=>{
      const header = document.createElement('div');
      header.className='group-header';
      header.style.cursor = sec.id===null ? 'default' : 'pointer';
      const badge = isGroupComplete(sec.list, validGroupIds, sec.id) ? groupCompleteBadge() : '';
      const count = `<span class="pid" style="margin-left:8px;">${sec.list.length}</span>`;
      header.innerHTML = sec.id===null
        ? `<span class="group-name">Ungrouped</span>${count}${badge}`
        : `<button class="group-toggle" type="button">${sec.collapsed?'▸':'▾'}</button><span class="group-name">${escapeHtml(sec.name)}</span>${count}${badge}`;
      box.appendChild(header);
      if(!sec.collapsed) box.appendChild(buildItems(sec.list));
      if(sec.id!==null){
        header.querySelector('.group-toggle').onclick = async ()=>{
          const g = groups.find(x=>x.id===sec.id);
          if(g){ g.collapsed = !g.collapsed; await sSet('game:'+game.id, game); render(); }
        };
      }
    });
  }

  if(lockedCount>0){
    const note = document.createElement('div');
    note.className='locked-note';
    note.innerHTML = `${ICON_LOCK} ${lockedCount} more narration${lockedCount===1?'':'s'} will unlock as the campaign continues.`;
    box.appendChild(note);
  }
  return box;
}
