/**
 * Creates a prefixed console logger for the AniSearch script.
 * @param {string} prefix - Script identifier
 * @param {boolean} [debugMode=false] - When false, debug() is a no-op
 * @returns {{ log: Function, warn: Function, error: Function, info: Function, debug: Function }}
 */
export function createLogger(prefix, debugMode = false) {
  const tag = `[${prefix}]`;
  const make = (method) => (...args) => console[method](tag, ...args);
  return {
    log: make('log'),
    warn: make('warn'),
    error: make('error'),
    info: make('info'),
    debug: debugMode ? make('debug') : () => {},
  };
}
