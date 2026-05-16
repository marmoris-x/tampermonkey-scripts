'use strict';

import { AIProvider } from './_api-provider.js';

/**
 * Gemini API provider adapter.
 * Uses x-goog-api-key header authentication.
 */
export class GeminiProvider extends AIProvider {
  /**
   * @param {import('./_api-provider.js').ProviderConfig} config
   */
  constructor(config) {
    super(config);
  }

  /** @returns {string} */
  getEndpoint() {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.config.modelId}:generateContent`;
  }

  /**
   * @returns {Object<string, string>}
   */
  getAuthHeaders() {
    return {
      'x-goog-api-key': this.config.apiKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * @param {string} prompt
   * @param {Object} [options]
   * @param {number} [options.temperature]
   * @param {number} [options.maxOutputTokens]
   * @returns {Object}
   */
  buildRequest(prompt, options = {}) {
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.1,
        topK: 32,
        topP: 0.95,
        maxOutputTokens: options.maxOutputTokens ?? 8192,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            topDeals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  title: { type: 'string' },
                  price: { type: 'string' },
                  score: { type: 'integer' },
                  reason: { type: 'string' }
                },
                required: ['url', 'title', 'score', 'reason']
              }
            }
          },
          required: ['topDeals']
        }
      }
    };
    // Apply thinking config from providerOptions
    const opts = this.config.providerOptions || {};
    if (opts.thinking_budget !== undefined) {
      body.generationConfig.thinkingConfig = { thinking_budget: opts.thinking_budget };
    } else if (opts.thinking_level) {
      body.generationConfig.thinkingConfig = { thinking_level: opts.thinking_level };
    }
    return body;
  }

  /**
   * @param {Object} response - Gemini API response
   * @returns {string} - Extracted text content
   */
  parseResponse(response) {
    if (!response || !response.candidates || response.candidates.length === 0) {
      throw new Error('Gemini: empty response — no candidates returned');
    }
    const candidate = response.candidates[0];
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCKLIST') {
      throw new Error(`Gemini: blocked — finishReason: ${candidate.finishReason}`);
    }
    const parts = candidate.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error('Gemini: response missing content parts');
    }
    return parts[0].text || '';
  }
}


