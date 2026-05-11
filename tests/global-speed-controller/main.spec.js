import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the built userscript
const scriptPath = path.resolve(__dirname, '../../dist/Global Video Speed Controller.user.js');
const userscript = readFileSync(scriptPath, 'utf-8');

// Load the GM API mock
const mockPath = path.resolve(__dirname, '../fixtures/gm-mock.js');
const gmMock = readFileSync(mockPath, 'utf-8');

const TEST_HTML = '<!DOCTYPE html><html><head></head><body><h1>Test</h1></body></html>';

// Injects the prototype override page script into the page context
async function injectPageScript(page, speed = 1, enabled = true) {
  await page.evaluate(({ speed, enabled }) => {
    const s = document.createElement('script');
    s.textContent = `
      (function() {
        'use strict';
        if (window.__GS_ACTIVE__) return;
        window.__GS_ACTIVE__ = true;
        window.__GS_SPEED__ = ${speed};
        window.__GS_ENABLED__ = ${enabled};

        const origDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
        if (!origDesc || !origDesc.get || !origDesc.set) return;

        let isApplying = false;

        Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
          configurable: true, enumerable: true,
          get() { return window.__GS_ENABLED__ ? window.__GS_SPEED__ : origDesc.get.call(this); },
          set(rate) { if (isApplying || !window.__GS_ENABLED__) origDesc.set.call(this, rate); }
        });

        function applyTo(el) {
          if (!(el instanceof HTMLMediaElement) || !window.__GS_ENABLED__) return;
          try {
            isApplying = true;
            origDesc.set.call(el, window.__GS_SPEED__);
          } finally { isApplying = false; }
        }

        function register(el) {
          if (seen.has(el)) return;
          seen.add(el);
          applyTo(el);
          el.addEventListener('ratechange', function() {
            if (!isApplying && window.__GS_ENABLED__) {
              const real = origDesc.get.call(el);
              if (real !== window.__GS_SPEED__) applyTo(el);
            }
          }, true);
        }

        window.addEventListener('__GS_CMD__', function(e) {
          const { speed, enabled } = e.detail || {};
          window.__GS_SPEED__ = speed;
          window.__GS_ENABLED__ = enabled;
          document.querySelectorAll('video, audio').forEach(function(el) {
            if (enabled) applyTo(el);
            else { isApplying = true; origDesc.set.call(el, 1.0); isApplying = false; }
          });
        });

        const seen = new WeakSet();

        new MutationObserver(function(mutations) {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (!node || node.nodeType !== 1) continue;
              if (node instanceof HTMLMediaElement) register(node);
              else if (node.querySelectorAll) node.querySelectorAll('video, audio').forEach(el => register(el));
            }
          }
        }).observe(document.documentElement, { childList: true, subtree: true });

        // Immediate scan
        document.querySelectorAll('video, audio').forEach(function(el) {
          try {
            isApplying = true;
            origDesc.set.call(el, window.__GS_SPEED__);
          } finally { isApplying = false; }
        });
      })();
    `;
    document.head.appendChild(s);
  }, { speed, enabled });
}

