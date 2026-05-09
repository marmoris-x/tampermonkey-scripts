/**
 * Prefixed console logger factory.
 * Standalone copy — zero external dependencies.
 *
 * Creates a logger that prepends `[prefix]` to all console messages.
 * All log methods (log, warn, error, info, debug) are supported.
 * debug() is a no-op unless debugMode is explicitly enabled.
 *
 * @param {string} prefix - Script identifier (e.g. "NotebookLM Source Export")
 * @param {boolean} [debugMode=false]
 * @returns {{ log: Function, warn: Function, error: Function, info: Function, debug: Function }}
 */
'use strict';

export function createLogger(prefix, debugMode) {
  debugMode = debugMode || false;
  const tag = '[' + prefix + ']';
  return {
    log:   function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.log.apply(console, args); },
    warn:  function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.warn.apply(console, args); },
    error: function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.error.apply(console, args); },
    info:  function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.info.apply(console, args); },
    debug: function () { if (debugMode) { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.debug.apply(console, args); } }
  };
}
