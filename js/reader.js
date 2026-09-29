// © 2026 Anders Ive. All Rights Reserved.
// Narration reader window and its Back / Forward navigation.
"use strict";

// True if the given narration should auto-advance — either the app-wide setting is on,
// or its group has "Automatically open the next node" enabled specifically.
function shouldAutoAdvance(node){
  if(settings.autoAdvance) return true;
  if(!node || !node.groupId) return false;
  const game = games.find(g=>g.id===node.gameId);
  if(!game) return false;
  const group = (game.groups||[]).find(g=>g.id===node.groupId);
  return !!(group && group.autoAdvanceGroup);
}
function openReaderFor(node, autoplay){
  // clicking an unheard narration plays it right away when auto-advance is on
  if(autoplay === undefined) autoplay = settings.autoAdvance && !isCompleted(node.id);
  const resolved = resolveJunctions(node);
  const skipped = resolved !== node;
  // if we're already viewing something and moving on to a different node, remember
  // where we came from so the reader's Back button can return to it.
  if(resolved && readerNode && readerNode.id !== resolved.id){ readerHistory.push(readerNode.id); }
  readerForward = []; // a fresh forward move invalidates whatever we could have redone to
  stopInlinePlay();
  readerNode = resolved;
  readerResult = null;
  readerAutoPlay = !!(resolved && resolved.audio && (autoplay || skipped));
  if(resolved) playTickSound();
  render();
}
function goBack(){
  if(readerHistory.length===0) return;
  const prevId = readerHistory.pop();
  const prevNode = findNodeById(prevId);
  if(!prevNode){ goBack(); return; } // that one's gone (e.g. deleted) — try the one before it
  if(readerNode) readerForward.push(readerNode.id);
  stopInlinePlay();
  readerNode = prevNode;
  readerResult = null;
  readerAutoPlay = false;
  render();
}
function goForward(){
  if(readerForward.length===0) return;
  const nextId = readerForward.pop();
  const nextNode = findNodeById(nextId);
  if(!nextNode){ goForward(); return; } // that one's gone (e.g. deleted) — try the one after it
  if(readerNode) readerHistory.push(readerNode.id);
  stopInlinePlay();
  readerNode = nextNode;
  readerResult = null;
  readerAutoPlay = false;
  render();
}

