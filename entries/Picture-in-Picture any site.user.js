// ==UserScript==
// @name         Picture-in-Picture any site
// @namespace    https://github.com/marmoris-x/tampermonkey-scripts
// @version      5.7.3
// @description  Adds a Tampermonkey menu command to force the current tab into PiP mode.
// @author       marmoris-x
// @match        *://*/*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=google.com
// @sandbox      raw
// @grant        GM_registerMenuCommand
// @noframes
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Picture-in-Picture%20any%20site.user.js
// @downloadURL  https://raw.githubusercontent.com/marmoris-x/tampermonkey-scripts/main/dist/Picture-in-Picture%20any%20site.user.js
// @supportURL   https://github.com/marmoris-x/tampermonkey-scripts/issues
// @license      MIT
// ==/UserScript==

/**
 * Creates a prefixed logger instance. All methods prepend `[prefix]` to messages.
 * @param {string} prefix - Script identifier
 * @param {boolean} [debugMode=false] - When false, debug() calls are no-ops
 */
function createLogger(prefix, debugMode) {
  debugMode = debugMode || false;
  const tag = '[' + prefix + ']';
  return {
    log:   function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.log.apply(console, args); },
    warn:  function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.warn.apply(console, args); },
    error: function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.error.apply(console, args); },
    info:  function () { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.info.apply(console, args); },
    debug: function () { if (debugMode) { const args = [tag]; for (let i = 0; i < arguments.length; i++) args.push(arguments[i]); console.debug.apply(console, args); } }
  };
}

const log = createLogger('Picture-in-Picture');

  let isActivating = false;

  /**
   * Toggles Picture-in-Picture mode for the current tab.
   * If PiP is active, exits it. Otherwise, captures the tab via getDisplayMedia
   * and requests PiP on a hidden video element.
   * Cleans up the stream and video element on PiP exit or user cancellation.
   */
  async function togglePiP() {
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch (e) {
        log.error('PiP exit failed:', e);
      }
      return;
    }

    if (!document.pictureInPictureEnabled) {
      log.warn('PiP not available on this page.');
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
      // opacity:0 instead of display:none — stays in render tree, prevents black screen in Chromium
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
          log.error('PiP error:', e);
          cleanup();
        } finally {
          isActivating = false;
        }
      }, { once: true });

      video.addEventListener("leavepictureinpicture", cleanup, { once: true });
      stream.getVideoTracks()[0].addEventListener("ended", cleanup, { once: true });

    } catch (err) {
      log.log('PiP cancelled by user.');
      isActivating = false;
    }
  }

  GM_registerMenuCommand("Picture-in-Picture", togglePiP);
