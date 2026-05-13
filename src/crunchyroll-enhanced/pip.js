// src/crunchyroll-enhanced/pip.js — PiP unlock für Crunchyroll-Videoseiten
// Provides: unlockPiP
// Consumers: Entry file

'use strict';

/**
 * Schaltet Picture-in-Picture auf Crunchyroll-Videoseiten frei.
 * Entfernt `disablePictureInPicture` von <video>-Elementen.
 * Läuft nur auf Seiten mit `/watch/` im Pfad.
 */
export function unlockPiP() {
  // Nur auf Watch-Seiten aktiv
  if (!/\/watch\//.test(location.pathname)) return;

  // Bestehende Videos sofort fixen
  const existing = document.querySelectorAll('video[disablePictureInPicture]');
  for (const v of existing) {
    v.removeAttribute('disablePictureInPicture');
  }

  // Observer für nachgeladene Videos
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'disablepictureinpicture') {
        m.target.removeAttribute('disablePictureInPicture');
      }
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches && node.matches('video[disablePictureInPicture]')) {
          node.removeAttribute('disablePictureInPicture');
        }
        if (node.querySelectorAll) {
          for (const v of node.querySelectorAll('video[disablePictureInPicture]')) {
            v.removeAttribute('disablePictureInPicture');
          }
        }
      }
    }
  });

  obs.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disablepictureinpicture']
  });
}
