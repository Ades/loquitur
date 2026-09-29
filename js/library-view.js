// © 2026 Anders Ive. All Rights Reserved.
// Library view, available game structures, and the Add / Edit game window.
"use strict";

// ---------------- Library view ----------------
function renderLibrary(){
  const wrap = document.createElement('div');
  const head = document.createElement('div');
  head.className='library-head';
  head.innerHTML = `<div><div class="eyebrow">The shelf</div><h2 style="font-size:22px;margin-top:4px;">Your games</h2></div>`;
  wrap.appendChild(head);

  // with an empty shelf, point new visitors at the ready-made games offered below
  if(games.length===0 && !manageMode){
    const empty = document.createElement('div');
    empty.className='empty';
    empty.innerHTML = importCandidates && importCandidates.length
      ? `<h3>No games on the shelf yet</h3><p>Add one of the games below to start playing, or switch to "Manage codex" to create your own.</p>`
      : `<h3>No games on the shelf yet</h3><p>Switch to "Manage codex" to add your first game and its narrations, or load a structure file below.</p>`;
    wrap.appendChild(empty);
    wrap.appendChild(renderAvailableStructures());
    return wrap;
  }

  const grid = document.createElement('div');
  grid.className='grid';
  games.forEach(g=>{
    const nodes = nodesByGame[g.id]||[];
    const total = nodes.length;
    const completedCount = nodes.filter(n=>isCompleted(n.id)).length;
    const card = document.createElement('div');
    card.className='game-card';
    card.setAttribute('style', gameAccentVars(g));
    card.innerHTML = `
      <div class="art" style="${bgImageStyle(g.image)}">${g.image?'':ICON_PICTURE}</div>
      ${manageMode? `<button class="game-card-delete" data-delgame="${g.id}" title="Remove this game">&times;</button>` : ''}
      <div class="body">
        <h3>${renderTitle(g.name)}</h3>
        <div class="node-card-text">${renderMarkdown(g.description||'')}</div>
        <div class="stat-row"><span>${total} NARRATION${total===1?'':'S'}</span><span>${completedCount}/${total} HEARD</span></div>
      </div>
    `;
    card.onclick = ()=>{ route = {view:'game', gameId:g.id}; gameSubView='shelf'; editingNodeId=null; render(); };
    if(manageMode){
      const delBtn = card.querySelector('[data-delgame]');
      delBtn.onclick = async (e)=>{
        e.stopPropagation();
        if(!confirm(`Remove "${g.name}" and all its narrations? This cannot be undone.`)) return;
        await deleteGame(g);
        toast('Game removed.');
        render();
      };
    }
    grid.appendChild(card);
  });

  if(manageMode){
    const addCard = document.createElement('div');
    addCard.className='add-card';
    addCard.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5v14M5 12h14"/></svg><span>Add a game</span>`;
    addCard.onclick = ()=>openGameModal(null);
    grid.appendChild(addCard);
  }
  wrap.appendChild(grid);
  wrap.appendChild(renderAvailableStructures());
  return wrap;
}

