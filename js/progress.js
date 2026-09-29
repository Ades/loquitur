// © 2026 Anders Ive. All Rights Reserved.
// Unlock logic, completion records, undo, and progress import/export.
"use strict";

// ---------------- Unlock logic ----------------
function findNodeById(id){
  for(const gid in nodesByGame){
    const found = (nodesByGame[gid]||[]).find(n=>n.id===id);
    if(found) return found;
  }
  return null;
}
function completionRecord(nodeId){ return progress.completed[nodeId]; }
// Normalizes a node's prerequisites to always carry a group ('all' or 'any'), for backward
// compatibility with older saved data that used a single node.prerequisiteMode instead.
function normalizedPrereqs(node){
  const legacyMode = node.prerequisiteMode==='any' ? 'any' : 'all';
  return (node.prerequisites||[]).map(p=> ({...p, group: p.group || legacyMode}));
}
// True once a node's own AND/OR prerequisites are satisfied — independent of whether the
// node itself has been explicitly marked heard. Shared by isAvailable() and, for
// "completed by default" nodes, by isCompleted() itself.
function prerequisitesSatisfiedFor(node){
  const prereqs = normalizedPrereqs(node);
  if(prereqs.length===0) return true;
  const allGroup = prereqs.filter(p=>p.group!=='any');
  const anyGroup = prereqs.filter(p=>p.group==='any');
  const allOk = allGroup.every(prereqSatisfied);
  const anyOk = anyGroup.length===0 || anyGroup.some(prereqSatisfied);
  return allOk && anyOk;
}
const completedByDefaultGuard = new Set(); // cycle protection while resolving auto-complete chains
function isCompleted(nodeId){
  if(progress.completed[nodeId]) return true;
  const node = findNodeById(nodeId);
  if(node && node.completedByDefault){
    if(completedByDefaultGuard.has(nodeId)) return false; // break accidental prerequisite cycles
    completedByDefaultGuard.add(nodeId);
    const result = prerequisitesSatisfiedFor(node);
    completedByDefaultGuard.delete(nodeId);
    return result;
  }
  return false;
}
function prereqSatisfied(p){
  if(!isCompleted(p.nodeId)) return false;
  if(p.choiceId){
    const rec = completionRecord(p.nodeId);
    if(!rec) return false;
    if(Array.isArray(rec.choiceIds)) return rec.choiceIds.includes(p.choiceId);
    return rec.choiceId === p.choiceId;
  }
  return true;
}
function isAvailable(node){
  if(isCompleted(node.id)) return true;
  return prerequisitesSatisfiedFor(node);
}
// Direct children that list this node as one of their prerequisites, and are currently
// available-but-not-completed and not hidden — used for "proceed" / junction navigation.
function findChildrenUnlockedBy(node){
  return (nodesByGame[node.gameId]||[]).filter(c=>
    !c.hidden &&
    (c.prerequisites||[]).some(p=>p.nodeId===node.id) &&
    isAvailable(c) && !isCompleted(c.id)
  );
}
// choiceIdOrIds is a single choiceId (single-choice narrations) or an array (multi-choice).
async function markCompleted(node, choiceIdOrIds){
  undoStack.push({nodeId: node.id, previous: progress.completed[node.id] ? {...progress.completed[node.id]} : null});
  if(undoStack.length>25) undoStack.shift();
  const isMulti = Array.isArray(choiceIdOrIds);
  progress.completed[node.id] = {
    completedAt: Date.now(),
    choiceId: isMulti ? null : (choiceIdOrIds || null),
    choiceIds: isMulti ? choiceIdOrIds : null
  };
  if(!node.hidden && (node.logMode||'full')!=='none') playScratchSound();
  await sSet('progress', progress);
}
async function undoLast(){
  if(undoStack.length===0) return;
  const last = undoStack.pop();
  if(last.previous){ progress.completed[last.nodeId] = last.previous; }
  else { delete progress.completed[last.nodeId]; }
  await sSet('progress', progress);
  toast('Last action undone.');
  render();
}
function availabilitySnapshot(gameId, excludeId){
  const map = {};
  (nodesByGame[gameId]||[]).forEach(n=>{ if(n.id!==excludeId) map[n.id] = isAvailable(n); });
  return map;
}
// Marks a node complete and, if exactly one other narration newly unlocked as a result, returns it.
async function markCompletedAndFindNext(node, choiceId){
  const before = availabilitySnapshot(node.gameId, node.id);
  await markCompleted(node, choiceId);
  const after = availabilitySnapshot(node.gameId, node.id);
  const newlyUnlocked = Object.keys(after).filter(id=> after[id] && !before[id]);
  if(newlyUnlocked.length===1){
    return (nodesByGame[node.gameId]||[]).find(n=>n.id===newlyUnlocked[0]) || null;
  }
  return null;
}
// Skips through any chain of "completed by default" junction nodes to find the real
// narration to show; returns null if the chain dead-ends or forks (multiple next options).
function resolveJunctions(node){
  let current = node, guard = 0;
  while(current && current.completedByDefault && guard++<25){
    const kids = findChildrenUnlockedBy(current);
    current = kids.length===1 ? kids[0] : null;
  }
  return current;
}

