// ==UserScript==
// @name            Global Video Speed Controller
// @name:de         Globaler Video-Geschwindigkeitsregler
// @namespace       https://github.com/marmoris-x/tampermonkey-scripts
// @version         2.6.0
// @author          marmoris-x
// @description     Sets a global playback speed for all HTML5 videos and audios.
// @description:de  Setzt eine globale Wiedergabegeschwindigkeit für alle HTML5-Videos und -Audios.
// @license         MIT
// @icon64          https://www.google.com/s2/favicons?sz=64&domain=example.com
// @supportURL      https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL     https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Global%20Video%20Speed%20Controller.user.js
// @updateURL       https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Global%20Video%20Speed%20Controller.user.js
// @match           http://*/*
// @match           https://*/*
// @sandbox         JavaScript
// @grant           GM.getValue
// @grant           GM.setValue
// @grant           GM_addStyle
// @grant           GM_addElement
// @grant           GM_addValueChangeListener
// @grant           GM_registerMenuCommand
// @grant           GM_unregisterMenuCommand
// @grant           unsafeWindow
// @run-at          document-start
// @noframes
// ==/UserScript==

'use strict';

import { init } from '../src/global-speed-controller/boot.js';
init().catch(console.error);
