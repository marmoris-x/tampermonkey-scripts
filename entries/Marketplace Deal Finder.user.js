// ==UserScript==
// @name         Marketplace Deal Finder
// @name:de      Marketplace Deal Finder
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      31.0.28
// @author       marmoris
// @description  Multi-provider AI deal aggregator for Willhaben & Kleinanzeigen. Supports Gemini, OpenAI, DeepSeek, Claude, OpenRouter & Portkey.
// @description:de  Multi-Provider KI-Deal-Aggregator für Willhaben und Kleinanzeigen. Unterstützt Gemini, OpenAI, DeepSeek, Claude, OpenRouter und Portkey.
// @license      MIT
// @homepageURL  https://github.com/marmoris-x/tampermonkey-scripts
// @tag          search
// @tag          deals
// @tag          marketplace
// @icon         https://i.imgur.com/oQmtRjQ.png
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Marketplace%20Deal%20Finder.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Marketplace%20Deal%20Finder.user.js
// @match        https://www.willhaben.at/iad/kaufen-und-verkaufen/*
// @match        https://www.kleinanzeigen.de/s-*
// @match        https://www.kleinanzeigen.de/z-*
// @sandbox      raw
// @noframes
// @connect      willhaben.at
// @connect      kleinanzeigen.de
// @connect      generativelanguage.googleapis.com
// @connect      api.openai.com
// @connect      api.deepseek.com
// @connect      api.anthropic.com
// @connect      openrouter.ai
// @connect      api.portkey.ai
// @require https://raw.githubusercontent.com/Tampermonkey/utils/3b32b826e84ccc99a0a3e3d8d6e5ce0fa9834f23/requires/gh_2215_make_GM_xhr_more_parallel_again.js#sha256=qo7Imc1jg2AryApKESDzER/AO92l55w1dH7+xsxrx2I=
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

'use strict';

import { init } from '../src/marketplace-deal-finder/main.js';
import { registerProvider } from '../src/marketplace-deal-finder/_api-provider.js';
import { GeminiProvider } from '../src/marketplace-deal-finder/_api-gemini.js';
import { OpenAICompatibleProvider } from '../src/marketplace-deal-finder/_api-openai.js';
import { ClaudeProvider } from '../src/marketplace-deal-finder/_api-claude.js';

// Register all provider adapters
registerProvider('gemini', GeminiProvider);
registerProvider('openai', OpenAICompatibleProvider);
registerProvider('deepseek', OpenAICompatibleProvider);
registerProvider('openrouter', OpenAICompatibleProvider);
registerProvider('portkey', OpenAICompatibleProvider);
registerProvider('claude', ClaudeProvider);

init();
