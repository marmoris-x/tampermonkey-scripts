'use strict';

const INTERSECTION_UPDATE_STEP_VIDEOS = 2;
let allIntersectVideoElements = null;
let intersectionObserverOtherVideos = null;

const INTERSECTION_UPDATE_STEP_SHORTS = 2;
let allIntersectShortElements = null;
let intersectionObserverOtherShorts = null;

let cachedRequest = null;

async function untranslateCurrentShortVideo() {
  const fakeNodeID = 'yt-anti-translate-fake-node-current-short-video';
  const originalNodeSelector = 'yt-shorts-video-title-view-model > h2 > span:not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'span:not(#' + fakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.location.href, 'span', true, true);
}

async function untranslateCurrentShortVideoDescriptionPanelHeader() {
  const fakeNodeID = 'yt-anti-translate-fake-node-current-short-video-description-panel-header';
  const originalNodeSelector = '#anchored-panel ytd-video-description-header-renderer > #title > yt-formatted-string:not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'span:not(#' + fakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.location.href, 'span', false);
}

function getShortUrlFromSource() {
  if (window.YoutubeAntiTranslate.isMobile()) {
    const sourceUrl = document.location.href;
    const match = sourceUrl.match(/\/source\/([^\\]+)\/shorts/);
    if (match) { const sourceVideoId = match[1]; return 'https://m.youtube.com/shorts/' + sourceVideoId; }
  }
  return document.location.href;
}

async function untranslateCurrentShortVideoEngagementPanel() {
  const fakeNodeID = 'yt-anti-translate-fake-node-current-short-video-engagement-panel';
  const originalNodeSelector = '#anchored-panel #header yt-dynamic-text-view-model > h1 > span:not(#' + fakeNodeID + '), ytm-browse yt-dynamic-text-view-model > h1 > span:not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'span:not(#' + fakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, getShortUrlFromSource, 'span', false, window.YoutubeAntiTranslate.isMobile());
}

async function untranslateCurrentShortVideoLinks() {
  const fakeNodeID = 'yt-anti-translate-fake-node-current-short-video-links';
  const originalNodeSelector = '.ytReelMultiFormatLinkViewModelEndpoint span' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + '>span:not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'span:not(#' + fakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, (el) => el?.parentElement?.parentElement?.parentElement?.href, 'span', false);
}

async function untranslateCurrentVideo() {
  if (!window.location.pathname.startsWith('/watch')) return;
  const fakeNodeID = 'yt-anti-translate-fake-node-current-video';
  const originalNodeSelector = '#title > h1 > yt-formatted-string:not(#' + fakeNodeID + '), .slim-video-information-title ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'yt-formatted-string:not(#' + fakeNodeID + '), ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + fakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.location.href, 'div', false, true);
}

async function untranslateCurrentVideoHeadLink() {
  const fakeNodeID = 'yt-anti-translate-fake-node-video-head-link';
  const originalNodeSelector = window.YoutubeAntiTranslate.getPlayerSelector() + ' a.ytp-title-link:not(#' + fakeNodeID + '), ' + window.YoutubeAntiTranslate.getPlayerSelector() + ' h2.ytPlayerOverlayVideoDetailsRendererTitle:not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'a.ytp-title-link:not(#' + fakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, (el) => { const videoLinkHead = el.href; if (!videoLinkHead || videoLinkHead.trim() === '') return document.location.href; return videoLinkHead; }, 'a', false, document.location.href.includes('youtube-nocookie.com') || document.location.href.includes('youtube.com/embed/'));
}

async function untranslateCurrentVideoFullScreenEdu() {
  if (!window.location.pathname.startsWith('/watch')) return;
  const fakeNodeID = 'yt-anti-translate-fake-node-fullscreen-edu';
  const originalNodeSelector = window.YoutubeAntiTranslate.getPlayerSelector() + ' div.ytp-fullerscreen-edu-text:not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'div.ytp-fullerscreen-edu-text:not(#' + fakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.location.href, 'div', false);
}

async function untranslateCurrentEmbeddedVideoMobileFullScreen() {
  const fakeNodeID = 'yt-anti-translate-fake-node-embedded-mobilefullscreen-title';
  const originalNodeSelector = '#player-controls a.ytmVideoInfoVideoTitle > span' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'span' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + fakeNodeID + ')';
  const authorFakeNodeID = fakeNodeID + '-author';
  const videoAuthorSelector = '#player-controls a.ytmVideoInfoChannelTitle > span' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + authorFakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.querySelector('#player-controls a.ytmVideoInfoVideoTitle')?.getAttribute('href'), 'div', false, true, videoAuthorSelector, authorFakeNodeID, 'span');
}

async function untranslateCurrentChannelEmbeddedVideoTitle() {
  const fakeNodeID = 'yt-anti-translate-fake-node-channel-embedded-title';
  const originalNodeSelector = 'div.ytd-channel-video-player-renderer #metadata-container.ytd-channel-video-player-renderer a:not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'a:not(#' + fakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, (el) => el.href, 'a', false);
}

async function untranslateCurrentMobileVideoDescriptionHeader() {
  if (!window.YoutubeAntiTranslate.isMobile()) return;
  const fakeNodeID = 'yt-anti-translate-fake-node-mobile-video-description';
  const originalNodeSelector = 'ytm-video-description-header-renderer .title > span' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'span' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + fakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => document.location.href, 'span', true);
}

async function untranslateCurrentMobileFeaturedVideoChannel() {
  if (!window.YoutubeAntiTranslate.isMobile()) return;
  const fakeNodeID = 'yt-anti-translate-fake-node-mobile-featured-video-channel';
  const originalNodeSelector = 'ytm-channel-featured-video-renderer > a > h3 > span' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = 'span' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + fakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, (el) => el.closest('a').href, 'span', false, true);
}

async function untranslateCurrentMiniPlayerVideo() {
  if (window.YoutubeAntiTranslate.isMobile()) return;
  if (!window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll('ytd-miniplayer ' + window.YoutubeAntiTranslate.getPlayerSelector()))) return;
  const fakeNodeID = 'yt-anti-translate-fake-node-mini-player-video-channel';
  const originalNodeSelector = 'ytd-miniplayer-info-bar .ytdMiniplayerInfoBarTitle ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + fakeNodeID + ')';
  const originalNodePartialSelector = window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + fakeNodeID + ')';
  const authorFakeNodeID = fakeNodeID + '-author';
  const videoAuthorSelector = 'ytd-miniplayer-info-bar .ytdMiniplayerInfoBarSubtitle ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ':not(#' + authorFakeNodeID + ')';
  await createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, () => {
    const miniPlayer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll('ytd-miniplayer ' + window.YoutubeAntiTranslate.getPlayerSelector()));
    const playerResponse = window.YoutubeAntiTranslate.getPlayerResponseSafely(miniPlayer);
    if (playerResponse && playerResponse['videoDetails'] && playerResponse['videoDetails'].videoId) return document.location.origin + '/watch?v=' + playerResponse['videoDetails'].videoId;
    return null;
  }, 'span', true, false, videoAuthorSelector, authorFakeNodeID, 'span');
}

async function createOrUpdateUntranslatedFakeNode(fakeNodeID, originalNodeSelector, originalNodePartialSelector, getUrl, createElementTag, requirePlayer = true, shouldSetDocumentTitle = false, videoAuthorSelector = null, authorFakeNodeID = null, authorCreateElementTag = null) {
  if (!requirePlayer || window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()))) {
    const settings = await window.YoutubeAntiTranslate.getSettings();
    let translatedElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(originalNodeSelector));
    if (!translatedElement || !translatedElement.textContent) translatedElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(originalNodeSelector + ':not(.cbCustomTitle)'));
    const fakeNode = window.YoutubeAntiTranslate.querySelector('#' + fakeNodeID);
    if ((!fakeNode || !fakeNode.textContent) && (!translatedElement || !translatedElement.textContent)) return;
    const getUrlForElement = window.YoutubeAntiTranslate.stripNonEssentialParams(getUrl(translatedElement ?? fakeNode));
    if (window.YoutubeAntiTranslate.isAdvertisementHref(getUrlForElement)) return;
    const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(getUrlForElement.startsWith('http') ? getUrlForElement : window.location.origin + getUrlForElement);
    if (!videoId) return;
    let response = await cachedRequest('https://www.youtube.com/oembed?url=' + getUrlForElement);
    if (!response || !response.response || !response.response.ok || !response.data?.title) {
      if (response?.response?.status === 401) {
        response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
        if (!response?.response?.ok || !response.data?.title) { window.YoutubeAntiTranslate.logWarning('YoutubeI title request failed for video ' + videoId); return; }
      } else { return; }
    }
    const realTitle = response.data.title;
    if (!realTitle || (!translatedElement && !fakeNode)) return;
    if (settings.untranslateChannelBranding && videoAuthorSelector && authorFakeNodeID && authorCreateElementTag) {
      await createOrUpdateUntranslatedFakeNodeAuthor(response.data.author_url, response.data.author_name, videoAuthorSelector, authorFakeNodeID, authorCreateElementTag);
    }
    if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateTitle', null, response.data.author_url)) { window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping video titles untranslation'); return; }
    if (settings.untranslateTitle) {
      let oldTitle = translatedElement?.textContent;
      if (!oldTitle && fakeNode) {
        const hiddenTranslatedElement = fakeNode.parentElement?.querySelector(originalNodePartialSelector);
        oldTitle = hiddenTranslatedElement?.textContent?.trim() === '' ? null : hiddenTranslatedElement?.textContent;
      }
      if (shouldSetDocumentTitle && oldTitle && window.YoutubeAntiTranslate.doesStringInclude(document.title, oldTitle)) document.title = window.YoutubeAntiTranslate.stringReplaceWithOptions(document.title, oldTitle, realTitle);
      if (fakeNode && window.YoutubeAntiTranslate.isVisible(fakeNode) && translatedElement && window.YoutubeAntiTranslate.isVisible(translatedElement)) { translatedElement['style']['visibility'] = 'hidden'; translatedElement['style']['display'] = 'none'; }
      if (window.YoutubeAntiTranslate.isStringEqual(fakeNode?.textContent, realTitle)) return;
      if (window.YoutubeAntiTranslate.isStringEqual(realTitle, oldTitle)) return;
      window.YoutubeAntiTranslate.logInfo('translated title to "' + realTitle + '" from "' + oldTitle + '"');
      if (!fakeNode && translatedElement) {
        const existingFakeNode = translatedElement.parentElement.querySelector('#' + fakeNodeID);
        const newFakeNode = document.createElement(createElementTag);
        if (translatedElement.getAttribute('href')) newFakeNode.setAttribute('href', translatedElement.getAttribute('href'));
        newFakeNode.className = translatedElement.className;
        newFakeNode.setAttribute('target', translatedElement.getAttribute('target'));
        newFakeNode.tabIndex = parseInt(translatedElement.getAttribute('tabIndex') ?? '0');
        newFakeNode['data-sessionlink'] = translatedElement['data-sessionlink'];
        newFakeNode.id = fakeNodeID;
        newFakeNode.textContent = realTitle;
        newFakeNode.setAttribute('video-id', videoId);
        if (!existingFakeNode) { newFakeNode.style.visibility = translatedElement['style']?.['visibility'] ?? 'visible'; newFakeNode.style.display = translatedElement['style']?.['display'] ?? 'block'; translatedElement.after(newFakeNode); }
        else { newFakeNode.style.visibility = existingFakeNode['style']?.['visibility'] ?? 'visible'; newFakeNode.style.display = existingFakeNode['style']?.['display'] ?? 'block'; existingFakeNode.replaceWith(newFakeNode); }
        translatedElement['style']['visibility'] = 'hidden'; translatedElement['style']['display'] = 'none';
      } else if (fakeNode) { fakeNode.textContent = realTitle; fakeNode.setAttribute('video-id', videoId); }
    }
  }
}

