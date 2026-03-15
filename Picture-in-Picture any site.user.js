// ==UserScript==
// @name         Picture-in-Picture any site
// @namespace    http://tampermonkey.net/
// @version      5.3
// @description  Adds an entry in the Tampermonkey menu to force the tab into PiP.
// @author       DeinName
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @icon         https://img.icons8.com/fluency/64/picture-in-picture.png
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Picture-in-Picture%20any%20site.user.js
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Picture-in-Picture%20any%20site.user.js
// ==/UserScript==

(function() {
    'use strict';

    let isActivating = false;

    async function togglePiP() {
        if (document.pictureInPictureElement) {
            try {
                await document.exitPictureInPicture();
            } catch (e) {
                console.error("PiP beenden fehlgeschlagen:", e);
            }
            return;
        }

        if (!document.pictureInPictureEnabled) {
            console.warn("PiP: auf dieser Seite deaktiviert.");
            return;
        }

        if (isActivating) return;
        isActivating = true;

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "browser" },
                audio: false,
                selfBrowserSurface: "include",
                preferCurrentTab: true
            });

            const video = document.createElement("video");
            video.srcObject = stream;
            video.muted = true;
            video.autoplay = true;
            // opacity:0 statt display:none — bleibt im Render-Tree, verhindert Black-Screen in Chromium
            video.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;";
            document.body.appendChild(video);

            const cleanup = () => {
                stream.getTracks().forEach(track => track.stop());
                video.remove();
            };

            video.addEventListener("loadedmetadata", async () => {
                try {
                    await video.play();
                    await video.requestPictureInPicture();
                } catch (e) {
                    console.error("PiP Fehler:", e);
                    cleanup();
                } finally {
                    isActivating = false;
                }
            }, { once: true });

            video.addEventListener("leavepictureinpicture", cleanup, { once: true });
            stream.getVideoTracks()[0].addEventListener("ended", cleanup, { once: true });

        } catch (err) {
            console.log("PiP vom Benutzer abgebrochen.");
            isActivating = false;
        }
    }

    GM_registerMenuCommand("Picture-in-Picture", togglePiP);
})();
