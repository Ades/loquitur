// © 2026 Anders Ive. All Rights Reserved.
// Keyboard shortcuts.
"use strict";

// ---------------- Escape closes whichever modal is open ----------------
document.addEventListener('keydown', (e)=>{
  if(e.key !== 'Escape') return;
  const reader = document.getElementById('narrationReaderOverlay');
  if(reader){
    e.preventDefault();
    readerNode = null; readerResult = null; readerAutoPlay = false; readerHistory = []; readerForward = [];
    reader.remove();
    render();
    return;
  }
  const otherModal = document.querySelector('.reader-overlay');
  if(otherModal){
    e.preventDefault();
    otherModal.remove();
    return;
  }
  if(manageMode){
    const cancelBtn = document.querySelector('.manage-panel #cancelEdit');
    if(cancelBtn){ e.preventDefault(); cancelBtn.click(); }
  }
});

// ---------------- Space bar plays/pauses the reader's audio ----------------
document.addEventListener('keydown', (e)=>{
  if(e.code !== 'Space' && e.key !== ' ') return;
  const reader = document.getElementById('narrationReaderOverlay');
  if(!reader) return;
  const active = document.activeElement;
  const tag = active && active.tagName;
  if(tag==='BUTTON' || tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT' || tag==='A') return; // let space activate the focused control instead
  const audioEl = reader.querySelector('audio');
  if(!audioEl) return;
  e.preventDefault();
  if(audioEl.paused) audioEl.play().catch(()=>{});
  else audioEl.pause();
});

// ---------------- Manage Codex fast keys ----------------
async function switchToPathAndPaste(toggleGroup, field){
  if(!toggleGroup || !field){
    toast('That field isn\'t open right now.');
    return;
  }
  const pathBtn = toggleGroup.querySelector('button[data-m="path"]');
  if(pathBtn) pathBtn.click();
  field.focus();
  try{
    const text = await navigator.clipboard.readText();
    if(text){
      field.value = text;
      field.dispatchEvent(new Event('input', {bubbles:true}));
      toast('Pasted from clipboard.');
    }
  }catch(err){
    toast('Could not read the clipboard — your browser may need permission for this.');
  }
}
function currentImagePathTarget(){
  const gameToggle = document.querySelector('.reader-overlay #ngImgToggle');
  if(gameToggle){
    return { toggle: gameToggle, field: document.querySelector('.reader-overlay #ngImgPath') };
  }
  const narrToggle = document.querySelector('.manage-panel .media-toggle[data-t="image"]');
  if(narrToggle){
    return { toggle: narrToggle, field: document.querySelector('.manage-panel #nImagePath') };
  }
  return null;
}
function currentAudioPathTarget(){
  const narrToggle = document.querySelector('.manage-panel .media-toggle[data-t="audio"]');
  if(narrToggle){
    return { toggle: narrToggle, field: document.querySelector('.manage-panel #nAudioPath') };
  }
  return null;
}
// Duplicates the most recently saved narration and opens the copy for editing, with its
// title field focused so it can be renamed right away.
async function duplicateLastEdited(chain){
  const original = findNodeById(lastEditedNodeId);
  if(!original){
    toast(chain ? 'Save a narration first, then Shift+↓ adds the next one after it.' : 'Save a narration first, then Shift+↑ copies it.');
    return;
  }
  // chain: the copy requires the original, so it continues on from it
  const copy = await duplicateNode(original, chain ? [{nodeId: original.id, choiceId: null, group:'all'}] : undefined);
  if(!copy){ toast(chain ? 'Could not create the next narration — please try again.' : 'Could not copy this narration — please try again.'); return; }
  route = {view:'game', gameId: original.gameId};
  editingNodeId = copy.id;
  lastEditedNodeId = copy.id;
  toast(chain ? 'Added the next narration — requires "'+original.title+'".' : 'Narration copied.');
  render();
  setTimeout(()=>{
    const titleInput = document.querySelector('.manage-panel #nTitle');
    if(titleInput){ titleInput.focus(); titleInput.select(); }
  }, 30);
}
// Cycles editingNodeId through whatever narration rows are currently visible in Manage
// Codex (i.e. inside expanded groups, plus Ungrouped), in their displayed order. Scrolls
// the title into view but deliberately does not focus it, so repeated presses keep working.
function cycleManageNode(direction){
  const rows = Array.from(document.querySelectorAll('.manage-panel #narrationsList .node-manage-item'))
    .filter(r=> r.offsetParent!==null);
  if(rows.length===0){ toast('No narrations are visible to cycle through — expand a group first.'); return; }
  const ids = rows.map(r=>r.dataset.id);
  const idx = ids.indexOf(editingNodeId);
  let nextIdx;
  if(idx===-1){ nextIdx = direction>0 ? 0 : ids.length-1; }
  else { nextIdx = (idx + direction + ids.length) % ids.length; }
  editingNodeId = ids[nextIdx];
  render();
  setTimeout(()=>{
    const titleField = document.querySelector('.manage-panel #nTitle');
    if(titleField) titleField.scrollIntoView({behavior:'smooth', block:'center'});
  }, 30);
}
// Cycles the map shape of whatever node is currently hovered on the campaign map,
// through the shapes below, then back to the first.
const MAP_SHAPE_CYCLE = ['circle','playIcon','box','boxRule','boxErrata','labelOnly'];
const MAP_SHAPE_NAMES = {circle:'Small circle', playIcon:'Play icon', box:'Box', boxRule:'Box, rule', boxErrata:'Box, errata', labelOnly:'Label only'};
async function cycleHoveredNodeShape(){
  if(!hoveredMapNodeId){ toast('Hover a node on the campaign map, then press Shift+N.'); return; }
  const n = findNodeById(hoveredMapNodeId);
  if(!n){ return; }
  const curIdx = MAP_SHAPE_CYCLE.indexOf(n.mapShape || 'box');
  n.mapShape = MAP_SHAPE_CYCLE[(curIdx + 1) % MAP_SHAPE_CYCLE.length];
  const ok = await sSet('node:'+n.id, n);
  if(!ok){ toast('Could not save the shape change — please try again.'); return; }
  toast(`Map shape: ${MAP_SHAPE_NAMES[n.mapShape]}`);
  render();
}
let prereqPos = 0; // Shift+A cycles through the checked prerequisites
document.addEventListener('keydown', (e)=>{
  if(!manageMode) return;
  const active = document.activeElement;
  const tag = active && active.tagName;
  const isTextEditing = tag==='TEXTAREA' || (tag==='INPUT' && !['checkbox','radio','button','submit','file'].includes(active.type));
  if(e.shiftKey && e.key==='Enter' && !isTextEditing){
    const saveBtn = document.querySelector('.manage-panel #saveNode');
    if(saveBtn){ e.preventDefault(); saveBtn.click(); }
    return;
  }
  if(e.shiftKey && e.key==='ArrowRight' && !isTextEditing){
    e.preventDefault();
    const target = currentImagePathTarget();
    if(target) switchToPathAndPaste(target.toggle, target.field);
    else toast('No image field is open right now.');
    return;
  }
  if(e.shiftKey && e.key==='ArrowLeft' && !isTextEditing){
    e.preventDefault();
    const target = currentAudioPathTarget();
    if(target) switchToPathAndPaste(target.toggle, target.field);
    else toast('No audio field is open right now.');
    return;
  }
  if(e.shiftKey && e.key==='ArrowDown' && !isTextEditing){
    e.preventDefault();
    duplicateLastEdited(true);
    return;
  }
  if(e.shiftKey && e.key==='ArrowUp' && !isTextEditing){
    e.preventDefault();
    duplicateLastEdited(false);
    return;
  }
  if(e.shiftKey && (e.key==='N'||e.key==='n') && !isTextEditing){
    e.preventDefault();
    cycleHoveredNodeShape();
    return;
  }
  if(e.key==='>' && !isTextEditing){
    e.preventDefault();
    cycleManageNode(1);
  }
  if(e.key==='<' && !isTextEditing && e.ctrlKey){
    e.preventDefault();
    cycleManageNode(-1);
  }
  if(e.key==='A' && !isTextEditing && e.shiftKey){
    setTimeout(()=>{
      const checked = document.querySelectorAll('.prereqCk:checked');
      if(checked.length===0) return;
      prereqPos = prereqPos % checked.length;
      checked[prereqPos].scrollIntoView({behavior:'smooth', block:'center', inline:'start'});
      prereqPos = (prereqPos+1) % checked.length;
    }, 30);
  }
});
