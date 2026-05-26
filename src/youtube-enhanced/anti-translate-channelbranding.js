'use strict';

const CHANNELBRANDING_HEADER_SELECTOR =
  '#page-header-container #page-header .page-header-view-model-wiz__page-header-headline-info, .page-header-view-model-wiz__page-header-headline-info, .page-header-view-model__page-header-headline-info, .yt-page-header-view-model__page-header-headline-info, .ytPageHeaderViewModelHeadlineInfo, .ytPageHeaderViewModelHeadline, #page-header';
const CHANNELBRANDING_ABOUT_SELECTOR =
  'ytd-engagement-panel-section-list-renderer, ytm-engagement-panel-section-list-renderer';
const CHANNEL_LOCATION_REGEXES = [
  /:\/\/(?:www\.|m\.)?youtube\.com\/channel\//,
  /:\/\/(?:www\.|m\.)?youtube\.com\/c\//,
  /:\/\/(?:www\.|m\.)?youtube\.com\/@/,
  /:\/\/(?:www\.|m\.)?youtube\.com\/user\//,
];

function getChannelFilter() {
  if (window.location.pathname.startsWith('/channel/')) {
    const match = window.location.pathname.match(/\/channel\/([^/?]+)/);
    return match ? `id=${match[1]}` : null;
  }
  if (window.location.pathname.startsWith('/c/')) {
    const match = window.location.pathname.match(/\/c\/([^/?]+)/);
    return match ? `forHandle=${match[1]}` : null;
  } else if (window.location.pathname.startsWith('/@')) {
    const match = window.location.pathname.match(/\/(@[^/?]+)/);
    return match ? `forHandle=${match[1]}` : null;
  } else if (window.location.pathname.startsWith('/user/')) {
    const match = window.location.pathname.match(/\/user\/([^/?]+)/);
    return match ? `forUsername=${match[1]}` : null;
  }
}

/**
 * YouTube Data API v3 call — always returns null since no API key is available in TM.
 * Falls back to InnerTube-based getChannelBrandingWithYoutubeI.
 */
async function getChannelBrandingWithYoutubeDataAPI() {
  const channelFilter = getChannelFilter();
  if (!channelFilter) { window.YoutubeAntiTranslate.logInfo('Channel ID not found'); return null; }
  window.YoutubeAntiTranslate.logInfo('Missing YOUTUBE_API_KEY is not set — skipping Data API');
  return null;
}

async function restoreOriginalBrandingHeader() {
  if (window.YoutubeAntiTranslate.getFirstVisible(document.querySelectorAll(CHANNELBRANDING_HEADER_SELECTOR))) {
    let originalBrandingData = await getChannelBrandingWithYoutubeDataAPI();
    if (!originalBrandingData) {
      originalBrandingData = await window.YoutubeAntiTranslate.getChannelBrandingWithYoutubeI();
    }
    if (!originalBrandingData) { window.YoutubeAntiTranslate.logWarning('No original branding data found'); }
    else if (!originalBrandingData.title && !originalBrandingData.description) { window.YoutubeAntiTranslate.logWarning('No original branding data found for title and description'); }
    else {
      const brandingHeaderContainer = window.YoutubeAntiTranslate.getFirstVisible(document.querySelectorAll(CHANNELBRANDING_HEADER_SELECTOR));
      if (brandingHeaderContainer) {
        updateBrandingHeaderTitleContent(brandingHeaderContainer, originalBrandingData);
        updateBrandingHeaderDescriptionContent(brandingHeaderContainer, originalBrandingData);
      } else { window.YoutubeAntiTranslate.logWarning('Channel Branding Header container not found'); }
    }
  }
}

function updateBrandingHeaderTitleContent(container, originalBrandingData) {
  if (originalBrandingData['title']) {
    const titleTextContainer = container.querySelector(`h1 ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}`);
    if (!titleTextContainer) { window.YoutubeAntiTranslate.logInfo('No branding header title text containers found'); }
    else {
      const cachedOldTitle = window.YoutubeAntiTranslate.getSessionCache(`pageTitle_${document.location.href}`);
      if (cachedOldTitle && document.title.includes(cachedOldTitle)) {
        const normalizedDocumentTitle = window.YoutubeAntiTranslate.normalizeSpaces(document.title);
        const normalizedOldTitle = window.YoutubeAntiTranslate.normalizeSpaces(cachedOldTitle);
        const normalizeRealTitle = window.YoutubeAntiTranslate.normalizeSpaces(originalBrandingData['title']);
        const realDocumentTitle = normalizedDocumentTitle.replace(normalizedOldTitle, normalizeRealTitle);
        if (normalizedDocumentTitle !== realDocumentTitle) document.title = realDocumentTitle;
      }
      if (titleTextContainer.textContent !== originalBrandingData['title']) {
        window.YoutubeAntiTranslate.setSessionCache(`pageTitle_${document.location.href}`, titleTextContainer.textContent);
        window.YoutubeAntiTranslate.replaceTextOnly(titleTextContainer, originalBrandingData['title']);
      }
    }
  }
}

