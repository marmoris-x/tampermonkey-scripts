/**
 * Creates a prefixed logger for consistent [ScriptName] console output.
 *
 * @param {string} prefix - The log prefix (e.g., "GlobalSpeed")
 * @param {boolean} [debugMode=false] - Enable debug-level logging
 * @returns {{ log: Function, warn: Function, error: Function, info: Function, debug: Function }}
 */
export function createLogger(prefix, debugMode = false) {
  const isDebug = debugMode ?? false;
  const tag = `[${prefix}]`;
  return {
    log:   (...args) => console.log(tag, ...args),
    warn:  (...args) => console.warn(tag, ...args),
    error: (...args) => console.error(tag, ...args),
    info:  (...args) => console.info(tag, ...args),
    debug: (...args) => { if (isDebug) console.debug(tag, ...args); }
  };
}