async function createOrUpdateUntranslatedFakeNodeAuthor(realAuthorUrl, realAuthor, videoAuthorSelector, authorFakeNodeID, authorCreateElementTag) {
  const translatedElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(videoAuthorSelector));
  const fakeNode = window.YoutubeAntiTranslate.querySelector('#' + authorFakeNodeID);
  if ((!fakeNode || !fakeNode.textContent) && (!translatedElement || !translatedElement.textContent)) return;
  if (!realAuthor || (!translatedElement && !fakeNode)) return;
  if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateChannelBranding', null, realAuthorUrl)) { window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping channel branding untranslation'); return; }
  const oldAuthor = translatedElement?.textContent || fakeNode?.textContent;
  if (fakeNode && window.YoutubeAntiTranslate.isVisible(fakeNode) && translatedElement && window.YoutubeAntiTranslate.isVisible(translatedElement)) { translatedElement['style']['visibility'] = 'hidden'; translatedElement['style']['display'] = 'none'; }
  if (window.YoutubeAntiTranslate.isStringEqual(fakeNode?.textContent, realAuthor)) return;
  window.YoutubeAntiTranslate.logInfo('translated author to "' + realAuthor + '" from "' + oldAuthor + '"');
  if (!fakeNode && translatedElement) {
    const existingFakeNode = translatedElement.parentElement.querySelector('#' + authorFakeNodeID);
    const newFakeNode = document.createElement(authorCreateElementTag);
    if (translatedElement.getAttribute('href')) newFakeNode.setAttribute('href', translatedElement.getAttribute('href'));
    newFakeNode.className = translatedElement.className;
    newFakeNode.setAttribute('target', translatedElement.getAttribute('target'));
    newFakeNode.tabIndex = parseInt(translatedElement.getAttribute('tabIndex') ?? '0');
    newFakeNode['data-sessionlink'] = translatedElement['data-sessionlink'];
    newFakeNode.id = authorFakeNodeID;
    newFakeNode.textContent = realAuthor;
    if (!existingFakeNode) { newFakeNode.style.visibility = translatedElement['style']?.['visibility'] ?? 'visible'; newFakeNode.style.display = translatedElement['style']?.['display'] ?? 'block'; translatedElement.after(newFakeNode); }
    else { newFakeNode.style.visibility = existingFakeNode['style']?.['visibility'] ?? 'visible'; newFakeNode.style.display = existingFakeNode['style']?.['display'] ?? 'block'; existingFakeNode.replaceWith(newFakeNode); }
    translatedElement['style']['visibility'] = 'hidden'; translatedElement['style']['display'] = 'none';
  } else if (fakeNode) { fakeNode.textContent = realAuthor; }
}

