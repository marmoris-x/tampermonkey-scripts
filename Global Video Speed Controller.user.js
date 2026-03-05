// ==UserScript==
// @name         Global Video Speed Controller
// @name:de      Globaler Video-Geschwindigkeitsregler
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Sets a global playback speed for all HTML5 videos and audios.
// @description:de Setzt eine globale Wiedergabegeschwindigkeit für alle HTML5-Videos und -Audios.
// @author       Precise Information Specialist
// @match        http://*/*
// @match        https://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addStyle
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @run-at       document-start
// @icon         https://lh3.googleusercontent.com/tPBNat6dgVmnj-qBCsqizbjByLu2x-XTgTFR7MGKWiPwDk422k5eF7_9B__pTlfm97JTt4X7YeIgq0za-3qaR6O6vQ=s60
// ==/UserScript==

/*
 * ARCHITEKTUR:
 * Tampermonkey läuft in einer isolierten Sandbox. Änderungen an HTMLMediaElement.prototype
 * innerhalb des Skripts betreffen NUR den Sandbox-Kontext – die Seite sieht davon nichts.
 * Lösung (wie die Chrome Extension): Code per <script>-Tag direkt in den Seiten-Kontext
 * injizieren. Kommunikation über CustomEvents auf unsafeWindow (= echtes window der Seite).
 *
 * Fallback-Kette:
 *   1. <script>-Tag Injektion  (primär, läuft im Seiten-Kontext)
 *   2. unsafeWindow-Prototype-Override  (falls CSP inline-scripts blockiert)
 *   3. Periodisches direktes Setzen via unsafeWindow  (letzter Ausweg)
 */

