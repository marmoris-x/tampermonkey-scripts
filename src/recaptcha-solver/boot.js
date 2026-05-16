'use strict';

import { createLogger } from './_logger.js';
import { waitForElement, observeMutations, qs } from './_dom.js';
import { startSolver } from './solver-engine.js';
import { createFreshState } from './solver-state.js';
import { injectButton, setButtonState } from './ui-button.js';
import { createStyleSheet } from './ui-styles.js';
import { measureServerLatencies } from './_network.js';
import { SEL, SERVERS, HELP_SEL, HOST_ID } from './config.js';

/**
 * Registers the Recaptcha Solver boot sequence.
 * 1. Fires server latency pings (non-blocking)
 * 2. Injects the solve button into the challenge footer
 * 3. Wires the button click to the solver engine via dependency injection
 * 4. Observes for DOM resets and re-injects the button if lost
 */
export function registerBoot() {
  const log = createLogger('Recaptcha Solver');

  // Kick off server latency measurement (non-blocking)
  measureServerLatencies(SERVERS);

  // State managed by boot — passed to solver engine via DI
  let currentState = null;
  let currentInterval = null;

  /**
   * Click handler for the solve button.
   * Routes to retry or fresh start depending on solver state.
   */
  function handleClick(btn) {
    // Retry: previously failed (stopped but not solved)
    if (currentState && currentState.stopped && !currentState.solved) {
      log.log('Retrying solver...');
      const statusEl = qs(SEL.STATUS);
      currentState = createFreshState(statusEl ? statusEl.innerText : '');
      currentInterval = startSolver({
        state: currentState,
        onStateChange: (stateName) => {
          setButtonState(btn, stateName);
          if (stateName !== 'working') currentInterval = null;
        }
      });
      return;
    }

    // Prevent double-start while running or already solved
    if (currentInterval || (currentState && currentState.solved)) return;

    // Fresh start
    log.log('Solver started by user');
    const statusEl = qs(SEL.STATUS);
    currentState = createFreshState(statusEl ? statusEl.innerText : '');
    currentInterval = startSolver({
      state: currentState,
      onStateChange: (stateName) => {
        setButtonState(btn, stateName);
        if (stateName !== 'working') currentInterval = null;
      }
    });
  }

  // Pre-create style sheet so CSSStyleSheet.replaceSync runs once
  createStyleSheet();

  // Wait for help button holder, then inject solve button
  waitForElement(HELP_SEL, 0).then(() => {
    const btnData = injectButton({
      onClick() { handleClick(this); }
    });

    if (btnData) {
      log.log('Boot complete');
    }
  });

  // Observe for DOM resets — re-inject button if lost
  observeMutations(() => {
    if (!document.getElementById(HOST_ID) && qs(HELP_SEL)) {
      log.log('Button lost — re-injecting');
      injectButton({
        onClick() { handleClick(this); }
      });
    }
  });
}