function updateBrandingHeaderDescriptionContent(container, originalBrandingData) {
  if (originalBrandingData['description']) {
    const selector = `yt-description-preview-view-model .yt-truncated-text__truncated-text-content > ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}:nth-child(1),
    yt-description-preview-view-model .truncated-text-wiz__truncated-text-content > ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}:nth-child(1),
    yt-description-preview-view-model truncated-text.ytTruncatedTextHost truncated-text-content.ytTruncatedTextTruncatedTextContent:not(.ytTruncatedTextHiddenTextContent) > ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}:nth-child(1)`;
    let descriptionTextContainer = container.querySelector(selector);
    if (!descriptionTextContainer) descriptionTextContainer = window.YoutubeAntiTranslate.getFirstVisible(document.querySelectorAll(selector));
    if (!descriptionTextContainer) { window.YoutubeAntiTranslate.logInfo('No branding header description text containers found'); }
    else {
      const truncatedDescription = originalBrandingData['truncatedDescription'] || originalBrandingData['description'].split('\n')[0];
      if (descriptionTextContainer.textContent?.trim() !== truncatedDescription?.trim()) {
        const storeStyleDisplay = descriptionTextContainer.parentElement.style.display;
        descriptionTextContainer.parentElement.style.display = 'none';
        window.YoutubeAntiTranslate.replaceTextOnly(descriptionTextContainer, truncatedDescription);
        setTimeout(() => { descriptionTextContainer.parentElement.style.display = storeStyleDisplay; }, 50);
      }
    }
  }
}

async function restoreOriginalBrandingAbout() {
  if (window.YoutubeAntiTranslate.getFirstVisible(document.querySelectorAll(CHANNELBRANDING_ABOUT_SELECTOR))) {
    let originalBrandingData = await getChannelBrandingWithYoutubeDataAPI();
    if (!originalBrandingData) originalBrandingData = await window.YoutubeAntiTranslate.getChannelBrandingWithYoutubeI();
    if (!originalBrandingData) { window.YoutubeAntiTranslate.logWarning('No original branding data found'); }
    else if (!originalBrandingData.title && !originalBrandingData.description) { window.YoutubeAntiTranslate.logWarning('No original branding data found for title and description'); }
    else {
      const aboutContainer = window.YoutubeAntiTranslate.getAllVisibleNodes(document.querySelectorAll(CHANNELBRANDING_ABOUT_SELECTOR));
      if (aboutContainer && aboutContainer.length > 0) {
        aboutContainer.forEach((element) => {
          updateBrandingAboutDescriptionContent(element, originalBrandingData);
          updateBrandingAboutTitleContent(element, originalBrandingData);
        });
      } else { window.YoutubeAntiTranslate.logInfo('Channel About container not found'); }
    }
  }
}

function updateBrandingAboutTitleContent(container, originalBrandingData) {
  if (!originalBrandingData['title']) return;
  let titleTextContainer = container.querySelector('#title-text');
  if (!titleTextContainer) titleTextContainer = container.querySelector(`.engagement-panel-section-list-header-title span${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}`);
  if (!titleTextContainer) { window.YoutubeAntiTranslate.logInfo('No branding about title text containers found'); return; }
  if (titleTextContainer.textContent !== originalBrandingData['title']) window.YoutubeAntiTranslate.replaceTextOnly(titleTextContainer, originalBrandingData['title']);
}