async function untranslateOtherVideos(intersectElements = null, mutations) {
  const player = window.YoutubeAntiTranslate.getCachedPlayer();
  const allMutationsAreInPlayer = player && mutations && mutations.every((e) => player.contains(e.target));
  if (allMutationsAreInPlayer) return;

  async function untranslateOtherVideosArray(otherVideos) {
    if (!otherVideos) return;
    const videosArray = Array.from(otherVideos);
    const settings = await window.YoutubeAntiTranslate.getSettings();
    await Promise.all(videosArray.map(async (video) => {
      if (!video) return;
      const isPlaylist = video.querySelector('a[href*="/playlist?"]') || window.YoutubeAntiTranslate.getFirstVisible(video.querySelectorAll('yt-collection-thumbnail-view-model, .media-item-thumbnail-container.stacked'));
      if (isPlaylist && !settings.untranslateThumbnail) return;
      const hrefFilter = '[href*="/watch?v="]';
      let linkElement = video.querySelector('a#video-title-link' + hrefFilter) || video.querySelector('a#thumbnail' + hrefFilter) || video.querySelector('a.media-item-thumbnail-container' + hrefFilter) || video.querySelector('div.media-item-metadata > a' + hrefFilter) || video.querySelector('ytd-playlist-panel-video-renderer a' + hrefFilter) || video.querySelector('ytm-video-card-renderer a' + hrefFilter) || video.querySelector('a.yt-lockup-metadata-view-model__title' + hrefFilter) || video.querySelector('a.ytLockupMetadataViewModelTitle' + hrefFilter) || video.querySelector('a.yt-simple-endpoint' + hrefFilter);
      if (!linkElement) {
        function isMatches(v) { return v.matches('a.ytp-videowall-still' + hrefFilter) || v.matches('a.ytp-ce-covering-overlay' + hrefFilter) || v.matches('a.ytp-suggestion-link' + hrefFilter) || v.matches('a.ytp-autonav-endscreen-link-container' + hrefFilter) || v.matches('a.autonav-endscreen-cued-video-container' + hrefFilter) || v.matches('a.ytp-modern-videowall-still' + hrefFilter); }
        if (isMatches(video)) { linkElement = video; }
        if (!linkElement) {
          linkElement = video.querySelector('ytd-thumbnail a' + hrefFilter) || video.querySelector('a' + hrefFilter);
          if (!linkElement) {
            const thumbnail = video.querySelector('img[src*="i.ytimg.com"]');
            if (thumbnail) { const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(thumbnail.src); if (videoId) { linkElement = document.createElement('a'); linkElement.href = '/watch?v=' + videoId; } }
          }
        }
        if (!linkElement) return;
      }
      if (window.YoutubeAntiTranslate.isAdvertisementHref(linkElement.href)) return;
      const videoHref = window.YoutubeAntiTranslate.stripNonEssentialParams(linkElement.href);
      const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(videoHref.startsWith('http') ? videoHref : window.location.origin + videoHref);
      if ((video.hasAttribute('data-ytat-untranslated-video-title') && video.getAttribute('data-ytat-untranslated-video-title') === videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS && video.hasAttribute('data-ytat-untranslated-video-thumbnail') && video.getAttribute('data-ytat-untranslated-video-thumbnail') === videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS && video.hasAttribute('data-ytat-untranslated-video-desc') && video.getAttribute('data-ytat-untranslated-video-desc') === videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS && video.hasAttribute('data-ytat-untranslated-video-channel-branding') && video.getAttribute('data-ytat-untranslated-video-channel-branding') === videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS) || (video.hasAttribute('data-ytat-untranslated-video-failed-attempts') && video.getAttribute('data-ytat-untranslated-video-failed-attempts') === videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS)) return;
      let titleElement = video.querySelector('#video-title:not(.cbCustomTitle)') || video.querySelector('.compact-media-item-headline ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('.YtmCompactMediaItemHeadline ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('ytd-playlist-panel-video-renderer #video-title') || video.querySelector('ytm-video-card-renderer .video-card-title ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('.media-item-headline ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('div.media-item-metadata > a > h3.media-item-headline') || video.querySelector('.yt-lockup-metadata-view-model__heading-reset ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('.ytLockupMetadataViewModelHeadingReset ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('a.ytLockupMetadataViewModelTitle ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('span.ytp-videowall-still-info-title') || video.querySelector('div.ytp-ce-video-title') || video.querySelector('div.ytp-suggestion-title') || video.querySelector('#title.ytd-structured-description-video-lockup-renderer') || video.querySelector('div.ytp-autonav-endscreen-upnext-title') || video.querySelector('div.autonav-endscreen-video-title > ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('span.ytp-modern-videowall-still-info-title');
      if (!titleElement) {
        titleElement = video.querySelector('yt-formatted-string#video-title') || video.querySelector('.yt-lockup-metadata-view-model-wiz__title>' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('.ytLockupMetadataViewModelTitle>' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('.compact-media-item-headline ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || video.querySelector('.YtmCompactMediaItemHeadline ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR);
        if (!titleElement) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-title', videoId);
      }
      const thumbnailElements = video.querySelectorAll('yt-thumbnail-view-model img:not(.ytd-moving-thumbnail-renderer), img[src*="i.ytimg.com"]:not(.ytd-moving-thumbnail-renderer):not([src*="ytimg.com/an_webp/"]), div[style*="i.ytimg.com"][style*="background-image"]');
      if (!thumbnailElements || thumbnailElements.length === 0) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-thumbnail', videoId);
      const snippetElements = video.querySelectorAll('.metadata-snippet-text, .metadata-snippet-text-navigation, #dismissible #description-text');
      if (!snippetElements || snippetElements.length === 0) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-desc', videoId);
      const authorsElement = window.YoutubeAntiTranslate.getFirstVisible(video.querySelectorAll('#channel-info yt-formatted-string > a.yt-simple-endpoint, yt-content-metadata-view-model ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ' a, .ytd-channel-name a.yt-simple-endpoint, .ytd-playlist-panel-video-renderer #byline, div.media-item-metadata .YtmBadgeAndBylineRendererHost span' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ', .YtmCompactMediaItemByline span' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR));
      if (!authorsElement) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-channel-branding', videoId);
      if (!titleElement && (!thumbnailElements || thumbnailElements.length === 0) && (!snippetElements || snippetElements.length === 0) && !authorsElement) return;
      try {
        let response = await cachedRequest('https://www.youtube.com/oembed?url=' + videoHref);
        if (!response || !response.response || !response.response.ok || !response.data?.title) {
          if (response?.response?.status === 401) {
            response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId);
            if (!response?.response?.ok || !response.data?.title) { window.YoutubeAntiTranslate.logWarning('YoutubeI title request failed for video ' + videoId); window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-failed-attempts', videoId); return; }
          } else { window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-failed-attempts', videoId); return; }
        }
        const originalTitle = response.data.title;
        const currentTitle = titleElement?.innerText?.trim() || titleElement?.textContent?.trim();
        if (!isPlaylist && settings.untranslateTitle && originalTitle && currentTitle && !window.YoutubeAntiTranslate.isStringEqual(originalTitle, currentTitle)) {
          if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateTitle', null, response.data.author_url)) { window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping video titles untranslation for:', videoId, response.data.author_url); video.setAttribute('data-ytat-untranslated-video-title', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS); }
          else { window.YoutubeAntiTranslate.logInfo('Untranslating Video: "' + currentTitle + '" -> "' + originalTitle + '"'); titleElement.innerText = originalTitle; titleElement.title = originalTitle; if (linkElement.matches('a#video-title-link:not(.cbCustomTitle)')) linkElement.title = originalTitle; video.setAttribute('data-ytat-untranslated-video-title', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS); }
        } else { window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-title', videoId); }
        const originalThumbnail = response.data.thumbnail_url;
        if (settings.untranslateThumbnail && originalThumbnail && thumbnailElements && thumbnailElements.length > 0) {
          if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateThumbnail', null, response.data.author_url)) { video.setAttribute('data-ytat-untranslated-video-thumbnail', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS); }
          else {
            for (const thumbnailElement of thumbnailElements) {
              if (thumbnailElement.closest('#mouseover-overlay')) continue;
              let imageSrc;
              if (thumbnailElement.matches("[style*='background-image']")) { const currentStyle = thumbnailElement['style']?.['backgroundImage'] || ''; imageSrc = currentStyle.match(/url\(["']?([^"']+)["']?\)/)?.[1]; }
              else { imageSrc = thumbnailElement.currentSrc || thumbnailElement.src; }
              if (!thumbnailElement || !imageSrc) continue;
              if (imageSrc.includes('https://i.ytimg.com/vi/') || imageSrc.includes('?youtube-anti-translate')) continue;
              if (!thumbnailElement.matches("[style*='background-image']") && thumbnailElement.style.width === '118%' && thumbnailElement.style.height === '118%' && thumbnailElement.style.position === 'absolute' && thumbnailElement.style.top === '50%' && thumbnailElement.style.left === '50%') { thumbnailElement.style.width = ''; thumbnailElement.style.height = ''; thumbnailElement.style.position = ''; thumbnailElement.style.top = ''; thumbnailElement.style.left = ''; thumbnailElement.style.transform = ''; }
              if (!imageSrc.includes(originalThumbnail)) {
                const { width, height } = await window.YoutubeAntiTranslate.getImageSize(imageSrc);
                if (thumbnailElement.matches("[style*='background-image']")) thumbnailElement.style.backgroundImage = 'url("' + originalThumbnail + '?youtube-anti-translate=' + Date.now() + '")';
                else thumbnailElement.src = originalThumbnail + '?youtube-anti-translate=' + Date.now();
                if (width && height) { const cropRatio = width / height; if (cropRatio) { thumbnailElement.style.aspectRatio = cropRatio; thumbnailElement.style.objectFit = 'cover'; } }
                video.setAttribute('data-ytat-untranslated-video-thumbnail', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
              }
            }
          }
        } else { window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-thumbnail', videoId); }
        if (!isPlaylist && settings.untranslateDescription && snippetElements && snippetElements.length > 0) {
          if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateDescription', null, response.data.author_url)) { video.setAttribute('data-ytat-untranslated-video-desc', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS); }
          else {
            const idMatch = videoHref.match(/[?&]v=([a-zA-Z0-9_-]+)/);
            if (idMatch && idMatch[1]) {
              const vId = idMatch[1];
              const originalDescription = await getOriginalVideoDescription(vId);
              if (originalDescription) { const truncated = trimDescriptionByWords(originalDescription); snippetElements.forEach((el) => { const currentText = el.textContent?.trim(); if (truncated && currentText && !window.YoutubeAntiTranslate.isStringEqual(currentText, truncated)) { el.textContent = truncated; if (el.hasAttribute('is-empty')) el.removeAttribute('is-empty'); video.setAttribute('data-ytat-untranslated-video-desc', vId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS); } }); }
            }
          }
        } else { window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-desc', videoId); }
        const mainAuthor = response.data.author_name;
        if (!isPlaylist && settings.untranslateChannelBranding && authorsElement && mainAuthor) {
          const authors = [];
          const avatarStacks = window.YoutubeAntiTranslate.getAllVisibleNodes(video.querySelectorAll('yt-avatar-stack-view-model yt-avatar-shape img'));
          if (avatarStacks && avatarStacks.length > 1) {
            for (const avatarImage of avatarStacks) {
              if (avatarImage instanceof HTMLImageElement === false) continue;
              const imgSrc = avatarImage.src;
              if (!imgSrc || imgSrc.trim() === '') continue;
              const originalCollaborators = await window.YoutubeAntiTranslate.getOriginalCollaboratorsItemsWithYoutubeI(mainAuthor + ' ' + originalTitle);
              const originalItem = originalCollaborators?.find((item) => item.avatarImage === avatarImage.src);
              if (!originalItem) continue;
              authors.push(originalItem.name);
            }
          }
          if (authors.length === 0 && authorsElement.textContent.includes(' ' + window.YoutubeAntiTranslate.getLocalizedAnd(document.documentElement.lang) + ' ')) {
            const originalCollaborators = await window.YoutubeAntiTranslate.getOriginalCollaboratorsItemsWithYoutubeI(mainAuthor + ' ' + originalTitle);
            const originalItems = originalCollaborators?.filter((item) => item.videoId === videoId);
            if (originalItems && originalItems.length > 0) { for (const originalItem of originalItems) authors.push(originalItem.name); }
          }
          if (authors.length > 0) {
            const collaboratorAuthorsOnly = authors.filter((name) => name !== mainAuthor);
            if (collaboratorAuthorsOnly && collaboratorAuthorsOnly.length === 1) {
              if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateChannelBranding', null, null, null, collaboratorAuthorsOnly[0])) { video.setAttribute('data-ytat-untranslated-video-channel-branding', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS); }
              else {
                const authorsTooltipElements = video.querySelectorAll('.ytd-channel-name #tooltip');
                const localizedAnd = window.YoutubeAntiTranslate.getLocalizedAnd(document.documentElement.lang);
                const untranslatedAuthorText = mainAuthor + ' ' + localizedAnd + ' ' + collaboratorAuthorsOnly[0];
                if (authorsElement && !authorsElement.textContent.includes(untranslatedAuthorText)) { authorsElement.textContent = untranslatedAuthorText; if (authorsTooltipElements && authorsTooltipElements.length > 0) { for (const el of authorsTooltipElements) el.textContent = untranslatedAuthorText; } video.setAttribute('data-ytat-untranslated-video-channel-branding', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS); }
              }
            }
          }
        } else { window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-channel-branding', videoId); }
      } catch (error) { window.YoutubeAntiTranslate.logInfo('Error processing video:', videoHref, error); window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(video, 'data-ytat-untranslated-video-failed-attempts', videoId); }
    }));
  }
  if (intersectElements) { await untranslateOtherVideosArray(intersectElements); return; }
  await untranslateOtherVideosArray(window.YoutubeAntiTranslate.getAllVisibleNodes(window.YoutubeAntiTranslate.getArraysVideos()));
}

async function untranslateOtherShortsVideos(intersectElements = null, mutations) {
  const player = window.YoutubeAntiTranslate.getCachedPlayer();
  const allMutationsAreInPlayer = player && mutations && mutations.every((e) => player.contains(e.target));
  if (allMutationsAreInPlayer) return;

  async function untranslateOtherShortsArray(shortsItems) {
    if (!shortsItems) return;
    const shortsArray = Array.from(shortsItems);
    const settings = await window.YoutubeAntiTranslate.getSettings();
    await Promise.all(shortsArray.map(async (shortElement) => {
      if (!shortElement) return;
      const isPlaylist = shortElement.querySelector('a[href*="/playlist?"]') || window.YoutubeAntiTranslate.getFirstVisible(shortElement.querySelectorAll('yt-collection-thumbnail-view-model, .media-item-thumbnail-container.stacked'));
      if (isPlaylist && !settings.untranslateThumbnail) return;
      const isShortsLikeRenderer = shortElement.matches('ytm-shorts-lockup-view-model') || !!shortElement.querySelector('a.shortsLockupViewModelHostEndpoint, .shortsLockupViewModelHostMetadataTitle, .shortsLockupViewModelHostOutsideMetadataEndpoint, ytd-reel-item-renderer');
      if (!isShortsLikeRenderer) {
        const thumbnails = shortElement.querySelectorAll('img');
        for (const thumbnailElement of thumbnails) { if (thumbnailElement.style.width === '118%' && thumbnailElement.style.height === '118%' && thumbnailElement.style.position === 'absolute' && thumbnailElement.style.top === '50%' && thumbnailElement.style.left === '50%') { thumbnailElement.style.width = ''; thumbnailElement.style.height = ''; thumbnailElement.style.position = ''; thumbnailElement.style.top = ''; thumbnailElement.style.left = ''; thumbnailElement.style.transform = ''; } }
        return;
      }
      let linkElement = shortElement.querySelector('a.shortsLockupViewModelHostEndpoint[href*="/shorts/"]') || shortElement.querySelector('a[href*="/shorts/"]');
      if (!linkElement && isShortsLikeRenderer) linkElement = shortElement.querySelector('a[href*="/watch?v="]');
      if (!linkElement || !linkElement.href) {
        if (!linkElement) { const thumbnail = shortElement.querySelector('img[src*="i.ytimg.com"]'); if (thumbnail) { const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(thumbnail.src); if (videoId) { linkElement = document.createElement('a'); linkElement.href = '/shorts/' + videoId; } } }
        if (!linkElement || !linkElement.href) return;
      }
      if (window.YoutubeAntiTranslate.isAdvertisementHref(linkElement.href)) return;
      const videoHref = linkElement.href;
      const videoIdMatch = videoHref.match(/shorts\/([a-zA-Z0-9_-]+)/) || videoHref.match(/[?&]v=([a-zA-Z0-9_-]+)/);
      if (!videoIdMatch || !videoIdMatch[1]) return;
      const videoId = videoIdMatch[1];
      if ((shortElement.hasAttribute('data-ytat-untranslated-other-title') && shortElement.getAttribute('data-ytat-untranslated-other-title') === videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS && shortElement.hasAttribute('data-ytat-untranslated-other-thumbnail') && shortElement.getAttribute('data-ytat-untranslated-other-thumbnail') === videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS) || (shortElement.hasAttribute('data-ytat-untranslated-other-failed-attempts') && shortElement.getAttribute('data-ytat-untranslated-other-failed-attempts') === videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS)) return;
      const shortTitleElement = shortElement.querySelector(window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_PRE_WRAP_SELECTOR) || shortElement.querySelector('a.shortsLockupViewModelHostOutsideMetadataEndpoint ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || shortElement.querySelector('.shortsLockupViewModelHostMetadataTitle ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || shortElement.querySelector('.ytLockupMetadataViewModelHeadingReset ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR) || shortElement.querySelector('a.ytLockupMetadataViewModelTitle ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR);
      if (!shortTitleElement) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, 'data-ytat-untranslated-other-title', videoId);
      const thumbnailElements = shortElement.querySelectorAll('img[src*="i.ytimg.com"]');
      if (!thumbnailElements || thumbnailElements.length === 0) window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, 'data-ytat-untranslated-other-thumbnail', videoId);
      if (!shortTitleElement && (!thumbnailElements || thumbnailElements.length === 0)) return;
      const oembedUrl = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + videoId;
      try {
        let response = await cachedRequest(oembedUrl);
        if (!response || !response.response || !response.response.ok || !response.data?.title) {
          if (response?.response?.status === 401) { response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId); if (!response?.response?.ok || !response.data?.title) { window.YoutubeAntiTranslate.logWarning('YoutubeI title request failed for video ' + videoId); window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, 'data-ytat-untranslated-other-failed-attempts', videoId); return; } }
          else { window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, 'data-ytat-untranslated-other-failed-attempts', videoId); return; }
        }
        if (settings.untranslateTitle || settings.untranslateThumbnail) {
          const realTitle = response.data.title;
          const currentTitle = shortTitleElement?.textContent?.trim();
          if (!isPlaylist && settings.untranslateTitle && realTitle && currentTitle && !window.YoutubeAntiTranslate.isStringEqual(realTitle, currentTitle)) {
            if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateTitle', null, response.data.author_url)) { shortElement.setAttribute('data-ytat-untranslated-other-title', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS); }
            else { shortTitleElement.textContent = realTitle; if (shortTitleElement.hasAttribute('title')) shortTitleElement.title = realTitle; const titleA = shortElement.querySelector('a.shortsLockupViewModelHostEndpoint.shortsLockupViewModelHostOutsideMetadataEndpoint'); if (titleA) titleA.title = realTitle; shortElement.setAttribute('data-ytat-untranslated-other-title', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS); }
          } else { window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, 'data-ytat-untranslated-other-title', videoId); }
          let originalThumbnail = response.data.thumbnail_url;
          if (settings.untranslateThumbnail && originalThumbnail && thumbnailElements && thumbnailElements.length > 0) {
            if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateThumbnail', null, response.data.author_url)) { shortElement.setAttribute('data-ytat-untranslated-other-thumbnail', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS); }
            else {
              for (const thumbnailElement of thumbnailElements) {
                if (!thumbnailElement || !thumbnailElement.src) continue;
                if (thumbnailElement.src.includes('https://i.ytimg.com/vi/') || thumbnailElement.src.includes('?youtube-anti-translate')) continue;
                if (linkElement.href.includes('/shorts/')) {
                  for (const maxResName of ['maxresdefault', 'oardefault']) {
                    if (!originalThumbnail.includes(maxResName)) originalThumbnail = originalThumbnail.replace(/\/([^/_]+)\.(jpg|jpeg|png|gif|webp|avif)/, '/' + maxResName + '.$2');
                    if (await window.YoutubeAntiTranslate.isFoundImageSrc(originalThumbnail)) break;
                    else originalThumbnail = response.data.thumbnail_url;
                  }
                }
                if (!thumbnailElement.src.includes(originalThumbnail)) {
                  const { width, height } = await window.YoutubeAntiTranslate.getImageSize(thumbnailElement.src);
                  thumbnailElement.src = originalThumbnail + '?youtube-anti-translate=' + Date.now();
                  if (width && height) { const cropRatio = width / height; if (cropRatio) { thumbnailElement.style.aspectRatio = cropRatio; thumbnailElement.style.objectFit = 'cover'; const { width: nw, height: nh } = await window.YoutubeAntiTranslate.getImageSize(originalThumbnail); if (nw > nh) { thumbnailElement.style.width = '118%'; thumbnailElement.style.height = '118%'; thumbnailElement.style.position = 'absolute'; thumbnailElement.style.top = '50%'; thumbnailElement.style.left = '50%'; thumbnailElement.style.transform = 'translate(-50%, -50%)'; } } }
                  shortElement.setAttribute('data-ytat-untranslated-other-thumbnail', videoId + '__' + window.YoutubeAntiTranslate.MAX_ATTEMPTS);
                }
              }
            }
          } else { window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, 'data-ytat-untranslated-other-thumbnail', videoId); }
        }
      } catch (error) { window.YoutubeAntiTranslate.logInfo('Error fetching oEmbed for other Short:', videoId, error); window.YoutubeAntiTranslate.increaseVideoAttemptAttribute(shortElement, 'data-ytat-untranslated-other-failed-attempts', videoId); }
    }));
  }
  if (intersectElements) { await untranslateOtherShortsArray(intersectElements); return; }
  await untranslateOtherShortsArray(window.YoutubeAntiTranslate.getAllVisibleNodes(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.ALL_ARRAYS_SHORTS_SELECTOR)));
}

async function untranslateCurrentPlayerBackgroundThumbnail() {
  const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()));
  if (!player) return;
  const thumbnailBackground = window.YoutubeAntiTranslate.querySelector(".ytp-cued-thumbnail-overlay-image[style*='i.ytimg.com'][style*='background-image'][style*='maxresdefault']");
  if (thumbnailBackground) {
    const currentStyle = thumbnailBackground['style']?.['backgroundImage'] || '';
    const currentImageSrc = currentStyle.match(/url\(["']?([^"']+)["']?\)/)?.[1];
    if (!currentImageSrc || currentImageSrc.includes('https://i.ytimg.com/vi/') || currentImageSrc.includes('?youtube-anti-translate')) return;
    const currentVideo = document.location.href;
    const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(currentVideo);
    if (!videoId) return;
    const oembedUrl = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + videoId;
    try {
      let response = await cachedRequest(oembedUrl);
      if (!response || !response.response || !response.response.ok || !response.data?.thumbnail_url) {
        if (response?.response?.status === 401) { response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId); if (!response?.response?.ok || !response.data?.title) { window.YoutubeAntiTranslate.logWarning('YoutubeI title request failed for video ' + videoId); return; } }
      }
      if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateThumbnail', null, response.data.author_url)) { window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping video thumbnail untranslation'); return; }
      let originalThumbnail = response.data.maxresdefault_url || response.data.thumbnail_url;
      if (originalThumbnail) {
        if (!originalThumbnail.includes('maxresdefault')) originalThumbnail = originalThumbnail.replace(/\/([^/]+)\.(jpg|jpeg|png|gif|webp|avif)/, '/maxresdefault.jpg');
        if (!(await window.YoutubeAntiTranslate.isFoundImageSrc(originalThumbnail))) originalThumbnail = response.data.maxresdefault_url || response.data.thumbnail_url;
        if (!currentStyle || !currentStyle.includes(originalThumbnail)) {
          const { width, height } = await window.YoutubeAntiTranslate.getImageSize(currentImageSrc);
          thumbnailBackground['style']['backgroundImage'] = 'url("' + originalThumbnail + '?youtube-anti-translate=' + Date.now() + '")';
          if (width && height) { const cropRatio = width / height; if (cropRatio) { thumbnailBackground['style']['aspectRatio'] = cropRatio; thumbnailBackground['style']['objectFit'] = 'cover'; } }
        }
      }
    } catch (error) { window.YoutubeAntiTranslate.logInfo('Error fetching oEmbed for current player thumbnail:', videoId, error); return; }
  }
}

