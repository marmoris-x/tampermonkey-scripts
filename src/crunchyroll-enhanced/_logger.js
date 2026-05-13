// src/crunchyroll-enhanced/_logger.js — Console-Logger-Factory
// Provides: createLogger

'use strict';

/**
 * Creates a tagged console logger.
 * @param {string} prefix - Tag shown in console output (e.g. '[ScriptName]')
 * @param {boolean} [debugMode=false] - Enable debug-level logging
 * @returns {{ log: Function, warn: Function, error: Function, info: Function, debug: Function }}
 */
export function createLogger(prefix, debugMode = false) {
  const tag = `[${prefix}]`;

  const forward = (method, args) => console[method](tag, ...args);

  return {
    /** @param {...unknown} args */
    log:   (...args) => forward('log',   args),
    /** @param {...unknown} args */
    warn:  (...args) => forward('warn',  args),
    /** @param {...unknown} args */
    error: (...args) => forward('error', args),
    /** @param {...unknown} args */
    info:  (...args) => forward('info',  args),
    /** @param {...unknown} args */
    debug: (...args) => { if (debugMode) forward('debug', args); },
  };
}