function updateBrandingAboutDescriptionContent(container, originalBrandingData) {
  if (!originalBrandingData['description']) return;
  let descriptionTextContainer = container.querySelector(`#description-container > ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}:nth-child(1), #description-container ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}`);
  if (!descriptionTextContainer) descriptionTextContainer = container.querySelector(`.user-text > ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}`);
  if (!descriptionTextContainer) { window.YoutubeAntiTranslate.logInfo('No branding about description text containers found'); return; }
  let formattedContent;
  const originalTextFirstLine = originalBrandingData['truncatedDescription'] || originalBrandingData['description'].split('\n')[0];
  if (descriptionTextContainer.hasChildNodes() && descriptionTextContainer.firstChild && (descriptionTextContainer.firstChild.firstChild || descriptionTextContainer.firstChild).textContent?.trim() === originalTextFirstLine?.trim()) {
    formattedContent = window.YoutubeAntiTranslate.createFormattedContent(originalBrandingData['description']);
    if (descriptionTextContainer.hasChildNodes() && descriptionTextContainer.firstChild.textContent !== formattedContent.textContent) window.YoutubeAntiTranslate.replaceContainerContent(descriptionTextContainer, formattedContent.cloneNode(true));
  } else {
    formattedContent = window.YoutubeAntiTranslate.createFormattedContent(originalBrandingData['description']);
    window.YoutubeAntiTranslate.replaceContainerContent(descriptionTextContainer, formattedContent.cloneNode(true));
  }
}

async function untranslateBranding() {
  const url = document.location.href;
  const isChannelPage = CHANNEL_LOCATION_REGEXES.some((regex) => regex.test(url));
  if (isChannelPage) {
    if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateChannelBranding', null, document.location.href)) {
      window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping channel branding untranslation');
    } else {
      await Promise.all([
        restoreOriginalBrandingHeader(),
        restoreOriginalBrandingAbout(),
        restoreCollaboratorsDialog(),
        restoreOriginalBrandingChannelRenderers(),
      ]);
    }
  } else {
    await Promise.all([restoreOriginalBrandingChannelRenderers(), restoreCollaboratorsDialog()]);
  }
}

function updateChannelRendererDescriptionContent(container, originalBrandingData) {
  if (!originalBrandingData?.description) return;
  const descriptionTextContainer = container.querySelector('#info yt-formatted-string#description, yt-formatted-string#description, #description');
  if (!descriptionTextContainer) { window.YoutubeAntiTranslate.logDebug('No search result description container found'); return; }
  const truncatedDescription = originalBrandingData.description;
  if (descriptionTextContainer.textContent?.trim() !== truncatedDescription?.trim()) descriptionTextContainer.textContent = truncatedDescription;
}

function updateChannelRendererAuthor(container, originalBrandingData) {
  if (!originalBrandingData?.title) return;
  const authorTextContainer = container.querySelector(
    '#info ytd-channel-name#channel-title #text, #channel-title yt-formatted-string#text, #channel-title yt-formatted-string, #channel-info #title, #endpoint yt-formatted-string.title, h4.compact-media-item-headline > ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ', h4.YtmCompactMediaItemHeadline > ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR,
  );
  if (!authorTextContainer) { window.YoutubeAntiTranslate.logDebug('No search result channel author container found'); return; }
  if (authorTextContainer.textContent !== originalBrandingData.title) authorTextContainer.textContent = originalBrandingData.title;
}

async function restoreOriginalBrandingChannelRenderers() {
  const channelRenderers = window.YoutubeAntiTranslate.getAllVisibleNodes(
    document.querySelectorAll('ytd-channel-renderer, ytd-grid-channel-renderer, ytm-compact-channel-renderer, ytd-guide-entry-renderer'),
    false, 20,
  );
  if (!channelRenderers || channelRenderers.length === 0) return;
  const tasks = channelRenderers.map(async (renderer) => {
    const linkElement = renderer.querySelector('a.channel-link') || renderer.querySelector('a#main-link') ||
      renderer.querySelector('a.compact-media-item-image') || renderer.querySelector('a#channel-info') ||
      renderer.querySelector('a.YtmCompactMediaItemImage') || renderer.querySelector('a.compact-media-item-metadata-content') ||
      renderer.querySelector('a.YtmCompactMediaItemMetadataContent') || renderer.querySelector('a[href*="/channel/"]') ||
      renderer.querySelector('a[href*="/c/"]') || renderer.querySelector('a[href*="/@"]') || renderer.querySelector('a[href*="/user/"]');
    if (!linkElement) return;
    const href = linkElement.getAttribute('href');
    if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateChannelBranding', null, href)) {
      window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping channel branding untranslation');
      return;
    }
    const ucid = await window.YoutubeAntiTranslate.getChannelUCIDFromHref(href);
    if (!ucid) return;
    const originalBrandingData = await window.YoutubeAntiTranslate.getChannelBrandingWithYoutubeI(ucid);
    if (!originalBrandingData) return;
    updateChannelRendererDescriptionContent(renderer, originalBrandingData);
    updateChannelRendererAuthor(renderer, originalBrandingData);
  });
  await Promise.allSettled(tasks);
}