async function untranslateCurrentPlaylistHeaderThumbnail() {
  if (document.location.pathname !== '/playlist') return;
  const playlistHeadersImages = window.YoutubeAntiTranslate.getAllVisibleNodes(window.YoutubeAntiTranslate.querySelectorAll('yt-page-header-renderer img[src*="i.ytimg.com"]'));
  if (!playlistHeadersImages || playlistHeadersImages.length === 0) return;
  for (const playlistHeadersImage of playlistHeadersImages) {
    const imageSrc = playlistHeadersImage.getAttribute('src');
    if (!imageSrc || imageSrc.trim() === '') continue;
    if (imageSrc.includes('https://i.ytimg.com/vi/') || imageSrc.includes('?youtube-anti-translate')) continue;
    const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(imageSrc);
    if (!videoId) return;
    const oembedUrl = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + videoId;
    try {
      let response = await cachedRequest(oembedUrl);
      if (!response || !response.response || !response.response.ok || !response.data?.thumbnail_url) {
        if (response?.response?.status === 401) { response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId); if (!response?.response?.ok || !response.data?.title) { window.YoutubeAntiTranslate.logWarning('YoutubeI title request failed for video ' + videoId); return; } }
      }
      if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateThumbnail', null, response.data.author_url)) { window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping video thumbnail untranslation'); continue; }
      if (response.data.thumbnail_url && !imageSrc.includes(response.data.thumbnail_url)) {
        const { width, height } = await window.YoutubeAntiTranslate.getImageSize(imageSrc);
        playlistHeadersImage.setAttribute('src', response.data.thumbnail_url + '?youtube-anti-translate=' + Date.now());
        if (width && height) { const cropRatio = width / height; if (cropRatio) { playlistHeadersImage['style']['aspectRatio'] = cropRatio; playlistHeadersImage['style']['objectFit'] = 'cover'; } }
      }
    } catch (error) { window.YoutubeAntiTranslate.logInfo('Error fetching oEmbed for current playlist header thumbnail:', videoId, error); return; }
  }
}

