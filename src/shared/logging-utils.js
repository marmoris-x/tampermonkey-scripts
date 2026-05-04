// src/shared/logging-utils.js — Prefix-based logger factory for Tampermonkey scripts
// Provides console.log/warn/error/info/debug with automatic [Prefix] formatting.
// Consumers: ALL 17 scripts (direct console.log callers replaced with logger instance).

/**
 * Creates a prefixed logger instance. All methods prepend `[prefix]` to messages.
 * @param {string} prefix - Script identifier (e.g. "Marketplace Deal Finder")
 * @param {boolean} [debugMode=false] - When false, debug() calls are no-ops
 * @returns {{ log: Function, warn: Function, error: Function, info: Function, debug: Function }}
 */
globalThis.TM = globalThis.TM || {};
globalThis.TM.createLogger = createLogger;

export function createLogger(prefix, debugMode) {
  debugMode = debugMode || false;
  var tag = '[' + prefix + ']';
  return {
    log:   function () { var args = [tag]; for (var i = 0; i < arguments.length; i++) args.push(arguments[i]); console.log.apply(console, args); },
    warn:  function () { var args = [tag]; for (var i = 0; i < arguments.length; i++) args.push(arguments[i]); console.warn.apply(console, args); },
    error: function () { var args = [tag]; for (var i = 0; i < arguments.length; i++) args.push(arguments[i]); console.error.apply(console, args); },
    info:  function () { var args = [tag]; for (var i = 0; i < arguments.length; i++) args.push(arguments[i]); console.info.apply(console, args); },
    debug: function () { if (debugMode) { var args = [tag]; for (var i = 0; i < arguments.length; i++) args.push(arguments[i]); console.debug.apply(console, args); } }
  };
}