async function restoreCollaboratorsDialog() {
  const dialog = window.YoutubeAntiTranslate.getFirstVisible(document.querySelectorAll('yt-dialog-view-model'));
  if (!dialog) return;
  const listItems = dialog.querySelectorAll('yt-list-item-view-model .yt-list-item-view-model__label');
  if (!listItems || listItems.length === 0) return;
  const tasks = Array.from(listItems).map(async (item) => {
    if (item.getAttribute('data-ytat-collab-untranslated') === document.location.href) return;
    let linkEl = item.querySelector(`.yt-list-item-view-model__text-wrapper ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_LINK_SELECTOR}`) ||
      item.querySelector(window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_LINK_SELECTOR);
    if (!linkEl) {
      const channelInfoEl = item.querySelector(`.yt-list-item-view-model__text-wrapper > span${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR}`);
      const channelNameEl = item.querySelector(`.yt-list-item-view-model__title-wrapper ${window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR} > span > span`);
      if (channelInfoEl) {
        const handleMatch = channelInfoEl.textContent.match(/^[ -ₙ]{0,3}(@[^  -ₙ]+)/);
        if (handleMatch) {
          const handle = handleMatch[1];
          const href = `https://www.youtube.com/${handle.trim()}`;
          if (channelNameEl) { channelNameEl.setAttribute('href', href); linkEl = channelNameEl; }
          else { const a = document.createElement('a'); a.href = href; linkEl = a; }
        }
      }
      if (!linkEl && !channelNameEl && document.location.pathname.startsWith('/results') && document.location.search.includes('search_query=')) {
        const search_query = new URLSearchParams(document.location.search).get('search_query');
        const originalItems = await window.YoutubeAntiTranslate.getOriginalCollaboratorsItemsWithYoutubeI(search_query);
        const nameEl = item.parentElement.querySelector('yt-avatar-shape img');
        const imgSrc = nameEl?.getAttribute('src') || null;
        if (!imgSrc) return;
        const originalItem = originalItems?.find((item) => item.avatarImage === imgSrc);
        if (!originalItem?.name || !channelNameEl) return;
        if (!window.YoutubeAntiTranslate.isStringEqual(channelNameEl.textContent?.trim(), originalItem.name)) {
          if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateChannelBranding', null, null, null, originalItem.name)) { return; }
          window.YoutubeAntiTranslate.replaceTextOnly(channelNameEl, originalItem.name);
        }
        return;
      }
      if (!linkEl) return;
    }
    const href = linkEl.getAttribute('href');
    if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateChannelBranding', null, href)) { return; }
    const ucid = await window.YoutubeAntiTranslate.getChannelUCIDFromHref(href);
    if (!ucid) return;
    const branding = await window.YoutubeAntiTranslate.getChannelBrandingWithYoutubeI(ucid);
    if (!branding || !branding.title) return;
    if (!window.YoutubeAntiTranslate.isStringEqual(linkEl.textContent?.trim(), branding.title)) window.YoutubeAntiTranslate.replaceTextOnly(linkEl, branding.title);
    item.setAttribute('data-ytat-collab-untranslated', document.location.href);
  });
  await Promise.allSettled(tasks);
}

/**
 * Initializes channel branding untranslation.
 * Only active on channel pages (/@handle, /channel/UCxxx, etc.).
 */
export function initAntiTranslateChannelBranding() {
  if (!window.YoutubeAntiTranslate) return;

  const isChannelPage = CHANNEL_LOCATION_REGEXES.some((re) => re.test(window.location.href));
  if (!isChannelPage) {
    // Still run for channel renderers in search results / sidebar
    const observerNonChannel = new MutationObserver(
      window.YoutubeAntiTranslate.debounce(untranslateBranding),
    );
    observerNonChannel.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['style', 'class'],
    });
    return;
  }

  const observer = new MutationObserver(
    window.YoutubeAntiTranslate.debounce(untranslateBranding),
  );
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['style', 'class'],
  });
}
