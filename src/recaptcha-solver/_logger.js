'use strict';

/**
 * Creates a namespaced logger with [prefix] tagging.
 * @param {string} prefix - Displayed as [prefix] in all log lines
 * @param {boolean} [debugMode=false] - When false, .debug() calls are no-ops
 * @returns {{ log: Function, warn: Function, error: Function, info: Function, debug: Function }}
 */
export function createLogger(prefix, debugMode = false) {
  const tag = `[${prefix}]`;
  return {
    log(...args)     { console.log(tag, ...args); },
    warn(...args)    { console.warn(tag, ...args); },
    error(...args)   { console.error(tag, ...args); },
    info(...args)    { console.info(tag, ...args); },
    debug(...args)   { if (debugMode) console.debug(tag, ...args); }
  };
}
