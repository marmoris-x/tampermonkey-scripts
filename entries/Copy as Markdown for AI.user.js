// ==UserScript==
// @name         Copy as Markdown for AI
// @name:de      Als Markdown für KI kopieren
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      1.0.2
// @description  Select page elements with Ctrl/Cmd+Click and convert them to clean Markdown for AI prompts
// @description:de Wähle Seitenelemente mit Strg/Cmd+Klick aus und konvertiere sie in sauberes Markdown für KI-Prompts
// @author       marmoris-x
// @license      MIT
// @icon         https://media.licdn.com/dms/image/v2/D560BAQFyGRIuF2bqeQ/company-logo_200_200/B56ZfTe2EtHoAI-/0/1751599768258/crawl4ai_logo?e=2147483647&v=beta&t=skhRct8O4VaW42IwD7eC9Eqc9Pbavt7n6q7QgaJTQE8
// @match        *://*/*
// @noframes
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_download
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Copy%20as%20Markdown%20for%20AI.user.js
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Copy%20as%20Markdown%20for%20AI.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// ==/UserScript==

'use strict';

import { MarkdownExtraction } from '../src/copy-as-markdown-for-ai/entry.js';
import { styles } from '../src/copy-as-markdown-for-ai/styles.js';

let activeInstance = null;

function activate() {
  if (activeInstance) {
    activeInstance.deactivate();
    activeInstance = null;
  }
  activeInstance = new MarkdownExtraction();
}

(function init() {
  'use strict';

  GM_addStyle(styles);

  GM_registerMenuCommand('📝 Start Markdown Extraction', activate);
})();
