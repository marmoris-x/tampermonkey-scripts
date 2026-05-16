'use strict';

/**
 * Creates a fresh solver state object with all properties reset.
 * Pure function — no DOM access, no side effects.
 * @param {string} [initialStatus=''] - Initial accessible status text from the page
 * @returns {{
 *   stopped: boolean,
 *   solved: boolean,
 *   waiting: boolean,
 *   waitingStart: number,
 *   audioUrl: string,
 *   requestCount: number,
 *   submittedAt: number,
 *   audioBtnClickAt: number,
 *   initialStatus: string
 * }}
 */
export function createFreshState(initialStatus = '') {
  return {
    stopped:         false,
    solved:          false,
    waiting:         false,
    waitingStart:    0,
    audioUrl:        '',
    requestCount:    0,
    submittedAt:     0,
    audioBtnClickAt: 0,
    initialStatus
  };
}
