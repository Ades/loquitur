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
// ---------------- Prerequisite expressions ----------------
// A narration's prerequisites are a condition tree, stored in node.requires:
//   group:     {op:'and'|'or', items:[...]}   — all of / any one of its items
//   condition: {nodeId, choiceId}              — that narration heard (with that choice, if set)
// Any group or condition can also carry not:true, which inverts it: {nodeId:'X', not:true} is
// "X not heard", {op:'or', items:[A,B], not:true} is "neither A nor B". Groups nest freely.
// An empty group (or no prerequisites at all) is always satisfied.
//
// Without NOT, hearing a narration can only unlock others. With NOT it can also lock an
// unheard narration again (D requiring NOT X disappears once X is heard); heard narrations
// always stay available.
//
// Older data has a flat node.prerequisites list instead, each entry marked group 'all' or
// 'any' (or, older still, one node.prerequisiteMode for the whole list), meaning: every
// 'all' entry AND at least one 'any' entry. legacyRequires() turns that into the same tree.
function isReqGroup(item){ return !!item && (item.op==='and' || item.op==='or'); }
function emptyRequires(){ return {op:'and', items:[]}; }
function legacyRequires(node){
  const legacyMode = node.prerequisiteMode==='any' ? 'any' : 'all';
  const list = (node.prerequisites||[]).map(p=> ({nodeId: p.nodeId, choiceId: p.choiceId || null, group: p.group || legacyMode}));
  const all = list.filter(p=>p.group!=='any').map(p=>({nodeId: p.nodeId, choiceId: p.choiceId}));
  const any = list.filter(p=>p.group==='any').map(p=>({nodeId: p.nodeId, choiceId: p.choiceId}));
  if(any.length===0) return {op:'and', items: all};
  if(all.length===0) return {op:'or', items: any};
  return {op:'and', items: [...all, {op:'or', items: any}]};
}
// The node's condition tree — its own, or converted from the legacy list. Conversions are
// cached per node object (edits always replace the object, so the cache can't go stale).
const legacyRequiresCache = new WeakMap();
function prereqExpr(node){
  if(isReqGroup(node.requires)) return node.requires;
  let expr = legacyRequiresCache.get(node);
  if(!expr){ expr = legacyRequires(node); legacyRequiresCache.set(node, expr); }
  return expr;
}
function evalRequires(item){
  let result;
  if(!isReqGroup(item)){
    result = prereqSatisfied(item);
  } else {
    const items = item.items || [];
    result = items.length===0 ? true : item.op==='or' ? items.some(evalRequires) : items.every(evalRequires);
  }
  return item.not ? !result : result;
}
// Every condition in the tree, flattened — for map connectors, "what does this unlock", badges.
// Each entry is {nodeId, choiceId, negated}; negated is true when an odd number of NOTs
// (on the condition itself or on groups around it) apply to it.
function prereqRefs(node){
  const out = [];
  (function walk(item, negated){
    if(!item) return;
    const neg = item.not ? !negated : negated;
    if(isReqGroup(item)) (item.items||[]).forEach(i=>walk(i, neg));
    else if(item.nodeId) out.push({nodeId: item.nodeId, choiceId: item.choiceId || null, negated: neg});
  })(prereqExpr(node), false);
  return out;
}
// Readable form of a condition tree, e.g.  A AND (B OR C: “Flee”).  titleOf(nodeId) and
// choiceLabelOf(nodeId, choiceId) supply the names. Plain text; escape before inserting as HTML.
function describeRequires(expr, titleOf, choiceLabelOf, nested){
  if(!isReqGroup(expr)){
    const t = titleOf(expr.nodeId);
    const base = expr.choiceId ? `${t}: “${choiceLabelOf(expr.nodeId, expr.choiceId)}”` : t;
    return expr.not ? `NOT ${base}` : base;
  }
  const items = (expr.items||[]).filter(i=> isReqGroup(i) ? (i.items||[]).length : i.nodeId);
  if(items.length===0) return nested ? '' : (expr.not ? 'never' : 'available from the start');
  const text = items.map(i=>describeRequires(i, titleOf, choiceLabelOf, true)).filter(Boolean).join(expr.op==='or' ? ' OR ' : ' AND ');
  if(expr.not) return items.length>1 ? `NOT (${text})` : `NOT ${text}`;
  return nested && items.length>1 ? `(${text})` : text;
}
// True once a node's own prerequisites are satisfied — independent of whether the
// node itself has been explicitly marked heard. Shared by isAvailable() and, for
// "completed by default" nodes, by isCompleted() itself.
function prerequisitesSatisfiedFor(node){
  return evalRequires(prereqExpr(node));
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
    prereqRefs(c).some(p=>p.nodeId===node.id) &&
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
// Whether every narration unlocked so far in this node's group has been heard — the same
// rule as the group's "Complete" badge. Narrations still locked don't count; ungrouped
// narrations never form a section.
function isSectionComplete(node){
  if(!node.groupId) return false;
  const game = games.find(g=>g.id===node.gameId);
  const group = game && (game.groups||[]).find(g=>g.id===node.groupId);
  if(!group) return false;
  const members = (nodesByGame[node.gameId]||[]).filter(n=>
    n.groupId===group.id && (group.showHiddenNodes || !n.hidden) && isAvailable(n));
  return members.length>0 && members.every(n=>isCompleted(n.id));
}
// Marks a node complete and, if exactly one other narration newly unlocked as a result, returns it.
// Returns null when this completes the node's section, so the reader closes there instead of
// moving on — finishing a section always returns the player to the list.
async function markCompletedAndFindNext(node, choiceId){
  const sectionWasComplete = isSectionComplete(node);
  const before = availabilitySnapshot(node.gameId, node.id);
  await markCompleted(node, choiceId);
  if(!sectionWasComplete && isSectionComplete(node)) return null;
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