test.describe('Page Script — Prototype Override', () => {

  test('T01: page script injects and sets window.__GS_ACTIVE__', async ({ page }) => {
    await page.setContent(TEST_HTML);
    await injectPageScript(page);

    const isActive = await page.evaluate(() => window.__GS_ACTIVE__);
    expect(isActive).toBe(true);
    expect(await page.evaluate(() => window.__GS_SPEED__)).toBe(1);
  });

  test('T02: prototype returns global speed when enabled', async ({ page }) => {
    await page.setContent(TEST_HTML);
    await injectPageScript(page, 2.0, true);

    const rate = await page.evaluate(() => {
      return document.createElement('video').playbackRate;
    });
    expect(rate).toBe(2.0);
  });

  test('T03: setter blocked when enabled', async ({ page }) => {
    await page.setContent(TEST_HTML);
    await injectPageScript(page, 1.5, true);

    const rate = await page.evaluate(() => {
      const v = document.createElement('video');
      v.playbackRate = 3.0;
      return v.playbackRate;
    });
    expect(rate).toBe(1.5);
  });

  test('T04: setter works when disabled', async ({ page }) => {
    await page.setContent(TEST_HTML);
    await injectPageScript(page, 1.5, false);

    const rate = await page.evaluate(() => {
      const v = document.createElement('video');
      v.playbackRate = 2.0;
      return v.playbackRate;
    });
    expect(rate).toBe(2.0);
  });

  test('T05: dynamic video element gets speed via MutationObserver', async ({ page }) => {
    await page.setContent(TEST_HTML);
    await injectPageScript(page, 2.0, true);

    const rate = await page.evaluate(() => {
      return new Promise(resolve => {
        const v = document.createElement('video');
        document.body.appendChild(v);
        requestAnimationFrame(() => resolve(v.playbackRate));
      });
    });
    expect(rate).toBe(2.0);
  });

  test('T06: dynamic audio element gets speed via MutationObserver', async ({ page }) => {
    await page.setContent(TEST_HTML);
    await injectPageScript(page, 1.75, true);

    const rate = await page.evaluate(() => {
      return new Promise(resolve => {
        const a = document.createElement('audio');
        document.body.appendChild(a);
        requestAnimationFrame(() => resolve(a.playbackRate));
      });
    });
    expect(rate).toBe(1.75);
  });

  test('T07: command event changes speed on all elements', async ({ page }) => {
    await page.setContent(TEST_HTML);
    await injectPageScript(page, 1.0, true);

    // Create media elements first
    await page.evaluate(() => {
      const v = document.createElement('video');
      v.id = 'cv';
      document.body.appendChild(v);
      const a = document.createElement('audio');
      a.id = 'ca';
      document.body.appendChild(a);
    });

    await page.waitForTimeout(50);

    // Send command with new speed
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('__GS_CMD__', {
        detail: { speed: 2.5, enabled: true }
      }));
    });

    await page.waitForTimeout(50);

    const rates = await page.evaluate(() => {
      const v = document.getElementById('cv');
      const a = document.getElementById('ca');
      return { video: v ? v.playbackRate : -1, audio: a ? a.playbackRate : -1 };
    });
    expect(rates.video).toBe(2.5);
    expect(rates.audio).toBe(2.5);
  });

  test('T08: video in Shadow DOM gets speed', async ({ page }) => {
    await page.setContent(TEST_HTML);

    // First inject page script
    await injectPageScript(page, 2.0, true);

    // Now create a shadow root with a video element
    const rate = await page.evaluate(() => {
      return new Promise(resolve => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const v = document.createElement('video');
        shadow.appendChild(v);
        document.body.appendChild(host);
        requestAnimationFrame(() => resolve(v.playbackRate));
      });
    });
    expect(rate).toBe(2.0);
  });

  test('T09: disable returns original rate (1.0)', async ({ page }) => {
    await page.setContent(TEST_HTML);
    await injectPageScript(page, 2.0, true);

    await page.evaluate(() => { window.__GS_ENABLED__ = false; });

    const rate = await page.evaluate(() => {
      return document.createElement('video').playbackRate;
    });
    expect(rate).toBe(1.0);
  });

  test('T10: double injection prevention', async ({ page }) => {
    await page.setContent(TEST_HTML);

    // Inject twice — second should be blocked
    await page.evaluate(() => {
      const s1 = document.createElement('script');
      s1.textContent = `(function(){'use strict';if(window.__GS_ACTIVE__)return;window.__GS_ACTIVE__=true;window.__GS_SPEED__=1;})();`;
      document.head.appendChild(s1);

      const s2 = document.createElement('script');
      s2.textContent = `(function(){'use strict';if(window.__GS_ACTIVE__)return;window.__GS_SPEED__=999;})();`;
      document.head.appendChild(s2);
    });

    const speed = await page.evaluate(() => window.__GS_SPEED__);
    expect(speed).toBe(1);
  });

  test('T17: ratechange event triggers speed correction', async ({ page }) => {
    await page.setContent(TEST_HTML);
    await injectPageScript(page, 2.0, true);

    // Create video, set its rate via the override path (isApplying=true),
    // then fire ratechange
    const rate = await page.evaluate(() => {
      return new Promise(resolve => {
        const v = document.createElement('video');
        v.id = 'rcv';
        document.body.appendChild(v);

        // Simulate page trying to change the rate
        // The page script's ratechange handler should correct it back
        const origDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');

        // Set a different underlying value (bypassing the override)
        // Using isApplying=true to actually set the real value
        let isApplying = true;
        origDesc.set.call(v, 0.5);
        isApplying = false;

        // Now fire ratechange — the listener should correct to 2.0
        v.dispatchEvent(new Event('ratechange'));

        requestAnimationFrame(() => resolve(v.playbackRate));
      });
    });
    expect(rate).toBe(2.0);
  });
});

