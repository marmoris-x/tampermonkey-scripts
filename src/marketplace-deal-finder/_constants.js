'use strict';

/** @constant {string} */
export const SCRIPT_NAME = 'Marketplace Deal Finder';

/** @constant {Object<string, string>} */
export const PROVIDER_TYPES = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
  DEEPSEEK: 'deepseek',
  CLAUDE: 'claude',
  OPENROUTER: 'openrouter',
  PORTKEY: 'portkey'
};

/** @constant {number} */
export const INITIAL_BATCH_SIZE = 8;
export const MAX_RETRIES = 2;
export const DESCRIPTION_PREVIEW_LENGTH = 150;
export const SETTINGS_VERSION = 3;
export const MAX_CACHE_SIZE = 100;
export const REQUEST_TIMEOUT = 60000;
export const RE_RANK_MAX_DEALS = 30;
export const PAUSE_POLL_INTERVAL = 500;
export const SAME_PAGE_INCREMENT = 0;
export const NEW_PAGE_INCREMENT = 1;
export const MAX_INIT_RETRIES = 5;
export const MIN_TITLE_LENGTH = 5;
export const GEMINI_API_TIMEOUT = 60000;
export const RATE_LIMIT_MAX_RETRIES = 5;
export const RATE_LIMIT_BASE_DELAY = 5000;
export const RETRY_BASE_DELAY = 2000;
export const MAX_RATE_LIMIT_DELAY = 300000;
export const JITTER_FACTOR = 0.2;
export const MAX_OUTPUT_TOKENS = 8192;
export const DESCRIPTION_FETCH_DELAY = 1000;
export const DESCRIPTION_MAX_RETRIES = 1;
export const DESCRIPTION_BACKOFF_FACTOR = 2;
export const PAGE_TRANSITION_DELAY = 1500;
export const SCROLL_DELAY = 1500;

/** @constant {Object<string, string>} */
export const DEAL_KEYS = {
  URL: 'url',
  TITLE: 'title',
  PRICE: 'price',
  DESCRIPTION: 'description',
  SCORE: 'score',
  REASON: 'reason',
  PAGE: 'page'
};

/** @constant {Object<string, Array<{id: string, label: string, icon: string, desc: string, options?: Object}>>} */
export const MODEL_PRESETS = {
  gemini: [
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', icon: '💡', desc: 'Most economical, high thinking', options: { thinking_budget: -1 } },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', icon: '⚡', desc: 'Latest flash, high thinking', options: { thinking_level: 'high' } },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', icon: '🔥', desc: 'Preview, high thinking', options: { thinking_level: 'high' } },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', icon: '🧠', desc: 'Max intelligence, preview' }
  ],
  openai: [
    { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', icon: '💡', desc: 'Cheapest, high thinking', options: { reasoning_effort: 'high' } },
    { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', icon: '⚡', desc: 'Fast & cheap' },
    { id: 'gpt-5.5', label: 'GPT-5.5', icon: '🧠', desc: 'Flagship intelligence' }
  ],
  deepseek: [
    { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', icon: '⚡', desc: 'Fast 284B, max thinking', options: { reasoning_effort: 'max' } },
    { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', icon: '🧠', desc: '1.6T params, max thinking', options: { reasoning_effort: 'max' } }
  ],
  claude: [
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', icon: '🧠', desc: 'Latest flagship, adaptive thinking', options: { thinking: { type: 'adaptive' } } },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', icon: '🎯', desc: 'Best balance, adaptive thinking', options: { thinking: { type: 'adaptive' } } },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', icon: '⚡', desc: 'Fast & cheap' }
  ],
  openrouter: [
    { id: 'google/gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', icon: '💡', desc: 'Cheap via OR' },
    { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', icon: '⚡', desc: 'Cheap via OR' },
    { id: 'openai/gpt-5.4-nano', label: 'GPT-5.4 Nano', icon: '💡', desc: 'Cheapest smart model via OR' }
  ],
  portkey: [
    { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', icon: '💡', desc: 'Via Portkey config' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', icon: '⚡', desc: 'Via Portkey config' },
    { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', icon: '⚡', desc: 'Via Portkey config' }
  ]
};
