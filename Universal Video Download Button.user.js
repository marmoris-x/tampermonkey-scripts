// ==UserScript==
// @name         Universal Video Download Button
// @namespace    marmoris.tools.video.universal
// @version      2.0.0
// @description  Universeller Download-Button für alle Video-Types (YouTube, TikTok, HLS, DASH, etc.)
// @author       marmoris
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_download
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      *
// @noframes     false
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// ==/UserScript==

(function () {
  'use strict';

  const BTN_SIZE = 32;
  const BTN_CLASS = 'tm-universal-dl-btn';
  const SEEN = new WeakSet();
  const POS_LOOP = new WeakMap();
  const BUTTONS = new WeakMap();
  const VIDEO_DATA = new WeakMap(); // Store additional video metadata

  // Platform-specific extractors
  const EXTRACTORS = {
    youtube: {
      match: /youtube\.com|youtu\.be/,
      extract: extractYouTubeVideo
    },
    tiktok: {
      match: /tiktok\.com/,
      extract: extractTikTokVideo
    },
    instagram: {
      match: /instagram\.com/,
      extract: extractInstagramVideo
    },
    twitter: {
      match: /twitter\.com|x\.com/,
      extract: extractTwitterVideo
    },
    twitch: {
      match: /twitch\.tv/,
      extract: extractTwitchVideo
    },
    facebook: {
      match: /facebook\.com|fb\.watch/,
      extract: extractFacebookVideo
    },
    generic: {
      match: /.*/,
      extract: extractGenericVideo
    }
  };

  // ---------- Enhanced Styles ----------
  GM_addStyle(`
    .${BTN_CLASS} {
      position: fixed;
      width: ${BTN_SIZE}px;
      height: ${BTN_SIZE}px;
      border-radius: 50%;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,.3);
      backdrop-filter: blur(12px);
      border: 2px solid rgba(255,255,255,.2);
      background: linear-gradient(135deg, rgba(74,144,226,.9), rgba(80,200,120,.9));
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      font: 700 14px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: white;
      padding: 0;
      margin: 0;
      user-select: none;
      transition: all 0.2s ease;
      opacity: 0.8;
    }

    .${BTN_CLASS}:hover {
      opacity: 1;
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0,0,0,.4);
    }

    .${BTN_CLASS}[data-show="1"] {
      display: flex;
      animation: slideIn 0.3s ease;
    }

    .${BTN_CLASS} svg {
      width: 18px;
      height: 18px;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.3));
    }

    .${BTN_CLASS}[data-state="downloading"] {
      background: linear-gradient(135deg, rgba(255,165,0,.9), rgba(255,69,0,.9));
      animation: pulse 1s infinite;
      pointer-events: none;
    }

    .${BTN_CLASS}[data-state="success"] {
      background: linear-gradient(135deg, rgba(40,167,69,.9), rgba(76,175,80,.9));
    }

    .${BTN_CLASS}[data-state="error"] {
      background: linear-gradient(135deg, rgba(220,53,69,.9), rgba(244,67,54,.9));
    }

    @keyframes slideIn {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 0.8; transform: scale(1); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }

    /* Quality selection dropdown */
    .${BTN_CLASS}-quality-menu {
      position: fixed;
      background: rgba(30,30,30,.95);
      backdrop-filter: blur(12px);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.4);
      padding: 8px 0;
      min-width: 120px;
      z-index: 2147483648;
      display: none;
    }

    .${BTN_CLASS}-quality-item {
      display: block;
      width: 100%;
      padding: 8px 16px;
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font: 14px system-ui;
      text-align: left;
      transition: background 0.2s;
    }

    .${BTN_CLASS}-quality-item:hover {
      background: rgba(255,255,255,.1);
    }

    .${BTN_CLASS}-toast {
      position: fixed;
      background: rgba(0,0,0,.85);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font: 12px system-ui;
      pointer-events: none;
      z-index: 2147483649;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 12px rgba(0,0,0,.3);
    }
  `);

  // ---------- Core Functions ----------
  function initOnExisting() {
    document.querySelectorAll('video').forEach(attachHandlers);
  }

  function watchDOM() {
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLVideoElement) {
            attachHandlers(node);
          } else if (node instanceof Element) {
            node.querySelectorAll?.('video').forEach(attachHandlers);
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  function attachHandlers(video) {
    if (!(video instanceof HTMLVideoElement) || SEEN.has(video)) return;
    SEEN.add(video);

    const btn = createButton(video);
    BUTTONS.set(video, btn);

    // Enhanced event handling
    video.addEventListener('loadeddata', () => updateVideoData(video), { passive: true });
    video.addEventListener('playing', () => showBtnFor(video), { passive: true });
    video.addEventListener('play', () => showBtnFor(video), { passive: true });
    video.addEventListener('pause', () => hideBtnFor(video), { passive: true });
    video.addEventListener('ended', () => hideBtnFor(video), { passive: true });

    // Check if already playing
    if (!video.paused && !video.ended && video.readyState >= 2) {
      updateVideoData(video);
      showBtnFor(video);
    }
  }

  function updateVideoData(video) {
    // Store metadata for better filename generation
    const data = {
      title: getVideoTitle(),
      duration: video.duration,
      currentTime: video.currentTime,
      url: window.location.href,
      platform: getPlatform()
    };
    VIDEO_DATA.set(video, data);
  }

  function createButton(video) {
    const btn = document.createElement('button');
    btn.className = BTN_CLASS;
    btn.type = 'button';
    btn.title = 'Video herunterladen (Rechtsklick für Optionen)';
    btn.setAttribute('aria-label', 'Video herunterladen');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4.707 4.707a1 1 0 0 1-1.414 0L7.879 10.707a1 1 0 0 1 1.414-1.414L12 12.586V3a1 1 0 0 1 1-1zM6 20a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1z"/>
      </svg>
    `;

    // Left click: Direct download
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      downloadVideo(video, btn);
    }, { passive: false });

    // Right click: Show quality options (if available)
    btn.addEventListener('contextmenu', (e) => {
      e.stopPropagation();
      e.preventDefault();
      showQualityMenu(video, btn, e);
    }, { passive: false });

    document.documentElement.appendChild(btn);
    return btn;
  }

  function showBtnFor(video) {
    const btn = BUTTONS.get(video) || createButton(video);
    BUTTONS.set(video, btn);
    btn.dataset.show = '1';
    btn.dataset.state = '';
    positionLoop(video, btn);
  }

  function hideBtnFor(video) {
    const btn = BUTTONS.get(video);
    if (!btn) return;
    btn.dataset.show = '0';
    stopPositionLoop(video);
  }

  function positionLoop(video, btn) {
    stopPositionLoop(video);
    const tick = () => {
      const rect = safeRect(video);
      if (rect && rect.width > 0 && rect.height > 0) {
        btn.style.left = (rect.right - BTN_SIZE - 12) + 'px';
        btn.style.top = (rect.top + 12) + 'px';
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
      }
      const id = requestAnimationFrame(tick);
      POS_LOOP.set(video, id);
    };
    tick();
  }

  function stopPositionLoop(video) {
    const id = POS_LOOP.get(video);
    if (id) cancelAnimationFrame(id);
    POS_LOOP.delete(video);
  }

  function safeRect(el) {
    try {
      const r = el.getBoundingClientRect?.();
      if (!r || !isFinite(r.top) || r.width <= 0 || r.height <= 0) return null;
      return r;
    } catch {
      return null;
    }
  }

  // ---------- Platform Detection ----------
  function getPlatform() {
    const hostname = window.location.hostname.toLowerCase();
    for (const [name, extractor] of Object.entries(EXTRACTORS)) {
      if (name !== 'generic' && extractor.match.test(hostname)) {
        return name;
      }
    }
    return 'generic';
  }

  function getVideoTitle() {
    // Try multiple selectors for video title
    const selectors = [
      'h1[class*="title"]',
      '.video-title',
      'h1.title',
      'h1',
      'title',
      '[property="og:title"]',
      'meta[name="title"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = (el.content || el.textContent || '').trim();
        if (text && text.length > 3 && text.length < 200) {
          return sanitizeFilename(text);
        }
      }
    }
    return null;
  }

  function sanitizeFilename(str) {
    return str
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  // ---------- Video Extraction Functions ----------
  async function downloadVideo(video, btn) {
    btn.dataset.state = 'downloading';

    try {
      const platform = getPlatform();
      const extractor = EXTRACTORS[platform] || EXTRACTORS.generic;

      console.log(`Attempting to download video using ${platform} extractor`);

      const videoInfo = await extractor.extract(video);

      if (!videoInfo || !videoInfo.url) {
        throw new Error('No video URL found');
      }

      await performDownload(videoInfo, btn);

    } catch (error) {
      console.error('Download failed:', error);
      btn.dataset.state = 'error';
      showToast(btn, 'Download fehlgeschlagen: ' + error.message);

      setTimeout(() => {
        btn.dataset.state = '';
      }, 3000);
    }
  }

  // YouTube Extractor
  async function extractYouTubeVideo(video) {
    console.log('Extracting YouTube video...');

    // YouTube URLs often require special handling due to authentication
    showToast(BUTTONS.get(video), 'YouTube-Video erkannt - verwende spezielle Methoden...', 2000);

    // Method 1: Try to get from ytInitialPlayerResponse
    try {
      if (window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.streamingData) {
        console.log('Found ytInitialPlayerResponse');
        const streamingData = window.ytInitialPlayerResponse.streamingData;
        const formats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])];

        // Get highest quality video with audio, prioritize non-encrypted
        const videoWithAudio = formats
          .filter(f => f.mimeType && f.mimeType.includes('video') && f.audioChannels && !f.signatureCipher)
          .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

        if (videoWithAudio && videoWithAudio.url) {
          console.log('Found direct YouTube URL from ytInitialPlayerResponse');
          return {
            url: videoWithAudio.url,
            filename: generateYouTubeFilename(videoWithAudio),
            quality: videoWithAudio.height || 'unknown',
            isYouTube: true
          };
        }

        // If no direct URL, try any available format (even without audio)
        const anyVideo = formats
          .filter(f => f.mimeType && f.mimeType.includes('video') && f.url && !f.signatureCipher)
          .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

        if (anyVideo && anyVideo.url) {
          console.log('Found YouTube video-only URL from ytInitialPlayerResponse');
          return {
            url: anyVideo.url,
            filename: generateYouTubeFilename(anyVideo),
            quality: anyVideo.height || 'unknown',
            isYouTube: true,
            isVideoOnly: true
          };
        }
      }
    } catch (e) {
      console.log('ytInitialPlayerResponse method failed:', e);
    }

    // Method 2: Try ytplayer config
    try {
      if (window.ytplayer && window.ytplayer.config) {
        console.log('Trying ytplayer config...');
        const config = window.ytplayer.config;
        if (config.args && config.args.player_response) {
          const playerResponse = JSON.parse(config.args.player_response);
          if (playerResponse.streamingData) {
            const formats = [...(playerResponse.streamingData.formats || []), ...(playerResponse.streamingData.adaptiveFormats || [])];
            const bestFormat = formats
              .filter(f => f.url && !f.signatureCipher)
              .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

            if (bestFormat) {
              return {
                url: bestFormat.url,
                filename: generateYouTubeFilename(bestFormat),
                quality: bestFormat.height || 'unknown',
                isYouTube: true
              };
            }
          }
        }
      }
    } catch (e) {
      console.log('ytplayer config method failed:', e);
    }

    // Method 3: Check for embedded video data
    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';

        // Look for streaming data in scripts
        if (content.includes('streamingData') || content.includes('adaptiveFormats')) {
          const streamingDataMatch = content.match(/"streamingData":\s*({[^}]+})/);
          if (streamingDataMatch) {
            const streamingData = JSON.parse(streamingDataMatch[1]);
            const formats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])];
            const bestFormat = formats
              .filter(f => f.url && !f.signatureCipher)
              .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

            if (bestFormat) {
              return {
                url: bestFormat.url,
                filename: generateYouTubeFilename(bestFormat),
                quality: bestFormat.height || 'unknown',
                isYouTube: true
              };
            }
          }
        }
      }
    } catch (e) {
      console.log('Script parsing method failed:', e);
    }

    // Method 4: Try current video source as last resort (often fails due to CORS)
    const currentUrl = video.currentSrc || video.src;
    if (currentUrl && !currentUrl.startsWith('blob:')) {
      console.log('Falling back to current video source (may have CORS issues)');
      return {
        url: currentUrl,
        filename: generateFilename(video, currentUrl),
        quality: 'current',
        isYouTube: true,
        hasCORSIssues: true
      };
    }

    // If all else fails, provide helpful guidance
    throw new Error('YouTube Download nicht möglich - verwende yt-dlp oder ähnliche Tools');
  }

  // TikTok Extractor
  async function extractTikTokVideo(video) {
    console.log('Extracting TikTok video...');

    // TikTok often uses the video element's src directly
    const videoUrl = video.currentSrc || video.src;

    if (videoUrl && !videoUrl.startsWith('blob:')) {
      return {
        url: videoUrl,
        filename: generateTikTokFilename(),
        quality: 'original'
      };
    }

    // Try to find video data in TikTok's app data
    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        if (content.includes('playAddr') || content.includes('downloadAddr')) {
          const matches = content.match(/"(https:\/\/[^"]*\.mp4[^"]*?)"/g);
          if (matches && matches.length > 0) {
            const url = matches[0].replace(/"/g, '');
            return {
              url: url,
              filename: generateTikTokFilename(),
              quality: 'original'
            };
          }
        }
      }
    } catch (e) {
      console.log('TikTok extraction failed:', e);
    }

    return extractGenericVideo(video);
  }

  // Instagram Extractor
  async function extractInstagramVideo(video) {
    console.log('Extracting Instagram video...');

    const videoUrl = video.currentSrc || video.src;
    if (videoUrl && !videoUrl.startsWith('blob:')) {
      return {
        url: videoUrl,
        filename: generateInstagramFilename(),
        quality: 'original'
      };
    }

    return extractGenericVideo(video);
  }

  // Twitter/X Extractor
  async function extractTwitterVideo(video) {
    console.log('Extracting Twitter/X video...');

    const videoUrl = video.currentSrc || video.src;
    if (videoUrl && !videoUrl.startsWith('blob:')) {
      return {
        url: videoUrl,
        filename: generateTwitterFilename(),
        quality: 'original'
      };
    }

    return extractGenericVideo(video);
  }

  // Twitch Extractor
  async function extractTwitchVideo(video) {
    console.log('Extracting Twitch video...');

    // Twitch uses HLS streams, try to get the m3u8 URL
    const videoUrl = video.currentSrc || video.src;

    if (videoUrl) {
      if (videoUrl.includes('.m3u8')) {
        // For HLS streams, we'll need to process them differently
        return {
          url: videoUrl,
          filename: generateTwitchFilename(),
          quality: 'stream',
          isHLS: true
        };
      } else if (!videoUrl.startsWith('blob:')) {
        return {
          url: videoUrl,
          filename: generateTwitchFilename(),
          quality: 'original'
        };
      }
    }

    return extractGenericVideo(video);
  }

  // Facebook Extractor
  async function extractFacebookVideo(video) {
    console.log('Extracting Facebook video...');

    const videoUrl = video.currentSrc || video.src;
    if (videoUrl && !videoUrl.startsWith('blob:')) {
      return {
        url: videoUrl,
        filename: generateFacebookFilename(),
        quality: 'original'
      };
    }

    return extractGenericVideo(video);
  }

  // Generic Extractor (fallback)
  async function extractGenericVideo(video) {
    console.log('Using generic video extractor...');

    // Try multiple methods to get video URL
    let videoUrl = '';
    let extractionMethod = 'unknown';

    // Method 1: video.currentSrc
    if (video.currentSrc && video.currentSrc.trim()) {
      videoUrl = video.currentSrc.trim();
      extractionMethod = 'currentSrc';
    }

    // Method 2: video.src
    if (!videoUrl && video.src && video.src.trim()) {
      videoUrl = video.src.trim();
      extractionMethod = 'src';
    }

    // Method 3: source elements
    if (!videoUrl) {
      const sources = video.querySelectorAll('source');
      for (const source of sources) {
        const src = source.src || source.getAttribute('src');
        if (src && src.trim()) {
          videoUrl = src.trim();
          extractionMethod = 'source';
          break;
        }
      }
    }

    // Method 4: Try to find video URLs in network requests or page data
    if (!videoUrl || videoUrl.startsWith('blob:') || videoUrl.startsWith('data:')) {
      console.log('Standard methods failed, trying advanced extraction...');

      // Look for video URLs in page scripts
      const scripts = document.querySelectorAll('script');
      const urlPatterns = [
        /https?:\/\/[^\s"']+\.mp4[^\s"']*/gi,
        /https?:\/\/[^\s"']+\.webm[^\s"']*/gi,
        /https?:\/\/[^\s"']+\.mov[^\s"']*/gi,
        /https?:\/\/[^\s"']+\.avi[^\s"']*/gi
      ];

      for (const script of scripts) {
        const content = script.textContent || '';
        for (const pattern of urlPatterns) {
          const matches = content.match(pattern);
          if (matches && matches.length > 0) {
            // Take the first match that looks like a direct video file
            for (const match of matches) {
              if (!match.includes('thumbnail') && !match.includes('preview')) {
                videoUrl = match;
                extractionMethod = 'script-extraction';
                console.log('Found video URL in script:', videoUrl);
                break;
              }
            }
            if (videoUrl && !videoUrl.startsWith('blob:')) break;
          }
        }
        if (videoUrl && !videoUrl.startsWith('blob:')) break;
      }
    }

    // Method 5: Handle blob URLs specially
    if (videoUrl && videoUrl.startsWith('blob:')) {
      console.log('Detected blob URL, attempting blob conversion...');

      try {
        // Try to fetch the blob and convert it
        const response = await fetch(videoUrl);
        const blob = await response.blob();

        if (blob && blob.size > 0) {
          // Create object URL from blob (this might work better for download)
          const objectUrl = URL.createObjectURL(blob);

          return {
            url: objectUrl,
            filename: generateFilename(video, videoUrl),
            quality: 'blob-converted',
            isBlob: true,
            originalBlobUrl: videoUrl
          };
        }
      } catch (blobError) {
        console.error('Blob conversion failed:', blobError);
        // Continue with original blob URL as last resort
      }
    }

    // Validate URL
    if (!videoUrl) {
      throw new Error('Keine Video-URL gefunden');
    }

    // Skip problematic URLs
    if (videoUrl.startsWith('data:')) {
      throw new Error('Data-URLs werden nicht unterstützt');
    }

    // Convert relative URLs to absolute
    try {
      videoUrl = new URL(videoUrl, window.location.href).href;
    } catch (urlError) {
      console.error('URL conversion failed:', urlError);
      throw new Error('Ungültige Video-URL: ' + videoUrl);
    }

    console.log(`Video URL extracted using ${extractionMethod}: ${videoUrl}`);

    return {
      url: videoUrl,
      filename: generateFilename(video, videoUrl),
      quality: 'original',
      extractionMethod: extractionMethod
    };
  }

  // ---------- Filename Generation ----------
  function generateYouTubeFilename(format) {
    const title = getVideoTitle() || 'YouTube Video';
    const quality = format.height ? `${format.height}p` : 'unknown';
    const ext = getExtensionFromMimeType(format.mimeType) || 'mp4';
    return `${title} [${quality}].${ext}`;
  }

  function generateTikTokFilename() {
    const title = getVideoTitle() || 'TikTok Video';
    return `${title}.mp4`;
  }

  function generateInstagramFilename() {
    const title = getVideoTitle() || 'Instagram Video';
    return `${title}.mp4`;
  }

  function generateTwitterFilename() {
    const title = getVideoTitle() || 'Twitter Video';
    return `${title}.mp4`;
  }

  function generateTwitchFilename() {
    const title = getVideoTitle() || 'Twitch Video';
    return `${title}.mp4`;
  }

  function generateFacebookFilename() {
    const title = getVideoTitle() || 'Facebook Video';
    return `${title}.mp4`;
  }

  function generateFilename(video, url) {
    // Try to get filename from URL
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();

      if (filename && filename.includes('.') && filename.length < 100) {
        return sanitizeFilename(filename);
      }
    } catch (e) {
      // URL parsing failed
    }

    // Generate filename with timestamp
    const title = getVideoTitle() || 'Video';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const ext = getExtensionFromUrl(url) || getExtensionFromMimeType(video.getAttribute('type')) || 'mp4';

    return `${title} ${timestamp}.${ext}`;
  }

  function getExtensionFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  function getExtensionFromMimeType(mimeType) {
    if (!mimeType) return null;

    const mimeMap = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'video/avi': 'avi',
      'video/mov': 'mov',
      'video/wmv': 'wmv',
      'video/flv': 'flv',
      'video/mkv': 'mkv'
    };

    return mimeMap[mimeType.split(';')[0]] || null;
  }

  // ---------- Download Functions ----------
  async function performDownload(videoInfo, btn) {
    console.log('Performing download:', videoInfo);

    if (videoInfo.isHLS) {
      // For HLS streams, show a message that this requires special handling
      showToast(btn, 'HLS-Stream erkannt - verwende externen Downloader');
      btn.dataset.state = 'error';
      return;
    }

    let downloadSuccessful = false;

    // Try GM_download first if available
    if (typeof GM_download === 'function') {
      try {
        console.log('Trying GM_download...');
        await downloadWithGM(videoInfo, btn);
        downloadSuccessful = true;
        console.log('GM_download successful');
      } catch (error) {
        console.warn('GM_download failed, trying fallback method:', error.message);
        showToast(btn, `GM_download fehlgeschlagen: ${error.message}`, 3000);
      }
    }

    // If GM_download failed or is not available, use fallback
    if (!downloadSuccessful) {
      try {
        console.log('Trying fallback download...');
        await downloadWithFallback(videoInfo, btn);
        downloadSuccessful = true;
        console.log('Fallback download successful');
      } catch (error) {
        console.error('Fallback download also failed:', error);

        // Last resort: try direct navigation
        try {
          console.log('Trying direct navigation as last resort...');
          await downloadWithDirectNavigation(videoInfo, btn);
          downloadSuccessful = true;
          console.log('Direct navigation successful');
        } catch (navError) {
          console.error('All download methods failed:', navError);
          throw new Error(`Alle Download-Methoden fehlgeschlagen. Letzter Fehler: ${navError.message}`);
        }
      }
    }

    if (downloadSuccessful) {
      btn.dataset.state = 'success';
      showToast(btn, 'Download gestartet!');

      // Cleanup blob URLs after download
      if (videoInfo.isBlob && videoInfo.url.startsWith('blob:')) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(videoInfo.url);
            console.log('Blob URL cleaned up');
          } catch (e) {
            console.warn('Blob URL cleanup failed:', e);
          }
        }, 5000);
      }

      setTimeout(() => {
        btn.dataset.state = '';
      }, 2000);
    }
  }

  function downloadWithGM(videoInfo, btn) {
    return new Promise((resolve, reject) => {
      console.log('Attempting GM_download with:', videoInfo.url);

      const downloadOptions = {
        url: videoInfo.url,
        name: videoInfo.filename,
        saveAs: false,
        timeout: 60000, // Increased timeout

        ontimeout: () => {
          console.error('GM_download timeout for:', videoInfo.url);
          reject(new Error('Download-Timeout (60s erreicht)'));
        },

        onerror: (error) => {
          console.error('GM_download error:', error, 'for URL:', videoInfo.url);
          // Try to provide more specific error info
          const errorMsg = error && error.error ? error.error : 'Unbekannter GM_download Fehler';
          reject(new Error(`GM_download: ${errorMsg}`));
        },

        onload: (response) => {
          console.log('GM_download successful:', response);
          resolve();
        }
      };

      try {
        GM_download(downloadOptions);
      } catch (e) {
        console.error('GM_download exception:', e);
        reject(new Error(`GM_download Exception: ${e.message}`));
      }
    });
  }

  async function downloadWithFallback(videoInfo, btn) {
    console.log('Attempting fallback download for:', videoInfo.url);

    // Method 1: Standard <a> tag download
    const a = document.createElement('a');
    a.href = videoInfo.url;
    a.download = videoInfo.filename;
    a.style.display = 'none';
    a.rel = 'noopener noreferrer';
    a.target = '_blank';

    document.body.appendChild(a);

    try {
      a.click();
      // Small delay to ensure click is processed
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('Fallback download initiated');
    } catch (error) {
      console.error('Fallback download failed:', error);
      throw new Error(`Fallback-Download fehlgeschlagen: ${error.message}`);
    } finally {
      document.body.removeChild(a);
    }
  }

  async function downloadWithDirectNavigation(videoInfo, btn) {
    console.log('Attempting direct navigation for:', videoInfo.url);

    try {
      // For YouTube and protected content, try opening in new tab first
      if (videoInfo.isYouTube || videoInfo.url.includes('googlevideo.com') || videoInfo.url.includes('youtube.com')) {
        console.log('Detected YouTube/Google content - using new tab method');

        const newWindow = window.open(videoInfo.url, '_blank', 'noopener,noreferrer');

        if (newWindow) {
          showToast(btn, 'Video in neuem Tab geöffnet - Download sollte automatisch starten', 3000);
          return;
        } else {
          throw new Error('Popup wurde blockiert');
        }
      }

      // For other content, try iframe method
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.src = videoInfo.url;

      // Add error handling to iframe
      iframe.onerror = () => {
        console.log('Iframe method failed for:', videoInfo.url);
      };

      document.body.appendChild(iframe);

      // Wait a bit then remove
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 3000);

      // Also try direct window.open as backup
      setTimeout(() => {
        try {
          const newWindow = window.open(videoInfo.url, '_blank', 'noopener,noreferrer');
          if (!newWindow) {
            console.log('Direct window.open failed - popup blocked');
          }
        } catch (e) {
          console.log('Direct window.open exception:', e);
        }
      }, 500);

      console.log('Direct navigation methods initiated');

    } catch (error) {
      console.error('Direct navigation failed:', error);

      // Final fallback: Copy URL to clipboard
      try {
        const urlToCopy = videoInfo.isYouTube ? window.location.href : videoInfo.url;
        await navigator.clipboard.writeText(urlToCopy);

        if (videoInfo.isYouTube) {
          showToast(btn, 'YouTube-URL wurde kopiert - verwende yt-dlp oder andere Tools!', 4000);
        } else {
          showToast(btn, 'Video-URL wurde kopiert - Download manuell starten', 4000);
        }

      } catch (clipError) {
        console.warn('Could not copy to clipboard:', clipError);

        // Ultimate fallback: Show URL in toast
        const displayUrl = videoInfo.url.length > 50 ?
          videoInfo.url.substring(0, 50) + '...' :
          videoInfo.url;

        showToast(btn, `URL: ${displayUrl}`, 8000);
        throw new Error(`Direkte Navigation und Zwischenablage fehlgeschlagen: ${clipError.message}`);
      }
    }
  }

  // ---------- UI Functions ----------
  function showQualityMenu(video, btn, event) {
    // Remove existing menu
    const existingMenu = document.querySelector(`.${BTN_CLASS}-quality-menu`);
    if (existingMenu) existingMenu.remove();

    // Create quality menu
    const menu = document.createElement('div');
    menu.className = `${BTN_CLASS}-quality-menu`;

    const platform = getPlatform();

    // Add platform-specific options
    let options = [];

    if (platform === 'youtube') {
      options = [
        { label: '🎥 YouTube Download versuchen', action: () => downloadVideo(video, btn) },
        { label: '📋 YouTube URL kopieren', action: () => copyYouTubeUrl(btn) },
        { label: '🔧 yt-dlp Befehl kopieren', action: () => copyYtDlpCommand(btn) },
        { label: 'ℹ️ Info & Alternativen', action: () => showYouTubeAlternatives(btn) }
      ];
    } else if (platform === 'tiktok') {
      options = [
        { label: '🎬 TikTok Download', action: () => downloadVideo(video, btn) },
        { label: '📱 TikTok URL kopieren', action: () => copyCurrentUrl(btn) },
        { label: 'ℹ️ Video Info', action: () => showVideoInfo(video, btn) }
      ];
    } else {
      options = [
        { label: '⬇️ Beste Qualität', action: () => downloadVideo(video, btn) },
        { label: '📁 Originaldatei', action: () => downloadOriginal(video, btn) },
        { label: '📋 URL kopieren', action: () => copyVideoUrl(video, btn) },
        { label: 'ℹ️ Video Info', action: () => showVideoInfo(video, btn) }
      ];
    }

    options.forEach(option => {
      const item = document.createElement('button');
      item.className = `${BTN_CLASS}-quality-item`;
      item.textContent = option.label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        option.action();
      });
      menu.appendChild(item);
    });

    // Position menu
    const rect = btn.getBoundingClientRect();
    menu.style.left = (rect.left - 60) + 'px';
    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.display = 'block';

    document.documentElement.appendChild(menu);

    // Remove menu on outside click
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 100);
  }

  // Helper functions for menu actions
  async function copyYouTubeUrl(btn) {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast(btn, 'YouTube URL in Zwischenablage kopiert!', 2000);
    } catch (e) {
      showToast(btn, 'URL kopieren fehlgeschlagen', 2000);
    }
  }

  async function copyYtDlpCommand(btn) {
    try {
      const command = `yt-dlp "${window.location.href}"`;
      await navigator.clipboard.writeText(command);
      showToast(btn, 'yt-dlp Befehl kopiert! Füge ihn in die Kommandozeile ein.', 3000);
    } catch (e) {
      showToast(btn, 'Befehl kopieren fehlgeschlagen', 2000);
    }
  }

  async function copyCurrentUrl(btn) {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast(btn, 'URL in Zwischenablage kopiert!', 2000);
    } catch (e) {
      showToast(btn, 'URL kopieren fehlgeschlagen', 2000);
    }
  }

  async function copyVideoUrl(video, btn) {
    try {
      const url = video.currentSrc || video.src || window.location.href;
      await navigator.clipboard.writeText(url);
      showToast(btn, 'Video-URL in Zwischenablage kopiert!', 2000);
    } catch (e) {
      showToast(btn, 'URL kopieren fehlgeschlagen', 2000);
    }
  }

  function showYouTubeAlternatives(btn) {
    const alternatives = `🎥 YouTube Download Alternativen:

🔧 Kommandozeile:
• yt-dlp (empfohlen)
• youtube-dl

🖥️ Desktop Apps:
• 4K Video Downloader
• JDownloader
• Freemake Video Downloader

🌐 Online:
• SaveFrom.net
• Y2mate.com
• ClipConverter.cc

💡 Tipp: yt-dlp ist am zuverlässigsten!
Installation: pip install yt-dlp`;

    showToast(btn, alternatives, 10000);
  }

  async function downloadOriginal(video, btn) {
    try {
      const originalUrl = video.currentSrc || video.src;
      if (!originalUrl || originalUrl.startsWith('blob:')) {
        throw new Error('Keine Original-URL verfügbar');
      }

      await performDownload({
        url: originalUrl,
        filename: generateFilename(video, originalUrl),
        quality: 'original'
      }, btn);
    } catch (error) {
      console.error('Original download failed:', error);
      showToast(btn, 'Original-Download fehlgeschlagen');
    }
  }

  function showVideoInfo(video, btn) {
    const videoData = VIDEO_DATA.get(video) || {};
    const platform = getPlatform();

    // Get current video URL info
    const currentSrc = video.currentSrc || video.src || 'N/A';
    const isBlob = currentSrc.startsWith('blob:');
    const isDash = currentSrc.includes('.mpd');
    const isHLS = currentSrc.includes('.m3u8');

    const info = [
      `=== Video Info ===`,
      `Platform: ${platform}`,
      `Titel: ${getVideoTitle() || 'N/A'}`,
      `Auflösung: ${video.videoWidth || '?'}x${video.videoHeight || '?'}`,
      `Dauer: ${Math.round(video.duration || 0)}s`,
      ``,
      `=== Technische Details ===`,
      `URL: ${currentSrc.substring(0, 80)}${currentSrc.length > 80 ? '...' : ''}`,
      `URL-Typ: ${isBlob ? 'Blob' : isDash ? 'DASH' : isHLS ? 'HLS' : 'Direkt'}`,
      `ReadyState: ${video.readyState}`,
      `NetworkState: ${video.networkState}`,
      ``,
      `=== Download-Status ===`,
      `GM_download verfügbar: ${typeof GM_download === 'function' ? 'Ja' : 'Nein'}`,
      `Cross-Origin: ${isBlob || currentSrc.includes('youtube.com') || currentSrc.includes('tiktok.com') ? 'Möglich' : 'Nein'}`,
      ``,
      `💡 Bei Problemen: Rechtsklick → "Originaldatei" versuchen`
    ].join('\n');

    showToast(btn, info, 8000);
  }

  function showToast(btn, text, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = `${BTN_CLASS}-toast`;
    toast.textContent = text;

    const rect = btn.getBoundingClientRect();
    toast.style.left = Math.max(10, rect.left - 50) + 'px';
    toast.style.top = (rect.top - 40) + 'px';
    toast.style.maxWidth = '300px';
    toast.style.whiteSpace = 'pre-wrap';

    document.documentElement.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ---------- Initialization ----------
  console.log('Universal Video Downloader v2.0 loaded');
  console.log('Supported platforms: YouTube, TikTok, Instagram, Twitter, Twitch, Facebook, Generic');

  // Add platform detection info
  const currentPlatform = getPlatform();
  if (currentPlatform !== 'generic') {
    console.log(`Platform detected: ${currentPlatform}`);

    // Show platform-specific initialization message
    setTimeout(() => {
      const videos = document.querySelectorAll('video');
      if (videos.length > 0) {
        console.log(`Found ${videos.length} video(s) on ${currentPlatform}`);

        // Special message for YouTube
        if (currentPlatform === 'youtube') {
          console.log('YouTube detected - CORS restrictions may apply. External tools recommended for reliable downloads.');
        }
      }
    }, 2000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnExisting);
  } else {
    initOnExisting();
  }

  watchDOM();

  // Add global keyboard shortcut (Ctrl+Shift+D)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      const videos = document.querySelectorAll('video');
      const playingVideo = Array.from(videos).find(v => !v.paused && !v.ended);

      if (playingVideo) {
        const btn = BUTTONS.get(playingVideo);
        if (btn) {
          console.log('Keyboard shortcut triggered for video download');
          downloadVideo(playingVideo, btn);
        }
      } else {
        console.log('Keyboard shortcut: No playing video found');

        // Show all available videos
        if (videos.length > 0) {
          console.log(`Found ${videos.length} video(s) - none currently playing`);

          // Try to download the first video
          const firstVideo = videos[0];
          const btn = BUTTONS.get(firstVideo);
          if (btn) {
            console.log('Attempting download of first video found');
            downloadVideo(firstVideo, btn);
          }
        } else {
          console.log('No videos found on page');
        }
      }
    }
  });

  // Add message for users
  console.log(`
🎥 Universal Video Downloader v2.0 Active!

📋 Usage:
• Click the blue download button on playing videos
• Right-click button for more options
• Keyboard: Ctrl+Shift+D for quick download

🔧 Platform Support:
✅ Generic videos (direct URLs)
✅ TikTok, Instagram, Twitter
⚠️  YouTube (limited due to CORS - use yt-dlp for best results)
✅ Facebook, Twitch (basic support)

💡 For YouTube: Use external tools like yt-dlp for reliable downloads
   Right-click button → "yt-dlp command kopieren"
  `);

})();