// ---------------- Reader overlay ----------------
function renderReader(){
  const n = readerNode;
  stopInlinePlay();
  const overlay = document.createElement('div');
  overlay.className='reader-overlay' + (settings.animationsEnabled ? ' anim-in' : '');
  overlay.id='narrationReaderOverlay';
  const done = isCompleted(n.id);
  const hasChoices = n.choices && n.choices.length>0;

  const closeAndRerender = ()=>{ readerNode=null; readerResult=null; readerAutoPlay=false; readerHistory=[]; readerForward=[]; overlay.remove(); render(); };
  const advanceTo = (nextNode)=>{ openReaderFor(nextNode, true); };

  const pos = n.image ? (n.imagePosition || 'top') : 'top';
  const isRow = n.image && (pos==='left' || pos==='right');
  const artHtml = n.image
    ? (isRow
        ? `<div class="art" style="${bgImageStyle(n.image)}width:100%;height:100%;min-height:220px;"></div>`
        : `<div class="art" style="${bgImageStyle(n.image)}"></div>`)
    : '';
  const contentHtml = `
    <div class="content">
      <h2>${renderTitle(n.title)}</h2>
      ${(!readerResult && n.audio) ? buildAudioMarkup(n.audio) : ''}
      ${(!readerResult && !n.audio) ? `<div class="hint" style="margin-bottom:16px;">No audio attached to this narration.</div>` : ''}
      ${!readerResult ? `<div class="body-text">${renderMarkdown(n.text||'')}</div>` : ''}
      <div id="readerAction"></div>
    </div>
  `;

  const navButtons = (readerHistory.length? `<button id="backReader">← Back</button>` : '') + (readerForward.length? `<button id="forwardReader">Forward →</button>` : '');
  const backBtnHtml = navButtons ? `<div class="nav-btn-group">${navButtons}</div>` : '';
  let bodyMarkup;
  if(isRow){
    bodyMarkup = `
      <div class="reader-relative" style="display:flex;flex-direction:${pos==='left'?'row':'row-reverse'};max-height:92vh;overflow:hidden;">
        <div style="flex:0 0 34%;align-self:stretch;">${artHtml}</div>
        <div style="flex:1;min-width:0;max-height:92vh;overflow:auto;">${contentHtml}</div>
        ${backBtnHtml}
        <button class="close" id="closeReader">&times;</button>
      </div>`;
  } else if(pos==='bottom'){
    bodyMarkup = `<div class="reader-relative">${contentHtml}${artHtml}${backBtnHtml}<button class="close" id="closeReader">&times;</button></div>`;
  } else {
    bodyMarkup = `<div class="reader-relative">${artHtml}${backBtnHtml}<button class="close" id="closeReader">&times;</button>${contentHtml}</div>`;
  }
  overlay.innerHTML = `<div class="reader">${bodyMarkup}</div>`;
  const ownerGame = games.find(g=>g.id===n.gameId);
  overlay.querySelector('.reader').setAttribute('style', gameFontStyle(ownerGame));

  document.body.appendChild(overlay);
  overlay.onclick = (e)=>{ if(e.target===overlay) closeAndRerender(); };
  const backBtnEl = overlay.querySelector('#backReader');
  if(backBtnEl){ backBtnEl.onclick = goBack; }
  const forwardBtnEl = overlay.querySelector('#forwardReader');
  if(forwardBtnEl){ forwardBtnEl.onclick = goForward; }
  overlay.querySelector('#closeReader').onclick = closeAndRerender;

  const audioEl = overlay.querySelector('audio');
  const capPlayer = overlay.querySelector('#customAudioPlayer');
  if(audioEl && capPlayer){
    const playBtn = capPlayer.querySelector('.cap-play');
    const fill = capPlayer.querySelector('.cap-progress-fill');
    const track = capPlayer.querySelector('.cap-progress-track');
    const timeLabel = capPlayer.querySelector('.cap-time');
    const fmtTime = (s)=>{ if(!isFinite(s)||s<0) return '0:00'; const m=Math.floor(s/60); const sec=Math.floor(s%60); return m+':'+String(sec).padStart(2,'0'); };
    const updateUI = ()=>{
      fill.style.width = (audioEl.duration? (audioEl.currentTime/audioEl.duration*100):0)+'%';
      timeLabel.textContent = fmtTime(audioEl.currentTime)+' / '+fmtTime(audioEl.duration);
      playBtn.innerHTML = (!audioEl.paused && !audioEl.ended) ? ICON_PAUSE : ICON_PLAY;
    };
    playBtn.onclick = ()=>{ if(audioEl.paused) audioEl.play().catch(()=>{}); else audioEl.pause(); };
    track.addEventListener('click', (e)=>{
      const rect = track.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX-rect.left)/rect.width));
      if(isFinite(audioEl.duration)) audioEl.currentTime = pct*audioEl.duration;
    });
    ['play','pause','timeupdate','loadedmetadata','ended'].forEach(evtName=> audioEl.addEventListener(evtName, updateUI));
    updateUI();
  }
  if(audioEl && settings.autoCloseOnAudioEnd){
    audioEl.addEventListener('ended', async ()=>{
      if(hasChoices) return; // a choice still has to be made manually
      if(!done){
        const next = await markCompletedAndFindNext(n, null);
        if(shouldAutoAdvance(n) && next){ advanceTo(next); return; }
        toast('Marked as heard — new narrations may be available.');
      }
      closeAndRerender();
    });
  }
  const shouldDelayChoices = hasChoices && !done && settings.revealChoicesWhenDone && !!n.audio;
  if(audioEl && shouldDelayChoices){
    audioEl.addEventListener('ended', ()=>{
      const box = overlay.querySelector('#readerAction');
      if(box){ box.innerHTML=''; box.appendChild(renderChoiceButtons()); }
    });
  }
  if(audioEl && readerAutoPlay){
    readerAutoPlay = false;
    audioEl.play().catch(()=>{ /* autoplay may be blocked by the browser */ });
  } else {
    readerAutoPlay = false;
  }

  const actionBox = overlay.querySelector('#readerAction');

  if(readerResult){
    actionBox.innerHTML = `
      <div class="result-box">
        <div class="result-label">What happens</div>
        <div class="result-text">${renderMarkdown(readerResult.text)}</div>
        <button class="btn primary" id="closeResult">Continue</button>
      </div>
    `;
    actionBox.querySelector('#closeResult').onclick = ()=>{
      const next = readerResult.advanceTo;
      if(shouldAutoAdvance(n) && next){ advanceTo(next); return; }
      closeAndRerender();
    };
    return overlay;
  }

  function renderChoiceButtons(){
    const box = document.createElement('div');
    box.innerHTML = `<div class="hint" style="margin-bottom:8px;">What happens next?</div>`;
    const choicesWrap = document.createElement('div');
    choicesWrap.className='choices';
    n.choices.forEach(c=>{
      const b = document.createElement('button');
      b.className='choice-btn';
      b.textContent = c.label;
      b.onclick = async ()=>{
        const next = await markCompletedAndFindNext(n, c.id);
        if(c.resultText && c.resultText.trim()){
          readerResult = {text: c.resultText.trim(), advanceTo: next};
          overlay.remove();
          render();
        } else if(shouldAutoAdvance(n) && next){
          advanceTo(next);
        } else {
          toast('Choice recorded — new narrations may be available.');
          closeAndRerender();
        }
      };
      choicesWrap.appendChild(b);
    });
    box.appendChild(choicesWrap);
    return box;
  }

  function renderMultiChoiceButtons(preselected){
    const pre = new Set(preselected||[]);
    const box = document.createElement('div');
    box.innerHTML = `<div class="hint" style="margin-bottom:8px;">Select all that apply, then continue — or leave everything unchecked if none apply.</div>`;
    const choicesWrap = document.createElement('div');
    choicesWrap.className='choices';
    const selected = new Set(pre);
    n.choices.forEach(c=>{
      const label = document.createElement('label');
      label.className='choice-btn';
      label.style.display='flex'; label.style.alignItems='center'; label.style.gap='10px';
      label.innerHTML = `<input type="checkbox" ${pre.has(c.id)?'checked':''}> <span>${escapeHtml(c.label)}</span>`;
      label.querySelector('input').onchange = (e)=>{ if(e.target.checked) selected.add(c.id); else selected.delete(c.id); };
      choicesWrap.appendChild(label);
    });
    box.appendChild(choicesWrap);
    const submitBtn = document.createElement('button');
    submitBtn.className='btn primary';
    submitBtn.style.marginTop='10px';
    submitBtn.textContent='Confirm selection';
    submitBtn.onclick = async ()=>{
      const ids = Array.from(selected);
      const next = await markCompletedAndFindNext(n, ids);
      const resultTexts = n.choices.filter(c=>ids.includes(c.id) && c.resultText && c.resultText.trim()).map(c=>c.resultText.trim());
      if(resultTexts.length){
        readerResult = {text: resultTexts.join('\n\n'), advanceTo: next};
        overlay.remove();
        render();
      } else if(shouldAutoAdvance(n) && next){
        advanceTo(next);
      } else {
        toast(ids.length ? 'Choices recorded — new narrations may be available.' : 'No answer recorded — new narrations may be available.');
        closeAndRerender();
      }
    };
    box.appendChild(submitBtn);
    return box;
  }

  function renderProceedButton(){
    const kids = findChildrenUnlockedBy(n);
    const b = document.createElement('button');
    if(kids.length===1){
      b.className='btn primary small';
      b.textContent='Continue →';
      b.onclick = ()=> openReaderFor(kids[0], true);
    } else {
      b.className='btn ghost small';
      b.textContent='Return to index';
      b.onclick = closeAndRerender;
    }
    return b;
  }

  function renderChoicesPending(){
    const box = document.createElement('div');
    box.innerHTML = `<div class="hint">Choices will appear once the narration finishes playing.</div>`;
    return box;
  }

  if(hasChoices){
    if(done){
      const rec = completionRecord(n.id) || {choiceId:null, choiceIds:null};
      const chosenList = Array.isArray(rec.choiceIds) && rec.choiceIds.length
        ? n.choices.filter(c=>rec.choiceIds.includes(c.id))
        : (n.choices.find(c=>c.id===rec.choiceId) ? [n.choices.find(c=>c.id===rec.choiceId)] : []);
      const chosenLabel = chosenList.map(c=>`"${escapeHtml(c.label)}"`).join(', ');
      const footer = document.createElement('div');
      footer.className='reader-footer';
      footer.innerHTML = `<span class="completed-pill">${ICON_CHECK} Heard — you chose ${chosenLabel||'—'}</span>`;
      const btnRow = document.createElement('span');
      btnRow.style.cssText='display:flex;gap:8px;';
      const changeBtn = document.createElement('button');
      changeBtn.className='btn ghost small';
      changeBtn.textContent='Change choice';
      changeBtn.onclick = ()=>{
        actionBox.innerHTML='';
        actionBox.appendChild(n.multiChoice ? renderMultiChoiceButtons(rec.choiceIds||[]) : renderChoiceButtons());
      };
      btnRow.appendChild(changeBtn);
      btnRow.appendChild(renderProceedButton());
      footer.appendChild(btnRow);
      actionBox.appendChild(footer);
    } else {
      actionBox.appendChild(shouldDelayChoices ? renderChoicesPending() : (n.multiChoice ? renderMultiChoiceButtons() : renderChoiceButtons()));
    }
  } else {
    if(done){
      const footer = document.createElement('div');
      footer.className='reader-footer';
      footer.innerHTML = `<span class="completed-pill">${ICON_CHECK} Marked as heard</span>`;
      footer.appendChild(renderProceedButton());
      actionBox.appendChild(footer);
    } else {
      const b = document.createElement('button');
      b.className='btn primary';
      b.textContent='Mark as heard';
      b.onclick = async ()=>{
        const next = await markCompletedAndFindNext(n, null);
        if(shouldAutoAdvance(n) && next){ advanceTo(next); return; }
        toast('Marked as heard — new narrations may be available.');
        closeAndRerender();
      };
      actionBox.appendChild(b);
    }
  }
  return overlay;
}
