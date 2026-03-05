// ==UserScript==
// @name         Night Mode (Keyboard Controlled)
// @namespace    Nightmode
// @version      9
// @description  Dark Layer mit Tastatursteuerung (Strg+↑/↓ = Deckkraft, Alt+Shift+D = Toggle)
// @author       marmoris
// @require      https://greasyfork.org/scripts/403996-exev/code/ExEv.js?version=808391
// @icon         https://i.imgur.com/XxHMRlM.png
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @noframes
// ==/UserScript==

(function() {
  'use strict';

  // Initialwerte laden
  let opacity = GM_getValue('nightOpacity', 30);
  let isEnabled = GM_getValue('nightEnabled', true);

  // Dark Layer erstellen
  const layer = document.createElement('div');
  Object.assign(layer.style, {
    width: '100vw',
    height: '100vh',
    background: 'black',
    opacity: `${opacity}%`,
    position: 'fixed',
    top: '0',
    left: '0',
    pointerEvents: 'none',
    zIndex: '2147483647',
    display: isEnabled ? 'block' : 'none'
  });

  document.events.on('bodyloaded', () => {
    document.body.append(layer);
  });

  // Statusmeldung anzeigen
  function showStatus(text) {
    const status = document.createElement('div');
    Object.assign(status.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '8px',
      borderRadius: '4px',
      zIndex: '2147483647',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px'
    });
    status.textContent = text;
    document.body.appendChild(status);
    setTimeout(() => status.remove(), 1500);
  }

  // Tastatursteuerung
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.altKey && !e.metaKey) {
      const step = 5;

      // Deckkraft: Strg + Pfeil Hoch/Runter
      if (e.key === 'ArrowUp') {
        opacity = Math.min(95, opacity + step);
        layer.style.opacity = `${opacity}%`;
        GM_setValue('nightOpacity', opacity);
        showStatus(`🌑 Deckkraft: ${opacity}%`);
        e.preventDefault();
      }
      else if (e.key === 'ArrowDown') {
        opacity = Math.max(0, opacity - step);
        layer.style.opacity = `${opacity}%`;
        GM_setValue('nightOpacity', opacity);
        showStatus(`🌑 Deckkraft: ${opacity}%`);
        e.preventDefault();
      }
    }

    // Toggle Darkmode: Alt+Shift+D anstatt nur D
    if (e.key.toLowerCase() === 'd' && e.altKey && e.shiftKey && !e.ctrlKey) {
      isEnabled = !isEnabled;
      layer.style.display = isEnabled ? 'block' : 'none';
      GM_setValue('nightEnabled', isEnabled);
      showStatus(isEnabled ? '🌑 Darkmode: AN' : '🌞 Darkmode: AUS');
      e.preventDefault();
    }
  });
})();