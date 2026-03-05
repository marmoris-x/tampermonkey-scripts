// ==UserScript==
// @name         Crunchyroll PiP Unlocker (Only)
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  Entfernt nur die PiP-Sperre auf Crunchyroll. Kein Button, keine UI.
// @author       DeinName
// @match        https://*.crunchyroll.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crunchyroll.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Funktion: Nur das Attribut entfernen, das PiP verhindert
    function unlockVideo() {
        const video = document.querySelector('video');
        if (video && video.hasAttribute('disablePictureInPicture')) {
            video.removeAttribute('disablePictureInPicture');
        }
    }

    // Dauerschleife (1x pro Sekunde), um sicherzustellen, dass die Sperre
    // auch nach Werbung, Intro-Skip oder Folgenwechsel entfernt bleibt.
    setInterval(unlockVideo, 1000);

})();