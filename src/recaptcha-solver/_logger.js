/**
 * Creates a prefixed logger instance. All methods prepend `[prefix]` to messages.
 * @param {string} prefix - Script identifier (e.g. "Recaptcha Solver")
 * @param {boolean} [debugMode=false] - When false, debug() calls are no-ops
 * @returns {{ log: Function, warn: Function, error: Function, info: Function, debug: Function }}
 */
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
