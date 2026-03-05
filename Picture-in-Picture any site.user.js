// ==UserScript==
// @name         Picture-in-Picture any site
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Adds an entry in the right-click menu to force the tab into PiP.
// @author       DeinName
// @match        *://*/*
// @run-at       context-menu
// @grant        none
// @icon         https://img.icons8.com/fluency/64/picture-in-picture.png
// ==/UserScript==

(async function() {
    'use strict';

    // Da @run-at auf context-menu steht, wird dieser Code
    // genau dann ausgeführt, wenn du im Menü auf "Diese Seite in PiP öffnen" klickst.

    // 1. Wenn PiP bereits läuft, wird es beendet.
    if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
    }

    // 2. PiP-Prozess starten
    try {
        // Der Browser fragt nach der Freigabe des Tabs
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "browser" },
            audio: false,
            selfBrowserSurface: "include",
            preferCurrentTab: true
        });

        // Ein unsichtbares Video-Element wird erstellt
        const video = document.createElement("video");
        video.srcObject = stream;
        video.style.display = "none";
        video.autoplay = true;

        // Sobald der Stream bereit ist, wird PiP angefordert
        video.onloadedmetadata = async () => {
            try {
                await video.requestPictureInPicture();
            } catch (e) {
                console.error("PiP Fehler:", e);
                // Aufräumen bei Fehler
                stream.getTracks().forEach(track => track.stop());
                video.remove();
            }
        };

        // Aufräumen, wenn das PiP-Fenster geschlossen wird
        video.addEventListener("leavepictureinpicture", () => {
            stream.getTracks().forEach(track => track.stop());
            video.remove();
        });

        // Aufräumen, wenn der User "Teilen beenden" klickt
        stream.getVideoTracks()[0].onended = () => {
            video.remove();
        };

    } catch (err) {
        // Dieser Fehler passiert, wenn der User im Freigabe-Dialog auf "Abbrechen" klickt.
        console.log("PiP vom Benutzer abgebrochen.");
    }
})();