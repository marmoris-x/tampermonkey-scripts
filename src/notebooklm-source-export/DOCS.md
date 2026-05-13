# NotebookLM Source Export — Developer Documentation (v6.0)

Exports NotebookLM sources and chat as ZIP archives. Two Tampermonkey menu commands — no floating UI.

## Architecture

```
NotebookLM Source Export.user.js     Tampermonkey entry (in entries/)
    ├── progress.js                  Mini progress bar (closed Shadow DOM, zero innerHTML)
    └── extractor.js                 exportChat + exportSources — orchestrates extraction
            ├── converter.js         Recursive DOM-to-Markdown (standalone)
            ├── zip.js               STORE ZIP builder with CRC-32 (standalone)
            ├── chat-extractor.js    Chat DOM extraction: Markdown, HTML, plain text
            └── logger.js            Prefixed console logger (standalone)
```

**No more `ui.js` (removed in v6.0).** All UI replaced by a ~160-line mini progress bar that self-destructs after 7 seconds.

## File Map

| File | Lines | Responsibility |
|------|-------|---------------|
| `progress.js` | ~160 | `createProgress(mode, onStop)` — closed Shadow DOM, zero `innerHTML`, 7s self-destruct |
| `extractor.js` | ~530 | `exportChat()`, `exportSources()` — extraction loops, SoundFX, KeepAlive |
| `chat-extractor.js` | ~420 | `extractChatToMarkdown()`, `extractChatToText()`, `extractChatMessages()`, `buildChatHTMLDocument()` |
| `converter.js` | ~145 | `htmlToMarkdown(el)` — recursive DOM→GFM converter |
| `zip.js` | ~107 | `buildStoreZip(files)` — STORE ZIP archive builder |
| `logger.js` | ~25 | `createLogger(prefix)` — prefixed console logger |

## Dataflow

```
TM Menu: "Export Chat"
  → exportChat(options) [extractor.js]
     ├── extractChatToMarkdown(htmlToMarkdown) → chat.md
     ├── extractChatMessages() + buildChatHTMLDocument() → chat.html
     ├── extractChatToText() → chat.txt
     ├── buildStoreZip([chat.md, chat.html, chat.txt])
     └── GM_download({ url: zipBlob, name: "title - chat.zip" })

TM Menu: "Export Sources"
  → exportSources(options) [extractor.js]
     ├── Start keep-alive audio loop (prevents timer throttling in background tabs)
     ├── Register "Stop Export" menu command
     └── For each .single-source-container:
          1. Scroll into view, click source title
          2. waitForContent() — MutationObserver-based, polls up to 15s
          3. htmlToMarkdown() on each content element → join with \n\n
          4. Collect {name, data} object
          5. attemptClose() (4-strategy fallback)
          6. waitForContentGone() — verify panel closed
     Build ZIP via buildStoreZip()
     GM_download({ url: zipBlob, name: "title.zip" })
     GM_notification() on success
```

## Menu Commands

| Command | Action |
|---------|--------|
| **Export Chat** | Bundles chat as `.md` (markdown) + `.html` (styled) + `.txt` (plain text) in one ZIP |
| **Export Sources** | Extracts all sources as `.md` files in a ZIP (one file per source) |

Both commands show a mini progress bar (bottom-right) during extraction.
The progress bar self-destructs 7 seconds after completion, error, or stop.

## Selector Reference

These selectors target the NotebookLM DOM. Update them if Google changes the UI.

| Purpose | Selector | Found In |
|---------|----------|----------|
| Source list items | `.single-source-container` | SOURCE LIST |
| Source title | `.source-title` (inside `.source-title-column`) | SOURCE LIST |
| Source content | `labs-tailwind-structural-element-view-v2` | SOURCE CONTENT |
| Notebook title (sources) | `.title-label-inner.mat-title-large` | PROJECT TITLE |
| Notebook title (chat) | `.cover-title.mat-headline-medium` | CHAT PANEL |
| Chat container | `.chat-panel-content` | CHAT PANEL |
| Close button | `button[mattooltip*="close"], button[aria-label*="Close"], ...` | UI Chrome |

## Source Types

NotebookLM supports multiple source types (web pages, YouTube, pasted text, Google Docs/Slides, PDF). All follow the same extraction flow: click source title, wait for content panel, convert HTML to Markdown.

## Limits

- **Background tabs:** Timers are throttled. The inaudible keep-alive audio loop prevents this.
- **Content wait:** Up to 15s per source via MutationObserver with stability detection.
- **Minimum content length:** Sources shorter than 20 chars are skipped.
- **File naming:** Sanitized (invalid chars → `_`), truncated to 120 chars, `.md` appended.
- **Chat export:** 3 formats bundled in one ZIP (STORE, no compression).
- **Audio feedback:** Startup tone (600Hz), error (150Hz sawtooth), completion chime (440/554/659Hz).
- **Trusted Types:** The mini progress bar uses zero `innerHTML` — only `createElement` + `textContent`. Trusted Types safe by design.
