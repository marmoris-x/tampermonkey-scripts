import { chromium } from '@playwright/test';

const DIST_URL = 'http://localhost:3457/';
const YT_VIDEO = 'https://www.youtube.com/watch?v=XxG_i3uSqT4';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Register Trusted Types default policy BEFORE any navigation
  await context.addInitScript(() => {
    try {
      trustedTypes.createPolicy('default', {
        createScript: (s) => s,
        createScriptURL: (s) => s,
      });
    } catch (e) {
      console.log('[TTP] Policy exists or error:', e.message);
    }
  });

  const page = await context.newPage();

  // 1. Navigate to MrBeast video
  console.log('[TEST] Navigating to MrBeast video...');
  await page.goto(YT_VIDEO, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log('[TEST] Page loaded');

  // 2. Mock GM APIs
  await page.evaluate(() => {
    window.GM_addStyle = (css) => {
      try { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); } catch(e) {}
    };
    window.GM = {
      getValue: async (k, d) => null,
      setValue: async () => {},
      registerMenuCommand: () => {},
    };
    window.GM_getValue = (k, d) => d;
    window.GM_setValue = () => {};
    window.onurlchange = null;
    console.log('[TEST] GM APIs mocked');
  });

  // 3. Fetch and inject dist script
  console.log('[TEST] Fetching dist script...');
  const resp = await page.request.get(DIST_URL);
  const code = await resp.text();
  console.log('[TEST] Script fetched, length:', code.length);

  await page.evaluate((scriptCode) => {
    const s = document.createElement('script');
    s.textContent = scriptCode;
    document.body.appendChild(s);
    console.log('[TEST] Script injected');
  }, code);

  await page.waitForTimeout(2000);

  // 4. VERIFY: Core namespace
  const coreResult = await page.evaluate(() => ({
    coreExists: !!window.YoutubeAntiTranslate,
    logPrefix: window.YoutubeAntiTranslate?.LOG_PREFIX,
    maxAttempts: window.YoutubeAntiTranslate?.MAX_ATTEMPTS,
    methods: {
      cachedRequest: typeof window.YoutubeAntiTranslate?.cachedRequest === 'function',
      getVideoTitleFromYoutubeI: typeof window.YoutubeAntiTranslate?.getVideoTitleFromYoutubeI === 'function',
      getChannelBrandingWithYoutubeI: typeof window.YoutubeAntiTranslate?.getChannelBrandingWithYoutubeI === 'function',
      isWhitelistedChannel: typeof window.YoutubeAntiTranslate?.isWhitelistedChannel === 'function',
      getPlayerResponseSafely: typeof window.YoutubeAntiTranslate?.getPlayerResponseSafely === 'function',
      getCachedPlayer: typeof window.YoutubeAntiTranslate?.getCachedPlayer === 'function',
      isMobile: typeof window.YoutubeAntiTranslate?.isMobile === 'function',
      getCurrentVideoId: typeof window.YoutubeAntiTranslate?.getCurrentVideoId === 'function',
      debounce: typeof window.YoutubeAntiTranslate?.debounce === 'function',
      logInfo: typeof window.YoutubeAntiTranslate?.logInfo === 'function',
    },
    constants: {
      coreAttributedString: typeof window.YoutubeAntiTranslate?.CORE_ATTRIBUTED_STRING_SELECTOR === 'string',
      allArraysVideos: typeof window.YoutubeAntiTranslate?.ALL_ARRAYS_VIDEOS_SELECTOR === 'string',
      allArraysShorts: typeof window.YoutubeAntiTranslate?.ALL_ARRAYS_SHORTS_SELECTOR === 'string',
      supportedBCP47: window.YoutubeAntiTranslate?.SUPPORTED_BCP47_CODES instanceof Set,
      commonBCP47: typeof window.YoutubeAntiTranslate?.COMMON_BCP47_FALLBACKS === 'object',
    },
    videoId: window.YoutubeAntiTranslate?.getCurrentVideoId(),
    sapisidFn: typeof window.YoutubeAntiTranslate?.getSAPISID === 'function',
  }));
  console.log('[TEST] Core namespace:', JSON.stringify(coreResult, null, 2));

  // 5. VERIFY: Settings bridge
  const settingsResult = await page.evaluate(async () => {
    const settings = await window.YoutubeAntiTranslate.getSettings();
    return {
      disabled: settings.disabled,
      untranslateTitle: settings.untranslateTitle,
      untranslateAudio: settings.untranslateAudio,
      untranslateDescription: settings.untranslateDescription,
      untranslateChapters: settings.untranslateChapters,
      untranslateChannelBranding: settings.untranslateChannelBranding,
      untranslateNotification: settings.untranslateNotification,
      untranslateThumbnail: settings.untranslateThumbnail,
      subtitlesLanguage: settings.subtitlesLanguage,
      subtitlesEnabled: settings.subtitlesEnabled,
      settingsCount: Object.keys(settings).length,
    };
  });
  console.log('[TEST] Settings:', JSON.stringify(settingsResult, null, 2));

  // 6. VERIFY: Network calls (YouTubei API)
  const ytiResult = await page.evaluate(async () => {
    const result = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI('XxG_i3uSqT4');
    return {
      responseOk: result?.response?.ok,
      hasTitle: !!result?.data?.title,
      title: result?.data?.title,
      author: result?.data?.author_name,
      hasThumbnail: !!result?.data?.thumbnail_url,
    };
  });
  console.log('[TEST] YouTubei API:', JSON.stringify(ytiResult, null, 2));

  // 7. VERIFY: Session cache
  const cacheResult = await page.evaluate(() => {
    window.YoutubeAntiTranslate.setSessionCache('test-key', { hello: 'world' });
    const cached = window.YoutubeAntiTranslate.getSessionCache('test-key');
    return { cached: cached };
  });
  console.log('[TEST] Session cache:', JSON.stringify(cacheResult, null, 2));

  // 8. VERIFY: processString and helpers
  const helperResult = await page.evaluate(() => {
    const YAT = window.YoutubeAntiTranslate;
    return {
      processString: YAT.processString('  Hello  World  '),
      isStringEqual: YAT.isStringEqual('Test', 'test'),
      doesStringInclude: YAT.doesStringInclude('Hello World', 'world'),
      normalizeSpaces: YAT.normalizeSpaces('  a  b  c  '),
      isMobile: YAT.isMobile(),
      extractVideoId: YAT.extractVideoIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    };
  });
  console.log('[TEST] Helpers:', JSON.stringify(helperResult, null, 2));

  // 9. VERIFY: getArraysVideos (structure check)
  const arraysResult = await page.evaluate(() => {
    const YAT = window.YoutubeAntiTranslate;
    const videos = YAT.getArraysVideos();
    return {
      videosIsArray: Array.isArray(videos),
      videoCount: videos.length,
    };
  });
  console.log('[TEST] getArraysVideos:', JSON.stringify(arraysResult, null, 2));

  console.log('\n===== TEST RESULTS =====');
  const allPassed = (
    coreResult.coreExists &&
    coreResult.methods.cachedRequest &&
    coreResult.methods.getVideoTitleFromYoutubeI &&
    coreResult.methods.getChannelBrandingWithYoutubeI &&
    coreResult.methods.isWhitelistedChannel &&
    coreResult.methods.getPlayerResponseSafely &&
    coreResult.methods.isMobile &&
    coreResult.methods.getCurrentVideoId &&
    coreResult.methods.debounce &&
    coreResult.methods.logInfo &&
    coreResult.constants.coreAttributedString &&
    coreResult.constants.allArraysVideos &&
    coreResult.constants.allArraysShorts &&
    coreResult.constants.supportedBCP47 &&
    coreResult.constants.commonBCP47 &&
    coreResult.sapisidFn &&
    settingsResult.untranslateTitle === true &&
    settingsResult.settingsCount >= 11 &&
    cacheResult.cached?.hello === 'world' &&
    helperResult.processString === 'hello world' &&
    helperResult.isStringEqual === true &&
    helperResult.doesStringInclude === true &&
    helperResult.normalizeSpaces === 'a b c' &&
    helperResult.extractVideoId === 'dQw4w9WgXcQ'
  );

  console.log('Core namespace:', coreResult.coreExists ? 'PASS' : 'FAIL');
  console.log('All methods:', Object.values(coreResult.methods).every(Boolean) ? 'PASS' : 'FAIL');
  console.log('All constants:', Object.values(coreResult.constants).every(Boolean) ? 'PASS' : 'FAIL');
  console.log('Video ID:', coreResult.videoId ? 'PASS (' + coreResult.videoId + ')' : 'FAIL');
  console.log('Settings:', settingsResult.untranslateTitle ? 'PASS' : 'FAIL');
  console.log('YouTubei API:', ytiResult.responseOk ? 'PASS' : 'WARN (no auth in test)');
  console.log('Session cache:', cacheResult.cached?.hello === 'world' ? 'PASS' : 'FAIL');
  console.log('String helpers:', helperResult.processString === 'hello world' ? 'PASS' : 'FAIL');
  console.log('getArraysVideos:', arraysResult.videosIsArray ? 'PASS' : 'FAIL');
  console.log('');
  console.log('ALL TESTS:', allPassed ? 'PASSED' : 'FAILED');

  await browser.close();
}

main().catch(console.error);