async function untranslateCurrentVideoPreviewThumbnail() {
  const videoPreview = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll('#video-preview-container a.ytd-video-preview'));
  if (!videoPreview) return;
  const thumbnailElements = window.YoutubeAntiTranslate.getAllVisibleNodes(videoPreview.querySelectorAll('img[src*="i.ytimg.com"]'));
  let thumbnailNeedsUpdate = false;
  if (thumbnailElements && thumbnailElements.length > 0) {
    for (const thumbnailElement of thumbnailElements) {
      if (!thumbnailElement || !thumbnailElement.getAttribute('src')) continue;
      const currentImageSrc = thumbnailElement.getAttribute('src');
      if (currentImageSrc.includes('https://i.ytimg.com/vi/') || currentImageSrc.includes('?youtube-anti-translate')) continue;
      thumbnailNeedsUpdate = true; break;
    }
    if (!thumbnailNeedsUpdate) return;
    const currentVideoHref = videoPreview.getAttribute('href');
    if (!currentVideoHref || currentVideoHref.trim() === '') return;
    const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(currentVideoHref);
    if (!videoId) return;
    const oembedUrl = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + videoId;
    try {
      let response = await cachedRequest(oembedUrl);
      if (!response || !response.response || !response.response.ok || !response.data?.thumbnail_url) {
        if (response?.response?.status === 401) { response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId); if (!response?.response?.ok || !response.data?.title) { window.YoutubeAntiTranslate.logWarning('YoutubeI title request failed for video ' + videoId); return; } }
      }
      if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateThumbnail', null, response.data.author_url)) { window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping video thumbnail untranslation'); return; }
      const originalThumbnail = response.data.thumbnail_url;
      for (const thumbnailElement of thumbnailElements) {
        if (!thumbnailElement.getAttribute('src').includes(originalThumbnail)) {
          const { width, height } = await window.YoutubeAntiTranslate.getImageSize(thumbnailElement.getAttribute('src'));
          thumbnailElement.setAttribute('src', originalThumbnail + '?youtube-anti-translate=' + Date.now());
          if (width && height) { const cropRatio = width / height; if (cropRatio) { thumbnailElement['style']['aspectRatio'] = cropRatio; thumbnailElement['style']['objectFit'] = 'cover'; } }
        }
      }
    } catch (error) { window.YoutubeAntiTranslate.logInfo('Error fetching oEmbed for current player thumbnail:', videoId, error); return; }
  }
}

