## The thing speaks for itself...
A tool to keep track of your voice narrations.

### Installation
Go to the html-page.

### Project structure
`loquitur.html` is the page. Its styles are in `css/loquitur.css` and its code in `js/`,
as plain scripts (not ES modules), so the page also works when opened straight from disk.
The scripts share one global scope and are loaded in order by `loquitur.html`:

| File | Contents |
|---|---|
| `vendor/purify.min.js` | [DOMPurify](https://github.com/cure53/DOMPurify) 3.4.16, sanitizes author HTML (license in `vendor/purify.LICENSE`) |
| `storage.js` | Persistent storage (IndexedDB) and small utilities |
| `state.js` | Limits, default settings, shared application state |
| `progress.js` | Unlock logic, completion records, undo, progress import/export |
| `library-data.js` | Structure import/export and cleaning, default codex, deleting and copying |
| `audio.js` | Synthesized UI sounds, inline narration preview |
| `ui.js` | Toasts, media helpers, icons, theming and fonts, Markdown |
| `shell.js` | Root render, header, Settings window |
| `library-view.js` | Library, available structures, Add / Edit game window |
| `game-view.js` | Game header, Log, Shelf and List |
| `map-view.js` | Campaign map |
| `reader.js` | Narration reader and its navigation |
| `manage-view.js` | Manage codex panel |
| `shortcuts.js` | Keyboard shortcuts |
| `main.js` | Startup — must load last |

### Donations, Support on Patreon

Please support me on Patreon.

Or support me with PayPal:

![My patreon QR-code](patreon.jpg "My patreon")