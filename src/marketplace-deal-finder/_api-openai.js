'use strict';

import { AIProvider } from './_api-provider.js';
import { PROVIDER_TYPES } from './_constants.js';

/**
 * Endpoint map for each OpenAI-compatible provider type.
 * @type {Object<string, string>}
 */
const ENDPOINTS = {
  [PROVIDER_TYPES.OPENAI]: 'https://api.openai.com/v1/chat/completions',
  [PROVIDER_TYPES.DEEPSEEK]: 'https://api.deepseek.com/chat/completions',
  [PROVIDER_TYPES.OPENROUTER]: 'https://openrouter.ai/api/v1/chat/completions',
  [PROVIDER_TYPES.PORTKEY]: 'https://api.portkey.ai/v1/chat/completions'
};

/**
 * OpenAI-compatible provider adapter.
 * Handles OpenAI, DeepSeek, OpenRouter, and Portkey — all use Chat Completions schema.
 */
export class OpenAICompatibleProvider extends AIProvider {
  /**
   * @param {import('./_api-provider.js').ProviderConfig} config
   */
  constructor(config) {
    super(config);
  }

  /** @returns {string} */
  getEndpoint() {
    return this.config.baseUrl || ENDPOINTS[this.config.type];
  }

  /**
   * @returns {Object<string, string>}
   */
  getAuthHeaders() {
    /** @type {Object<string, string>} */
    const headers = { 'Content-Type': 'application/json' };

    if (this.config.type === PROVIDER_TYPES.PORTKEY) {
      headers['x-portkey-api-key'] = this.config.apiKey;
      const opts = this.config.providerOptions || {};
      if (opts.config) {
        // Portkey Config strategy — references a pre-defined config from dashboard
        headers['x-portkey-config'] = opts.config;
        headers['x-portkey-debug'] = 'false';
      } else {
        // Legacy Virtual Key strategy
        if (opts.providerSlug) {
          headers['x-portkey-provider'] = opts.providerSlug;
        }
        if (opts.virtualKey) {
          headers['x-portkey-virtual-key'] = opts.virtualKey;
        }
      }
    } else {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    if (this.config.type === PROVIDER_TYPES.OPENROUTER) {
      headers['HTTP-Referer'] = 'https://github.com/marmoris-x/tampermonkey-scripts';
      headers['X-OpenRouter-Title'] = 'Marketplace Deal Finder';
    }

    return headers;
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
      model: this.config.modelId,
      messages: [
        {
          role: 'system',
          content: 'You extract structured deal data from classified ads. Always respond with valid JSON matching the requested schema.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxOutputTokens ?? 8192
    };
    // Apply reasoning_effort from providerOptions (GPT-5.4-nano, DeepSeek, etc.)
    const opts = this.config.providerOptions || {};
    // response_format wird von DeepSeek, Portkey+DeepSeek etc. nicht
    // zuverlaessig unterstuetzt — ueber skip_response_format deaktivierbar.
    if (!opts.skip_response_format) {
      body.response_format = { type: 'json_object' };
    }
    if (opts.reasoning_effort) {
      body.reasoning_effort = opts.reasoning_effort;
    }
    // DeepSeek: extra_body for thinking mode
    if (this.config.type === PROVIDER_TYPES.DEEPSEEK && opts.reasoning_effort === 'max') {
      body.extra_body = { thinking: { type: 'enabled' } };
    }
    return body;
  }

  /**
   * @param {Object} response - OpenAI Chat Completions response
   * @returns {string} - Extracted text content
   */
  parseResponse(response) {
    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error(`${this.config.type}: empty response — no choices returned`);
    }
    const choice = response.choices[0];
    if (choice.finish_reason && choice.finish_reason !== 'stop' && choice.finish_reason !== 'length') {
      throw new Error(`${this.config.type}: unexpected finish_reason: ${choice.finish_reason}`);
    }
    const content = choice.message?.content;
    if (!content) {
      throw new Error(`${this.config.type}: response missing message content`);
    }
    return content;
  }
}