// ---------------- Available game structures (from a loaded file, not yet in Your Games) ----------------
function renderAvailableStructures(){
  const section = document.createElement('div');
  section.style.marginTop='28px';

  const head = document.createElement('div');
  head.className='library-head';
  head.innerHTML = `<div><div class="eyebrow">From a file</div><h2 style="font-size:18px;margin-top:4px;">Available game structures</h2></div>`;
  const loadBtn = document.createElement('button');
  loadBtn.className='btn ghost small';
  loadBtn.textContent = 'Load a structure file…';
  const fileInp = document.createElement('input');
  fileInp.type='file'; fileInp.accept='application/json'; fileInp.style.display='none';
  loadBtn.onclick = ()=> fileInp.click();
  fileInp.onchange = async ()=>{
    const f = fileInp.files[0];
    fileInp.value='';
    if(!f) return;
    try{
      const loaded = await importLibraryFromFile(f);
      const existingIds = new Set(games.map(g=>g.id));
      importCandidates = loaded.games
        .filter(g=>!existingIds.has(g.id))
        .map(g=>({game:g, nodes: loaded.nodesByGame[g.id]||[]}));
      if(importCandidates.length===0){
        toast('Every game in that file is already in Your Games.');
        importCandidates = null;
      }
      render();
    }catch(e){ toast(e.message); }
  };
  if(importCandidates===null && !defaultCodexRequested){
    defaultCodexRequested = true;
    loadDefaultCodex();
  }

  head.appendChild(loadBtn);
  head.appendChild(fileInp);
  section.appendChild(head);

  if(!importCandidates || importCandidates.length===0){
    const empty = document.createElement('div');
    empty.className='empty';
    empty.innerHTML = `<h3>Nothing loaded yet</h3><p>Load a "structure" file — the kind Settings → "Save structure to file" produces — to see any games in it that aren't already in Your Games, and add them individually.</p>`;
    section.appendChild(empty);
    return section;
  }

  const grid = document.createElement('div');
  grid.className='grid';
  importCandidates.forEach(cand=>{
    const g = cand.game;
    const card = document.createElement('div');
    card.className='game-card';
    card.style.cursor='default';
    card.innerHTML = `
      <div class="art" style="${bgImageStyle(g.image)}">${g.image?'':ICON_PICTURE}</div>
      <div class="body">
        <h3>${renderTitle(g.name)}</h3>
        <div class="node-card-text">${renderMarkdown(g.description||'')}</div>
        <div class="stat-row"><span>${cand.nodes.length} NARRATION${cand.nodes.length===1?'':'S'}</span><span></span></div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn primary small" data-add="1">Add to Your Games</button>
          <button class="btn ghost small" data-dismiss="1">Dismiss</button>
        </div>
      </div>
    `;
    card.querySelector('[data-add]').onclick = async ()=>{
      const ok = await sSet('game:'+g.id, g);
      if(!ok){ toast('Could not add this game — please try again.'); return; }
      await sSet('node-index:'+g.id, cand.nodes.map(n=>n.id));
      for(const n of cand.nodes){ await sSet('node:'+n.id, n); }
      const idx = await sGet('game-index') || [];
      idx.push(g.id);
      await sSet('game-index', idx);
      games.push(g);
      nodesByGame[g.id] = cand.nodes;
      importCandidates = importCandidates.filter(c=>c!==cand);
      toast(`"${g.name}" added to Your Games.`);
      render();
    };
    card.querySelector('[data-dismiss]').onclick = ()=>{
      importCandidates = importCandidates.filter(c=>c!==cand);
      render();
    };
    grid.appendChild(card);
  });
  section.appendChild(grid);
  return section;
}

