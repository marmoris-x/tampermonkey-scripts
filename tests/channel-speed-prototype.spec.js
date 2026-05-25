// @ts-check
import { test, expect } from '@playwright/test';
import { resolve } from 'path';

const FIXTURE = resolve(process.cwd(), 'tests', 'fixtures', 'video-test.html');

/**
 * Self-contained prototype override code mirroring the dist build.
 * Defines module-level variables and the installPrototypeOverride IIFE.
 * Variables are exposed on `window` for test access.
 */
const OVERRIDE_CODE = `
  // Module-level state (exposed on window for test access)
  window.activeChannelSpeed = null;
  window.browserOrigDesc = null;
  window.previousDescriptor = null;

  // Prototype override installation
  (function installPrototypeOverride() {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      (document.documentElement || document).appendChild(iframe);
      window.browserOrigDesc = Object.getOwnPropertyDescriptor(
        iframe.contentWindow.HTMLMediaElement.prototype, 'playbackRate'
      );
      iframe.remove();

      if (!window.browserOrigDesc || !window.browserOrigDesc.get || !window.browserOrigDesc.set) {
        console.error('Prototype override: could not capture browser descriptor');
        return;
      }

      window.previousDescriptor = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype, 'playbackRate'
      );
      if (!window.previousDescriptor || !window.previousDescriptor.get || !window.previousDescriptor.set) {
        window.previousDescriptor = window.browserOrigDesc;
      }

      Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
        configurable: true,
        enumerable: true,
        get: function () {
          if (window.activeChannelSpeed !== null) return window.activeChannelSpeed;
          return window.previousDescriptor.get.call(this);
        },
        set: function (rate) {
          if (window.activeChannelSpeed !== null) {
            window.browserOrigDesc.set.call(this, window.activeChannelSpeed);
          } else {
            window.previousDescriptor.set.call(this, rate);
          }
        }
      });
      console.log('Prototype override installed for channel speed protection');
    } catch (e) {
      console.error('Failed to install prototype override:', e);
    }
  })();
`;

test.describe('Channel Speed Prototype Override', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE);
    await page.evaluate(OVERRIDE_CODE);
  });

  test('1. Channel speed enforcement: playbackRate returns channel speed', async ({ page }) => {
    const rate = await page.evaluate(() => {
      window.activeChannelSpeed = 1.5;
      const vid = document.querySelector('video');
      return vid.playbackRate;
    });
    expect(rate).toBeCloseTo(1.5, 2);
  });

  test('2. Protection from external writes: vid.playbackRate = 2.0 silently ignored', async ({ page }) => {
    const rate = await page.evaluate(() => {
      window.activeChannelSpeed = 1.5;
      const vid = document.querySelector('video');
      vid.playbackRate = 2.0;
      return vid.playbackRate;
    });
    expect(rate).toBeCloseTo(1.5, 2);
  });

  test('3. Pass-through when no channel speed: write works normally', async ({ page }) => {
    const rate = await page.evaluate(() => {
      const vid = document.querySelector('video');
      vid.playbackRate = 2.0;
      return vid.playbackRate;
    });
    expect(rate).toBeCloseTo(2.0, 2);
  });

  test('4. Disabling channel speed restores pass-through', async ({ page }) => {
    const rate = await page.evaluate(() => {
      window.activeChannelSpeed = 1.5;
      window.activeChannelSpeed = null;
      const vid = document.querySelector('video');
      vid.playbackRate = 1.75;
      return vid.playbackRate;
    });
    expect(rate).toBeCloseTo(1.75, 2);
  });
});