async function untranslate(mutations) {
  const settings = await window.YoutubeAntiTranslate.getSettings();
  await Promise.all([
    settings.untranslateTitle ? untranslateCurrentVideo() : Promise.resolve(),
    settings.untranslateTitle ? untranslateCurrentVideoHeadLink() : Promise.resolve(),
    settings.untranslateTitle ? untranslateCurrentVideoFullScreenEdu() : Promise.resolve(),
    settings.untranslateTitle ? untranslateCurrentChannelEmbeddedVideoTitle() : Promise.resolve(),
    settings.untranslateTitle || settings.untranslateDescription || settings.untranslateChannelBranding || settings.untranslateThumbnail ? untranslateOtherVideos(undefined, mutations) : Promise.resolve(),
    settings.untranslateTitle ? untranslateCurrentShortVideo() : Promise.resolve(),
    settings.untranslateTitle ? untranslateCurrentShortVideoEngagementPanel() : Promise.resolve(),
    settings.untranslateTitle ? untranslateCurrentShortVideoDescriptionPanelHeader() : Promise.resolve(),
    settings.untranslateTitle ? untranslateCurrentShortVideoLinks() : Promise.resolve(),
    settings.untranslateTitle || settings.untranslateThumbnail ? untranslateOtherShortsVideos() : Promise.resolve(),
    settings.untranslateTitle ? untranslateCurrentMobileVideoDescriptionHeader() : Promise.resolve(),
    settings.untranslateTitle ? untranslateCurrentMobileFeaturedVideoChannel() : Promise.resolve(),
    settings.untranslateTitle || settings.untranslateChannelBranding ? untranslateCurrentEmbeddedVideoMobileFullScreen() : Promise.resolve(),
    settings.untranslateThumbnail ? untranslateCurrentPlayerBackgroundThumbnail() : Promise.resolve(),
    settings.untranslateThumbnail ? untranslateCurrentPlaylistHeaderThumbnail() : Promise.resolve(),
    settings.untranslateTitle ? untranslateCurrentMiniPlayerVideo() : Promise.resolve(),
    settings.untranslateThumbnail ? untranslateCurrentVideoPreviewThumbnail() : Promise.resolve(),
  ]);
  if (settings.untranslateTitle || settings.untranslateDescription || settings.untranslateChannelBranding || settings.untranslateThumbnail) updateObserverOtherVideosOnIntersect(mutations);
  if (settings.untranslateTitle || settings.untranslateThumbnail) updateObserverOtherShortsOnIntersect();
}

