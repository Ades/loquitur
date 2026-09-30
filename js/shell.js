// © 2026 Anders Ive. All Rights Reserved.
// Root render, page header and the Settings window.
"use strict";

// ---------------- Render root ----------------
function render(){
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(renderHeader());
  if(route.view==='library'){ app.appendChild(renderLibrary()); }
  else if(route.view==='game'){ app.appendChild(renderGame()); }
  const staleReader = document.getElementById('narrationReaderOverlay');
  if(staleReader) staleReader.remove();
  if(readerNode){ document.body.appendChild(renderReader()); }
}

function renderHeader(){
  const h = document.createElement('header');
  h.className='top';
  h.innerHTML = `
    <div class="brand">
      ${CREST}
      <div>
        <h1>res ipsa LOQUITUR  — Campaign Codex</h1>
        <div class="sub"><i>"it speaks for itself"</i> — VOICE NARRATION LIBRARY FOR TABLETOP CAMPAIGNS</div>
      </div>
    </div>
    <div class="top-actions">
      <button class="btn ghost" id="openSettings">${ICON_GEAR} Settings</button>
      <button class="btn ${manageMode?'primary':'ghost'}" id="toggleManage">${manageMode? 'Done editing' : 'Manage codex'}</button>
    </div>
  `;
  h.querySelector('#toggleManage').onclick = ()=>{ manageMode = !manageMode; editingNodeId=null; render(); };
  h.querySelector('#openSettings').onclick = openSettingsModal;
  return h;
}

