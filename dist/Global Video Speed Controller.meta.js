// ==UserScript==
// @name         Global Video Speed Controller
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      2.5.0
// @author       marmoris-x
// @description  Sets a global playback speed for all HTML5 videos and audios.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=example.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Global%20Video%20Speed%20Controller.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/marmoris-x/tampermonkey-scripts@main/dist/Global%20Video%20Speed%20Controller.meta.js
// @match        http://*/*
// @match        https://*/*
// @sandbox      JavaScript
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setValues
// @grant        GM_addStyle
// @grant        GM_addValueChangeListener
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_unregisterMenuCommand
// @grant        unsafeWindow
// @inject-into  content
// @run-at       document-start
// ==/UserScript==