let mutationIdxVideos = 0;
async function untranslateOtherVideosOnIntersect(entries) {
  if (mutationIdxVideos % INTERSECTION_UPDATE_STEP_VIDEOS === 0) {
    if (!entries) return;
    const intersectElements = [];
    for (const entry of entries) { if (entry.isIntersecting) intersectElements.push(entry.target); }
    await untranslateOtherVideos(intersectElements);
    updateObserverOtherVideosOnIntersect();
  }
  mutationIdxVideos++;
}

function updateObserverOtherVideosOnIntersect(mutations) {
  const player = window.YoutubeAntiTranslate.getCachedPlayer();
  const allMutationsAreInPlayer = player && mutations && mutations.every((e) => player.contains(e.target));
  if (allMutationsAreInPlayer) return;
  for (const el of allIntersectVideoElements ?? []) intersectionObserverOtherVideos.unobserve(el);
  allIntersectVideoElements = window.YoutubeAntiTranslate.getAllVisibleNodesOutsideViewport(window.YoutubeAntiTranslate.getArraysVideos(), true);
  for (const el of allIntersectVideoElements ?? []) intersectionObserverOtherVideos.observe(el);
}

let mutationIdxShorts = 0;
async function untranslateOtherShortsOnIntersect(entries) {
  if (mutationIdxShorts % INTERSECTION_UPDATE_STEP_SHORTS === 0) {
    if (!entries) return;
    const intersectElements = [];
    for (const entry of entries) { if (entry.isIntersecting) intersectElements.push(entry.target); }
    await untranslateOtherShortsVideos(intersectElements);
    updateObserverOtherShortsOnIntersect();
  }
  mutationIdxShorts++;
}

