// © 2026 Anders Ive. All Rights Reserved.
// Manage codex panel: add / edit narrations, groups, drag-and-drop ordering.
"use strict";

// ---------------- Manage panel (per-game): add + edit narrations ----------------
function renderManagePanel(game){
  const nodes = nodesByGame[game.id]||[];
  const editingNode = editingNodeId ? nodes.find(n=>n.id===editingNodeId) : null;
  const pending = (!editingNode && pendingPasteImport) ? pendingPasteImport : null;
  const panel = document.createElement('div');
  panel.className='manage-panel';

  const otherNodes = nodes.filter(n=> !editingNode || n.id !== editingNode.id);
  const normEditingPrereqs = editingNode ? normalizedPrereqs(editingNode) : [];
  const existingPrereqIds = normEditingPrereqs.map(p=>p.nodeId);
  const existingPrereqChoice = {};
  const existingPrereqGroup = {};
  normEditingPrereqs.forEach(p=>{ existingPrereqChoice[p.nodeId] = p.choiceId || ''; existingPrereqGroup[p.nodeId] = p.group || 'all'; });

  panel.innerHTML = `
    <h3>
      <span>${editingNode? `Editing “${escapeHtml(editingNode.title)}”` : `Add a narration to “${escapeHtml(game.name)}”`}</span>
      <span style="display:flex;gap:8px;">
        <button class="btn ghost small" id="editGameBtn">Edit game details</button>
        ${editingNode? `<button class="btn ghost small" id="cancelEdit">Cancel edit</button>` : ''}
      </span>
    </h3>
    <div class="field-row">
      <div class="field"><label>Title</label><input type="text" id="nTitle" placeholder="e.g. The Sunken Shrine" value="${editingNode? escapeHtml(editingNode.title) : (pending? escapeHtml(pending.title) : '')}"></div>
      <div class="field">
        <label>Group</label>
        <select id="nGroup" style="background:var(--bg);border:1px solid var(--line);color:var(--parchment);padding:10px 12px;border-radius:var(--radius);font-family:'Spectral',serif;font-size:14px;width:100%;">
          <option value="">No group</option>
          ${(game.groups||[]).map(g=>`<option value="${g.id}" ${editingNode && editingNode.groupId===g.id?'selected':''}>${escapeHtml(g.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field-row">
      <label class="setting-toggle"><input type="checkbox" id="nHidden" ${editingNode && editingNode.hidden?'checked':''}> Hidden — only visible in "Manage codex"</label>
      <label class="setting-toggle"><input type="checkbox" id="nAutoComplete" ${editingNode && editingNode.completedByDefault?'checked':''}> Completed by default — completes itself as soon as its prerequisites are met, no player action needed</label>
    </div>
    <div class="hint" style="margin-bottom:14px;">With no prerequisites set, this narration is complete from the very start. With prerequisites set, it completes itself automatically the instant those are satisfied — nothing to click, no audio to play. Combine with "Hidden" for an invisible junction narration used purely to route AND/OR prerequisite logic; the app skips straight through it to whatever it unlocks.</div>
    <div class="field">
      <label>Log entry, once heard</label>
      <select id="nLogMode" style="background:var(--bg);border:1px solid var(--line);color:var(--parchment);padding:10px 12px;border-radius:var(--radius);font-family:'Spectral',serif;font-size:14px;width:100%;">
        <option value="full" ${(!editingNode || (editingNode.logMode||'full')==='full')?'selected':''}>Full — title, choice made, and result text</option>
        <option value="choicesOnly" ${editingNode && editingNode.logMode==='choicesOnly'?'selected':''}>Choices made only</option>
        <option value="titleOnly" ${editingNode && editingNode.logMode==='titleOnly'?'selected':''}>Title only</option>
        <option value="textOnly" ${editingNode && editingNode.logMode==='textOnly'?'selected':''}>Text only (accompanying text, no title)</option>
        <option value="none" ${editingNode && editingNode.logMode==='none'?'selected':''}>Don't add to the log</option>
      </select>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Map shape</label>
        <select id="nMapShape" style="background:var(--bg);border:1px solid var(--line);color:var(--parchment);padding:10px 12px;border-radius:var(--radius);font-family:'Spectral',serif;font-size:14px;width:100%;">
          <option value="box" ${(!editingNode || (editingNode.mapShape||'box')==='box')?'selected':''}>Box (label + status inside)</option>
          <option value="circle" ${(editingNode && editingNode.mapShape==='circle')?'selected':''}>Small circle</option>
          <option value="playIcon" ${editingNode && editingNode.mapShape==='playIcon'?'selected':''}>Play icon if it has audio, else a small dot</option>
          <option value="boxRule" ${editingNode && editingNode.mapShape==='boxRule'?'selected':''}>Box, rule (label + status inside)</option>
          <option value="boxErrata" ${editingNode && editingNode.mapShape==='boxErrata'?'selected':''}>Box, errata (label + status inside)</option>
        </select>
      </div>
      <div class="field">
        <label>Map label</label>
        <select id="nMapLabel" style="background:var(--bg);border:1px solid var(--line);color:var(--parchment);padding:10px 12px;border-radius:var(--radius);font-family:'Spectral',serif;font-size:14px;width:100%;">
          <option value="title" ${(!editingNode || (editingNode.mapLabel||'title')==='title')?'selected':''}>Title only</option>
          <option value="text" ${editingNode && editingNode.mapLabel==='text'?'selected':''}>Accompanying text</option>
          <option value="choices" ${editingNode && editingNode.mapLabel==='choices'?'selected':''}>Choice options</option>
          <option value="none" ${editingNode && editingNode.mapLabel==='none'?'selected':''}>No text at all</option>
        </select>
      </div>
      <div class="field">
        <label>Map tooltip</label>
        <select id="nMapTooltip" style="background:var(--bg);border:1px solid var(--line);color:var(--parchment);padding:10px 12px;border-radius:var(--radius);font-family:'Spectral',serif;font-size:14px;width:100%;">
          <option value="title" ${(!editingNode || (editingNode.mapTooltip||'title')==='title')?'selected':''}>Title only</option>
          <option value="full" ${editingNode && editingNode.mapTooltip==='full'?'selected':''}>Title + full text</option>
          <option value="textOnly" ${editingNode && editingNode.mapTooltip==='textOnly'?'selected':''}>Text only</option>
        </select>
      </div>
    </div>
    <div class="hint" style="margin-bottom:14px;">Controls how this narration appears on the campaign map. "Play icon if it has audio, else a small dot" shows a play button for narrations with audio, and shrinks to a plain dot for ones without. "Box" fits its label and status word inside a bigger shape rather than beneath a small one. Hovering any node always shows a tooltip with its title and status — set "Map tooltip" to also include its full accompanying text there.</div>
    <div class="field"><label>Accompanying text</label><textarea id="nText" placeholder="Text shown alongside the narration">${editingNode? escapeHtml(editingNode.text||'') : (pending? escapeHtml(pending.text||'') : '')}</textarea><div class="hint">Supports basic Markdown: **bold**, *italic*, inline code with backticks, [links](url), "- " bullet lists — and raw HTML, which is rendered directly.</div></div>

    <div class="field-row">
      <div class="field">
        <label>Narration audio</label>
        <div class="media-toggle" data-t="audio">
          ${editingNode && editingNode.audio? `<button type="button" class="active" data-m="keep">Keep current</button>`:''}
          <button type="button" data-m="file">Upload file</button>
          <button type="button" data-m="url">Web URL</button>
          <button type="button" data-m="path" class="${editingNode && editingNode.audio? '':'active'}">Local file path</button>
        </div>
        <input type="file" id="nAudioFile" accept="audio/*" style="${editingNode && editingNode.audio? 'display:none;':''}">
        <input type="url" id="nAudioUrl" placeholder="https://…" style="display:none;">
        <div id="nAudioPathRow" style="display:none;">
          <input type="text" id="nAudioSubdir" placeholder="Optional subfolder, e.g. audio or assets/narration" style="margin-bottom:6px;">
          <div class="path-picker-row">
            <input type="text" id="nAudioPath" placeholder="e.g. audio/shrine.mp3 or file:///C:/Games/shrine.mp3" value="${editingNode && editingNode.audio && !/^https?:\/\//i.test(editingNode.audio) && !editingNode.audio.startsWith('data:') ? escapeHtml(editingNode.audio) : ''}">
            <button type="button" class="btn ghost small" id="nAudioPathBrowse">Browse…</button>
            <input type="file" id="nAudioPathPicker" accept="audio/*" style="display:none;">
          </div>
        </div>
        <div id="nAudioStatus">${editingNode && editingNode.audio? '<div class="file-status">Current audio is attached — choose another option to replace it.</div>':''}</div>
        <div class="hint">Uploaded clips must be under ${fmtBytes(MAX_AUDIO_BYTES)}. For longer recordings, either host the file online and paste its URL, or link to a local file — a path relative to this HTML file, or a full file:// path. Local paths only load when the page is opened directly from your computer. Set the subfolder once, then "Browse…" fills in the filename — together they form the full relative path, since browsers never expose the folder on their own.</div>
      </div>
      <div class="field">
        <label>Image (optional)</label>
        <div class="media-toggle" data-t="image">
          ${editingNode && editingNode.image? `<button type="button" class="active" data-m="keep">Keep current</button>`:''}
          <button type="button" data-m="file">Upload file</button>
          <button type="button" data-m="url">Web URL</button>
          <button type="button" data-m="path" class="${editingNode && editingNode.image? '':'active'}">Local file path</button>
        </div>
        <input type="file" id="nImageFile" accept="image/*" style="${editingNode && editingNode.image? 'display:none;':''}">
        <input type="url" id="nImageUrl" placeholder="https://…" style="display:none;">
        <div id="nImagePathRow" style="display:none;">
          <input type="text" id="nImageSubdir" placeholder="Optional subfolder, e.g. images or assets/narration" style="margin-bottom:6px;">
          <div class="path-picker-row">
            <input type="text" id="nImagePath" placeholder="e.g. images/shrine.jpg or file:///C:/Games/shrine.jpg" value="${editingNode && editingNode.image && !/^https?:\/\//i.test(editingNode.image) && !editingNode.image.startsWith('data:') ? escapeHtml(editingNode.image) : ''}">
            <button type="button" class="btn ghost small" id="nImagePathBrowse">Browse…</button>
            <input type="file" id="nImagePathPicker" accept="image/*" style="display:none;">
          </div>
        </div>
        <div id="nImageStatus">${editingNode && editingNode.image? '<div class="file-status">Current image is attached — choose another option to replace it.</div>':''}</div>
        <div class="hint">Uploaded photos are automatically resized. Local paths work the same way as for audio, above.</div>
        <label style="margin-top:8px;">Image position in the narration window</label>
        <select id="nImagePos" style="background:var(--bg);border:1px solid var(--line);color:var(--parchment);padding:8px 10px;border-radius:var(--radius);font-family:'Spectral',serif;font-size:13px;width:100%;">
          <option value="top" ${(!editingNode || (editingNode.imagePosition||'top')==='top')?'selected':''}>Top (banner)</option>
          <option value="bottom" ${editingNode && editingNode.imagePosition==='bottom'?'selected':''}>Bottom (banner)</option>
          <option value="left" ${editingNode && editingNode.imagePosition==='left'?'selected':''}>Left side</option>
          <option value="right" ${editingNode && editingNode.imagePosition==='right'?'selected':''}>Right side</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label>Unlocked only after (prerequisites)</label>
      <div class="prereq-box" id="prereqBox">
        ${otherNodes.length===0? '<div class="hint">No other narrations yet — this will be available from the start.</div>' :
          (()=>{
            function prereqItem(n){
            const checked = existingPrereqIds.includes(n.id);
            const hasChoices = n.choices && n.choices.length;
            const grp = existingPrereqGroup[n.id] || 'all';
            return `
            <div class="prereq-item">
              <input type="checkbox" class="prereqCk" value="${n.id}" ${checked?'checked':''}>
              <span style="flex:1;">${escapeHtml(n.title)}</span>
              <select class="prereqGroup" data-for="${n.id}" ${checked?'':'disabled'}>
                <option value="all" ${grp==='all'?'selected':''}>AND (required)</option>
                <option value="any" ${grp==='any'?'selected':''}>OR (any one)</option>
              </select>
              <select class="prereqChoice" data-for="${n.id}" ${checked?'':'disabled'}>
                <option value="">any completion</option>
                ${hasChoices? n.choices.map(c=>`<option value="${c.id}" ${existingPrereqChoice[n.id]===c.id?'selected':''}>requires choice: ${escapeHtml(c.label)}</option>`).join(''):''}
              </select>
            </div>`;
            }
            const byOrder = (a,b)=>(a.order||0)-(b.order||0);
            const gameGroups = game.groups || [];
            if(gameGroups.length===0){
              return otherNodes.slice().sort(byOrder).map(prereqItem).join('');
            }
            const validGroupIds = gameGroups.map(g=>g.id);
            const ungrouped = otherNodes.filter(n=> !n.groupId || !validGroupIds.includes(n.groupId)).sort(byOrder);
            let html = '';
            if(ungrouped.length){
              html += `<div class="prereq-group-label">Ungrouped</div>` + ungrouped.map(prereqItem).join('');
            }
            gameGroups.forEach(g=>{
              const list = otherNodes.filter(n=>n.groupId===g.id).sort(byOrder);
              if(list.length){
                html += `<div class="prereq-group-label">${escapeHtml(g.name)}</div>` + list.map(prereqItem).join('');
              }
            });
            return html;
          })()}
      </div>
      <div class="hint">Leave all unchecked for a narration available from the start. Mark a checked prerequisite "AND" if it's always required, or "OR" if satisfying just one of the OR-marked prerequisites is enough — the narration unlocks once all AND prerequisites are met, and (if any are marked OR) at least one OR prerequisite too.</div>
    </div>

    <div class="field">
      <label>Branching choices (optional)</label>
      <div id="choiceEditor"></div>
      <button class="btn ghost small" id="addChoiceBtn" type="button">+ Add a choice</button>
      <label class="setting-toggle" style="margin-top:10px;"><input type="checkbox" id="nMultiChoice" ${editingNode && editingNode.multiChoice?'checked':''}> Multiple choice — let the listener pick more than one option</label>
      <div class="hint">If you add choices, the listener picks one after hearing this narration (or several, with "multiple choice" on). Give each choice its own "what happens" text — it's shown right after the choice is made — and later narrations can require that specific choice.</div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;flex-wrap:wrap;gap:8px;">
      <span class="hint" style="margin:0;">Fast keys: <strong>Shift+Enter</strong> saves this form, <strong>Esc</strong> cancels editing, <strong>Shift+→</strong> switches the image to "Local file path", focuses it and pastes the clipboard, <strong>Shift+←</strong> does the same for the audio field, <strong>Shift+↓</strong> duplicates the last-saved narration as the next one in sequence, <strong>Shift+↑</strong> duplicates it as a plain copy with the same prerequisites, <strong>Shift+&gt;</strong> jumps to the next narration visible in an expanded group (<strong>Ctrl+&lt;</strong> for the previous one) without stealing focus from the title field, <strong>Shift+A</strong> go to next checked prerequisite.</span>
      <button class="btn primary" id="saveNode">${editingNode? 'Save changes' : 'Add narration'}</button>
    </div>

    <div class="node-manage-list">
      <div class="eyebrow" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <span>Existing narrations</span>
        <button class="btn ghost small" id="addGroupBtn" type="button">+ Add group</button>
      </div>
      <div id="narrationsList"></div>
      ${nodes.length===0? '<div class="hint">None yet.</div>' : '<div class="hint">Drag a narration by its ⠿ handle to reorder it, or drop it onto a group to file it there. Drag a group\'s ⠿ handle to reorder groups.</div>'}
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <button class="btn danger small" id="deleteGameBtn">Remove this game</button>
      </div>
    </div>
  `;

  if(editingNode){
    panel.querySelector('#cancelEdit').onclick = ()=>{ editingNodeId=null; render(); };
  }
  panel.querySelector('#editGameBtn').onclick = ()=> openGameModal(game);

  // media toggles (audio / image), each may include a "keep" option plus file / url / local-path
  panel.querySelectorAll('.media-toggle').forEach(mt=>{
    const t = mt.dataset.t;
    const btns = mt.querySelectorAll('button');
    const fileInp = panel.querySelector(t==='audio'? '#nAudioFile':'#nImageFile');
    const urlInp = panel.querySelector(t==='audio'? '#nAudioUrl':'#nImageUrl');
    const pathRow = panel.querySelector(t==='audio'? '#nAudioPathRow':'#nImagePathRow');
    btns.forEach(b=>b.onclick=()=>{
      btns.forEach(x=>x.classList.remove('active')); b.classList.add('active');
      fileInp.style.display = b.dataset.m==='file' ? 'block' : 'none';
      urlInp.style.display = b.dataset.m==='url' ? 'block' : 'none';
      pathRow.style.display = b.dataset.m==='path' ? 'block' : 'none';
    });
  });
  panel.querySelector('#nAudioFile').onchange = (e)=>{
    const f = e.target.files[0];
    const statusEl = panel.querySelector('#nAudioStatus');
    if(!f){ statusEl.innerHTML=''; return; }
    if(f.size > MAX_AUDIO_BYTES){
      statusEl.innerHTML = `<div class="file-error">${escapeHtml(f.name)} is ${fmtBytes(f.size)} — over the ${fmtBytes(MAX_AUDIO_BYTES)} limit. Use a shorter clip, paste a web URL, or link to a local file instead.</div>`;
    } else {
      statusEl.innerHTML = `<div class="file-status">Selected: ${escapeHtml(f.name)} (${fmtBytes(f.size)})</div>`;
    }
  };
  panel.querySelector('#nImageFile').onchange = (e)=>{
    const f = e.target.files[0];
    const statusEl = panel.querySelector('#nImageStatus');
    statusEl.innerHTML = f ? `<div class="file-status">Selected: ${escapeHtml(f.name)} (${fmtBytes(f.size)}) — will be resized to fit.</div>` : '';
  };
  let nAudioLastPicked = '';
  const nAudioSubdirInp = panel.querySelector('#nAudioSubdir');
  panel.querySelector('#nAudioPathBrowse').onclick = ()=> panel.querySelector('#nAudioPathPicker').click();
  panel.querySelector('#nAudioPathPicker').onchange = (e)=>{
    const f = e.target.files[0];
    if(f){ nAudioLastPicked = f.name; panel.querySelector('#nAudioPath').value = joinSubdirPath(nAudioSubdirInp.value, nAudioLastPicked); }
  };
  nAudioSubdirInp.oninput = ()=>{ if(nAudioLastPicked) panel.querySelector('#nAudioPath').value = joinSubdirPath(nAudioSubdirInp.value, nAudioLastPicked); };

  let nImageLastPicked = '';
  const nImageSubdirInp = panel.querySelector('#nImageSubdir');
  panel.querySelector('#nImagePathBrowse').onclick = ()=> panel.querySelector('#nImagePathPicker').click();
  panel.querySelector('#nImagePathPicker').onchange = (e)=>{
    const f = e.target.files[0];
    if(f){ nImageLastPicked = f.name; panel.querySelector('#nImagePath').value = joinSubdirPath(nImageSubdirInp.value, nImageLastPicked); }
  };
  nImageSubdirInp.oninput = ()=>{ if(nImageLastPicked) panel.querySelector('#nImagePath').value = joinSubdirPath(nImageSubdirInp.value, nImageLastPicked); };

  // prereq checkbox enabling group + choice dropdowns
  panel.querySelectorAll('.prereqCk').forEach(ck=>{
    const grpSel = panel.querySelector(`.prereqGroup[data-for="${ck.value}"]`);
    const choiceSel = panel.querySelector(`.prereqChoice[data-for="${ck.value}"]`);
    ck.onchange = ()=>{ grpSel.disabled = !ck.checked; choiceSel.disabled = !ck.checked; };
  });

  // choice editor (label + result text shown when that choice is played)
  let choiceRows = editingNode && editingNode.choices ? editingNode.choices.map(c=>({id:c.id, label:c.label, resultText:c.resultText||''})) : [];
  const choiceEditor = panel.querySelector('#choiceEditor');
  function renderChoiceRows(){
    choiceEditor.innerHTML = '';
    choiceRows.forEach((c,i)=>{
      const card = document.createElement('div');
      card.className='choice-editor-card';
      card.innerHTML = `
        <div class="choice-editor-row">
          <input type="text" value="${escapeHtml(c.label)}" placeholder="Choice label, e.g. Flee into the woods">
          <button type="button" class="small-x">×</button>
        </div>
        <textarea placeholder="What happens next — shown to the player right after they pick this choice" style="min-height:56px;">${escapeHtml(c.resultText)}</textarea>
      `;
      card.querySelector('input').oninput = (e)=>{ choiceRows[i].label = e.target.value; };
      card.querySelector('textarea').oninput = (e)=>{ choiceRows[i].resultText = e.target.value; };
      card.querySelector('.small-x').onclick = ()=>{ choiceRows.splice(i,1); renderChoiceRows(); };
      choiceEditor.appendChild(card);
    });
  }
  renderChoiceRows();
  panel.querySelector('#addChoiceBtn').onclick = ()=>{
    choiceRows.push({id:uid(), label:'', resultText:''});
    renderChoiceRows();
  };

  // save (add or update)
  panel.querySelector('#saveNode').onclick = async ()=>{
    const title = panel.querySelector('#nTitle').value.trim();
    if(!title){ toast('Give the narration a title.'); return; }
    const saveBtn = panel.querySelector('#saveNode');
    saveBtn.disabled = true; saveBtn.textContent='Saving…';

    let audio = editingNode ? (editingNode.audio||'') : '';
    let image = editingNode ? (editingNode.image||'') : '';

    try{
      const audioMode = panel.querySelector('.media-toggle[data-t="audio"] button.active').dataset.m;
      if(audioMode==='file' && panel.querySelector('#nAudioFile').files[0]){
        audio = await readAudioFile(panel.querySelector('#nAudioFile').files[0]);
      } else if(audioMode==='url'){
        audio = panel.querySelector('#nAudioUrl').value.trim();
      } else if(audioMode==='path'){
        audio = panel.querySelector('#nAudioPath').value.trim();
      } else if(audioMode==='file' && !panel.querySelector('#nAudioFile').files[0] && !editingNode){
        audio = '';
      }
      const imageMode = panel.querySelector('.media-toggle[data-t="image"] button.active').dataset.m;
      if(imageMode==='file' && panel.querySelector('#nImageFile').files[0]){
        image = await compressImage(panel.querySelector('#nImageFile').files[0]);
      } else if(imageMode==='url'){
        image = panel.querySelector('#nImageUrl').value.trim();
      } else if(imageMode==='path'){
        image = panel.querySelector('#nImagePath').value.trim();
      } else if(imageMode==='file' && !panel.querySelector('#nImageFile').files[0] && !editingNode){
        image = '';
      }
    }catch(e){
      toast(e.message);
      saveBtn.disabled=false; saveBtn.textContent = editingNode? 'Save changes':'Add narration';
      return;
    }

    const prerequisites = [];
    panel.querySelectorAll('.prereqCk').forEach(ck=>{
      if(ck.checked){
        const grpSel = panel.querySelector(`.prereqGroup[data-for="${ck.value}"]`);
        const choiceSel = panel.querySelector(`.prereqChoice[data-for="${ck.value}"]`);
        prerequisites.push({nodeId: ck.value, choiceId: choiceSel.value || null, group: grpSel.value || 'all'});
      }
    });
    const choices = choiceRows.filter(c=>c.label.trim()).map(c=>({id:c.id, label:c.label.trim(), resultText:(c.resultText||'').trim()}));
    const multiChoice = panel.querySelector('#nMultiChoice').checked;
    const imagePosition = panel.querySelector('#nImagePos').value;
    const hidden = panel.querySelector('#nHidden').checked;
    const completedByDefault = panel.querySelector('#nAutoComplete').checked;
    const logMode = panel.querySelector('#nLogMode').value;
    const mapShape = panel.querySelector('#nMapShape').value;
    const mapLabel = panel.querySelector('#nMapLabel').value;
    const mapTooltip = panel.querySelector('#nMapTooltip').value;
    const groupId = panel.querySelector('#nGroup').value || null;
    let order = editingNode ? (editingNode.order||0) : 0;
    if(!editingNode){
      const siblings = nodes.filter(n=> (n.groupId||null) === groupId);
      order = siblings.length ? Math.max(...siblings.map(n=>n.order||0)) + 1 : 0;
    }

    const id = editingNode ? editingNode.id : uid();
    const node = {
      id, gameId: game.id, title,
      text: panel.querySelector('#nText').value.trim(),
      audio, image, imagePosition, prerequisites, choices, multiChoice,
      hidden, completedByDefault, logMode, mapShape, mapLabel, mapTooltip, groupId, order,
      createdAt: editingNode ? editingNode.createdAt : Date.now()
    };

    const ok = await sSet('node:'+id, node);
    if(!ok){ toast('Could not save — please try again, or use a URL instead of uploading.'); saveBtn.disabled=false; saveBtn.textContent = editingNode? 'Save changes':'Add narration'; return; }
    lastEditedNodeId = id;

    if(editingNode){
      nodesByGame[game.id] = nodesByGame[game.id].map(n=> n.id===id ? node : n);
      toast('Narration updated.');
      editingNodeId = null;
    } else {
      const nodeIndex = await sGet('node-index:'+game.id) || [];
      nodeIndex.push(id);
      await sSet('node-index:'+game.id, nodeIndex);
      nodesByGame[game.id].push(node);
      toast('Narration added.');
    }
    render();
  };

  // ---- Existing narrations: grouped, drag-and-drop reorderable list ----
  let dragInfo = null; // {type:'node'|'group', id}
  async function persistGroups(){ await sSet('game:'+game.id, game); }
  function openGroupSettingsModal(game, g){
    const overlay = document.createElement('div');
    overlay.className='reader-overlay' + (settings.animationsEnabled ? ' anim-in' : '');
    overlay.innerHTML = `
      <div class="reader" style="max-width:460px;">
        <div class="content reader-relative">
          <button class="close" id="closeGroupSettings">&times;</button>
          <h2 style="margin-bottom:6px;">“${escapeHtml(g.name)}” display settings</h2>
          <div class="hint" style="margin-bottom:14px;">Similar to the app-wide settings, but scoped to just this group — on the shelf, list, and campaign map.</div>
          <label class="setting-toggle" style="margin-top:4px;">
            <input type="checkbox" id="gsFirstOnly" ${g.showFirstOnly?'checked':''}> Show only the first available narration in this group
          </label>
          <div class="hint">Instead of every unlocked narration, only the earliest one (by its order in Manage Codex) is shown at a time.</div>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="gsShowHidden" ${g.showHiddenNodes?'checked':''}> Show hidden narrations in this group
          </label>
          <div class="hint">Overrides "Hidden" narrations normally being visible only in Manage Codex — just for this group.</div>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="gsHideHeard" ${g.hideHeard?'checked':''}> Hide narrations you've already heard, in this group
          </label>
          <div class="hint">Applies here even if the app-wide "Hide narrations you've already heard" setting is off.</div>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="gsAutoAdvance" ${g.autoAdvanceGroup?'checked':''}> Automatically open the next node when it unlocks, in this group
          </label>
          <div class="hint">Applies here even if the app-wide "Automatically open the next narration" setting is off.</div>
          <div style="display:flex;justify-content:flex-end;margin-top:16px;">
            <button class="btn primary" id="doneGroupSettings">Done</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = ()=>overlay.remove();
    overlay.querySelector('#closeGroupSettings').onclick = close;
    overlay.querySelector('#doneGroupSettings').onclick = close;
    overlay.onclick = (e)=>{ if(e.target===overlay) close(); };
    const save = async ()=>{
      g.showFirstOnly = overlay.querySelector('#gsFirstOnly').checked;
      g.showHiddenNodes = overlay.querySelector('#gsShowHidden').checked;
      g.hideHeard = overlay.querySelector('#gsHideHeard').checked;
      g.autoAdvanceGroup = overlay.querySelector('#gsAutoAdvance').checked;
      await persistGroups();
      render();
    };
    ['gsFirstOnly','gsShowHidden','gsHideHeard','gsAutoAdvance'].forEach(id=>{
      overlay.querySelector('#'+id).onchange = save;
    });
  }
  async function persistNodes(ids){
    for(const id of ids){
      const nd = nodesByGame[game.id].find(x=>x.id===id);
      if(nd) await sSet('node:'+id, nd);
    }
  }
  function reorderWithinContainer(containerNodes, draggedId, targetId, after){
    const ids = containerNodes.map(x=>x.id).filter(id=>id!==draggedId);
    let idx = ids.indexOf(targetId);
    if(idx===-1) idx = ids.length; else if(after) idx += 1;
    ids.splice(idx, 0, draggedId);
    ids.forEach((id,i)=>{ const nd = nodesByGame[game.id].find(x=>x.id===id); if(nd) nd.order = i; });
    return ids;
  }
  const LOG_MODE_BADGES = {none:'off', titleOnly:'title only', textOnly:'text only', choicesOnly:'choices only'};
  function buildNodeRow(n){
    const row = document.createElement('div');
    row.className = 'node-manage-item';
    row.draggable = true;
    row.dataset.id = n.id;
    const normPrereqs = normalizedPrereqs(n);
    const anyCount = normPrereqs.filter(p=>p.group==='any').length;
    const allCount = normPrereqs.length - anyCount;
    let prereqBadge = 'start node';
    if(normPrereqs.length){
      prereqBadge = `${normPrereqs.length} prereq${normPrereqs.length===1?'':'s'}`;
      if(allCount>0 && anyCount>0) prereqBadge += ` (${allCount} and, ${anyCount} or)`;
      else if(anyCount>1) prereqBadge += ' (any)';
    }
    row.innerHTML = `
      <div class="left">
        <span class="drag-handle" title="Drag to reorder or move to a group">⠿</span>
        <span>${escapeHtml(n.title)}</span>
        ${n.hidden? `<span class="pid" style="color:#d99;">hidden</span>`:''}
        ${n.completedByDefault? `<span class="pid" style="color:var(--moss);">auto</span>`:''}
        ${(n.logMode && n.logMode!=='full')? `<span class="pid">log: ${LOG_MODE_BADGES[n.logMode]||n.logMode}</span>`:''}
        ${n.choices&&n.choices.length? `<span class="pid">${n.choices.length} choice${n.choices.length===1?'':'s'}</span>`:''}
        <span class="pid">${prereqBadge}</span>
        ${!n.image? `<span class="pid" style="color:#d99;">no image</span>` : `<span class="pid media-status" data-check="image">checking image…</span>`}
        ${!n.audio? `<span class="pid" style="color:#d99;">no narration</span>` : `<span class="pid media-status" data-check="audio">checking audio…</span>`}
      </div>
      <div class="right">
        ${n.audio? `<button class="btn ghost small" data-testplay="${n.id}" title="Preview the audio — does not mark this narration as heard">${inlinePlayingId===n.id?ICON_MINI_PAUSE:ICON_MINI_PLAY} Test play</button>`:''}
        <button class="btn ghost small" data-copy="${n.id}">Copy</button>
        <button class="btn ghost small" data-edit="${n.id}">Edit</button>
        <button class="btn danger small" data-del="${n.id}">Remove</button>
      </div>
    `;
    row.querySelectorAll('.media-status').forEach(badge=>{
      const type = badge.dataset.check;
      const src = type==='image' ? n.image : n.audio;
      checkMediaReachable(src, type).then(ok=>{
        if(ok===true){ badge.remove(); }
        else if(ok===false){
          badge.textContent = type==='image' ? 'image not found' : 'audio not found';
          badge.style.color = '#d99';
        } else {
          badge.remove(); // timed out — inconclusive, don't leave a confusing "checking…" forever
        }
      });
    });
    row.querySelector('[data-edit]').onclick = ()=>{ editingNodeId = n.id; render(); };
    const testPlayBtn = row.querySelector('[data-testplay]');
    if(testPlayBtn){ testPlayBtn.onclick = (e)=>{ e.stopPropagation(); toggleInlinePlay(n, e); }; }
    row.querySelector('[data-copy]').onclick = async ()=>{
      const copy = await duplicateNode(n);
      if(!copy){ toast('Could not copy this narration — please try again.'); return; }
      editingNodeId = copy.id;
      lastEditedNodeId = copy.id;
      toast('Narration copied.');
      render();
    };
    row.querySelector('[data-del]').onclick = async ()=>{
      if(!confirm('Remove this narration? Other narrations that require it will stay locked. This cannot be undone.')) return;
      await sDel('node:'+n.id);
      let nodeIndex = await sGet('node-index:'+game.id) || [];
      nodeIndex = nodeIndex.filter(x=>x!==n.id);
      await sSet('node-index:'+game.id, nodeIndex);
      nodesByGame[game.id] = nodesByGame[game.id].filter(x=>x.id!==n.id);
      delete progress.completed[n.id];
      await sSet('progress', progress);
      if(editingNodeId===n.id) editingNodeId=null;
      toast('Narration removed.');
      render();
    };
    row.addEventListener('dragstart', (e)=>{
      dragInfo = {type:'node', id:n.id};
      e.dataTransfer.effectAllowed='move';
      try{ e.dataTransfer.setData('text/plain', n.id); }catch(err){}
      row.style.opacity='0.4';
    });
    row.addEventListener('dragend', ()=>{ row.style.opacity=''; });
    row.addEventListener('dragover', (e)=>{ if(dragInfo && dragInfo.type==='node'){ e.preventDefault(); row.style.borderColor='var(--brass)'; } });
    row.addEventListener('dragleave', ()=>{ row.style.borderColor=''; });
    row.addEventListener('drop', async (e)=>{
      e.preventDefault(); e.stopPropagation();
      row.style.borderColor='';
      if(!dragInfo || dragInfo.type!=='node' || dragInfo.id===n.id) return;
      const rect = row.getBoundingClientRect();
      const after = (e.clientY - rect.top) > rect.height/2;
      const draggedNode = nodesByGame[game.id].find(x=>x.id===dragInfo.id);
      if(!draggedNode) return;
      const targetGroupId = n.groupId || null;
      draggedNode.groupId = targetGroupId;
      const containerNodes = nodesByGame[game.id].filter(x=> (x.groupId||null)===targetGroupId).sort((a,b)=>(a.order||0)-(b.order||0));
      const orderedIds = reorderWithinContainer(containerNodes, draggedNode.id, n.id, after);
      await persistNodes(Array.from(new Set(orderedIds.concat(draggedNode.id))));
      dragInfo = null;
      render();
    });
    return row;
  }
  function buildBucket(groupId, nodesInBucket){
    const bucket = document.createElement('div');
    bucket.className = 'node-group-bucket';
    if(nodesInBucket.length===0){
      bucket.innerHTML = `<div class="hint" style="padding:6px 0 10px;">Drop a narration here.</div>`;
    }
    nodesInBucket.slice().sort((a,b)=>(a.order||0)-(b.order||0)).forEach(n=> bucket.appendChild(buildNodeRow(n)));
    bucket.addEventListener('dragover', (e)=>{ if(dragInfo && dragInfo.type==='node') e.preventDefault(); });
    bucket.addEventListener('drop', async (e)=>{
      e.preventDefault();
      if(!dragInfo || dragInfo.type!=='node') return;
      const draggedNode = nodesByGame[game.id].find(x=>x.id===dragInfo.id);
      if(!draggedNode) return;
      draggedNode.groupId = groupId || null;
      const siblings = nodesByGame[game.id].filter(x=>(x.groupId||null)===(groupId||null) && x.id!==draggedNode.id);
      draggedNode.order = siblings.length? Math.max(...siblings.map(s=>s.order||0))+1 : 0;
      await persistNodes([draggedNode.id]);
      dragInfo = null;
      render();
    });
    return bucket;
  }
  function renderNarrationsList(){
    const listWrap = panel.querySelector('#narrationsList');
    const allNodesInGame = nodesByGame[game.id]||[];
    const validGroupIds = (game.groups||[]).map(g=>g.id);
    const ungrouped = allNodesInGame.filter(n=> !n.groupId || !validGroupIds.includes(n.groupId));

    const ungroupedHeader = document.createElement('div');
    ungroupedHeader.className='group-header';
    ungroupedHeader.innerHTML = `<span class="group-name">Ungrouped</span>`;
    listWrap.appendChild(ungroupedHeader);
    listWrap.appendChild(buildBucket(null, ungrouped));

    (game.groups||[]).forEach(g=>{
      const header = document.createElement('div');
      header.className='group-header';
      header.draggable = true;
      header.innerHTML = `
        <span class="drag-handle" title="Drag to reorder groups">⠿</span>
        <button class="group-toggle" type="button">${g.collapsed?'▸':'▾'}</button>
        <span class="group-name">${escapeHtml(g.name)}</span>
        <span style="flex:1;"></span>
        <button class="btn ghost small" data-groupsettings="1" title="Group display settings">⚙</button>
        <button class="btn ghost small" data-rename="1">Rename</button>
        <button class="btn danger small" data-delgroup="1">Delete</button>
      `;
      listWrap.appendChild(header);
      const groupNodes = allNodesInGame.filter(n=>n.groupId===g.id);
      const bucket = buildBucket(g.id, groupNodes);
      bucket.style.display = g.collapsed ? 'none' : '';
      listWrap.appendChild(bucket);

      header.querySelector('.group-toggle').onclick = async ()=>{ g.collapsed = !g.collapsed; await persistGroups(); render(); };
      header.querySelector('[data-groupsettings]').onclick = ()=> openGroupSettingsModal(game, g);
      header.querySelector('[data-rename]').onclick = async ()=>{
        const name = prompt('Rename group', g.name);
        if(name && name.trim()){ g.name = name.trim(); await persistGroups(); render(); }
      };
      header.querySelector('[data-delgroup]').onclick = async ()=>{
        if(!confirm(`Delete group "${g.name}"? Its narrations become ungrouped, not deleted.`)) return;
        game.groups = (game.groups||[]).filter(x=>x.id!==g.id);
        const toUngroup = allNodesInGame.filter(n=>n.groupId===g.id);
        toUngroup.forEach(n=>{ n.groupId=null; });
        await persistGroups();
        await persistNodes(toUngroup.map(n=>n.id));
        render();
      };
      header.addEventListener('dragstart', (e)=>{ dragInfo={type:'group', id:g.id}; e.dataTransfer.effectAllowed='move'; });
      header.addEventListener('dragover', (e)=>{ e.preventDefault(); header.style.borderColor='var(--brass)'; });
      header.addEventListener('dragleave', ()=>{ header.style.borderColor=''; });
      header.addEventListener('drop', async (e)=>{
        e.preventDefault();
        header.style.borderColor='';
        if(dragInfo && dragInfo.type==='group' && dragInfo.id!==g.id){
          const groups = game.groups;
          const fromIdx = groups.findIndex(x=>x.id===dragInfo.id);
          const toIdx = groups.findIndex(x=>x.id===g.id);
          if(fromIdx>-1 && toIdx>-1){ const [moved]=groups.splice(fromIdx,1); groups.splice(toIdx,0,moved); await persistGroups(); }
        } else if(dragInfo && dragInfo.type==='node'){
          const draggedNode = allNodesInGame.find(x=>x.id===dragInfo.id);
          if(draggedNode){
            draggedNode.groupId = g.id;
            const siblings = allNodesInGame.filter(x=>x.groupId===g.id && x.id!==draggedNode.id);
            draggedNode.order = siblings.length? Math.max(...siblings.map(s=>s.order||0))+1 : 0;
            await persistNodes([draggedNode.id]);
          }
        }
        dragInfo = null;
        render();
      });
    });
  }
  renderNarrationsList();

  panel.querySelector('#addGroupBtn').onclick = async ()=>{
    const name = prompt('Group name', 'New group');
    if(!name || !name.trim()) return;
    game.groups = game.groups || [];
    game.groups.push({id: uid(), name: name.trim(), collapsed:false});
    await persistGroups();
    render();
  };

  // delete game
  panel.querySelector('#deleteGameBtn').onclick = async ()=>{
    if(!confirm(`Remove "${game.name}" and all its narrations? This cannot be undone.`)) return;
    await deleteGame(game);
    route = {view:'library', gameId:null};
    toast('Game removed.');
    render();
  };

  return panel;
}
