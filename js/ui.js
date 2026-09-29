// © 2026 Anders Ive. All Rights Reserved.
// Toasts, media file helpers, icons, per-game theming and fonts, Markdown rendering.
"use strict";

// ---------------- Toast ----------------
let toastTimer=null;
function toast(msg){
  let el = document.getElementById('toast');
  if(!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.style.display='block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.style.display='none'; }, 3200);
}

// ---------------- Media helpers ----------------
function readFileAsDataUrl(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = ()=>rej(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
}

// Downscale + recompress an image file so it comfortably fits in storage.
function compressImage(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error('Could not read that image.'));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>reject(new Error('That image could not be decoded.'));
      img.onload = ()=>{
        let { width, height } = img;
        if(width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM){
          if(width >= height){ height = Math.round(height * (MAX_IMAGE_DIM/width)); width = MAX_IMAGE_DIM; }
          else { width = Math.round(width * (MAX_IMAGE_DIM/height)); height = MAX_IMAGE_DIM; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl;
        try{ dataUrl = canvas.toDataURL('image/jpeg', IMAGE_QUALITY); }
        catch(e){ reject(new Error('That image could not be processed.')); return; }
        if(dataUrl.length > 4.2*1024*1024){
          reject(new Error('Even after compressing, that image is too large to store. Try a smaller photo or paste an image URL instead.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function readAudioFile(file){
  if(file.size > MAX_AUDIO_BYTES){
    throw new Error(`That audio file is ${fmtBytes(file.size)} — please use a clip under ${fmtBytes(MAX_AUDIO_BYTES)}, or paste a hosted audio URL instead.`);
  }
  return readFileAsDataUrl(file);
}
// Tries to actually load an image/audio src (URL or local file path) to see whether it
// resolves — used in Manage Codex to flag references that can't currently be found.
// Resolves true (found), false (not found) or null (timed out / no src).
// Uploaded data: URLs are already known-good and resolve instantly without a real load.
// Manage Codex re-renders on every edit, so answers are remembered: "found" for the rest
// of the visit, anything else for a minute (so a file added on disk is picked up again).
// At most a few checks run at once, so a big game doesn't fire hundreds of requests together.
const MEDIA_CHECK_RETRY_MS = 60*1000;
const MEDIA_CHECK_PARALLEL = 6;
const mediaCheckCache = new Map(); // "type|src" -> {promise, result, at}
const mediaCheckWaiting = [];      // probes queued until a slot frees up
let mediaChecksRunning = 0;

function checkMediaReachable(src, type){
  if(!src) return Promise.resolve(null);
  if(src.startsWith('data:')) return Promise.resolve(true);
  const key = type+'|'+src;
  const cached = mediaCheckCache.get(key);
  if(cached && (cached.result===undefined || cached.result===true || Date.now()-cached.at < MEDIA_CHECK_RETRY_MS)){
    return cached.promise;
  }
  const entry = {result: undefined, at: 0};
  entry.promise = new Promise(resolve=>{
    mediaCheckWaiting.push(()=> probeMedia(src, type).then(ok=>{
      entry.result = ok; entry.at = Date.now();
      resolve(ok);
    }));
    runQueuedMediaChecks();
  });
  mediaCheckCache.set(key, entry);
  return entry.promise;
}
function runQueuedMediaChecks(){
  while(mediaChecksRunning < MEDIA_CHECK_PARALLEL && mediaCheckWaiting.length){
    mediaChecksRunning++;
    mediaCheckWaiting.shift()().finally(()=>{ mediaChecksRunning--; runQueuedMediaChecks(); });
  }
}
function probeMedia(src, type){
  return new Promise(resolve=>{
    let settled = false;
    let el;
    const done = (ok)=>{
      if(settled) return;
      settled = true;
      clearTimeout(timer);
      // stop any download still in progress — only the answer was needed
      if(el){ el.onload = el.onerror = el.onloadedmetadata = el.oncanplay = null; el.removeAttribute('src'); if(el.load) el.load(); }
      resolve(ok);
    };
    const timer = setTimeout(()=>done(null), 6000);
    if(type==='image'){
      el = new Image();
      el.onload = ()=>done(true);
      el.onerror = ()=>done(false);
      el.src = src;
    } else {
      el = new Audio();
      el.preload = 'metadata';
      el.onloadedmetadata = ()=>done(true);
      el.oncanplay = ()=>done(true);
      el.onerror = ()=>done(false);
      el.src = src;
      el.load();
    }
  });
}
async function readFontFile(file){
  if(file.size > MAX_FONT_BYTES){
    throw new Error(`That font file is ${fmtBytes(file.size)} — please use one under ${fmtBytes(MAX_FONT_BYTES)}, or paste a hosted or local font URL instead.`);
  }
  return readFileAsDataUrl(file);
}

// ---------------- Icons ----------------
const ICON_LOCK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="11" width="16" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const ICON_PLAY = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8V4z"/></svg>';
const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12l6 6L20 6"/></svg>';
const ICON_EYE_OFF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 10.6a2 2 0 1 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a15 15 0 0 1-4 4.6M6.2 6.2C3.6 8 2 12 2 12s4 7 10 7c1.3 0 2.5-.3 3.6-.8"/></svg>';
const ICON_GEAR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const CREST = '<img src="book-bubble.png" width="34" height="34" alt="">';
const ICON_PICTURE = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>';

function groupCompleteBadge(){
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:2px;background:rgba(111,138,83,.18);color:var(--moss);margin-left:8px;">${ICON_CHECK} Complete</span>`;
}
const ICON_MINI_PLAY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8V4z"/></svg>';
const ICON_MINI_PAUSE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>';

const AUDIO_PLAYER_STYLES = {
  native: {label:'Native (browser default)'},
  minimal: {label:'Minimal bar'},
  brass: {label:'Brass player'}
};
const ICON_PAUSE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>';

function buildAudioMarkup(src){
  if(!src) return '';
  const style = settings.audioPlayerStyle || 'native';
  if(style==='native'){
    return `<audio controls src="${escapeHtml(src)}"></audio>`;
  }
  return `
    <div class="custom-audio-player style-${style}" id="customAudioPlayer">
      <button class="cap-play" type="button" aria-label="Play">${ICON_PLAY}</button>
      <div class="cap-progress-track"><div class="cap-progress-fill"></div></div>
      <span class="cap-time">0:00 / 0:00</span>
    </div>
    <audio src="${escapeHtml(src)}" style="display:none;"></audio>
  `;
}

const TITLE_FONTS = {
  cinzel: {label:'Cinzel (default)', css:"'Cinzel', serif"},
  imfell_sc: {label:'IM Fell English SC', css:"'IM Fell English SC', serif"},
  special_elite: {label:'Special Elite (typewriter)', css:"'Special Elite', monospace"},
  cormorant: {label:'Cormorant Garamond', css:"'Cormorant Garamond', serif"},
  georgia: {label:'Georgia (system)', css:"Georgia, 'Times New Roman', serif"}
};
const TEXT_FONTS = {
  spectral: {label:'Spectral (default)', css:"'Spectral', serif"},
  imfell: {label:'IM Fell English', css:"'IM Fell English', serif"},
  garamond: {label:'EB Garamond', css:"'EB Garamond', serif"},
  special_elite: {label:'Special Elite (typewriter)', css:"'Special Elite', monospace"},
  system: {label:'System sans-serif', css:"-apple-system, 'Segoe UI', Arial, sans-serif"}
};
function customFontFamily(gameId, slot){ return `gf-${slot}-${gameId}`; }
function guessFontFormat(src){
  const s = (src||'').split('?')[0].toLowerCase();
  if(s.endsWith('.woff2') || src.startsWith('data:font/woff2') || src.startsWith('data:application/font-woff2')) return 'woff2';
  if(s.endsWith('.woff') || src.startsWith('data:font/woff') || src.startsWith('data:application/font-woff')) return 'woff';
  if(s.endsWith('.ttf') || src.startsWith('data:font/ttf')) return 'truetype';
  if(s.endsWith('.otf') || src.startsWith('data:font/otf')) return 'opentype';
  return '';
}
// Injects/refreshes the @font-face rule(s) for a game's custom fonts, if any.
function ensureCustomFontFaces(game){
  if(!game) return;
  ['customTitleFont','customTextFont'].forEach(key=>{
    const cf = game[key];
    const styleId = 'ff-'+key+'-'+game.id;
    let styleEl = document.getElementById(styleId);
    if(!cf || !cf.source){
      if(styleEl) styleEl.textContent = '';
      return;
    }
    if(!styleEl){ styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
    const format = guessFontFormat(cf.source);
    styleEl.textContent = `@font-face{font-family:'${cf.family}';src:${cssUrl(cf.source)}${format?` format('${format}')`:''};font-display:swap;}`;
  });
}
const GAME_STYLES = {
  default: {label:'Default (matches app theme)'},
  crimson: {label:'Crimson', dark:{brass:'#c0524a',dim:'#8a3a34',bright:'#e0736a'}, light:{brass:'#a83a32',dim:'#c25850',bright:'#7a241d'}},
  verdant: {label:'Verdant', dark:{brass:'#6f9a52',dim:'#4c6f38',bright:'#8fc26c'}, light:{brass:'#4c7a34',dim:'#6f9a52',bright:'#375c26'}},
  azure:   {label:'Azure',   dark:{brass:'#5a8fc2',dim:'#3d648c',bright:'#7fb0e0'}, light:{brass:'#3d6f9c',dim:'#5a8fc2',bright:'#2a4d70'}},
  amethyst:{label:'Amethyst',dark:{brass:'#9a72c2',dim:'#6f4f8f',bright:'#b896e0'}, light:{brass:'#7a53a3',dim:'#9a72c2',bright:'#5c3d80'}},
  ember:   {label:'Ember',   dark:{brass:'#d98a3d',dim:'#a8611f',bright:'#f0a75c'}, light:{brass:'#b5701f',dim:'#d98a3d',bright:'#8a5316'}},
  slate:   {label:'Slate',   dark:{brass:'#8a97a8',dim:'#5f6b7a',bright:'#aab6c4'}, light:{brass:'#5f6b7a',dim:'#8a97a8',bright:'#3f4854'}}
};
const COLOR_ROLES = ['bg','bgPanel','brass','brassDim','brassBright'];
const COLOR_ROLE_LABELS = {bg:'Background', bgPanel:'Panel background', brass:'Accent', brassDim:'Accent (dim)', brassBright:'Accent (bright)'};
function baseThemeColors(mode){
  return mode==='light'
    ? { bg:'#f3ead2', bgPanel:'#fdf8ea', brass:'#8a6114', brassDim:'#a9812c', brassBright:'#6b480d' }
    : { bg:'#181310', bgPanel:'#221b15', brass:'#c9a24b', brassDim:'#8c7431', brassBright:'#e2bc63' };
}
// Merges, per mode: this game's own custom picks (highest priority) over its style
// preset's accent colors (if any) over the app's base theme colors (lowest priority).
function effectiveGameColors(game, mode){
  const merged = baseThemeColors(mode);
  const presetKey = (game && game.stylePreset) || 'default';
  const preset = GAME_STYLES[presetKey];
  if(preset && preset[mode]){
    merged.brass = preset[mode].brass;
    merged.brassDim = preset[mode].dim;
    merged.brassBright = preset[mode].bright;
  }
  const custom = game && game.customColors && game.customColors[mode];
  if(custom){ COLOR_ROLES.forEach(role=>{ if(custom[role]) merged[role] = custom[role]; }); }
  return merged;
}
function gameAccentVars(game){
  const mode = settings.theme==='light' ? 'light' : 'dark';
  const c = effectiveGameColors(game, mode);
  return `--brass:${c.brass};--brass-dim:${c.brassDim};--brass-bright:${c.brassBright};--bg:${c.bg};--bg-panel:${c.bgPanel};`;
}
function gameFontStyle(game){
  ensureCustomFontFaces(game);
  let t, x;
  if(game && game.titleFont==='custom' && game.customTitleFont && game.customTitleFont.source){
    t = `'${game.customTitleFont.family}', serif`;
  } else {
    t = (TITLE_FONTS[game && game.titleFont] || TITLE_FONTS.cinzel).css;
  }
  if(game && game.textFont==='custom' && game.customTextFont && game.customTextFont.source){
    x = `'${game.customTextFont.family}', serif`;
  } else {
    x = (TEXT_FONTS[game && game.textFont] || TEXT_FONTS.spectral).css;
  }
  return `--font-title:${t};--font-text:${x};${gameAccentVars(game)}`;
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// A CSS url() for an image or font source, safe to put inside a style attribute or a
// <style> element — quotes, backslashes and line breaks in the source can't break out.
function cssUrl(src){
  return 'url("' + String(src||'').replace(/["\\\n\r]/g, c=>'\\'+c.charCodeAt(0).toString(16)+' ') + '")';
}
function bgImageStyle(src){
  return src ? escapeHtml('background-image:'+cssUrl(src)+';') : '';
}

// Author text may contain HTML (see renderMarkdown). It is run through DOMPurify so
// formatting, links and images survive, but scripts, event handlers and javascript:
// links from a loaded structure file can't run. Results are cached, since the same
// texts are re-rendered on every redraw.
const sanitizedCache = new Map();
if(window.DOMPurify){
  // keep target="_blank" links, but always with rel="noopener"
  DOMPurify.addHook('afterSanitizeAttributes', node=>{
    if(node.tagName==='A' && node.getAttribute('target')) node.setAttribute('rel', 'noopener noreferrer');
  });
}
function sanitizeHtml(html){
  if(!window.DOMPurify) return escapeHtml(html); // purify.min.js failed to load — show the text, never run it
  let clean = sanitizedCache.get(html);
  if(clean===undefined){
    clean = DOMPurify.sanitize(html, {ADD_ATTR:['target']});
    if(sanitizedCache.size > 2000) sanitizedCache.clear();
    sanitizedCache.set(html, clean);
  }
  return clean;
}

// Inline-only Markdown transforms (bold/italic/code/links), reused by both the full block
// renderer below and the single-line title renderer. Raw HTML passes through untouched.
function inlineMarkdown(t){
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return t;
}
// Titles/names: single line, no paragraph or list wrapping, but the same inline
// Markdown shortcuts and raw HTML support as the full renderer.
function renderTitle(src){
  if(!src) return '';
  return sanitizeHtml(inlineMarkdown(src));
}

// Small Markdown -> HTML renderer for accompanying text / choice results. Raw HTML typed
// by the author renders directly, after sanitizing (see sanitizeHtml).
function renderMarkdown(src){
  if(!src) return '';
  const lines = src.replace(/\r\n/g,'\n').split('\n');
  let html = '';
  let inList = false;
  const inlineMd = inlineMarkdown;
  lines.forEach(line=>{
    const listMatch = line.match(/^\s*[-*]\s+(.*)/);
    if(listMatch){
      if(!inList){ html += '<ul>'; inList = true; }
      html += `<li>${inlineMd(listMatch[1])}</li>`;
      return;
    }
    if(inList){ html += '</ul>'; inList=false; }
    if(line.trim()===''){ html += '<br>'; return; }
    html += `<p>${inlineMd(line)}</p>`;
  });
  if(inList) html += '</ul>';
  return sanitizeHtml(html);
}