(function () {
    'use strict';

    // =========================================================
    // KONSTANTEN & ZUSTAND (Tampermonkey-Kontext)
    // =========================================================

    const TM_LOG    = '[GlobalSpeed-TM]';
    const PAGE_LOG  = '[GlobalSpeed-Page]';
    const CMD_EVENT  = '__GS_CMD__';

    const STORAGE_KEY_SPEED   = 'global_video_speed';
    const STORAGE_KEY_ENABLED = 'global_video_speed_enabled';

    let tmState = {
        speed:   1.0,
        enabled: true,
    };

    // =========================================================
    // HILFSFUNKTION: Befehl an den Seiten-Kontext senden
    // =========================================================

    function sendCmd(speed, enabled) {
        try {
            // unsafeWindow ist das ECHTE window der Seite – Events hierauf werden
            // vom injizierten Skript empfangen.
            unsafeWindow.dispatchEvent(
                new unsafeWindow.CustomEvent(CMD_EVENT, { detail: { speed, enabled } })
            );
            console.log(TM_LOG, `Befehl gesendet: speed=${speed}, enabled=${enabled}`);
        } catch (e) {
            console.error(TM_LOG, 'sendCmd fehlgeschlagen:', e);
        }
    }

    // =========================================================
    // ANSATZ 1: <script>-Tag Injektion in den Seiten-Kontext
    // =========================================================
    //
    // Dieser Code läuft im echten Seiten-JavaScript-Kontext und kann daher
    // HTMLMediaElement.prototype so modifizieren, dass die Seite es sieht.
    //
    // Das ist exakt das Prinzip, das die Global Speed Chrome Extension nutzt:
    // main.js läuft als Content Script im "MAIN world" – das ist äquivalent dazu.

    function buildPageScript(initialSpeed, initialEnabled) {
        // WICHTIG: Dieser String wird als JavaScript in die Seite injiziert.
        // Er hat KEINEN Zugriff auf Tampermonkey-APIs oder den TM-Kontext.
        return `
(function () {
    if (window.__GS_ACTIVE__) {
        console.log('${PAGE_LOG}', 'Bereits aktiv – Doppel-Injektion verhindert.');
        window.dispatchEvent(new CustomEvent('${CMD_EVENT}', {
            detail: { speed: window.__GS_SPEED__, enabled: window.__GS_ENABLED__ }
        }));
        return;
    }
    window.__GS_ACTIVE__  = true;
    window.__GS_SPEED__   = ${initialSpeed};
    window.__GS_ENABLED__ = ${initialEnabled};

    const LOG = '${PAGE_LOG}';

    // Originalen Deskriptor sichern, BEVOR irgendein Seitenskript ihn ändern kann.
    const origDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
    if (!origDesc || !origDesc.get || !origDesc.set) {
        console.error(LOG, 'FATAL: playbackRate-Deskriptor nicht gefunden oder kein getter/setter.', origDesc);
        return;
    }

    console.log(LOG, 'Initialisierung. speed=' + window.__GS_SPEED__ + ', enabled=' + window.__GS_ENABLED__);

    let isApplying = false;
    const seen = new WeakSet();

    // --------------------------------------------------
    // Prototype-Override (läuft jetzt im Seiten-Kontext)
    // --------------------------------------------------
    Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        configurable: true,
        enumerable:   true,
        get() {
            return window.__GS_ENABLED__ ? window.__GS_SPEED__ : origDesc.get.call(this);
        },
        set(rate) {
            // Nur Werte von uns durchlassen; Seiten-Skripte ignorieren.
            if (isApplying || !window.__GS_ENABLED__) {
                origDesc.set.call(this, rate);
            }
        }
    });

    // --------------------------------------------------
    // Auf einzelnes Element anwenden
    // --------------------------------------------------
    function applyTo(el) {
        if (!(el instanceof HTMLMediaElement) || !window.__GS_ENABLED__) return;
        try {
            isApplying = true;
            origDesc.set.call(el, window.__GS_SPEED__);
            console.log(LOG, 'Angewendet:', window.__GS_SPEED__ + 'x',
                '<' + el.tagName.toLowerCase() + '>',
                (el.src || el.currentSrc || '').slice(0, 70) || '(kein src)');
        } catch (e) {
            console.error(LOG, 'applyTo Fehler:', e);
        } finally {
            isApplying = false;
        }
    }

    function resetTo(el, rate) {
        if (!(el instanceof HTMLMediaElement)) return;
        try {
            isApplying = true;
            origDesc.set.call(el, rate);
        } finally {
            isApplying = false;
        }
    }

    function applyToAll() {
        document.querySelectorAll('video, audio').forEach(applyTo);
    }

    function resetAll() {
        document.querySelectorAll('video, audio').forEach(el => resetTo(el, 1.0));
    }

    // --------------------------------------------------
    // Element registrieren & Events anhängen
    // --------------------------------------------------
    function register(el) {
        if (!(el instanceof HTMLMediaElement)) return;
        if (seen.has(el)) return;
        seen.add(el);

        applyTo(el);

        // Wenn Seite die Rate ändert – sofort korrigieren
        el.addEventListener('ratechange', () => {
            if (!isApplying && window.__GS_ENABLED__) {
                const real = origDesc.get.call(el);
                if (real !== window.__GS_SPEED__) {
                    console.log(LOG, 'ratechange-Korrektur:', real, '->', window.__GS_SPEED__);
                    applyTo(el);
                }
            }
        }, true);

        // Bei jedem dieser Events sicherstellen, dass die Rate stimmt
        ['play', 'playing', 'loadedmetadata', 'canplay', 'seeked'].forEach(evt => {
            el.addEventListener(evt, () => { if (window.__GS_ENABLED__) applyTo(el); }, true);
        });
    }

    // --------------------------------------------------
    // MutationObserver für ein Root-Element
    // --------------------------------------------------
    function observeRoot(root) {
        new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (!node || node.nodeType !== 1) continue;
                    if (node instanceof HTMLMediaElement) {
                        register(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('video, audio').forEach(register);
                    }
                }
            }
        }).observe(root, { childList: true, subtree: true });
    }

    observeRoot(document.documentElement);

    // --------------------------------------------------
    // Shadow DOM: wie Global Speed es macht
    // --------------------------------------------------
    const origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (opts) {
        const shadow = origAttachShadow.call(this, opts);
        observeRoot(shadow);
        setTimeout(() => shadow.querySelectorAll('video, audio').forEach(register), 0);
        setTimeout(() => shadow.querySelectorAll('video, audio').forEach(register), 500);
        return shadow;
    };

    // --------------------------------------------------
    // Sofortiger Scan (Elemente, die schon im DOM sind)
    // --------------------------------------------------
    applyToAll();

    // --------------------------------------------------
    // Periodischer Korrekturscan (30 s)
    // --------------------------------------------------
    let ticks = 0;
    const timer = setInterval(() => {
        if (window.__GS_ENABLED__) {
            document.querySelectorAll('video, audio').forEach(el => {
                if (!seen.has(el)) {
                    console.log(LOG, 'Periodischer Scan: neues Element gefunden.');
                    register(el);
                } else {
                    const real = origDesc.get.call(el);
                    if (real !== window.__GS_SPEED__) {
                        console.log(LOG, 'Periodischer Scan: Rate-Abweichung korrigiert:', real, '->', window.__GS_SPEED__);
                        applyTo(el);
                    }
                }
            });
        }
        if (++ticks >= 30) clearInterval(timer);
    }, 1000);

    // --------------------------------------------------
    // Befehle vom Tampermonkey-Kontext empfangen
    // --------------------------------------------------
    window.addEventListener('${CMD_EVENT}', (e) => {
        const { speed, enabled } = e.detail || {};
        console.log(LOG, 'Befehl empfangen: speed=' + speed + ', enabled=' + enabled);
        window.__GS_SPEED__   = speed;
        window.__GS_ENABLED__ = enabled;
        if (enabled) {
            applyToAll();
        } else {
            resetAll();
        }
    });

    console.log(LOG, 'Bereit. Prototype-Override aktiv im Seiten-Kontext.');
})();
`;
    }

    function injectPageScript(speed, enabled) {
        try {
            const script = document.createElement('script');
            script.setAttribute('type', 'text/javascript');
            script.textContent = buildPageScript(speed, enabled);
            (document.head || document.documentElement).appendChild(script);
            script.remove();
            console.log(TM_LOG, '<script>-Injektion erfolgreich.');
            return true;
        } catch (e) {
            console.error(TM_LOG, '<script>-Injektion fehlgeschlagen (CSP?):', e);
            return false;
        }
    }

    // =========================================================
    // ANSATZ 2: unsafeWindow-Prototype-Override (CSP-Fallback)
    // =========================================================
    // Falls die Seite inline-scripts per CSP blockiert, können wir den
    // Prototype trotzdem über unsafeWindow modifizieren, da Tampermonkey
    // mit @grant unsafeWindow CSP-Schutz umgehen kann.

    let fallbackOrigDesc   = null;
    let fallbackIsApplying = false;

    function setupUnsafeWindowFallback() {
        try {
            const uw = unsafeWindow;
            if (!uw || !uw.HTMLMediaElement) {
                console.warn(TM_LOG, 'Fallback: unsafeWindow.HTMLMediaElement nicht verfügbar.');
                return false;
            }

            fallbackOrigDesc = Object.getOwnPropertyDescriptor(
                uw.HTMLMediaElement.prototype, 'playbackRate'
            );
            if (!fallbackOrigDesc || !fallbackOrigDesc.get || !fallbackOrigDesc.set) {
                console.warn(TM_LOG, 'Fallback: Deskriptor nicht nutzbar.');
                return false;
            }

            // Referenz auf tmState für Closure
            const s = tmState;
            const fd = fallbackOrigDesc;
            let fa = false; // isApplying

            Object.defineProperty(uw.HTMLMediaElement.prototype, 'playbackRate', {
                configurable: true,
                enumerable:   true,
                get() { return s.enabled ? s.speed : fd.get.call(this); },
                set(rate) { if (fa || !s.enabled) fd.set.call(this, rate); }
            });

            // Anwende-Funktion für späteren Aufruf
            unsafeWindow.__gsFallbackApply = function () {
                const elements = uw.document.querySelectorAll('video, audio');
                elements.forEach(el => {
                    try {
                        fa = true;
                        fd.set.call(el, s.enabled ? s.speed : 1.0);
                    } finally {
                        fa = false;
                    }
                });
            };

            console.log(TM_LOG, 'unsafeWindow-Fallback aktiv.');
            return true;
        } catch (e) {
            console.error(TM_LOG, 'unsafeWindow-Fallback Fehler:', e);
            return false;
        }
    }

    function fallbackApply() {
        try {
            if (unsafeWindow.__gsFallbackApply) {
                unsafeWindow.__gsFallbackApply();
            }
        } catch (e) {
            console.error(TM_LOG, 'fallbackApply Fehler:', e);
        }
    }

    // =========================================================
    // ANSATZ 3: Direktes Polling ohne Prototype-Override
    // =========================================================
    // Letzter Ausweg: Einfach jede Sekunde alle Videos zwingen.
    // Kein Prototype-Override, daher können Seiten-Skripte es zwischen
    // den Intervallen überschreiben – aber besser als nichts.

    let pollingActive = false;

    function startDirectPolling() {
        if (pollingActive) return;
        pollingActive = true;
        console.log(TM_LOG, 'Direktes Polling gestartet (letzter Ausweg).');

        let ticks = 0;
        const id = setInterval(() => {
            if (!tmState.enabled) return;
            try {
                const els = unsafeWindow.document.querySelectorAll('video, audio');
                els.forEach(el => {
                    if (Math.abs(el.playbackRate - tmState.speed) > 0.001) {
                        console.log(TM_LOG, 'Polling: Setze Rate', tmState.speed, 'auf', el.tagName);
                        el.playbackRate = tmState.speed;
                    }
                });
            } catch (e) {
                console.error(TM_LOG, 'Polling-Fehler:', e);
            }
            if (++ticks >= 60) clearInterval(id);
        }, 500);
    }

    // =========================================================
    // UI (Tampermonkey-Kontext)
    // =========================================================

    let indicator = null;

    function showIndicator() {
        if (!tmState.enabled) return;
        try {
            const doc = unsafeWindow.document;
            if (!doc.body) return;
            if (!indicator) {
                indicator = doc.createElement('div');
                indicator.id = 'gm-speed-indicator';
                doc.body.appendChild(indicator);
            }
            indicator.textContent = `${tmState.speed.toFixed(2)}x`;
            indicator.style.display = 'block';
            clearTimeout(indicator._timeout);
            indicator._timeout = setTimeout(() => {
                if (indicator) indicator.style.display = 'none';
            }, 1500);
        } catch (e) { /* body noch nicht da */ }
    }

    function updateSetSpeedLabel() {
        if (window.__gsUpdateSetSpeedLabel) window.__gsUpdateSetSpeedLabel();
    }

    function applyAll() {
        sendCmd(tmState.speed, tmState.enabled);
        fallbackApply();
        updateSetSpeedLabel();
    }

    function setupMenuCommands() {
        const setSpeedHandler = () => {
            const input = prompt('Wiedergabegeschwindigkeit (0.07 – 16):', tmState.speed);
            const val = parseFloat(input);
            if (input !== null && !isNaN(val) && val > 0) {
                tmState.speed = Math.max(0.07, Math.min(16, val));
                GM_setValue(STORAGE_KEY_SPEED, tmState.speed);
                applyAll();
                showIndicator();
            }
        };

        let setSpeedId = GM_registerMenuCommand(
            `Geschwindigkeit einstellen (${tmState.speed.toFixed(2)}x)`, setSpeedHandler
        );

        // Aktualisiert das Label wenn sich die Geschwindigkeit ändert.
        window.__gsUpdateSetSpeedLabel = () => {
            if (window !== window.top) return;
            try { GM_unregisterMenuCommand(setSpeedId); } catch (_) {}
            setSpeedId = GM_registerMenuCommand(
                `Geschwindigkeit einstellen (${tmState.speed.toFixed(2)}x)`, setSpeedHandler
            );
        };
        updateSetSpeedLabel();

        GM_registerMenuCommand('Zurücksetzen (1.0x)', () => {
            tmState.speed = 1.0;
            GM_setValue(STORAGE_KEY_SPEED, tmState.speed);
            applyAll();
            showIndicator();
        });

        const label = () => tmState.enabled ? 'Global Speed deaktivieren' : 'Global Speed aktivieren';

        const onToggle = () => {
            tmState.enabled = !tmState.enabled;
            GM_setValue(STORAGE_KEY_ENABLED, tmState.enabled);
            applyAll();
            try {
                GM_unregisterMenuCommand(toggleId);
                toggleId = GM_registerMenuCommand(label(), onToggle);
            } catch (_) {}
            if (tmState.enabled) showIndicator();
            else if (indicator) indicator.style.display = 'none';
        };

        let toggleId = GM_registerMenuCommand(label(), onToggle);
    }

    function addStyles() {
        GM_addStyle(`
            #gm-speed-indicator {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0,0,0,0.78);
                color: #fff;
                padding: 7px 15px;
                border-radius: 6px;
                font: bold 16px/1 sans-serif;
                z-index: 2147483647;
                display: none;
                pointer-events: none;
                user-select: none;
            }
        `);
    }

    // =========================================================
    // INITIALISIERUNG
    // =========================================================

    async function init() {
        console.log(TM_LOG, 'init() – readyState:', document.readyState);

        // SCHRITT 1 — Sofort mit Standardwerten injizieren (synchron, vor jedem await).
        // Selbst wenn die Seite noch nicht geladen ist, muss der Prototype-Override
        // im Seiten-Kontext aktiv sein, bevor Seitenskripte Videos erstellen.
        const injected = injectPageScript(1.0, true);

        // SCHRITT 2 — Gespeicherte Werte laden.
        try {
            tmState.speed   = await GM_getValue(STORAGE_KEY_SPEED,   1.0);
            tmState.enabled = await GM_getValue(STORAGE_KEY_ENABLED, true);
            console.log(TM_LOG, `Gespeichert: speed=${tmState.speed}, enabled=${tmState.enabled}`);
        } catch (e) {
            console.error(TM_LOG, 'GM_getValue Fehler (Standardwerte):', e);
        }

        // SCHRITT 3 — Korrekte Werte an das injizierte Skript übermitteln.
        sendCmd(tmState.speed, tmState.enabled);

        // SCHRITT 4 — Falls Injektion fehlgeschlagen (CSP): unsafeWindow-Fallback.
        if (!injected) {
            console.warn(TM_LOG, 'Primäre Injektion fehlgeschlagen → Fallback 2 (unsafeWindow)...');
            const fallbackOk = setupUnsafeWindowFallback();
            if (!fallbackOk) {
                console.warn(TM_LOG, 'Fallback 2 fehlgeschlagen → Fallback 3 (Polling)...');
                startDirectPolling();
            } else {
                fallbackApply();
            }
        }

        // SCHRITT 5 — UI einrichten (wartet auf DOM).
        const setupUI = () => {
            // Menü und Indikator nur im Top-Frame registrieren.
            // Das Skript läuft in jedem iframe – ohne diese Prüfung würde
            // GM_registerMenuCommand mehrfach aufgerufen und der prompt mehrfach erscheinen.
            if (window !== window.top) return;
            addStyles();
            setupMenuCommands();
            console.log(TM_LOG, 'UI bereit.');
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupUI, { once: true });
        } else {
            setupUI();
        }

        // SCHRITT 6 — Cross-Tab-Synchronisation.
        // Wenn ein anderer Tab GM_setValue aufruft, feuert dieser Callback sofort.
        // "remote" ist true, wenn die Änderung aus einem anderen Tab kommt.
        GM_addValueChangeListener(STORAGE_KEY_SPEED, (_key, _old, newVal, remote) => {
            if (!remote) return;
            tmState.speed = newVal;
            sendCmd(tmState.speed, tmState.enabled);
            fallbackApply();
            console.log(TM_LOG, `Cross-Tab: Geschwindigkeit auf ${newVal}x gesetzt.`);
        });

        GM_addValueChangeListener(STORAGE_KEY_ENABLED, (_key, _old, newVal, remote) => {
            if (!remote) return;
            tmState.enabled = newVal;
            sendCmd(tmState.speed, tmState.enabled);
            fallbackApply();
            console.log(TM_LOG, `Cross-Tab: Enabled auf ${newVal} gesetzt.`);
        });
    }

    init().catch(e => console.error(TM_LOG, 'Kritischer Fehler:', e));

})();
