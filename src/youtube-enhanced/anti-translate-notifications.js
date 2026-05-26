'use strict';

async function fetchOriginalTitle(videoId) {
  const cacheKey = `ytat_oembed_${videoId}`;
  const cached = window.YoutubeAntiTranslate.getSessionCache(cacheKey);
  if (cached) return { originalTitle: cached };

  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}`;
  try {
    let response = await window.YoutubeAntiTranslate.cachedRequest(oembedUrl);
    if (!response || !response.response || !response.response.ok || !response.data?.thumbnail_url) {
      if (response?.response?.status === 401) {
        response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
        if (!response?.response?.ok || !response.data?.title) {
          window.YoutubeAntiTranslate.logWarning(`YoutubeI title request failed for video ${videoId}`);
          return;
        }
      }
    }
    if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateTitle', null, response.data.author_url)) {
      window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping notification titles untranslation');
      return { originalTitle: null };
    }
    return { originalTitle: response.data.title };
  } catch (err) {
    window.YoutubeAntiTranslate.logWarning(`oEmbed fetch error for video ${videoId}:`, err);
    window.YoutubeAntiTranslate.setSessionCache(cacheKey, null);
    return { originalTitle: null };
  }
}

let notificationMutationObserver = null;

function setupNotificationTitlesObserver() {
  cleanupNotificationTitlesObserver();
  const dropdown = window.YoutubeAntiTranslate.getFirstVisible(
    window.YoutubeAntiTranslate.querySelectorAll(
      'ytd-popup-container tp-yt-iron-dropdown[vertical-align="top"]',
    ),
  );
  if (!dropdown) return;
  refreshNotificationTitles();
  const contentWrapper = dropdown.querySelector('#contentWrapper');
  if (!contentWrapper) return;
  notificationMutationObserver = new MutationObserver(
    window.YoutubeAntiTranslate.debounce(() => { refreshNotificationTitles(); }),
  );
  notificationMutationObserver.observe(contentWrapper, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['style', 'class'],
  });
}

function cleanupNotificationTitlesObserver() {
  if (notificationMutationObserver) {
    notificationMutationObserver.disconnect();
    notificationMutationObserver = null;
  }
}

function replaceVideoTitleInNotification(message, originalTitle) {
  if (!message) return originalTitle;
  let endIdx = message.lastIndexOf('"');
  if (endIdx !== -1) {
    const startIdx = message.lastIndexOf('"', endIdx - 1);
    if (startIdx !== -1) return message.slice(0, startIdx + 1) + originalTitle + message.slice(endIdx);
  }
  endIdx = message.lastIndexOf('»');
  if (endIdx !== -1) {
    const startIdx = message.lastIndexOf('«', endIdx - 1);
    if (startIdx !== -1) return message.slice(0, startIdx + 1) + originalTitle + message.slice(endIdx);
  }
  const colonIdx = message.indexOf(':');
  if (colonIdx !== -1) return message.slice(0, colonIdx + 1) + ' ' + originalTitle;
  return originalTitle;
}

async function refreshNotificationTitles() {
  const notificationTitleElements = window.YoutubeAntiTranslate.querySelectorAll('.ytd-notification-renderer .message');
  for (const titleElement of notificationTitleElements) {
    const anchor = titleElement.closest('a');
    if (!anchor) continue;
    const href = anchor.getAttribute('href');
    if (!href) continue;
    const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(
      href.startsWith('http') ? href : window.location.origin + href,
    );
    if (!videoId) continue;
    const currentTitle = titleElement.textContent;
    const titleFetchResult = await fetchOriginalTitle(videoId);
    const originalTitle = titleFetchResult.originalTitle;
    if (!originalTitle) continue;
    if (originalTitle && !window.YoutubeAntiTranslate.doesStringInclude(currentTitle, originalTitle)) {
      const replaced = replaceVideoTitleInNotification(currentTitle, originalTitle);
      titleElement.textContent = replaced;
      window.YoutubeAntiTranslate.logInfo(`Updated notification title for video ${videoId}`, { before: currentTitle, after: replaced });
    }
  }
}

/**
 * Initializes notification popup title untranslation.
 */
export function initAntiTranslateNotifications() {
  if (!window.YoutubeAntiTranslate) return;

  const notificationDropdownObserver = new MutationObserver(
    window.YoutubeAntiTranslate.debounce(() => {
      const dropdownExists = window.YoutubeAntiTranslate.querySelector(
        'ytd-popup-container tp-yt-iron-dropdown[vertical-align="top"]',
      );
      if (dropdownExists) {
        setupNotificationTitlesObserver();
      } else {
        cleanupNotificationTitlesObserver();
      }
    }),
  );

  if (document.body) {
    notificationDropdownObserver.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['style', 'class'],
    });
  }
}