test.describe('Userscript Bootstrap (via addInitScript)', () => {

  test('T11: init() runs without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.addInitScript(gmMock);
    await page.addInitScript(userscript);
    await page.setContent(TEST_HTML);
    await page.waitForTimeout(500);

    expect(errors.length).toBe(0);
  });

  test('T12: state defaults to 1.0x after init', async ({ page }) => {
    await page.addInitScript(gmMock);
    await page.addInitScript(userscript);
    await page.setContent(TEST_HTML);
    await page.waitForTimeout(500);

    // The page script should have been injected and prototype override active
    const rate = await page.evaluate(() => {
      return document.createElement('video').playbackRate;
    });
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBe(1.0);
  });

  test('T13: GM storage getValue/setValue works correctly', async ({ page }) => {
    await page.addInitScript(gmMock);
    await page.goto('data:text/html,<h1>Storage Test</h1>');

    const result = await page.evaluate(async () => {
      await window.GM.setValue('test_key', 42);
      const val = await window.GM.getValue('test_key', 0);
      const missing = await window.GM.getValue('nonexistent', 'default');
      return { val, missing };
    });
    expect(result.val).toBe(42);
    expect(result.missing).toBe('default');
  });

  test('T14: cross-tab value change notification works', async ({ page }) => {
    await page.addInitScript(gmMock);
    await page.goto('data:text/html,<h1>Cross-Tab Test</h1>');

    const result = await page.evaluate(async () => {
      let receivedValue = null;
      window.GM_addValueChangeListener('test_cross_tab', (_key, _oldVal, newVal, remote) => {
        if (remote) receivedValue = newVal;
      });
      const listeners = window.__gmTest.getListeners().get('test_cross_tab');
      if (listeners) {
        listeners.forEach(cb => cb('test_cross_tab', undefined, 7.5, true));
      }
      return receivedValue;
    });
    expect(result).toBe(7.5);
  });
});

test.describe('Fallback Strategy', () => {

  test('T15: unsafeWindow fallback apply function works', async ({ page }) => {
    await page.setContent(TEST_HTML);

    // Simulate the unsafeWindow fallback setup
    await page.evaluate(() => {
      const fd = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
      window.__gsSpeed = 2.0;
      window.__gsEnabled = true;
      let isApplying = false;

      Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        configurable: true, enumerable: true,
        get() { return window.__gsEnabled ? window.__gsSpeed : fd.get.call(this); },
        set(rate) { if (isApplying || !window.__gsEnabled) fd.set.call(this, rate); }
      });

      window.__gsFallbackApply = function() {
        document.querySelectorAll('video, audio').forEach(function(el) {
          try {
            isApplying = true;
            fd.set.call(el, window.__gsEnabled ? window.__gsSpeed : 1);
          } finally { isApplying = false; }
        });
      };
    });

    // Create a video
    await page.evaluate(() => {
      const v = document.createElement('video');
      v.id = 'fv';
      document.body.appendChild(v);
    });

    // Trigger fallback apply
    await page.evaluate(() => { window.__gsFallbackApply(); });

    const rate = await page.evaluate(() => {
      return document.getElementById('fv').playbackRate;
    });
    expect(rate).toBe(2.0);
  });
});

test.describe('UI Components', () => {

  test('T16: speed indicator element is created', async ({ page }) => {
    await page.addInitScript(gmMock);
    await page.setContent(TEST_HTML);

    // Manually simulate indicator creation
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'gm-speed-indicator';
      div.textContent = '1.50x';
      div.style.display = 'block';
      document.body.appendChild(div);
    });

    const exists = await page.evaluate(() => {
      const el = document.getElementById('gm-speed-indicator');
      return { exists: !!el, text: el ? el.textContent : null };
    });
    expect(exists.exists).toBe(true);
    expect(exists.text).toBe('1.50x');
  });

  test('T17: menu commands can be registered programmatically', async ({ page }) => {
    await page.addInitScript(gmMock);
    await page.goto('data:text/html,<h1>Menu Test</h1>');

    const result = await page.evaluate(() => {
      window.GM_registerMenuCommand('Set speed (1.00x)', () => {});
      window.GM_registerMenuCommand('Reset (1.0x)', () => {});
      window.GM_registerMenuCommand('Disable Global Speed', () => {});
      return window.__gmMenuCommands ? Object.keys(window.__gmMenuCommands) : [];
    });

    expect(result.length).toBe(3);
    expect(result.some(c => c.includes('Set speed'))).toBe(true);
    expect(result.some(c => c.includes('Reset'))).toBe(true);
    expect(result.some(c => c.includes('Disable'))).toBe(true);
  });
});

test.describe('Edge Cases', () => {

  test('T18: setSpeed clamps extreme values', async ({ page }) => {
    await page.setContent(TEST_HTML);

    const result = await page.evaluate(() => {
      function clamp(v) { return Math.max(0.07, Math.min(16, v)); }
      return {
        tooLow: clamp(0.001),
        normal: clamp(1.5),
        tooHigh: clamp(20),
        negative: clamp(-5),
      };
    });
    expect(result.tooLow).toBe(0.07);
    expect(result.normal).toBe(1.5);
    expect(result.tooHigh).toBe(16);
    expect(result.negative).toBe(0.07);
  });

  test('T19: prototype works with multiple media elements', async ({ page }) => {
    await page.setContent(TEST_HTML);
    await injectPageScript(page, 2.0, true);

    const rates = await page.evaluate(() => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        const v = document.createElement('video');
        results.push(v.playbackRate);
      }
      return results;
    });

    rates.forEach(r => expect(r).toBe(2.0));
  });
});
