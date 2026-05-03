// src/recaptcha-solver/ui-button.js — Solve button injection and visual states
// Handles injecting the solve button into the reCAPTCHA challenge iframe,
// managing state-based visual appearance (ready/working/success/failed/dos),
// and observing for re-injection when the DOM resets.
// Consumers: Recaptcha Solver (entry file, solver-engine)
(function () {
  'use strict';

  var log = TM.createLogger('Recaptcha Solver');

  // ── SVG Icons ───────────────────────────────────────────────────────────────

  var SVG = {
    bolt:  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M13 2 3 14h9l-1 8L21 10h-9l1-8z"/></svg>',
    spin:  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="rs-spin" style="display:block"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="20 6 9 17 4 12"/></svg>',
    retry: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.95"/></svg>',
    warn:  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="#fff"/></svg>'
  };

  var BUTTON_ID  = 'rs-solve-btn';
  var WRAPPER_ID = 'rs-solve-wrapper';
  var HELP_SEL   = '.help-button-holder';

  // ── Button States ───────────────────────────────────────────────────────────

  var BTN_STATES = {
    ready:   [SVG.bolt,  'Solve automatically',           '',           false],
    working: [SVG.spin,  'Solving...',                    'rs-working',  true ],
    success: [SVG.check, 'Solved!',                       'rs-success',  true ],
    failed:  [SVG.retry, 'Failed — click to retry',       'rs-failed',   false],
    dos:     [SVG.warn,  'Automated query limit reached', 'rs-dos',      true ]
  };

  /**
   * Updates the button's appearance based on state name.
   * @param {Element} btn - The solve button element
   * @param {string} stateName - One of: ready, working, success, failed, dos
   */
  function setButtonState(btn, stateName) {
    if (!btn) return;
    var s = BTN_STATES[stateName] || BTN_STATES.ready;
    btn.innerHTML = s[0];
    btn.title     = s[1];
    btn.disabled  = s[3];
    btn.className = 'rc-button goog-inline-block rs-btn' + (s[2] ? ' ' + s[2] : '');
  }

  // ── CSS Injection ───────────────────────────────────────────────────────────

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '.rs-btn-holder{display:inline-flex!important;align-items:center!important;justify-content:center!important;vertical-align:middle!important}',
      '.rs-btn{background-image:none!important;background-color:#1a73e8!important;color:#fff!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;border:none!important;border-radius:4px!important;cursor:pointer!important;line-height:0!important;vertical-align:middle!important;transition:background-color 0.15s ease,transform 0.1s ease,box-shadow 0.15s ease!important;box-shadow:0 1px 3px rgba(0,0,0,0.25)!important;outline:none!important;user-select:none!important}',
      '.rs-btn:not(:disabled):hover{background-color:#1558b0!important;box-shadow:0 2px 6px rgba(0,0,0,0.3)!important;transform:translateY(-1px)!important}',
      '.rs-btn:not(:disabled):active{transform:translateY(0) scale(0.96)!important;box-shadow:0 1px 2px rgba(0,0,0,0.2)!important}',
      '.rs-btn:disabled{cursor:default!important;opacity:0.80!important}',
      '.rs-btn.rs-working{background-color:#f29900!important}',
      '.rs-btn.rs-success{background-color:#1e8e3e!important}',
      '.rs-btn.rs-failed{background-color:#d93025!important}',
      '.rs-btn.rs-failed:not(:disabled):hover{background-color:#b71c1c!important}',
      '.rs-btn.rs-dos{background-color:#e37400!important}',
      '.rs-spin{animation:rs-rotate 0.9s linear infinite!important;transform-origin:center!important}',
      '@keyframes rs-rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
      '.rs-btn:focus-visible{outline:2px solid #1a73e8!important;outline-offset:2px!important}'
    ].join('');
    document.head.appendChild(style);
  }

  // ── Button Injection ────────────────────────────────────────────────────────

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;

    var helpHolder = document.querySelector(HELP_SEL);
    if (!helpHolder) return;

    var btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.tabIndex = 0;
    setButtonState(btn, 'ready');

    btn.addEventListener('click', function () {
      var st = window.__RCS__.state;
      if (st && st.stopped && !st.solved) {
        log.log('Retrying solver...');
        window.__RCS__.startSolver(btn);
        return;
      }
      if (window.__RCS__.solverInterval || (st && st.solved)) return;
      log.log('Solver started by user');
      window.__RCS__.startSolver(btn);
    });

    var wrapper = document.createElement('div');
    wrapper.id = WRAPPER_ID;
    wrapper.className = 'button-holder rs-btn-holder';
    wrapper.appendChild(btn);

    helpHolder.insertAdjacentElement('afterend', wrapper);
    log.log('Solve button injected');
  }

  // ── Namespace Registration ─────────────────────────────────────────────────

  window.__RCS__ = window.__RCS__ || {};
  window.__RCS__.BUTTON_ID = BUTTON_ID;
  window.__RCS__.setButtonState = setButtonState;
  window.__RCS__.injectStyles = injectStyles;
  window.__RCS__.injectButton = injectButton;
})();
