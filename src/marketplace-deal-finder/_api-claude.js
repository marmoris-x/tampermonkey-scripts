'use strict';

import { AIProvider } from './_api-provider.js';
import { createLogger } from './_logger.js';
const Logger = createLogger('MDF Claude');

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
    const isLegacyThinking = opts.thinking && opts.thinking.type === 'enabled';
    const isAdaptiveThinking = opts.thinking && opts.thinking.type === 'adaptive';
    const body = {
      model: this.config.modelId,
      max_tokens: options.maxOutputTokens ?? 32000,
      system: 'You extract structured deal data from classified ads. Always respond with valid JSON matching the requested schema. Return ONLY valid JSON — no markdown, no code fences, no explanation.',
      messages: [
        { role: 'user', content: prompt }
      ]
    };

    // Legacy extended thinking (deprecated on Opus 4.6/Sonnet 4.6, removed on Opus 4.7+).
    // Requires budget_tokens < max_tokens (strict less-than per Anthropic API).
    if (isLegacyThinking) {
      if (!opts.thinking.budget_tokens || typeof opts.thinking.budget_tokens !== 'number') {
        Logger.warn('Claude legacy thinking enabled but budget_tokens missing — disabling');
      } else {
        // Ensure max_tokens > budget_tokens with safety margin for actual response
        const minMax = opts.thinking.budget_tokens + 4096;
        if (body.max_tokens <= opts.thinking.budget_tokens) {
          body.max_tokens = Math.max(body.max_tokens, minMax);
        }
        body.thinking = opts.thinking;
      }
    }

    // Adaptive thinking (required for Opus 4.7+).
    // No budget_tokens — model manages thinking budget automatically.
    if (isAdaptiveThinking) {
      body.thinking = opts.thinking;
    }

    // CRITICAL: Never set temperature when any thinking mode is active.
    // Opus 4.7/4.8 reject any non-default temperature (even 1.0) with 400.
    // Opus 4.6/Sonnet 4.6 tolerate it but Anthropic recommends omitting.
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
      Logger.warn('Claude response may be truncated — max tokens reached');
    }
    return block.text || '';
  }
}

