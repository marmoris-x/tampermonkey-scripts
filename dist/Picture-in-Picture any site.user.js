// ==UserScript==
// @name         Picture-in-Picture any site
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.7.0
// @author       marmoris-x
// @description  Adds a Tampermonkey menu command to force the current tab into PiP mode.
// @license      MIT
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=google.com
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @downloadURL  https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Picture-in-Picture%20any%20site.user.js
// @updateURL    https://github.com/marmoris-x/tampermonkey-scripts/raw/refs/heads/main/Picture-in-Picture%20any%20site.user.js
// @match        *://*/*
// @sandbox      JavaScript
// @grant        GM_registerMenuCommand
// @inject-into  content
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  globalThis.TM = globalThis.TM || {};
  globalThis.TM.createLogger = createLogger;
  function createLogger(prefix, debugMode) {
    debugMode = debugMode || false;
    var tag = "[" + prefix + "]";
    return {
      log: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.log.apply(console, args);
      },
      warn: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.warn.apply(console, args);
      },
      error: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.error.apply(console, args);
      },
      info: function() {
        var args = [tag];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        console.info.apply(console, args);
      },
      debug: function() {
        if (debugMode) {
          var args = [tag];
          for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
          console.debug.apply(console, args);
        }
      }
    };
  }
  // @license      MIT
  const log = createLogger("Picture-in-Picture");
  let isActivating = false;
  async function togglePiP() {
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch (e) {
        log.error("PiP exit failed:", e);
      }
      return;
    }
    if (!document.pictureInPictureEnabled) {
      log.warn("PiP not available on this page.");
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
      video.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;";
      document.body.appendChild(video);
      const cleanup = () => {
        stream.getTracks().forEach((track) => track.stop());
        video.remove();
      };
      video.addEventListener("loadedmetadata", async () => {
        try {
          await video.play();
          await video.requestPictureInPicture();
        } catch (e) {
          log.error("PiP error:", e);
          cleanup();
        } finally {
          isActivating = false;
        }
      }, { once: true });
      video.addEventListener("leavepictureinpicture", cleanup, { once: true });
      stream.getVideoTracks()[0].addEventListener("ended", cleanup, { once: true });
    } catch (err) {
      log.log("PiP cancelled by user.");
      isActivating = false;
    }
  }
  GM_registerMenuCommand("Picture-in-Picture", togglePiP);

})();