// ---------------- Settings modal ----------------
function openSettingsModal(){
  const currentGame = route.view==='game' ? games.find(g=>g.id===route.gameId) : null;
  const overlay = document.createElement('div');
  overlay.className='reader-overlay' + (settings.animationsEnabled ? ' anim-in' : '');
  overlay.innerHTML = `
    <div class="reader" style="max-width:480px;">
      <div class="content reader-relative">
        <button class="close" id="closeSettings">&times;</button>
        <h2 style="margin-bottom:16px;">Settings</h2>

        <div class="field">
          <label>Appearance</label>
          <div class="media-toggle" id="themeToggle">
            <button type="button" data-theme="dark" class="${settings.theme!=='light'?'active':''}">Dark</button>
            <button type="button" data-theme="light" class="${settings.theme==='light'?'active':''}">Light</button>
          </div>
          <div class="media-toggle" id="orientationToggle" style="margin-top:6px;">
            <button type="button" data-orient="horizontal" class="${settings.mapOrientation!=='vertical'?'active':''}">Map: left to right</button>
            <button type="button" data-orient="vertical" class="${settings.mapOrientation==='vertical'?'active':''}">Map: top to bottom</button>
          </div>
          <div class="hint">Each narration now has its own map shape and label options — see "Map appearance" when editing a narration in Manage Codex.</div>
        </div>

        <div class="field">
          <label>Display</label>
          <label class="setting-toggle" style="margin-top:4px;">
            <input type="checkbox" id="hideCompletedCk" ${settings.hideCompleted?'checked':''}> ${ICON_EYE_OFF} Hide narrations you've already heard
          </label>
          <label class="setting-toggle" style="margin-top:8px;">
            <input type="checkbox" id="hideLockedCk" ${settings.hideLockedInMap?'checked':''}> ${ICON_LOCK} Hide narrations you haven't unlocked yet on the campaign map
          </label>
          <div class="hint">On by default, so the map doesn't spoil what's still ahead. Turn it off to see the full tree while you play. In "Manage codex" mode the full tree is always shown.</div>
          <label class="setting-toggle" style="margin-top:8px;">
            <input type="checkbox" id="hideUnavailableGroups" ${settings.hideUnavailableGroups?'checked':''}> ${ICON_LOCK} Don't count (NB: should be "Hide") groups you haven't unlocked yet
          </label>
          <div class="hint">On by default, so the progress doesn't spoil what's still ahead. Turn it on to see the all groups while you play. In "Manage codex" mode the full tree is always shown.</div>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="animationsCk" ${settings.animationsEnabled?'checked':''}> Animate newly-unlocked narrations and opening windows
          </label>
          <div class="hint">Gives a brief pulse to narrations the moment they unlock on the shelf and map, and a short pop-in when a window opens. Turn off for an instant, static interface.</div>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="largeFontCk" ${settings.largeFont?'checked':''}> Large font
          </label>
          <div class="hint">Scales up all text, buttons and spacing together — useful for reading narrations from across the table.</div>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="countGroupsCompleted" ${settings.countGroupsCompleted?'checked':''}> Count completed groups (otherwise count completed narrations).
          </label>
          <div class="hint">The progress numbers and bar under the title shows number of completed groups or narrations</div>
          <label style="display:block;margin-top:12px;">Log order</label>
          <div class="media-toggle" id="logOrderToggle" style="margin-top:4px;">
            <button type="button" data-order="latestFirst" class="${settings.logOrder!=='latestLast'?'active':''}">Latest first</button>
            <button type="button" data-order="latestLast" class="${settings.logOrder==='latestLast'?'active':''}">Latest last</button>
          </div>
        </div>

        <div class="field">
          <label>Playback</label>
          <label class="setting-toggle" style="margin-top:4px;">
            <input type="checkbox" id="autoCloseCk" ${settings.autoCloseOnAudioEnd?'checked':''}> Close the narration automatically when its audio finishes
          </label>
          <div class="hint">Only applies to narrations with audio and no choices to make — those still need to be closed manually, and so do narrations with no audio at all.</div>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="autoAdvanceCk" ${settings.autoAdvance?'checked':''}> Automatically open (and try to play) the next narration when it unlocks
          </label>
          <div class="hint">Only triggers when marking a narration heard (or picking a choice) unlocks exactly one further narration — if it unlocks none, or several at once, you'll stay on the shelf or map to choose. Browsers sometimes block automatic audio playback; if so, just press play in the window that opens.</div>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="revealChoicesCk" ${settings.revealChoicesWhenDone?'checked':''}> Only show a narration's choices once it's done playing
          </label>
          <div class="hint">With this on, choice buttons stay hidden until the audio finishes (or right away if there's no audio), so you're not tempted to pick before hearing everything.</div>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="placeCompletedLastCk" ${settings.placeCompletedLast?'checked':''}> Put completed narrations last on the shelf and in the list
          </label>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="tickSoundCk" ${settings.tickSoundEnabled?'checked':''}> Play a tick sound when a narration window opens
          </label>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="scratchSoundCk" ${settings.scratchSoundEnabled?'checked':''}> Play a pencil-scratch sound when a new log entry is recorded
          </label>
          <label class="setting-toggle" style="margin-top:10px;">
            <input type="checkbox" id="chimeSoundCk" ${settings.groupCompleteSoundEnabled?'checked':''}> Play a sound when a group becomes completed
          </label>
          <div class="media-toggle" id="completeSoundToggle" style="margin-top:6px;">
            ${Object.keys(COMPLETE_SOUNDS).map(k=>`<button type="button" data-sound="${k}" class="${(COMPLETE_SOUNDS[settings.groupCompleteSound]?settings.groupCompleteSound:'chime')===k?'active':''}">${COMPLETE_SOUNDS[k].label}</button>`).join('')}
          </div>
          <div class="hint">Picking a sound plays it once, so you can hear it.</div>
          <label style="display:block;margin-top:12px;">Audio player style</label>
          <div class="media-toggle" id="audioStyleToggle" style="margin-top:4px;">
            ${Object.keys(AUDIO_PLAYER_STYLES).map(k=>`<button type="button" data-style="${k}" class="${(settings.audioPlayerStyle||'native')===k?'active':''}">${AUDIO_PLAYER_STYLES[k].label}</button>`).join('')}
          </div>
        </div>

        <div class="field">
          <label>Library data</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn ghost small" id="exportLibBtn">Save structure to file</button>
            <button class="btn ghost small" id="importLibBtn">Load structure from file</button>
          </div>
          <input type="file" id="importLibFile" accept="application/json" style="display:none;">
          <div class="hint">This backs up your games, their narrations, prerequisites, choices and app settings (not your listening progress). Loading a file replaces your current games, narrations and settings entirely.</div>
        </div>

        <div class="field">
          <label>Progress data</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn ghost small" id="exportBtn">Save progress to file</button>
            <button class="btn ghost small" id="undoBtn" ${undoStack.length===0?'disabled':''}>Undo last action</button>
            <button class="btn ghost small" id="importBtn">Load progress from file</button>
          </div>
          <input type="file" id="importFile" accept="application/json" style="display:none;">
          <div class="hint">Saving writes a small JSON file with everything you've heard and chosen so far. Loading replaces your current progress with what's in the file. "Undo last action" steps back one narration or choice at a time, up to the last 25 — it only remembers actions from this browsing session.</div>
        </div>

        <div class="field">
          <label>Reset</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${currentGame? `<button class="btn danger small" id="resetGameBtn">Reset progress for "${escapeHtml(currentGame.name)}"</button>`:''}
            <button class="btn danger small" id="resetAllBtn">Reset all progress</button>
          </div>
          <div class="hint">This clears which narrations are marked as heard and the choices you've made. Games, images and audio are not affected.</div>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:6px;">
          <button class="btn primary" id="doneSettings">Done</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = ()=>overlay.remove();
  overlay.querySelector('#closeSettings').onclick = close;
  overlay.querySelector('#doneSettings').onclick = close;
  overlay.onclick = (e)=>{ if(e.target===overlay) close(); };

  // checkbox id -> [settings key, what to do after saving]
  const toggles = {
    hideCompletedCk:       ['hideCompleted', render],
    hideLockedCk:          ['hideLockedInMap', render],
    hideUnavailableGroups: ['hideUnavailableGroups', render],
    animationsCk:          ['animationsEnabled'],
    largeFontCk:           ['largeFont', applyLargeFont],
    countGroupsCompleted:  ['countGroupsCompleted', render],
    autoCloseCk:           ['autoCloseOnAudioEnd'],
    autoAdvanceCk:         ['autoAdvance'],
    revealChoicesCk:       ['revealChoicesWhenDone'],
    placeCompletedLastCk:  ['placeCompletedLast', render],
    tickSoundCk:           ['tickSoundEnabled', ()=>{ if(settings.tickSoundEnabled) playTickSound(); }],
    scratchSoundCk:        ['scratchSoundEnabled', ()=>{ if(settings.scratchSoundEnabled) playScratchSound(); }],
    chimeSoundCk:          ['groupCompleteSoundEnabled', ()=>{ if(settings.groupCompleteSoundEnabled) playGroupCompleteSound(); }],
  };
  Object.entries(toggles).forEach(([id, [key, after]])=>{
    overlay.querySelector('#'+id).onchange = async (e)=>{
      settings[key] = e.target.checked;
      await saveSettings();
      if(after) after();
    };
  });
  // segmented button group id -> [data attribute, settings key, what to do after saving]
  const segmented = {
    audioStyleToggle:  ['style', 'audioPlayerStyle'],
    completeSoundToggle: ['sound', 'groupCompleteSound', ()=>{ COMPLETE_SOUNDS[settings.groupCompleteSound].play(); }],
    themeToggle:       ['theme', 'theme', applyTheme],
    orientationToggle: ['orient', 'mapOrientation', render],
    logOrderToggle:    ['order', 'logOrder', render],
  };
  Object.entries(segmented).forEach(([id, [attr, key, after]])=>{
    const btns = overlay.querySelector('#'+id).querySelectorAll('button');
    btns.forEach(b=>b.onclick = async ()=>{
      btns.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      settings[key] = b.dataset[attr];
      await saveSettings();
      if(after) after();
    });
  });
  overlay.querySelector('#undoBtn').onclick = async ()=>{
    await undoLast();
    close();
  };

  overlay.querySelector('#exportBtn').onclick = ()=>{ exportProgress(); toast('Progress file downloaded.'); };

  overlay.querySelector('#exportLibBtn').onclick = ()=>{ exportLibrary(); toast('Structure file downloaded.'); };
  const importLibFileInp = overlay.querySelector('#importLibFile');
  overlay.querySelector('#importLibBtn').onclick = ()=> importLibFileInp.click();
  importLibFileInp.onchange = async ()=>{
    const f = importLibFileInp.files[0];
    if(!f) return;
    if(!confirm('Loading a file will replace all current games and narrations. Continue?')) { importLibFileInp.value=''; return; }
    try{
      const loaded = await importLibraryFromFile(f);
      await applyImportedLibrary(loaded);
      toast('Structure loaded.');
      close();
      route = {view:'library', gameId:null};
      render();
    }catch(e){ toast(e.message); }
  };

  const importFileInp = overlay.querySelector('#importFile');
  overlay.querySelector('#importBtn').onclick = ()=> importFileInp.click();
  importFileInp.onchange = async ()=>{
    const f = importFileInp.files[0];
    if(!f) return;
    if(!confirm('Loading a file will replace your current progress. Continue?')) { importFileInp.value=''; return; }
    try{
      const loaded = await importProgressFromFile(f);
      progress = loaded;
      await sSet('progress', progress);
      toast('Progress loaded.');
      close();
      render();
    }catch(e){ toast(e.message); }
  };

  if(currentGame){
    overlay.querySelector('#resetGameBtn').onclick = async ()=>{
      if(!confirm(`Reset progress for "${currentGame.name}"? This cannot be undone.`)) return;
      await resetGameProgress(currentGame.id);
      toast('Progress reset for this game.');
      close();
      render();
    };
  }
  overlay.querySelector('#resetAllBtn').onclick = async ()=>{
    if(!confirm('Reset ALL progress across every game? This cannot be undone.')) return;
    await resetAllProgress();
    toast('All progress has been reset.');
    close();
    render();
  };
}
