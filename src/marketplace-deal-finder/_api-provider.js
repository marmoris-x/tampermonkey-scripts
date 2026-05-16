'use strict';

/**
 * @typedef {Object} ProviderConfig
 * @property {string} type - Provider type string
 * @property {string} apiKey - API key for authentication
 * @property {string} modelId - Model identifier
 * @property {string} [baseUrl] - Optional custom base URL
 * @property {Object} [providerOptions] - Provider-specific options
 */

/**
 * Abstract base class for AI API providers.
 * Subclasses must implement: getEndpoint(), getAuthHeaders(), buildRequest(), parseResponse().
 */
export class AIProvider {
  /** @param {ProviderConfig} config */
  constructor(config) {
    if (new.target === AIProvider) {
      throw new TypeError('AIProvider is abstract — must extend it');
    }
    /** @type {ProviderConfig} */
    this.config = config;
  }

  /**
   * Returns the API endpoint URL.
   * @returns {string}
   */
  getEndpoint() {
    throw new Error('Not implemented: getEndpoint() must be overridden');
  }

  /**
   * Returns headers for API authentication.
   * @returns {Object<string, string>}
   */
  getAuthHeaders() {
    throw new Error('Not implemented: getAuthHeaders() must be overridden');
  }

  /**
   * Builds the request body for the API call.
   * @param {string} prompt - The full prompt text
   * @param {Object} [options]
   * @param {number} [options.temperature]
   * @param {number} [options.maxOutputTokens]
   * @returns {Object}
   */
  buildRequest(prompt, options = {}) {
    throw new Error('Not implemented: buildRequest() must be overridden');
  }

  /**
   * Parses the API response and extracts text content.
   * @param {Object} response - Raw API response body
   * @returns {string}
   */
  parseResponse(response) {
    throw new Error('Not implemented: parseResponse() must be overridden');
  }

  /**
   * Returns true if the HTTP status indicates a rate limit error.
   * @param {number} status
   * @returns {boolean}
   */
  isRateLimitError(status) {
    return status === 429 || status === 503;
  }

  /**
   * Returns true if the HTTP status indicates an authentication error.
   * @param {number} status
   * @returns {boolean}
   */
  isAuthError(status) {
    return status === 401 || status === 403;
  }

  /**
   * Returns the delay in ms before the next retry attempt.
   * @param {number} retryCount - 0-based retry attempt number
   * @returns {number}
   */
  getRetryDelay(retryCount) {
    return 2000 * Math.pow(2, retryCount);
  }
}

/** @type {Map<string, typeof AIProvider>} */
const registry = new Map();

/**
 * Registers a provider class for a given type string.
 * @param {string} type - Provider type key (e.g. 'gemini', 'openai')
 * @param {typeof AIProvider} providerClass - Class extending AIProvider
 */
export function registerProvider(type, providerClass) {
  if (!(providerClass.prototype instanceof AIProvider)) {
    throw new TypeError('providerClass must extend AIProvider');
  }
  registry.set(type, providerClass);
}

/**
 * Creates a provider instance of the specified type with the given config.
 * @param {string} type - Registered provider type
 * @param {ProviderConfig} config - Configuration object
 * @returns {AIProvider}
 */
export function createProvider(type, config) {
  const ProviderClass = registry.get(type);
  if (!ProviderClass) {
    throw new Error(`Unknown provider type: "${type}". Available: ${Array.from(registry.keys()).join(', ')}`);
  }
  return new ProviderClass(config);
}

/**
 * Returns a list of all registered provider type strings.
 * @returns {string[]}
 */
export function getAvailableProviders() {
  return Array.from(registry.keys());
}