async function resetAllProgress(){
  progress = {completed:{}};
  await sSet('progress', progress);
}
async function resetGameProgress(gameId){
  const ids = (nodesByGame[gameId]||[]).map(n=>n.id);
  ids.forEach(id=>{ delete progress.completed[id]; });
  await sSet('progress', progress);
}
function exportProgress(){
  const payload = { type:'campaign-codex-progress', exportedAt: new Date().toISOString(), progress };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `campaign-codex-progress-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function importProgressFromFile(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onerror = ()=>reject(new Error('Could not read that file.'));
    r.onload = ()=>{
      try{
        const parsed = JSON.parse(r.result);
        if(!parsed || typeof parsed !== 'object' || !parsed.progress || typeof parsed.progress.completed !== 'object'){
          reject(new Error('That file doesn\'t look like a Campaign Codex progress export.'));
          return;
        }
        resolve(parsed.progress);
      }catch(e){ reject(new Error('That file is not valid JSON.')); }
    };
    r.readAsText(file);
  });
}

// Whether every narration in the given list that belongs to a group (or, for groupId
// null, the Ungrouped bucket) has been heard — used to badge folders as complete on the
// shelf and list views.
function isGroupComplete(visibleNodes, validGroupIds, groupId){
  const members = groupId===null
    ? visibleNodes.filter(n=> !n.groupId || !validGroupIds.includes(n.groupId))
    : visibleNodes.filter(n=> n.groupId===groupId);
  return members.length>0 && members.every(n=>isCompleted(n.id));
}
// The narrations a group (or, for g null, the Ungrouped bucket) currently shows to the
// player, after hidden / locked / heard filtering and the group's own display settings.
function groupMembers(g, nodes, visible, validGroupIds){
  let members = g===null
    ? visible.filter(n=> !n.groupId || !validGroupIds.includes(n.groupId))
    : nodes.filter(n=> n.groupId===g.id);
  if(!manageMode && !(g && g.showHiddenNodes)) members = members.filter(n=>!n.hidden);
  members = members.filter(isAvailable);
  if(settings.hideCompleted || (g && g.hideHeard)) members = members.filter(n=>!isCompleted(n.id));
  if(g && g.showFirstOnly && members.length>0){
    const minOrder = Math.min(...members.map(n=>n.order||0));
    members = members.filter(n=>(n.order||0)===minOrder);
  }
  return members;
}
// Applies the "put completed narrations last" setting to a list about to be displayed.
function displayOrder(list){
  if(!settings.placeCompletedLast) return list;
  return list.slice().sort((a,b)=>
    (isCompleted(a.id)===isCompleted(b.id) ? 0 : (isCompleted(a.id)?1:-1)) || ((a.order||0)-(b.order||0)));
}
