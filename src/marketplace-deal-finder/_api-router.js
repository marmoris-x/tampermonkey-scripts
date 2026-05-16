'use strict';

import { createProvider } from './_api-provider.js';
import {
  PROVIDER_TYPES,
  REQUEST_TIMEOUT,
  GEMINI_API_TIMEOUT,
  RETRY_BASE_DELAY,
  RATE_LIMIT_MAX_RETRIES,
  MAX_RATE_LIMIT_DELAY,
  JITTER_FACTOR
} from './_constants.js';

/**
 * Determines the request timeout for a given provider type.
 * @param {string} providerType
 * @returns {number}
 */
function getTimeoutForProvider(providerType) {
  return providerType === PROVIDER_TYPES.GEMINI ? GEMINI_API_TIMEOUT : REQUEST_TIMEOUT;
}

/**
 * Wraps GM_xmlhttpRequest in a Promise with timeout support.
 * @param {Object} params - GM_xmlhttpRequest details
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation
 * @returns {Promise<Object>} - Resolves with { status, responseText, responseHeaders }
 */
function gmRequest(params, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }

    /** @type {Object} */
    const details = {
      ...params,
      onload(resp) {
        resolve({ status: resp.status, responseText: resp.responseText, responseHeaders: resp.responseHeaders });
      },
      onerror(err) {
        reject(new Error(`GM_xmlhttpRequest failed: ${err?.finalUrl || err?.status || 'network error'}`));
      },
      ontimeout() {
        reject(new Error(`GM_xmlhttpRequest timed out after ${params.timeout || REQUEST_TIMEOUT}ms`));
      }
    };

    const abortHandler = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      GM_xmlhttpRequest(details);
    } catch (err) {
      reject(new Error(`GM_xmlhttpRequest threw: ${err.message}`));
    }
  });
}

/**
 * Builds the provider-specific request body from a prompt string.
 * Handles the structural differences between provider API schemas.
 *
 * @param {import('./_api-provider.js').AIProvider} provider
 * @param {string} prompt - The full prompt text
 * @param {Object} [userOptions]
 * @param {number} [userOptions.temperature]
 * @param {number} [userOptions.maxOutputTokens]
 * @returns {Object} - Provider-specific request body
 */
function buildRequestBody(provider, prompt, userOptions = {}) {
  return provider.buildRequest(prompt, userOptions);
}

/**
 * Calculates retry delay with jitter for rate-limited requests.
 * @param {number} retryCount - 0-based retry attempt count
 * @param {number} [baseDelay] - Base delay in ms (default: RETRY_BASE_DELAY)
 * @returns {number}
 */
function calculateBackoff(retryCount, baseDelay = RETRY_BASE_DELAY) {
  const exponential = baseDelay * Math.pow(2, retryCount);
  const capped = Math.min(exponential, MAX_RATE_LIMIT_DELAY);
  const jitter = capped * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.round(capped + jitter);
}

/**
 * Calls an AI provider with the given prompt and settings.
 * Handles retry logic with exponential backoff for rate limits.
 *
 * @param {string} prompt - The full prompt text to send
 * @param {Object} settings
 * @param {string} settings.providerType - Provider type key
 * @param {string} settings.apiKey - API key
 * @param {string} settings.modelId - Model identifier
 * @param {string} [settings.baseUrl] - Optional custom endpoint URL
 * @param {Object} [settings.providerOptions] - Provider-specific options
 * @param {Object} [options]
 * @param {number} [options.temperature]
 * @param {number} [options.maxOutputTokens]
 * @param {Function} [options.onRetry] - Callback(retryCount, error) before each retry
 * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
 * @returns {Promise<{topDeals: Array}>}
 */
export async function callAI(prompt, settings, options = {}) {
  const provider = createProvider(settings.providerType, {
    type: settings.providerType,
    apiKey: settings.apiKey,
    modelId: settings.modelId,
    baseUrl: settings.baseUrl,
    providerOptions: settings.providerOptions
  });

  const endpoint = provider.getEndpoint();
  const headers = provider.getAuthHeaders();
  const body = buildRequestBody(provider, prompt, options);
  const timeout = getTimeoutForProvider(settings.providerType);

  let lastError = null;

  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const resp = await gmRequest({
        method: 'POST',
        url: endpoint,
        headers,
        data: JSON.stringify(body),
        timeout
      }, options.signal);

      if (provider.isAuthError(resp.status)) {
        throw new Error(`Auth error (${resp.status}): API key rejected for ${settings.providerType}`);
      }

      if (provider.isRateLimitError(resp.status)) {
        lastError = new Error(`Rate limited (${resp.status})`);
        if (attempt < RATE_LIMIT_MAX_RETRIES) {
          const delay = calculateBackoff(attempt);
          if (options.onRetry) {
            options.onRetry(attempt + 1, lastError);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }

      if (resp.status < 200 || resp.status >= 300) {
        throw new Error(`API returned status ${resp.status}: ${resp.responseText?.slice(0, 200)}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(resp.responseText);
      } catch (parseErr) {
        throw new Error(`Failed to parse API response as JSON: ${parseErr.message}`);
      }

      let text;
      try {
        text = provider.parseResponse(parsed);
      } catch (parseErr) {
        throw new Error(`Provider parse error: ${parseErr.message}`);
      }

      if (!text || text.trim().length === 0) {
        throw new Error('Provider returned empty text content');
      }

      // Parse the extracted text as JSON (expected to contain { topDeals: [...] })
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Failed to parse provider output as JSON: ${parseErr.message}`);
      }

      if (!result.topDeals || !Array.isArray(result.topDeals)) {
        throw new Error('Provider response missing topDeals array');
      }

      return { topDeals: result.topDeals };

    } catch (err) {
      if (err.name === 'AbortError') throw err;
      lastError = err;
      // For non-rate-limit errors, retry only if we have attempts left
      if (attempt < RATE_LIMIT_MAX_RETRIES && !provider.isRateLimitError(err.status || 0)) {
        // Check if this error type should be retried (network errors, timeouts)
        const isRetryable = err.message.includes('timed out') || err.message.includes('network error') || err.message.includes('failed');
        if (isRetryable) {
          const delay = calculateBackoff(attempt);
          if (options.onRetry) {
            options.onRetry(attempt + 1, err);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }
  }

  throw lastError || new Error(`callAI failed after ${RATE_LIMIT_MAX_RETRIES + 1} attempts`);
}