// ---------------- Add / Edit Game modal ----------------
function openGameModal(existingGame){
  const overlay = document.createElement('div');
  overlay.className='reader-overlay' + (settings.animationsEnabled ? ' anim-in' : '');
  overlay.innerHTML = `
    <div class="reader" style="max-width:520px;">
      <div class="content reader-relative">
        <button class="close" id="closeAddGame">&times;</button>
        <h2 style="margin-bottom:18px;">${existingGame? 'Edit game' : 'Add a game'}</h2>
        <div class="field"><label>Name</label><input type="text" id="ngName" placeholder="e.g. Ashen Vault" value="${existingGame? escapeHtml(existingGame.name):''}"></div>
        <div class="field"><label>Description</label><textarea id="ngDesc" placeholder="One or two lines about the game">${existingGame? escapeHtml(existingGame.description||''):''}</textarea><div class="hint">Supports basic Markdown and raw HTML, same as narration text.</div></div>
        <div class="field">
          <label>Cover image (optional)</label>
          <div class="media-toggle" id="ngImgToggle">
            ${existingGame && existingGame.image? `<button type="button" class="active" data-m="keep">Keep current</button>`:''}
            <button type="button" data-m="file">Upload</button>
            <button type="button" data-m="url">Web URL</button>
            <button type="button" data-m="path" class="${existingGame && existingGame.image? '':'active'}">Local file path</button>
          </div>
          <input type="file" id="ngImgFile" accept="image/*" style="${existingGame && existingGame.image? 'display:none;':''}">
          <input type="url" id="ngImgUrl" placeholder="https://…" style="display:none;">
          <div id="ngImgPathRow" style="display:none;">
            <input type="text" id="ngImgSubdir" placeholder="Optional subfolder, e.g. images or assets/covers" style="margin-bottom:6px;">
            <div class="path-picker-row">
              <input type="text" id="ngImgPath" placeholder="e.g. images/cover.jpg or file:///C:/Games/cover.jpg">
              <button type="button" class="btn ghost small" id="ngImgPathBrowse">Browse…</button>
              <input type="file" id="ngImgPathPicker" accept="image/*" style="display:none;">
            </div>
          </div>
          <div id="ngImgStatus">${existingGame && existingGame.image? '<div class="file-status">A cover image is attached — pick another option to replace it.</div>':''}</div>
          <div class="hint">Local file paths are used as-is and only load if this page is opened directly from your computer, with the path given relative to this HTML file (or as a full file:// path). Set the subfolder once, then "Browse…" fills in the filename — together they form the full relative path. Browsers only ever expose the filename, never the folder, so this is the only way to get a subfolder in there automatically.</div>
        </div>
        <div class="field">
          <label>Color style</label>
          <select id="ngStylePreset" style="background:var(--bg);border:1px solid var(--line);color:var(--parchment);padding:8px 10px;border-radius:var(--radius);font-family:'Spectral',serif;font-size:13px;width:100%;">
            ${Object.keys(GAME_STYLES).map(k=>`<option value="${k}" ${((existingGame&&existingGame.stylePreset)||'default')===k?'selected':''}>${GAME_STYLES[k].label}</option>`).join('')}
          </select>
          <div class="hint">A quick starting point — pick a custom color below to override any of it.</div>
        </div>
        <div class="field">
          <label>Custom colors (optional)</label>
          <div class="field-row">
            ${['dark','light'].map(mode=>{
              const eff = effectiveGameColors(existingGame, mode);
              const custom = (existingGame && existingGame.customColors && existingGame.customColors[mode]) || {};
              return `
              <div class="field">
                <label style="text-transform:none;font-size:11px;">${mode==='dark'?'Dark mode':'Light mode'}</label>
                <div style="border:1px solid var(--line);border-radius:var(--radius);padding:10px;background:var(--bg);">
                  ${COLOR_ROLES.map(role=>`
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
                      <span style="font-size:12px;color:var(--parchment-dim);">${COLOR_ROLE_LABELS[role]}</span>
                      <span style="display:flex;align-items:center;gap:6px;">
                        <input type="color" id="ngColor-${mode}-${role}" value="${custom[role] || eff[role]}" ${!custom[role]?'data-cleared="1"':''} style="width:34px;height:24px;padding:0;border:1px solid var(--line);border-radius:3px;background:none;cursor:pointer;">
                        <button type="button" class="small-x" data-clear-color="${mode}-${role}" data-default-color="${eff[role]}" title="Reset to default" style="width:22px;height:22px;font-size:12px;">↺</button>
                      </span>
                    </div>
                  `).join('')}
                </div>
              </div>`;
            }).join('')}
          </div>
          <div class="hint">Overrides this game's background, panel, and accent colors independently for dark and light mode. Leave any color at its default (↺ resets it) to keep following the color style above.</div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Title font</label>
            <select id="ngTitleFont" style="background:var(--bg);border:1px solid var(--line);color:var(--parchment);padding:8px 10px;border-radius:var(--radius);font-family:'Spectral',serif;font-size:13px;width:100%;">
              ${Object.keys(TITLE_FONTS).map(k=>`<option value="${k}" ${((existingGame&&existingGame.titleFont)||'cinzel')===k?'selected':''}>${TITLE_FONTS[k].label}</option>`).join('')}
              <option value="custom" ${existingGame && existingGame.titleFont==='custom'?'selected':''}>Custom (your own font file)</option>
            </select>
            <div id="ngTitleCustomWrap" style="display:${existingGame && existingGame.titleFont==='custom'?'block':'none'};margin-top:8px;">
              <div class="media-toggle" id="ngTitleCustomToggle">
                ${existingGame && existingGame.customTitleFont && existingGame.customTitleFont.source? `<button type="button" class="active" data-m="keep">Keep current</button>`:''}
                <button type="button" data-m="file">Upload</button>
                <button type="button" data-m="url">Web URL</button>
                <button type="button" data-m="path" class="${existingGame && existingGame.customTitleFont && existingGame.customTitleFont.source? '':'active'}">Local file path</button>
              </div>
              <input type="file" id="ngTitleFontFile" accept=".woff,.woff2,.ttf,.otf,font/*" style="${existingGame && existingGame.customTitleFont && existingGame.customTitleFont.source? 'display:none;':''}">
              <input type="url" id="ngTitleFontUrl" placeholder="https://…/font.woff2" style="display:none;">
              <div id="ngTitleFontPathRow" style="display:none;">
                <input type="text" id="ngTitleFontSubdir" placeholder="Optional subfolder, e.g. fonts" style="margin-bottom:6px;">
                <div class="path-picker-row">
                  <input type="text" id="ngTitleFontPath" placeholder="e.g. fonts/title.woff2" value="${existingGame && existingGame.customTitleFont && existingGame.customTitleFont.source && !/^https?:\/\//i.test(existingGame.customTitleFont.source) && !existingGame.customTitleFont.source.startsWith('data:') ? escapeHtml(existingGame.customTitleFont.source) : ''}">
                  <button type="button" class="btn ghost small" id="ngTitleFontPathBrowse">Browse…</button>
                  <input type="file" id="ngTitleFontPathPicker" accept=".woff,.woff2,.ttf,.otf,font/*" style="display:none;">
                </div>
              </div>
              <div id="ngTitleFontStatus">${existingGame && existingGame.customTitleFont && existingGame.customTitleFont.source? '<div class="file-status">A custom title font is attached — pick another option to replace it.</div>':''}</div>
              <div class="hint">.woff2, .woff, .ttf or .otf. Uploaded files under ${fmtBytes(MAX_FONT_BYTES)} are stored directly; URLs and local file paths have no size limit.</div>
            </div>
          </div>
          <div class="field">
            <label>Text font</label>
            <select id="ngTextFont" style="background:var(--bg);border:1px solid var(--line);color:var(--parchment);padding:8px 10px;border-radius:var(--radius);font-family:'Spectral',serif;font-size:13px;width:100%;">
              ${Object.keys(TEXT_FONTS).map(k=>`<option value="${k}" ${((existingGame&&existingGame.textFont)||'spectral')===k?'selected':''}>${TEXT_FONTS[k].label}</option>`).join('')}
              <option value="custom" ${existingGame && existingGame.textFont==='custom'?'selected':''}>Custom (your own font file)</option>
            </select>
            <div id="ngTextCustomWrap" style="display:${existingGame && existingGame.textFont==='custom'?'block':'none'};margin-top:8px;">
              <div class="media-toggle" id="ngTextCustomToggle">
                ${existingGame && existingGame.customTextFont && existingGame.customTextFont.source? `<button type="button" class="active" data-m="keep">Keep current</button>`:''}
                <button type="button" data-m="file">Upload</button>
                <button type="button" data-m="url">Web URL</button>
                <button type="button" data-m="path" class="${existingGame && existingGame.customTextFont && existingGame.customTextFont.source? '':'active'}">Local file path</button>
              </div>
              <input type="file" id="ngTextFontFile" accept=".woff,.woff2,.ttf,.otf,font/*" style="${existingGame && existingGame.customTextFont && existingGame.customTextFont.source? 'display:none;':''}">
              <input type="url" id="ngTextFontUrl" placeholder="https://…/font.woff2" style="display:none;">
              <div id="ngTextFontPathRow" style="display:none;">
                <input type="text" id="ngTextFontSubdir" placeholder="Optional subfolder, e.g. fonts" style="margin-bottom:6px;">
                <div class="path-picker-row">
                  <input type="text" id="ngTextFontPath" placeholder="e.g. fonts/body.woff2" value="${existingGame && existingGame.customTextFont && existingGame.customTextFont.source && !/^https?:\/\//i.test(existingGame.customTextFont.source) && !existingGame.customTextFont.source.startsWith('data:') ? escapeHtml(existingGame.customTextFont.source) : ''}">
                  <button type="button" class="btn ghost small" id="ngTextFontPathBrowse">Browse…</button>
                  <input type="file" id="ngTextFontPathPicker" accept=".woff,.woff2,.ttf,.otf,font/*" style="display:none;">
                </div>
              </div>
              <div id="ngTextFontStatus">${existingGame && existingGame.customTextFont && existingGame.customTextFont.source? '<div class="file-status">A custom text font is attached — pick another option to replace it.</div>':''}</div>
              <div class="hint">.woff2, .woff, .ttf or .otf. Uploaded files under ${fmtBytes(MAX_FONT_BYTES)} are stored directly; URLs and local file paths have no size limit.</div>
            </div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
          <button class="btn ghost" id="cancelAddGame">Cancel</button>
          <button class="btn primary" id="saveAddGame">${existingGame? 'Save changes' : 'Save game'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = ()=>overlay.remove();
  overlay.querySelector('#closeAddGame').onclick = close;
  overlay.querySelector('#cancelAddGame').onclick = close;
  overlay.onclick = (e)=>{ if(e.target===overlay) close(); };

  const toggles = overlay.querySelector('#ngImgToggle').querySelectorAll('button');
  const fileInp = overlay.querySelector('#ngImgFile');
  const urlInp = overlay.querySelector('#ngImgUrl');
  const pathRow = overlay.querySelector('#ngImgPathRow');
  const pathInp = overlay.querySelector('#ngImgPath');
  const status = overlay.querySelector('#ngImgStatus');
  function showOnly(mode){
    fileInp.style.display = mode==='file' ? 'block' : 'none';
    urlInp.style.display = mode==='url' ? 'block' : 'none';
    pathRow.style.display = mode==='path' ? 'block' : 'none';
  }
  toggles.forEach(b=>b.onclick=()=>{
    toggles.forEach(x=>x.classList.remove('active')); b.classList.add('active');
    status.innerHTML='';
    showOnly(b.dataset.m);
  });
  fileInp.onchange = ()=>{
    status.innerHTML = fileInp.files[0] ? `<div class="file-status">Selected: ${escapeHtml(fileInp.files[0].name)} (${fmtBytes(fileInp.files[0].size)}) — will be resized to fit.</div>` : '';
  };
  let ngImgLastPicked = '';
  const ngImgSubdirInp = overlay.querySelector('#ngImgSubdir');
  overlay.querySelector('#ngImgPathBrowse').onclick = ()=> overlay.querySelector('#ngImgPathPicker').click();
  overlay.querySelector('#ngImgPathPicker').onchange = (e)=>{
    const f = e.target.files[0];
    if(f){ ngImgLastPicked = f.name; pathInp.value = joinSubdirPath(ngImgSubdirInp.value, ngImgLastPicked); }
  };
  ngImgSubdirInp.oninput = ()=>{ if(ngImgLastPicked) pathInp.value = joinSubdirPath(ngImgSubdirInp.value, ngImgLastPicked); };
  // with an existing image, the default 'keep' mode already hides file/url/path
  if(!(existingGame && existingGame.image)) showOnly('file');

  // custom font panels: select toggles visibility, media-toggle groups behave like other file/url/path pickers
  function wireFontPanel(prefix){
    const wrap = overlay.querySelector('#ng'+prefix+'CustomWrap');
    const toggleGroup = overlay.querySelector('#ng'+prefix+'CustomToggle');
    const fFile = overlay.querySelector('#ng'+prefix+'FontFile');
    const fUrl = overlay.querySelector('#ng'+prefix+'FontUrl');
    const fPathRow = overlay.querySelector('#ng'+prefix+'FontPathRow');
    const fPath = overlay.querySelector('#ng'+prefix+'FontPath');
    const fStatus = overlay.querySelector('#ng'+prefix+'FontStatus');
    const btns = toggleGroup.querySelectorAll('button');
    btns.forEach(b=>b.onclick=()=>{
      btns.forEach(x=>x.classList.remove('active')); b.classList.add('active');
      fFile.style.display = b.dataset.m==='file' ? 'block' : 'none';
      fUrl.style.display = b.dataset.m==='url' ? 'block' : 'none';
      fPathRow.style.display = b.dataset.m==='path' ? 'block' : 'none';
    });
    fFile.onchange = ()=>{
      const f = fFile.files[0];
      if(!f){ fStatus.innerHTML=''; return; }
      if(f.size > MAX_FONT_BYTES){
        fStatus.innerHTML = `<div class="file-error">${escapeHtml(f.name)} is ${fmtBytes(f.size)} — over the ${fmtBytes(MAX_FONT_BYTES)} limit. Use a smaller file or paste a URL/path instead.</div>`;
      } else {
        fStatus.innerHTML = `<div class="file-status">Selected: ${escapeHtml(f.name)} (${fmtBytes(f.size)})</div>`;
      }
    };
    let lastPicked = '';
    const subdirInp = overlay.querySelector('#ng'+prefix+'FontSubdir');
    overlay.querySelector('#ng'+prefix+'FontPathBrowse').onclick = ()=> overlay.querySelector('#ng'+prefix+'FontPathPicker').click();
    overlay.querySelector('#ng'+prefix+'FontPathPicker').onchange = (e)=>{
      const f = e.target.files[0];
      if(f){ lastPicked = f.name; fPath.value = joinSubdirPath(subdirInp.value, lastPicked); }
    };
    subdirInp.oninput = ()=>{ if(lastPicked) fPath.value = joinSubdirPath(subdirInp.value, lastPicked); };
  }
  wireFontPanel('Title');
  wireFontPanel('Text');
  overlay.querySelector('#ngTitleFont').onchange = (e)=>{
    overlay.querySelector('#ngTitleCustomWrap').style.display = e.target.value==='custom' ? 'block' : 'none';
  };
  overlay.querySelector('#ngTextFont').onchange = (e)=>{
    overlay.querySelector('#ngTextCustomWrap').style.display = e.target.value==='custom' ? 'block' : 'none';
  };

  overlay.querySelector('#ngStylePreset').onchange = (e)=>{
    const tempGame = {stylePreset: e.target.value};
    ['dark','light'].forEach(mode=>{
      const eff = effectiveGameColors(tempGame, mode);
      COLOR_ROLES.forEach(role=>{
        const inp = overlay.querySelector('#ngColor-'+mode+'-'+role);
        const btn = overlay.querySelector('[data-clear-color="'+mode+'-'+role+'"]');
        if(btn) btn.dataset.defaultColor = eff[role];
        if(inp && inp.dataset.cleared==='1'){ inp.value = eff[role]; }
      });
    });
  };
  overlay.querySelectorAll('input[id^="ngColor-"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{ delete inp.dataset.cleared; });
  });
  overlay.querySelectorAll('[data-clear-color]').forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.dataset.clearColor;
      const inp = overlay.querySelector('#ngColor-'+key);
      if(inp){ inp.value = btn.dataset.defaultColor; inp.dataset.cleared='1'; }
    };
  });

  overlay.querySelector('#saveAddGame').onclick = async ()=>{
    const name = overlay.querySelector('#ngName').value.trim();
    if(!name){ toast('Give the game a name first.'); return; }
    const btn = overlay.querySelector('#saveAddGame');
    btn.disabled = true; btn.textContent = 'Saving…';
    let image = existingGame ? (existingGame.image||'') : '';
    const activeMode = overlay.querySelector('#ngImgToggle button.active').dataset.m;
    try{
      if(activeMode==='file' && fileInp.files[0]){
        image = await compressImage(fileInp.files[0]);
      } else if(activeMode==='url'){
        image = urlInp.value.trim();
      } else if(activeMode==='path'){
        image = pathInp.value.trim();
      } else if(activeMode==='file' && !fileInp.files[0] && !existingGame){
        image = '';
      }
    }catch(e){
      toast(e.message);
      btn.disabled=false; btn.textContent = existingGame? 'Save changes':'Save game';
      return;
    }
    const id = existingGame ? existingGame.id : uid();
    const groups = existingGame ? existingGame.groups : [];

    const titleFontVal = overlay.querySelector('#ngTitleFont').value;
    const textFontVal = overlay.querySelector('#ngTextFont').value;
    let customTitleFont = existingGame ? existingGame.customTitleFont : null;
    let customTextFont = existingGame ? existingGame.customTextFont : null;
    try{
      if(titleFontVal==='custom'){
        const mode = overlay.querySelector('#ngTitleCustomToggle button.active').dataset.m;
        const family = customFontFamily(id, 'title');
        if(mode==='file' && overlay.querySelector('#ngTitleFontFile').files[0]){
          customTitleFont = {family, source: await readFontFile(overlay.querySelector('#ngTitleFontFile').files[0])};
        } else if(mode==='url'){
          customTitleFont = {family, source: overlay.querySelector('#ngTitleFontUrl').value.trim()};
        } else if(mode==='path'){
          customTitleFont = {family, source: overlay.querySelector('#ngTitleFontPath').value.trim()};
        } else if(mode==='keep' && customTitleFont){
          customTitleFont = {family, source: customTitleFont.source};
        }
      }
      if(textFontVal==='custom'){
        const mode = overlay.querySelector('#ngTextCustomToggle button.active').dataset.m;
        const family = customFontFamily(id, 'text');
        if(mode==='file' && overlay.querySelector('#ngTextFontFile').files[0]){
          customTextFont = {family, source: await readFontFile(overlay.querySelector('#ngTextFontFile').files[0])};
        } else if(mode==='url'){
          customTextFont = {family, source: overlay.querySelector('#ngTextFontUrl').value.trim()};
        } else if(mode==='path'){
          customTextFont = {family, source: overlay.querySelector('#ngTextFontPath').value.trim()};
        } else if(mode==='keep' && customTextFont){
          customTextFont = {family, source: customTextFont.source};
        }
      }
    }catch(e){
      toast(e.message);
      btn.disabled=false; btn.textContent = existingGame? 'Save changes':'Save game';
      return;
    }

    const customColors = {};
    ['dark','light'].forEach(mode=>{
      const modeColors = {};
      COLOR_ROLES.forEach(role=>{
        const inp = overlay.querySelector('#ngColor-'+mode+'-'+role);
        if(inp && inp.dataset.cleared!=='1'){ modeColors[role] = inp.value; }
      });
      if(Object.keys(modeColors).length) customColors[mode] = modeColors;
    });

    const game = {
      id, name,
      description: overlay.querySelector('#ngDesc').value.trim(),
      image,
      stylePreset: overlay.querySelector('#ngStylePreset').value,
      customColors,
      titleFont: titleFontVal,
      textFont: textFontVal,
      customTitleFont, customTextFont,
      groups,
      createdAt: existingGame ? existingGame.createdAt : Date.now()
    };
    const ok = await sSet('game:'+id, game);
    if(!ok){ toast('Could not save the game — please try again, or link the image instead of uploading it.'); btn.disabled=false; btn.textContent = existingGame? 'Save changes':'Save game'; return; }
    if(existingGame){
      games = games.map(g=> g.id===id ? game : g);
      toast('Game details updated.');
    } else {
      const idx = await sGet('game-index') || [];
      idx.push(id);
      await sSet('game-index', idx);
      games.push(game);
      nodesByGame[id] = [];
      toast('Game added to the shelf.');
    }
    close();
    render();
  };
}
