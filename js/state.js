// © 2026 Anders Ive. All Rights Reserved.
// Limits, default settings and the shared application state.
"use strict";

// ---------------- Limits ----------------
// raw file, before base64 inflation; IndexedDB has room for much bigger clips than the
// Claude.ai storage or localStorage
const MAX_AUDIO_BYTES = (hasPlatformStorage() || !window.indexedDB ? 3.2 : 25) * 1024 * 1024;
const MAX_FONT_BYTES = 2.5 * 1024 * 1024;    // raw file, before base64 inflation
const MAX_IMAGE_DIM = 1280;                   // px, longest side after compression
const IMAGE_QUALITY = 0.82;

const DEFAULT_SETTINGS = {
  hideCompleted:false,
  hideLockedInMap:true,
  autoCloseOnAudioEnd:false,
  theme:'dark',
  mapOrientation:'horizontal',
  autoAdvance:false,
  revealChoicesWhenDone:false,
  tickSoundEnabled:true,
  scratchSoundEnabled:true,
  logOrder:'latestFirst',
  audioPlayerStyle:'native',
  animationsEnabled:true,
  largeFont:false,
  groupCompleteSoundEnabled:true,
  countGroupsCompleted:true,
  hideUnavailableGroups:false,
  placeCompletedLast:false,
};

// ---------------- State ----------------
let games = [];
let nodesByGame = {};
let progress = {completed:{}};
let settings = Object.assign({}, DEFAULT_SETTINGS);

let route = {view:'library', gameId:null};
let manageMode = false;
let readerNode = null;
let readerResult = null; // {text, advanceTo} shown after a choice is played
let readerAutoPlay = false; // consumed once by renderReader to autoplay audio
let readerHistory = []; // node ids visited earlier in the current chain of reader navigations, for the Back button
let readerForward = []; // node ids to redo forward to, populated by the Back button, for the Forward button
let editingNodeId = null; // node currently being edited in manage panel, or null = "add new"
let gameSubView = 'shelf';
let undoStack = []; // [{nodeId, previous}] for progress changes, most recent last
let lastEditedNodeId = null; // most recently saved narration, for the Shift+↓ quick-chain fast key
let seenAvailableIds = new Set(); // node ids already shown as available — anything new here gets the unlock animation once
let importCandidates = null; // [{game, nodes}] loaded from a structure file, not yet in "Your Games" — shown on the Shelf
let hoveredMapNodeId = null; // node currently under the pointer on the campaign map, for the Shift+N shape-cycling fast key
let seenCompleteGroupIds = new Set(); // group ids already known complete — collapsing only fires on the transition into completeness
let defaultCodexRequested = false; // default_codex.json is offered on the Shelf once per page load
let pendingPasteImport = null; // {title, text} to prefill the "Add a narration" form with, or null

async function saveSettings(){ await sSet('settings', settings); }
