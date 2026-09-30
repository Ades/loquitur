// © 2026 Anders Ive. All Rights Reserved.
// Campaign map.
"use strict";

// ---------------- Campaign map ----------------
function hexToRgba(hex, alpha){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function mapPalette(game){
  const mode = settings.theme==='light' ? 'light' : 'dark';
  const base = mode==='light'
    ? { doneFill:'rgba(75,107,52,.14)', doneStroke:'#4b6b34', availFill:'rgba(138,97,20,.10)', availStroke:'#8a6114',
        lockedFill:'rgba(168,152,114,.20)', lockedStroke:'#a89872', textAvail:'#2b2013', textLocked:'#8a7c5c',
        connDone:'#a9812c', connLocked:'#c9b57e' }
    : { doneFill:'rgba(111,138,83,.16)', doneStroke:'#6f8a53', availFill:'rgba(201,162,75,.12)', availStroke:'#c9a24b',
        lockedFill:'rgba(74,64,56,.25)', lockedStroke:'#4a4038', textAvail:'#ece1c4', textLocked:'#7a7160',
        connDone:'#8c7431', connLocked:'#3a3128' };
  const c = effectiveGameColors(game, mode);
  base.availStroke = c.brass;
  base.connDone = c.brassDim;
  base.availFill = hexToRgba(c.brass, mode==='light'?0.10:0.12);
  return base;
}

// Wraps a title into up to maxLines lines of roughly maxChars characters each,
// breaking on word boundaries and ellipsizing anything left over.
function wrapLines(text, maxChars, maxLines){
  const words = (text||'').split(/\s+/).filter(Boolean);
  if(words.length===0) return [''];
  const lines = [];
  let cur = '';
  let idx = 0;
  while(idx < words.length && lines.length < maxLines){
    let w = words[idx];
    if(w.length > maxChars) w = w.slice(0, maxChars);
    const test = cur ? cur + ' ' + w : w;
    if(test.length <= maxChars){ cur = test; idx++; }
    else if(!cur){ cur = w; idx++; }
    else { lines.push(cur); cur=''; }
  }
  if(cur && lines.length < maxLines) lines.push(cur);
  const overflow = idx < words.length;
  if(overflow){
    if(lines.length===0) lines.push('…');
    else {
      let last = lines[lines.length-1];
      if(last.length > maxChars-1) last = last.slice(0, maxChars-1);
      lines[lines.length-1] = last + '…';
    }
  }
  return lines;
}

function renderCampaignMapCore(nodes, game, groupOverride){
  const wrap = document.createElement('div');
  if(nodes.length===0){
    wrap.innerHTML = '<div class="empty" style="border:none;">Add narrations to see the campaign map.</div>';
    return wrap;
  }
  if(manageMode){
    const hint = document.createElement('div');
    hint.className='map-hint';
    hint.textContent = 'In manage mode: click any node to edit it, including its prerequisites and choices. Narrations in a collapsed group (see Existing narrations, below) are dimmed here too — expand a group there to bring its nodes into focus.';
    wrap.appendChild(hint);
  }

  const mapBox = document.createElement('div');
  mapBox.className='map-wrap';

  let visibleNodes = nodes;
  let hiddenLockedCount = 0;
  if(!manageMode){
    const allowHidden = groupOverride && groupOverride.showHiddenNodes;
    const hideHeardHere = settings.hideCompleted || (groupOverride && groupOverride.hideHeard);
    visibleNodes = nodes.filter(n=>{
      if(n.hidden && !allowHidden) return false;
      if(hideHeardHere && isCompleted(n.id)) return false;
      if(settings.hideLockedInMap && !isAvailable(n)){ hiddenLockedCount++; return false; }
      return true;
    });
    if(groupOverride && groupOverride.showFirstOnly){
      const availableHere = visibleNodes.filter(n=>isAvailable(n) && !isCompleted(n.id));
      if(availableHere.length>0){
        const minOrder = Math.min(...availableHere.map(n=>n.order||0));
        const dropIds = new Set(availableHere.filter(n=>(n.order||0)!==minOrder).map(n=>n.id));
        visibleNodes = visibleNodes.filter(n=>!dropIds.has(n.id));
      }
    }
  }
  if(!manageMode && hiddenLockedCount>0){
    const hint = document.createElement('div');
    hint.className='map-hint';
    hint.innerHTML = `${ICON_LOCK} ${hiddenLockedCount} narration${hiddenLockedCount===1?'':'s'} further ahead are hidden until unlocked.`;
    wrap.appendChild(hint);
  }

  const idToNode = {}; nodes.forEach(n=>idToNode[n.id]=n);
  // Assigns each node a layer such that it always sits strictly after every one of its
  // prerequisites — by relaxation (like a longest-path pass) rather than a single
  // recursive walk, so a node gets pushed forward as far as needed even when it has
  // several prerequisites arriving from different depths. Capped in iterations so an
  // accidental prerequisite cycle can't loop forever; a genuine cycle has no valid
  // all-forward layering (by definition), so that's the one case this can't fully fix.
  const layerOf = {};
  nodes.forEach(n=>{ layerOf[n.id] = 0; });
  let relaxed = true, guardIter = 0;
  const maxIter = nodes.length + 5;
  while(relaxed && guardIter < maxIter){
    relaxed = false; guardIter++;
    nodes.forEach(n=>{
      prereqRefs(n).forEach(p=>{
        const pn = idToNode[p.nodeId];
        if(!pn || layerOf[pn.id]===undefined) return; // prerequisite outside this graph — nothing to enforce
        const need = layerOf[pn.id] + 1;
        if(need > layerOf[n.id]){ layerOf[n.id] = need; relaxed = true; }
      });
    });
  }
  function depth(n){ return layerOf[n.id] || 0; }
  const layers = {};
  visibleNodes.forEach(n=>{ const d = depth(n); layers[d] = layers[d]||[]; layers[d].push(n); });
  const layerKeys = Object.keys(layers).map(Number).sort((a,b)=>a-b);
  if(layerKeys.length===0){
    mapBox.innerHTML = '<div class="empty" style="border:none;">Nothing to show with the current filter.</div>';
    wrap.appendChild(mapBox);
    return wrap;
  }

  const isVertical = settings.mapOrientation==='vertical';
  const boxW = 56, boxH = 100; // anchor sizing: circle diameter (+buffer) x full slot height incl. label
  const circleR = 24;
  const primaryStep = isVertical ? 150 : 190;   // spacing between successive layers (depth)
  const secondaryStep = isVertical ? 170 : 150;  // spacing between siblings within a layer
  const padX = 46, padY = 50;
  const maxRows = Math.max(...layerKeys.map(k=>layers[k].length));
  const svgW = isVertical ? padX*2 + secondaryStep*maxRows : padX*2 + primaryStep*layerKeys.length;
  const svgH = isVertical ? padY*2 + primaryStep*layerKeys.length : padY*2 + secondaryStep*maxRows;

  const pos = {};
  // Within each layer (after the first), order nodes by the average position of their
  // prerequisites in earlier layers — this "barycenter" ordering keeps connector lines
  // flowing forward as directly as possible instead of zigzagging or crossing. It can't
  // eliminate every crossing (diamonds and OR-branches sometimes force one), but it
  // minimizes them for whatever the graph's actual shape allows.
  function barycenterOf(n){
    const coords = prereqRefs(n)
      .map(p=>pos[p.nodeId])
      .filter(Boolean)
      .map(pp=> isVertical ? pp.x : pp.y);
    if(coords.length===0) return Infinity; // no positioned prerequisites yet — keep at the end, stable-ish
    return coords.reduce((a,b)=>a+b,0) / coords.length;
  }
  layerKeys.forEach((k,ci)=>{
    if(ci>0){
      layers[k] = layers[k]
        .map((n,i)=>({n, i, bc:barycenterOf(n)}))
        .sort((a,b)=> a.bc-b.bc || a.i-b.i)
        .map(x=>x.n);
    }
    const rows = layers[k].length;
    const secOffset = (maxRows - rows) * secondaryStep / 2;
    layers[k].forEach((n,ri)=>{
      if(isVertical){
        pos[n.id] = { x: padX + secOffset + ri*secondaryStep + secondaryStep/2, y: padY + ci*primaryStep + primaryStep/2 };
      } else {
        pos[n.id] = { x: padX + ci*primaryStep + primaryStep/2, y: padY + secOffset + ri*secondaryStep + secondaryStep/2 };
      }
    });
  });

  const pal = mapPalette(game);
  let lines = '';
  visibleNodes.forEach(n=>{
    // one connector per prerequisite narration, labelled with every choice the conditions
    // ask for (a narration can appear in several conditions, with different choices);
    // NOT conditions are drawn dashed and labelled "not"
    const byPrereq = new Map();
    prereqRefs(n).forEach(p=>{
      if(!byPrereq.has(p.nodeId)) byPrereq.set(p.nodeId, []);
      byPrereq.get(p.nodeId).push(p);
    });
    byPrereq.forEach((refs, prereqId)=>{
      const from = pos[prereqId], to = pos[n.id];
      if(!from||!to) return;
      const pn = idToNode[prereqId];
      const choiceLabel = (cid)=>{ const c = pn && (pn.choices||[]).find(c=>c.id===cid); return c ? c.label : ''; };
      const parts = [];
      refs.forEach(r=>{
        const text = r.choiceId ? choiceLabel(r.choiceId) : '';
        const part = r.negated ? (text ? `not ${text}` : 'not') : text;
        if(part && !parts.includes(part)) parts.push(part);
      });
      const label = parts.join(' / ');
      const dashed = refs.some(r=>r.negated);
      const stroke = isCompleted(prereqId) ? pal.connDone : pal.connLocked;
      let d, labelX, labelY;
      if(isVertical){
        const midy = (from.y+to.y)/2;
        d = `M${from.x},${from.y+boxH/2} C${from.x},${midy} ${to.x},${midy} ${to.x},${to.y-boxH/2}`;
        labelX = (from.x+to.x)/2; labelY = midy - 6;
      } else {
        const midx = (from.x+to.x)/2;
        d = `M${from.x+circleR},${from.y} C${midx},${from.y} ${midx},${to.y} ${to.x-circleR},${to.y}`;
        labelX = midx; labelY = (from.y+to.y)/2 - 6;
      }
      lines += `<path d="${d}" stroke="${stroke}" stroke-width="1.4" fill="none"${dashed ? ' stroke-dasharray="5 4"' : ''}/>`;
      if(label){
        lines += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="9" class="map-node-label" fill="${pal.connDone}" style="font-style:italic;">${escapeHtml(label)}</text>`;
      }
    });
  });

  // Strips HTML/markdown syntax down to plain text for a compact map preview.
  function plainPreview(src){
    return (src||'').replace(/<[^>]+>/g,' ').replace(/[*`_#>]/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').trim();
  }

  let boxes = '';
  visibleNodes.forEach(n=>{
    const p = pos[n.id];
    const done = isCompleted(n.id);
    const avail = isAvailable(n);
    let fill = done ? pal.doneFill : (avail ? pal.availFill : pal.lockedFill);
    if(n.mapShape==='boxErrata') fill = fill.replace(/\d+/,'255'); // errata boxes get a red tint
    const stroke = done ? pal.doneStroke : (avail ? pal.availStroke : pal.lockedStroke);
    const textColor = avail ? pal.textAvail : pal.textLocked;
    const showPlay = !manageMode && n.audio && avail;
    const playing = inlinePlayingId === n.id;
    const statusWord = done?'HEARD':avail?'AVAILABLE':'LOCKED';
    let tooltipBody;
    if(n.mapTooltip==='textOnly' && n.text) tooltipBody = plainPreview(n.text);
    else if(n.mapTooltip==='full' && n.text) tooltipBody = `${n.title} — ${statusWord}\n\n${plainPreview(n.text)}`;
    else tooltipBody = `${n.title} — ${statusWord}`;
    const tooltip = `<title>${escapeHtml(tooltipBody)}</title>`;
    // boxErrata draws like boxRule (square, dashed), only its fill differs
    const shapeMode = {playIcon:'playIcon', box:'box', boxRule:'boxRule', boxErrata:'boxRule', labelOnly:'labelOnly'}[n.mapShape] || 'circle';
    const labelMode = n.mapLabel || 'title';
    const asPlayIcon = shapeMode==='playIcon' && !!n.audio;
    const iconColor = (done||avail) ? '#161109' : pal.textLocked;

    // label source text, per the node's chosen label mode (used below the small shapes, or inside the box)
    let labelSrc = '';
    if(labelMode==='title') labelSrc = n.title;
    else if(labelMode==='text') labelSrc = plainPreview(n.text);
    else if(labelMode==='choices') labelSrc = (n.choices||[]).map(c=>c.label).join(' / ');

    let shapeSvg, labelSvg;

    if(shapeMode==='labelOnly'){
      // no shape at all — just the wrapped label text, color-coded by status since there's no fill to rely on
      const src = (labelMode==='none' || !labelSrc) ? n.title : labelSrc;
      const lines = wrapLines(src, 20, 2);
      const blockY = lines.length<=1 ? p.y+3 : p.y-4;
      shapeSvg = showPlay ? `
        <g class="map-mini-play" data-id="${n.id}" style="cursor:pointer;">
          <circle cx="${p.x}" cy="${blockY - 20}" r="9" fill="${playing?pal.doneStroke:pal.availStroke}"/>
          ${playing
            ? `<rect x="${p.x-3}" y="${blockY-24}" width="2.5" height="8" fill="#161109"/><rect x="${p.x+1.5}" y="${blockY-24}" width="2.5" height="8" fill="#161109"/>`
            : `<path d="M${p.x-2.5},${blockY-25} l8,5 l-8,5 z" fill="#161109"/>`}
        </g>` : '';
      labelSvg = lines.map((line,i)=>
        `<text x="${p.x}" y="${blockY + i*14}" text-anchor="middle" font-size="12" class="map-node-label" fill="${stroke}">${escapeHtml(line)}</text>`
      ).join('');
    } else if(shapeMode==='box'||shapeMode==='boxRule'){
      const bw = 132, bh = 60;
      const lines = labelMode==='none' ? [] : wrapLines(labelSrc, 17, 2);
      const titleBlockY = lines.length<=1 ? p.y - 2 : p.y - 11;
      const dashArray = shapeMode==='boxRule' ? '6 3' : '0';
      const rx = shapeMode==='boxRule' ? '0' : '6';
      shapeSvg = `<rect x="${p.x-bw/2}" y="${p.y-bh/2}" width="${bw}" height="${bh}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-dasharray="${dashArray}"/>`;
      labelSvg = lines.map((line,i)=>
        `<text x="${p.x}" y="${titleBlockY + i*14}" text-anchor="middle" font-size="11" class="map-node-label" fill="${textColor}">${escapeHtml(line)}</text>`
      ).join('') + `<text x="${p.x}" y="${p.y+bh/2-8}" text-anchor="middle" font-size="9" class="map-node-label" fill="${stroke}" style="letter-spacing:.06em;">${statusWord}</text>`;
      if(showPlay){
        shapeSvg += `
          <g class="map-mini-play" data-id="${n.id}" style="cursor:pointer;">
            <circle cx="${p.x+bw/2-12}" cy="${p.y-bh/2+12}" r="9" fill="${playing?pal.doneStroke:pal.availStroke}" stroke="${fill}" stroke-width="1"/>
            ${playing
              ? `<rect x="${p.x+bw/2-15}" y="${p.y-bh/2+8}" width="2.5" height="8" fill="#161109"/><rect x="${p.x+bw/2-10}" y="${p.y-bh/2+8}" width="2.5" height="8" fill="#161109"/>`
              : `<path d="M${p.x+bw/2-15.5},${p.y-bh/2+7} l9,5 l-9,5 z" fill="#161109"/>`}
          </g>`;
      }
    } else {
      // the circle (or play-icon, or its no-audio dot fallback), centered at p.x,p.y
      const isDotFallback = shapeMode==='playIcon' && !n.audio;
      const r = isDotFallback ? 9 : circleR;
      shapeSvg = `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
      if(asPlayIcon){
        shapeSvg += `
          <g class="${showPlay?'map-mini-play':''}" data-id="${n.id}" style="cursor:${showPlay?'pointer':'inherit'};">
            <circle cx="${p.x}" cy="${p.y}" r="${circleR-6}" fill="${stroke}" opacity="${avail?1:0.55}"/>
            ${playing
              ? `<rect x="${p.x-6}" y="${p.y-7}" width="4" height="14" fill="${iconColor}"/><rect x="${p.x+2}" y="${p.y-7}" width="4" height="14" fill="${iconColor}"/>`
              : `<path d="M${p.x-6},${p.y-8} L${p.x+9},${p.y} L${p.x-6},${p.y+8} Z" fill="${iconColor}"/>`}
          </g>`;
      } else if(showPlay){
        // plain circle, but still offer the click-to-preview control as a small corner badge
        shapeSvg += `
          <g class="map-mini-play" data-id="${n.id}" style="cursor:pointer;">
            <circle cx="${p.x+circleR-8}" cy="${p.y-circleR+8}" r="9" fill="${playing?pal.doneStroke:pal.availStroke}" stroke="${fill}" stroke-width="1"/>
            ${playing
              ? `<rect x="${p.x+circleR-11}" y="${p.y-circleR+4}" width="2.5" height="8" fill="#161109"/><rect x="${p.x+circleR-6}" y="${p.y-circleR+4}" width="2.5" height="8" fill="#161109"/>`
              : `<path d="M${p.x+circleR-11},${p.y-circleR+3} l9,5 l-9,5 z" fill="#161109"/>`}
          </g>`;
      }

      // label text below the shape, per the node's chosen label mode
      const labelLines = labelMode==='none' ? [] : wrapLines(labelSrc, 16, 2);
      const labelTop = p.y + circleR + 13;
      labelSvg = labelLines.map((line,i)=>
        `<text x="${p.x}" y="${labelTop + i*13}" text-anchor="middle" font-size="10.5" class="map-node-label" fill="${textColor}">${escapeHtml(line)}</text>`
      ).join('');

    }

    const mapWasSeen = seenAvailableIds.has(n.id);
    if(avail && !mapWasSeen) seenAvailableIds.add(n.id);
    const isNewMapNode = settings.animationsEnabled && !manageMode && !done && avail && !mapWasSeen;
    let manageStyle = '';
    if(manageMode){
      const nodeGroup = n.groupId ? (game.groups||[]).find(g=>g.id===n.groupId) : null;
      const isCollapsed = nodeGroup && nodeGroup.collapsed;
      manageStyle = isCollapsed ? 'opacity:.3;' : '';
    }
    boxes += `<g class="map-node${isNewMapNode?' newly-unlocked':''}" data-id="${n.id}" style="cursor:${(avail||manageMode)?'pointer':'default'};${manageStyle}">${tooltip}${shapeSvg}${labelSvg}</g>`;
  });

  mapBox.innerHTML = `<svg viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="${isVertical? 'display:block;margin:0 auto;':''}">${lines}${boxes}</svg>`;
  mapBox.querySelectorAll('.map-mini-play').forEach(g=>{
    g.addEventListener('click', (e)=>{
      e.stopPropagation();
      const n = idToNode[g.dataset.id];
      toggleInlinePlay(n, e, true);
    });
  });
  mapBox.querySelectorAll('.map-node').forEach(g=>{
    const id = g.dataset.id;
    const n = idToNode[id];
    g.addEventListener('mouseenter', ()=>{ hoveredMapNodeId = id; });
    g.addEventListener('mouseleave', ()=>{ if(hoveredMapNodeId===id) hoveredMapNodeId=null; });
    if(manageMode){
      g.addEventListener('click', ()=>{ editingNodeId = id; render(); scrollToManagePanel(); });
    } else if(isAvailable(n)){
      g.addEventListener('click', ()=>{ openReaderFor(n); });
    }
  });
  wrap.appendChild(mapBox);
  return wrap;
}

// Wraps the core single-canvas map renderer with collapsible folders matching
// Manage Codex's groups, for the player-facing view. Manage mode always shows
// the full unified graph (folders would hide structure you need while editing).
function renderCampaignMap(nodes, game){
  if(nodes.length===0){
    const empty = document.createElement('div');
    empty.innerHTML = '<div class="empty" style="border:none;">Add narrations to see the campaign map.</div>';
    return empty;
  }
  const groups = game.groups || [];
  if(manageMode || groups.length===0){
    return renderCampaignMapCore(nodes, game);
  }
  const wrap = document.createElement('div');
  const validGroupIds = groups.map(g=>g.id);
  const ungrouped = nodes.filter(n=> !n.groupId || !validGroupIds.includes(n.groupId));
  const sections = [];
  if(ungrouped.length) sections.push({id:null, name:'Ungrouped', collapsed:false, list:ungrouped});
  groups.forEach(g=>{
    const list = nodes.filter(n=>n.groupId===g.id);
    if(list.length) sections.push({id:g.id, name:g.name, collapsed:!!g.collapsed, list});
  });

  sections.forEach(sec=>{
    const header = document.createElement('div');
    header.className='group-header';
    header.style.cursor = sec.id===null ? 'default' : 'pointer';
    header.innerHTML = sec.id===null
      ? `<span class="group-name">Ungrouped</span>`
      : `<button class="group-toggle" type="button">${sec.collapsed?'▸':'▾'}</button><span class="group-name">${escapeHtml(sec.name)}</span>`;
    wrap.appendChild(header);
    if(!sec.collapsed){
      wrap.appendChild(renderCampaignMapCore(sec.list, game, sec.id===null ? null : groups.find(x=>x.id===sec.id)));
    }
    if(sec.id!==null){
      header.querySelector('.group-toggle').onclick = async ()=>{
        const g = groups.find(x=>x.id===sec.id);
        if(g){ g.collapsed = !g.collapsed; await sSet('game:'+game.id, game); render(); }
      };
    }
  });
  return wrap;
}

function scrollToManagePanel(){
  setTimeout(()=>{
    const el = document.querySelector('.manage-panel');
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  }, 30);
}