function updateObserverOtherShortsOnIntersect() {
  for (const el of allIntersectShortElements ?? []) intersectionObserverOtherShorts.unobserve(el);
  allIntersectShortElements = window.YoutubeAntiTranslate.getAllVisibleNodesOutsideViewport(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.ALL_ARRAYS_SHORTS_SELECTOR), true);
  for (const el of allIntersectShortElements ?? []) intersectionObserverOtherShorts.observe(el);
}

async function getOriginalVideoDescription(videoId) {
  const body = {
    context: { client: { clientName: window.YoutubeAntiTranslate.isMobile() ? 'MWEB' : 'WEB', clientVersion: '2.20250527.00.00' } },
    videoId,
  };
  const response = await cachedRequest('https://' + (window.YoutubeAntiTranslate.isMobile() ? 'm' : 'www') + '.youtube.com/youtubei/v1/player?prettyPrint=false', JSON.stringify(body), await window.YoutubeAntiTranslate.getYoutubeIHeadersWithCredentials(), false, 'videoDetails.shortDescription');
  return response?.cachedWithDotNotation || response?.data?.videoDetails?.shortDescription || null;
}

function trimDescriptionByWords(description) {
  if (!description) return '';
  let text = description || '';
  text = text.replace(/\s+/g, ' ').trim();
  const MAX_LEN = 128;
  if (text.length <= MAX_LEN) return text;
  const words = text.split(' ');
  let truncated = '';
  const suffix = '\xa0...';
  for (const word of words) {
    const testString = truncated + (truncated ? ' ' : '') + word;
    truncated = testString;
    if (testString.length + suffix.length > MAX_LEN) break;
  }
  if (truncated.length < text.length) truncated += suffix;
  return truncated;
}

/**
 * Initializes the title/thumbnail untranslation engine.
 * Call after initAntiTranslateCore().
 */
export function initAntiTranslateTitles() {
  if (!window.YoutubeAntiTranslate) {
    window.YoutubeAntiTranslate?.logError('initAntiTranslateTitles: core not ready');
    return;
  }

  cachedRequest = window.YoutubeAntiTranslate.cachedRequest.bind(window.YoutubeAntiTranslate);

  intersectionObserverOtherVideos = new IntersectionObserver(untranslateOtherVideosOnIntersect, {
    root: null,
    rootMargin: (window.YoutubeAntiTranslate.VIEWPORT_EXTENSION_PERCENTAGE_FRACTION * 100) + '%',
    threshold: 0,
  });
  intersectionObserverOtherShorts = new IntersectionObserver(untranslateOtherShortsOnIntersect, {
    root: null,
    rootMargin: (window.YoutubeAntiTranslate.VIEWPORT_EXTENSION_PERCENTAGE_FRACTION * 100) + '%',
    threshold: 0,
  });

  const observer = new MutationObserver(window.YoutubeAntiTranslate.debounce(untranslate));
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['style', 'class'],
  });

  updateObserverOtherVideosOnIntersect();
  updateObserverOtherShortsOnIntersect();
}

/** Call on yt-navigate-finish to reset state for new page */
export function resetAntiTranslateTitles() {
  if (intersectionObserverOtherVideos) {
    for (const el of allIntersectVideoElements ?? []) intersectionObserverOtherVideos.unobserve(el);
  }
  if (intersectionObserverOtherShorts) {
    for (const el of allIntersectShortElements ?? []) intersectionObserverOtherShorts.unobserve(el);
  }
  allIntersectVideoElements = null;
  allIntersectShortElements = null;
}
