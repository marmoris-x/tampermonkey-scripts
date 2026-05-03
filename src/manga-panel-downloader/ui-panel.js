// src/manga-panel-downloader/ui-panel.js — Sidebar UI and ZIP download
// Builds a shadow-DOM sidebar with scan controls, image segment listing, and
// ZIP download. All element queries go through the sidebar ShadowRoot.
// Consumers: Manga Panel Downloader (entry file)
(function () {
  'use strict';

  var SW = 320;

  // Sidebar content styles injected into the Shadow DOM
  var CONTENT_CSS = [
    '#mpd-controls { padding:12px 0; border-bottom:1px solid #2c2d32; display:flex; flex-direction:column; gap:9px; }',
    '.mpd-btn-row { display:flex; gap:8px; }',
    '.mpd-btn-row button { flex:1; }',
    '.mpd-btn { padding:7px 12px; border:none; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.15s; }',
    '.mpd-primary { background:#2f9e44; color:#fff; }',
    '.mpd-primary:hover:not(:disabled) { background:#237032; }',
    '.mpd-danger { background:#c92a2a; color:#fff; }',
    '.mpd-danger:hover:not(:disabled) { background:#a61e1e; }',
    '.mpd-secondary { background:#2c2d32; color:#c1c2c5; }',
    '.mpd-secondary:hover:not(:disabled) { background:#373a40; }',
    '.mpd-btn:disabled { background:#333; color:#555; cursor:not-allowed; }',
    '#mpd-progress { height:3px; background:#2c2d32; border-radius:2px; overflow:hidden; display:none; }',
    '#mpd-progress-bar { height:100%; background:#2f9e44; width:0%; transition:width 0.15s; }',
    '#mpd-status { font-size:12px; color:#909296; min-height:16px; }',
    '.mpd-thumb { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid #25262b; }',
    '.mpd-thumb img { width:48px; height:48px; object-fit:cover; border-radius:3px; flex-shrink:0; background:#25262b; }',
    '.mpd-thumb-info { flex:1; min-width:0; }',
    '.mpd-thumb-name { font-size:11px; color:#909296; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
    '.mpd-thumb-size { font-size:11px; color:#555; }',
    '.mpd-thumb input[type=checkbox] { flex-shrink:0; width:15px; height:15px; cursor:pointer; accent-color:#2f9e44; }',
    '#mpd-footer { padding:8px 0; border-top:1px solid #2c2d32; font-size:11px; color:#555; }',
    '.mpd-toggle-row { display:flex; align-items:center; gap:8px; font-size:12px; color:#909296; cursor:pointer; user-select:none; }',
    '.mpd-toggle-row input { cursor:pointer; accent-color:#2f9e44; }'
  ].join('');

  /**
   * Creates the sidebar UI with scan controls.
   * Returns DOM references so the entry file can wire event handlers.
   * All element queries must use root.querySelector() (Shadow DOM).
   * @param {boolean} mangaMode - Initial manga mode state
   * @returns {{
   *   sidebar: Object,   // TM.ui.createSidebar return value
   *   root: ShadowRoot,
   *   scanBtn: Element,
   *   dlBtn: Element,
   *   mangaCheck: Element,
   *   statusEl: Element,
   *   progressEl: Element,
   *   progressBar: Element,
   *   resultsEl: Element,
   *   footerEl: Element
   * }}
   */
  function buildUI(mangaMode) {
    var sidebar = TM.ui.createSidebar({
      width: SW,
      title: 'Manga Downloader',
      accentColor: '#2f9e44',
    });

    var root = sidebar.root;
    var style = document.createElement('style');
    style.textContent = CONTENT_CSS;
    root.appendChild(style);

    var body = sidebar.bodyEl;
    body.innerHTML = [
      '<div id="mpd-controls">',
      '<div class="mpd-btn-row">',
      '<button class="mpd-btn mpd-primary" id="mpd-scan">Scan</button>',
      '<button class="mpd-btn mpd-secondary" id="mpd-dl" disabled>ZIP</button>',
      '</div>',
      '<label class="mpd-toggle-row">',
      '<input type="checkbox" id="mpd-manga-mode"',
      mangaMode ? ' checked' : '',
      '>',
      '<span>Manga-Modus (auto weiterklicken)</span>',
      '</label>',
      '<div id="mpd-progress"><div id="mpd-progress-bar"></div></div>',
      '<div id="mpd-status">Ready.</div>',
      '</div>',
      '<div id="mpd-results"></div>',
      '<div id="mpd-footer"></div>'
    ].join('');

    sidebar.open();

    return {
      sidebar: sidebar,
      root: root,
      scanBtn: root.querySelector('#mpd-scan'),
      dlBtn: root.querySelector('#mpd-dl'),
      mangaCheck: root.querySelector('#mpd-manga-mode'),
      statusEl: root.querySelector('#mpd-status'),
      progressEl: root.querySelector('#mpd-progress'),
      progressBar: root.querySelector('#mpd-progress-bar'),
      resultsEl: root.querySelector('#mpd-results'),
      footerEl: root.querySelector('#mpd-footer')
    };
  }

  /**
   * Updates the scan button appearance based on scanning state.
   * @param {Element} scanBtn
   * @param {boolean} scanning
   */
  function setScanBtn(scanBtn, scanning) {
    if (!scanBtn) return;
    scanBtn.textContent = scanning ? 'Stop' : 'Scan';
    scanBtn.className = scanning
      ? 'mpd-btn mpd-danger'
      : 'mpd-btn mpd-primary';
  }

  /**
   * Adds image segments to the results list.
   * @param {Array} segments - Array of segment objects
   * @param {Element} resultsEl - #mpd-results element
   */
  function addSegmentsToUI(segments, resultsEl) {
    // Segments are stored in the entry file's state array.
    // This function renders them into the results element.
    if (!resultsEl) return;
    resultsEl.innerHTML = '';
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var div = document.createElement('div');
      div.className = 'mpd-thumb';
      div.innerHTML = [
        '<img src="' + seg.previewUrl + '">',
        '<div class="mpd-thumb-info">',
        '<div class="mpd-thumb-name">' + seg.filename + '</div>',
        '<div class="mpd-thumb-size">' + seg.w + '×' + seg.h + 'px</div>',
        '</div>',
        '<input type="checkbox" checked data-idx="' + i + '">'
      ].join('');
      resultsEl.appendChild(div);
    }
  }

  /**
   * Converts blobs to Uint8Arrays and builds a STORE ZIP blob.
   * @param {Array<{filename: string, blob: Blob}>} files
   * @returns {Promise<Blob>}
   */
  function buildZipBlob(files) {
    var converted = [];
    var pending = [];
    for (var i = 0; i < files.length; i++) {
      pending.push(new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(new Uint8Array(fr.result)); };
        fr.onerror = function () { reject(fr.error || new Error('FileReader error')); };
        fr.readAsArrayBuffer(files[i].blob);
      }).then(function (data) {
        return { name: files[i].filename, data: data };
      }));
    }
    return Promise.all(pending).then(function (converted) {
      var zipBytes = TM.zip.buildStoreZip(converted);
      return new Blob([zipBytes], { type: 'application/zip' });
    });
  }

  /**
   * Triggers a browser download of the given blob.
   * @param {Blob} blob
   * @param {string} filename
   */
  function triggerDownload(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }

  // Export
  window.__MPD__ = window.__MPD__ || {};
  window.__MPD__.buildUI = buildUI;
  window.__MPD__.setScanBtn = setScanBtn;
  window.__MPD__.addSegmentsToUI = addSegmentsToUI;
  window.__MPD__.buildZipBlob = buildZipBlob;
  window.__MPD__.triggerDownload = triggerDownload;
})();
