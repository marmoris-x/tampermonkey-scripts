// ==UserScript==
// @name            Global Video Speed Controller
// @name:de         Globaler Video-Geschwindigkeitsregler
// @namespace       https://github.com/marmoris-x/tampermonkey-scripts
// @version         2.6.2
// @author          marmoris-x
// @description     Sets a global playback speed for all HTML5 videos and audios.
// @description:de  Setzt eine globale Wiedergabegeschwindigkeit für alle HTML5-Videos und -Audios.
// @license         MIT
// @icon            https://lh3.googleusercontent.com/tPBNat6dgVmnj-qBCsqizbjByLu2x-XTgTFR7MGKWiPwDk422k5eF7_9B__pTlfm97JTt4X7YeIgq0za-3qaR6O6vQ=s60
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
