'use strict';

import { AIProvider } from './_api-provider.js';

/**
 * Anthropic Claude API provider adapter.
 * Note: Claude does NOT support response_format — JSON-only instruction is in the system prompt.
 */
export class ClaudeProvider extends AIProvider {
  /**
   * @param {import('./_api-provider.js').ProviderConfig} config
   */
  constructor(config) {
    super(config);
  }

  /** @returns {string} */
  getEndpoint() {
    return 'https://api.anthropic.com/v1/messages';
  }

  /**
   * @returns {Object<string, string>}
   */
  getAuthHeaders() {
    return {
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
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
    const opts = this.config.providerOptions || {};
    const isThinking = opts.thinking && opts.thinking.type === 'enabled';

    const body = {
      model: this.config.modelId,
      max_tokens: options.maxOutputTokens ?? 8192,
      system: 'You extract structured deal data from classified ads. Always respond with valid JSON matching the requested schema. Return ONLY valid JSON — no markdown, no code fences, no explanation.',
      messages: [
        { role: 'user', content: prompt }
      ]
    };
    // Apply thinking config from providerOptions with validation.
    // Extended thinking requires temperature=1 and a valid budget_tokens.
    if (isThinking) {
      if (!opts.thinking.budget_tokens || typeof opts.thinking.budget_tokens !== 'number') {
        console.warn('[MDF] Claude thinking enabled but budget_tokens missing or invalid — disabling thinking');
      } else {
        body.thinking = opts.thinking;
        // Extended thinking requires temperature=1
        body.temperature = 1;
      }
    }
    // Only set temperature if thinking is not active (thinking forces temperature=1)
    if (!body.thinking) {
      body.temperature = options.temperature ?? 0.1;
    }
    return body;
  }

  /**
   * @param {Object} response - Claude Messages API response
   * @returns {string} - Extracted text content
   */
  parseResponse(response) {
    if (!response || !response.content || response.content.length === 0) {
      throw new Error('Claude: empty response — no content returned');
    }
    const block = response.content[0];
    if (block.type !== 'text') {
      throw new Error(`Claude: unexpected content block type: ${block.type}`);
    }
    if (response.stop_reason && response.stop_reason !== 'end_turn' && response.stop_reason !== 'stop' && response.stop_reason !== 'max_tokens') {
      throw new Error(`Claude: unexpected stop_reason: ${response.stop_reason}`);
    }
    if (response.stop_reason === 'max_tokens') {
      console.warn('[MDF] Claude response may be truncated — max tokens reached');
    }
    return block.text || '';
  }
}

