'use strict';

const DESCRIPTION_SELECTOR = '#description-inline-expander, ytd-expander#description, .expandable-video-description-body-main, .expandable-video-description-container, #collapsed-string, #expanded-string, #anchored-panel ytd-text-inline-expander';
const AUTHOR_SELECTOR = '#upload-info.ytd-video-owner-renderer, ytm-slim-owner-renderer div.slim-owner-bylines, div.cbox > a.reel-player-header-channel-endpoint.cbox';
const ATTRIBUTED_STRING_SELECTOR = 'yt-attributed-string';
const FORMATTED_STRING_SELECTOR = 'yt-formatted-string';
const SNIPPET_TEXT_SELECTOR = '#attributed-snippet-text, #formatted-snippet-text, #plain-snippet-text';
const HORIZONTAL_CHAPTERS_SELECTOR = 'ytd-horizontal-card-list-renderer, ytd-macro-markers-list-renderer, ytm-macro-markers-list-renderer, ytm-horizontal-card-list-renderer';
const CHAPTER_ITEM_SELECTOR = 'ytd-macro-markers-list-item-renderer, ytm-macro-markers-list-item-renderer';
const CHAPTER_TITLE_SELECTOR = 'h4.macro-markers, h4.problem-walkthroughs, .ytm-macro-markers-list-item-title h4';
const CHAPTER_TIME_SELECTOR = 'div#time, p.ytm-macro-markers-list-item-time, p.ytm-macro-markers-list-item-time span';
const CHAPTER_HEADER_SELECTOR = 'ytd-rich-list-header-renderer yt-formatted-string#title, h2#engagement-panel-section-list-header, .ytm-rich-list-header-title';
const CHAPTER_STYLE = `
.ytp-tooltip.ytp-bottom.ytp-preview .ytp-tooltip-title span[data-original-chapter]::after {
    content: attr(data-original-chapter);
    font-size: 12px !important;
    line-height: normal !important;
    color: inherit;
    font-family: inherit;
    display: inline !important;
}
.ytp-chapter-title-content[data-original-chapter-button] > * {
    display: none !important;
}
.ytp-chapter-title-content[data-original-chapter-button]::after {
    content: attr(title);
    font-size: var(--ytd-tab-system-font-size-body);
    line-height: var(--ytd-tab-system-line-height-body);
    font-family: var(--ytd-tab-system-font-family);
    color: inherit;
}
ytd-macro-markers-list-item-renderer h4[data-original-chapter-title] {
    visibility: hidden !important;
    position: relative;
}
ytd-macro-markers-list-item-renderer h4[data-original-chapter-title]::after {
    content: attr(data-original-chapter-title);
    visibility: visible !important;
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    color: inherit !important;
    font-size: inherit;
    line-height: inherit;
    font-family: inherit;
    font-weight: inherit;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-wrap: break-word;
    hyphens: auto;
}
`;

let chaptersObserver = null;
let chapterButtonObservers = [];
let horizontalChaptersObserver = null;
let cachedChapters = [];
let lastDescription = '';
let cachedChaptersVideoId = null;
let chaptersInitInProgress = false;

function getDescriptionNodes(root = document) {
  const context = root || document;
  const resultSet = new Set();
  for (const id of ['description-inline-expander', 'description', 'collapsed-string', 'expanded-string']) {
    const el = context.getElementById(id); if (el) resultSet.add(el);
  }
  for (const cls of ['expandable-video-description-body-main', 'expandable-video-description-container']) {
    const list = context.getElementsByClassName(cls); for (let i = 0; i < list.length; i++) resultSet.add(list[i]);
  }
  const anchored = context.getElementById('anchored-panel');
  if (anchored) { const list = anchored.getElementsByTagName('ytd-text-inline-expander'); for (let i = 0; i < list.length; i++) resultSet.add(list[i]); }
  return Array.from(resultSet);
}

function timeStringToSeconds(timeString) {
  const parts = timeString.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function parseChaptersFromDescription(description) {
  const TIMESTAMP_REGEX = /(\d{1,3}):(\d{2})(?::(\d{2}))?/;
  const TRIM_CHARS_REGEX = /^[\s–—•·▪▫‣⁃:→>-]+|[\s–—•·▪▫‣⁃:→>-]+$/g;
  const chapters = [];
  description.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const tsMatch = line.match(TIMESTAMP_REGEX);
    if (!tsMatch) return;
    const [fullTs, part1, part2, part3] = tsMatch;
    const after = line.slice(tsMatch.index + fullTs.length).trim();
    let hours = 0, minutes = 0, seconds = 0;
    if (part3 !== undefined) { hours = parseInt(part1, 10); minutes = parseInt(part2, 10); seconds = parseInt(part3, 10); }
    else { minutes = parseInt(part1, 10); seconds = parseInt(part2, 10); }
    if (seconds >= 60) return;
    if (part3 !== undefined && minutes >= 60) return;
    let title = after.length ? after : line.slice(0, tsMatch.index).trim();
    title = title.replace(TRIM_CHARS_REGEX, '').trim();
    if (title.length < 2) return;
    chapters.push({ startTime: hours * 3600 + minutes * 60 + seconds, title });
  });
  return chapters;
}

function findChapterByTime(timeInSeconds, chapters) {
  if (chapters.length === 0) return null;
  let targetChapter = chapters[0];
  for (let i = chapters.length - 1; i >= 0; i--) { if (timeInSeconds >= chapters[i].startTime) { targetChapter = chapters[i]; break; } }
  return targetChapter;
}

function getCurrentVideoId() { return window.YoutubeAntiTranslate.extractVideoIdFromUrl(document.location.href); }

function updateTooltipChapter() {
  if (cachedChapters.length === 0) return;
  const visibleTooltip = window.YoutubeAntiTranslate.querySelector('.ytp-tooltip.ytp-bottom.ytp-preview:not([style*="display: none"])');
  if (!visibleTooltip) return;
  const timeElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll('.ytp-tooltip-text, .ytp-tooltip-progress-bar-pill-time-stamp', visibleTooltip));
  const titleElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll('.ytp-tooltip-title span, .ytp-tooltip-progress-bar-pill-title', visibleTooltip));
  if (timeElement && titleElement) {
    const timeString = timeElement.textContent?.trim();
    if (timeString) { const targetChapter = findChapterByTime(timeStringToSeconds(timeString), cachedChapters); if (targetChapter) titleElement.textContent = targetChapter.title; }
  }
}

function updateStoryboardChapter() {
  if (cachedChapters.length === 0) return;
  const storyboard = window.YoutubeAntiTranslate.querySelector('.ytPlayerStoryboardHost');
  if (!storyboard) return;
  const timeElement = window.YoutubeAntiTranslate.querySelector('.ytPlayerStoryboardTimestamp', storyboard);
  const titleElement = window.YoutubeAntiTranslate.querySelector('.ytPlayerStoryboardTitle ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR, storyboard) || window.YoutubeAntiTranslate.querySelector('.ytPlayerStoryboardTitle', storyboard);
  if (!timeElement || !titleElement) return;
  const timeString = timeElement.textContent?.trim();
  if (!timeString) return;
  const targetChapter = findChapterByTime(timeStringToSeconds(timeString), cachedChapters);
  if (targetChapter && titleElement.textContent !== targetChapter.title) titleElement.textContent = targetChapter.title;
}

function getCurrentVideoTime() {
  const video = window.YoutubeAntiTranslate.querySelector('#movie_player video') || window.YoutubeAntiTranslate.querySelector('video');
  if (video && 'currentTime' in video) return Math.floor(Number(video.currentTime));
  return 0;
}

function updateDesktopChapterButton(targetChapter, currentTime) {
  const chapterButton = window.YoutubeAntiTranslate.querySelector('.ytp-chapter-title .ytp-chapter-title-content');
  if (!chapterButton) return;
  let span = window.YoutubeAntiTranslate.querySelector('span[ynt-chapter-span]', chapterButton);
  if (!span) { span = document.createElement('span'); span.setAttribute('ynt-chapter-span', 'current'); span.textContent = chapterButton.textContent; chapterButton.textContent = ''; chapterButton.appendChild(span); }
  else {
    const currentYouTubeText = Array.from(chapterButton.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join('');
    if (currentYouTubeText && currentYouTubeText.trim()) { span.textContent = currentYouTubeText; chapterButton.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) node.textContent = ''; }); }
  }
  chapterButton.setAttribute('title', targetChapter.title);
  chapterButton.setAttribute('data-original-chapter-button', targetChapter.title);
}

function updateMobileChapterButton(targetChapter, currentTime) {
  const mobileChapterButton = window.YoutubeAntiTranslate.querySelector('.ytwPlayerTimeDisplayChapterButton');
  if (!mobileChapterButton) return;
  const textContainer = window.YoutubeAntiTranslate.querySelector(window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR, mobileChapterButton) || mobileChapterButton;
  if (textContainer.textContent !== targetChapter.title) textContainer.textContent = targetChapter.title;
  mobileChapterButton.setAttribute('title', targetChapter.title);
  mobileChapterButton.setAttribute('data-original-chapter-button', targetChapter.title);
}

function updateChapterButton() {
  if (cachedChapters.length === 0) return;
  const currentTime = getCurrentVideoTime();
  const targetChapter = findChapterByTime(currentTime, cachedChapters);
  if (!targetChapter) return;
  updateDesktopChapterButton(targetChapter, currentTime);
  updateMobileChapterButton(targetChapter, currentTime);
}

function setupChapterButtonObserver() {
  const chapterButtons = window.YoutubeAntiTranslate.querySelectorAll('.ytp-chapter-title, .ytwPlayerTimeDisplayChapterButton');
  if (!chapterButtons || chapterButtons.length === 0) return;
  chapterButtonObservers = [];
  chapterButtons.forEach((chapterButton) => {
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
          if (target?.classList?.contains('ytp-chapter-title-content') || target?.closest('.ytp-chapter-title-content') || target?.classList?.contains('ytwPlayerTimeDisplayChapterButton') || target?.closest('.ytwPlayerTimeDisplayChapterButton')) shouldUpdate = true;
        }
      });
      if (shouldUpdate) setTimeout(updateChapterButton, 50);
    });
    observer.observe(chapterButton, { childList: true, subtree: true, characterData: true });
    chapterButtonObservers.push(observer);
  });
  updateChapterButton();
}

let _chapterStyleElement = null;

function cleanupChaptersObserver() {
  if (chaptersObserver) { chaptersObserver.disconnect(); chaptersObserver = null; }
  if (chapterButtonObservers.length > 0) { chapterButtonObservers.forEach((o) => o.disconnect()); chapterButtonObservers = []; }
  if (horizontalChaptersObserver) { horizontalChaptersObserver.disconnect(); horizontalChaptersObserver = null; }
  if (_chapterStyleElement) { _chapterStyleElement.remove(); _chapterStyleElement = null; }
  const style = document.getElementById('ynt-chapters-style'); if (style) style.remove();
  window.YoutubeAntiTranslate.querySelectorAll('[data-original-chapter]').forEach((el) => el.removeAttribute('data-original-chapter'));
  window.YoutubeAntiTranslate.querySelectorAll('[data-original-chapter-button]').forEach((el) => el.removeAttribute('data-original-chapter-button'));
  window.YoutubeAntiTranslate.querySelectorAll('[data-original-chapter-title]').forEach((el) => el.removeAttribute('data-original-chapter-title'));
  window.YoutubeAntiTranslate.querySelectorAll('[data-original-chapter-header]').forEach((el) => el.removeAttribute('data-original-chapter-header'));
  window.YoutubeAntiTranslate.querySelectorAll('[data-original-show-all]').forEach((el) => el.removeAttribute('data-original-show-all'));
}

function setupChapters(originalDescription, videoId = null) {
  const currentVideoId = videoId || getCurrentVideoId();
  if (originalDescription === lastDescription && (!currentVideoId || currentVideoId === cachedChaptersVideoId)) { window.YoutubeAntiTranslate.logDebug('Description unchanged, skipping chapters setup'); return; }
  cleanupChaptersObserver();
  if (originalDescription !== lastDescription) { cachedChapters = parseChaptersFromDescription(originalDescription); lastDescription = originalDescription; cachedChaptersVideoId = currentVideoId; }
  cachedChapters.sort((a, b) => a.startTime - b.startTime);
  if (cachedChapters.length === 0) { window.YoutubeAntiTranslate.logInfo('No chapters found in description'); return; }
  window.YoutubeAntiTranslate.logInfo('Found ' + cachedChapters.length + ' original chapters');
  if (!_chapterStyleElement) _chapterStyleElement = GM_addStyle(CHAPTER_STYLE);
  chaptersObserver = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.classList?.contains('ytp-tooltip') && element.classList?.contains('ytp-preview')) shouldUpdate = true;
            if (element.classList?.contains('ytPlayerStoryboardHost') || element.classList?.contains('ytPlayerStoryboardMetadata') || element.classList?.contains('ytPlayerStoryboardTitle')) shouldUpdate = true;
          }
        });
      }
      if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
        const target = mutation.target;
        if (target.classList?.contains('ytp-tooltip') && target.classList?.contains('ytp-preview') && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) shouldUpdate = true;
      }
      if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent?.classList?.contains('ytp-tooltip-text') || parent?.classList?.contains('ytPlayerStoryboardTimestamp') || parent?.classList?.contains('ytPlayerStoryboardTitle')) shouldUpdate = true;
      }
    });
    if (shouldUpdate) requestAnimationFrame(() => { updateTooltipChapter(); updateStoryboardChapter(); });
  });
  const player = document.getElementById('movie_player');
  if (player) chaptersObserver.observe(player, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
  setTimeout(() => { updateTooltipChapter(); updateStoryboardChapter(); }, 50);
  setupChapterButtonObserver();
  setupHorizontalChaptersObserver();
  window.YoutubeAntiTranslate.logInfo('Optimized chapters replacement initialized with chapter button and horizontal chapters support');
}

async function ensureChaptersInitialized() {
  const settings = await window.YoutubeAntiTranslate.getSettings();
  if (!settings.untranslateChapters) return;
  if (cachedChapters.length > 0) {
    const currentVideoId = getCurrentVideoId();
    if (currentVideoId && cachedChaptersVideoId && currentVideoId === cachedChaptersVideoId) { updateChapterButton(); updateHorizontalChapters(); updateStoryboardChapter(); return; }
    cachedChapters = []; lastDescription = ''; cachedChaptersVideoId = null; cleanupChaptersObserver();
  }
  if (chaptersInitInProgress) return;
  chaptersInitInProgress = true;
  try {
    const originalDescriptionData = await fetchOriginalDescription();
    const originalAuthor = fetchOriginalAuthor();
    if (!originalDescriptionData?.shortDescription) return;
    if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateChapters', null, null, null, originalAuthor)) { window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping video chapters untranslation'); return; }
    setupChapters(originalDescriptionData.shortDescription, originalDescriptionData.videoId);
  } finally { chaptersInitInProgress = false; }
}

async function fetchOriginalDescription() {
  const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()), false);
  const playerResponse = window.YoutubeAntiTranslate.getPlayerResponseSafely(player);
  if (!playerResponse && window.YoutubeAntiTranslate.isMobile()) {
    const mobileDescription = await getDescriptionMobile();
    if (mobileDescription) return mobileDescription;
    return null;
  }
  return {
    shortDescription: playerResponse?.['videoDetails']?.shortDescription || playerResponse?.['videoDetails']?.title || null,
    title: playerResponse?.['videoDetails']?.title || null,
    channelId: playerResponse?.['videoDetails']?.channelId || null,
    videoId: playerResponse?.['videoDetails']?.videoId || getCurrentVideoId() || null,
  };
}

function fetchOriginalAuthor() {
  const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()), false);
  const playerResponse = window.YoutubeAntiTranslate.getPlayerResponseSafely(player);
  if (!playerResponse && window.YoutubeAntiTranslate.isMobile()) { const mobileAuthor = getAuthorMobile(); if (mobileAuthor) return mobileAuthor; return null; }
  return playerResponse?.['videoDetails']?.author || null;
}

async function restoreOriginalDescriptionAndAuthor() {
  const settings = await window.YoutubeAntiTranslate.getSettings();
  const originalDescriptionData = settings.untranslateDescription || settings.untranslateChapters ? await fetchOriginalDescription() : null;
  const originalAuthor = fetchOriginalAuthor();
  const originalTitle = settings.untranslateChannelBranding ? await getTitle(document.location.href) : null;
  if (!originalDescriptionData && !originalAuthor && !originalTitle) return;
  if (originalDescriptionData.shortDescription) {
    if (settings.untranslateDescription) {
      const descriptionCandidates = getDescriptionNodes();
      const descriptionContainer = descriptionCandidates.find((el) => window.YoutubeAntiTranslate.isVisible(el, true, false, false));
      if (descriptionContainer) {
        if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateDescription', null, null, originalDescriptionData.channelId)) { window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping video description untranslation'); }
        else { updateDescriptionContent(descriptionContainer, originalDescriptionData.shortDescription); }
      } else { window.YoutubeAntiTranslate.logWarning('Video Description container not found'); }
    }
    if (settings.untranslateChapters) {
      if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateChapters', null, null, null, originalAuthor)) { window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping video chapters untranslation'); }
      else { setupChapters(originalDescriptionData.shortDescription, originalDescriptionData.videoId); }
    }
  }
  if (settings.untranslateChannelBranding && originalAuthor) await handleAuthor(originalAuthor, originalTitle);
}

async function restoreOriginalAuthorOnly() {
  const originalAuthor = fetchOriginalAuthor();
  if (!originalAuthor) return;
  await handleAuthor(originalAuthor);
}

async function handleAuthor(originalAuthor, originalTitle = null) {
  if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateChannelBranding', null, null, null, originalAuthor)) { window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping channel branding untranslation'); }
  else {
    const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()));
    if (player && player.id === 'c4-player') return;
    const authorContainers = window.YoutubeAntiTranslate.getAllVisibleNodes(window.YoutubeAntiTranslate.querySelectorAll(AUTHOR_SELECTOR));
    if (authorContainers) { for (const authorContainer of authorContainers) updateAuthorContent(authorContainer, originalAuthor); }
    else { window.YoutubeAntiTranslate.logWarning('Video Author container not found'); }
  }
  if (originalTitle) {
    const avatarStack = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll('#owner #avatar-stack'));
    if (avatarStack) await updateCollaboratorAuthors(avatarStack, originalAuthor);
    else window.YoutubeAntiTranslate.logInfo('Video Avatar Stack container not found');
  }
}

function updateDescriptionContent(container, originalText) {
  const mainTextContainer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(ATTRIBUTED_STRING_SELECTOR + ', ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ', ' + FORMATTED_STRING_SELECTOR, container));
  const snippetTextContainer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(SNIPPET_TEXT_SELECTOR, container));
  if (!mainTextContainer && !snippetTextContainer) { window.YoutubeAntiTranslate.logWarning('No video description text containers found'); return; }
  let formattedContent = null;
  const originalTextFirstLine = originalText.split('\n')[0];
  function needsUpdate(textContainer) {
    if (!textContainer || !textContainer.hasChildNodes()) return false;
    if (textContainer.firstChild.hasChildNodes() && textContainer.firstChild.firstChild.textContent === originalTextFirstLine) {
      if (!formattedContent) formattedContent = window.YoutubeAntiTranslate.createFormattedContent(originalText);
      return textContainer.firstChild.textContent !== formattedContent.textContent;
    }
    return true;
  }
  const mainNeedsUpdate = mainTextContainer ? !mainTextContainer.closest(SNIPPET_TEXT_SELECTOR) && !mainTextContainer.querySelector('#description-placeholder') && (!window.YoutubeAntiTranslate.isMobile || (window.YoutubeAntiTranslate.isDarkTheme() && !mainTextContainer.querySelector('[style="color: rgb(170, 170, 170);"]')) || (!window.YoutubeAntiTranslate.isDarkTheme() && !mainTextContainer.querySelector('[style="color: rgb(96, 96, 96);"]'))) && needsUpdate(mainTextContainer) : false;
  const snippetNeedsUpdate = snippetTextContainer ? needsUpdate(snippetTextContainer) : false;
  if (!mainNeedsUpdate && !snippetNeedsUpdate) return;
  if (!formattedContent) formattedContent = window.YoutubeAntiTranslate.createFormattedContent(originalText);
  if (mainNeedsUpdate && mainTextContainer) window.YoutubeAntiTranslate.replaceContainerContent(mainTextContainer, formattedContent.cloneNode(true));
  if (snippetNeedsUpdate && snippetTextContainer) window.YoutubeAntiTranslate.replaceContainerContent(snippetTextContainer, formattedContent.cloneNode(true));
}

function updateAuthorContent(container, originalText) {
  const singularChannelNameTitleContainer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll('#channel-name ' + FORMATTED_STRING_SELECTOR, container));
  const singularChannelNameTextContainer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll('#channel-name ' + FORMATTED_STRING_SELECTOR + ' a, #channel-name ' + ATTRIBUTED_STRING_SELECTOR + ', #channel-name ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ', .slim-owner-channel-name > ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ', .reel-player-header-channel-title > ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR, container));
  const multipleChannelNameContainers = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll('#attributed-channel-name ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ' ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_LINK_SELECTOR, container));
  if (!singularChannelNameTitleContainer && !singularChannelNameTextContainer && !multipleChannelNameContainers) { window.YoutubeAntiTranslate.logInfo('No video author text containers found'); return; }
  if (singularChannelNameTitleContainer && singularChannelNameTitleContainer.getAttribute('title') !== originalText) singularChannelNameTitleContainer.setAttribute('title', originalText);
  if (singularChannelNameTextContainer && singularChannelNameTextContainer.textContent !== originalText) { const storeStyleDisplay = singularChannelNameTextContainer.parentElement.style.display; singularChannelNameTextContainer.parentElement.style.display = 'none'; singularChannelNameTextContainer.textContent = originalText; setTimeout(() => { singularChannelNameTextContainer.parentElement.style.display = storeStyleDisplay; }, 50); }
  if (multipleChannelNameContainers) {
    const textNodes = Array.from(multipleChannelNameContainers.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
    const firstSpan = window.YoutubeAntiTranslate.querySelector("span[class='']", multipleChannelNameContainers);
    let firstSpanTextNodes;
    if (firstSpan) firstSpanTextNodes = Array.from(firstSpan.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
    if (!textNodes && !firstSpanTextNodes) return;
    if (textNodes && textNodes.length < 2 && firstSpanTextNodes && firstSpanTextNodes.length < 2) { window.YoutubeAntiTranslate.logDebug('Not enough text nodes found for this type of updateAuthorContent'); return; }
    let firstTextNode;
    if (textNodes && textNodes.length >= 2) firstTextNode = window.YoutubeAntiTranslate.getFirstTextNode(multipleChannelNameContainers);
    else if (firstSpanTextNodes && firstSpanTextNodes.length >= 2) firstTextNode = window.YoutubeAntiTranslate.getFirstTextNode(firstSpan);
    if (firstTextNode && firstTextNode.textContent !== originalText) firstTextNode.textContent = originalText;
  }
}

async function updateCollaboratorAuthors(avatarStack, originalAuthor) {
  const avatarStackImages = window.YoutubeAntiTranslate.querySelectorAll('yt-avatar-shape img', avatarStack);
  const authors = [];
  if (avatarStackImages && avatarStackImages.length > 1) {
    for (const avatarImage of avatarStackImages) {
      const imgSrc = avatarImage.src;
      if (!imgSrc || imgSrc.trim() === '') continue;
      const originalDescriptionData = await fetchOriginalDescription();
      const originalCollaborators = await window.YoutubeAntiTranslate.getOriginalCollaboratorsItemsWithYoutubeI(originalAuthor + ' ' + originalDescriptionData.title);
      const originalItem = originalCollaborators?.find((item) => item.avatarImage === avatarImage.src);
      if (!originalItem) continue;
      authors.push(originalItem.name);
    }
    if (authors.length > 0) {
      const collaboratorAuthorsOnly = authors.filter((name) => name !== originalAuthor);
      if (collaboratorAuthorsOnly && collaboratorAuthorsOnly.length === 1) {
        if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateChannelBranding', null, null, null, collaboratorAuthorsOnly[0])) { return; }
        const multipleChannelNameContainer = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll('#attributed-channel-name ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR + ' ' + window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_LINK_SELECTOR, avatarStack.closest('#owner')));
        const localizedAnd = window.YoutubeAntiTranslate.getLocalizedAnd(document.documentElement.lang);
        const textNodes = Array.from(multipleChannelNameContainer.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
        const firstSpan = window.YoutubeAntiTranslate.querySelector("span[class='']", multipleChannelNameContainer);
        let firstSpanTextNodes;
        if (firstSpan) firstSpanTextNodes = Array.from(firstSpan.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
        if (!textNodes && !firstSpanTextNodes) return;
        let includeMainAuthor = false;
        if (textNodes && textNodes.length < 2 && firstSpanTextNodes && firstSpanTextNodes.length < 2) includeMainAuthor = true;
        const untranslatedCollaboratorText = (includeMainAuthor ? originalAuthor + ' ' : '') + localizedAnd + ' ' + collaboratorAuthorsOnly[0];
        if (textNodes && textNodes.length >= 2 && multipleChannelNameContainer && !multipleChannelNameContainer.textContent.includes(untranslatedCollaboratorText)) replaceTextNodeContent(multipleChannelNameContainer, includeMainAuthor ? 0 : 1, untranslatedCollaboratorText);
        else if (firstSpanTextNodes && firstSpanTextNodes.length >= 2 && firstSpan && !firstSpan.textContent.includes(untranslatedCollaboratorText)) replaceTextNodeContent(firstSpan, includeMainAuthor ? 0 : 1, untranslatedCollaboratorText);
      }
    }
  }
}

function replaceTextNodeContent(container, textNodeIndex, newText) {
  const textNodes = Array.from(container.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
  if (textNodes.length > textNodeIndex) { const targetTextNode = textNodes[textNodeIndex]; if (targetTextNode.textContent !== newText) targetTextNode.textContent = newText; }
}

async function handleDescriptionMutation(mutations) {
  const settings = await window.YoutubeAntiTranslate.getSettings();
  if (!settings.untranslateDescription && !settings.untranslateChapters && !settings.untranslateChannelBranding) return;
  const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()), false);
  const allMutationsAreInPlayer = player && mutations && mutations.every((e) => player.contains(e.target));
  if (allMutationsAreInPlayer) { if (settings.untranslateChapters) await ensureChaptersInitialized(); return; }
  if (settings.untranslateDescription || settings.untranslateChapters || settings.untranslateChannelBranding) {
    const descriptionElement = getDescriptionNodes().find((el) => window.YoutubeAntiTranslate.isVisible(el, true, false, false));
    if (descriptionElement && player) await restoreOriginalDescriptionAndAuthor();
  }
  if (settings.untranslateChapters) await ensureChaptersInitialized();
  if (window.YoutubeAntiTranslate.isMobile() && settings.untranslateChannelBranding) {
    const authorElement = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(AUTHOR_SELECTOR));
    if (authorElement && player) restoreOriginalAuthorOnly();
  }
}

function updateHorizontalChapters() {
  const horizontalChapters = window.YoutubeAntiTranslate.querySelectorAll(HORIZONTAL_CHAPTERS_SELECTOR);
  horizontalChapters.forEach((container) => {
    const chapterItems = window.YoutubeAntiTranslate.querySelectorAll(CHAPTER_ITEM_SELECTOR, container);
    chapterItems.forEach((item) => {
      const isMobileChapterItem = item.tagName?.toLowerCase().startsWith('ytm-') || item.closest('ytm-macro-markers-list-renderer');
      const timeElement = window.YoutubeAntiTranslate.querySelector(CHAPTER_TIME_SELECTOR, item);
      const titleElements = window.YoutubeAntiTranslate.querySelectorAll(CHAPTER_TITLE_SELECTOR, item);
      if (!timeElement || titleElements.length === 0) return;
      const timeString = timeElement.textContent?.trim();
      if (!timeString) return;
      const timeInSeconds = timeStringToSeconds(timeString);
      const targetChapter = findChapterByTime(timeInSeconds, cachedChapters);
      if (targetChapter) {
        titleElements.forEach((titleElement) => {
          if (isMobileChapterItem) {
            const mobileTitleContainer = window.YoutubeAntiTranslate.querySelector(window.YoutubeAntiTranslate.CORE_ATTRIBUTED_STRING_SELECTOR, titleElement) || titleElement;
            if (mobileTitleContainer.textContent !== targetChapter.title) mobileTitleContainer.textContent = targetChapter.title;
            titleElement.setAttribute('title', targetChapter.title); return;
          }
          const currentOriginalTitle = titleElement.getAttribute('data-original-chapter-title');
          if (currentOriginalTitle !== targetChapter.title) {
            titleElement.setAttribute('data-original-chapter-title', targetChapter.title);
            titleElement.setAttribute('title', targetChapter.title);
          }
        });
      }
    });
  });
}

function setupHorizontalChaptersObserver() {
  horizontalChaptersObserver = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) { const element = node; if (element.matches?.(HORIZONTAL_CHAPTERS_SELECTOR) || element.querySelector?.(HORIZONTAL_CHAPTERS_SELECTOR)) shouldUpdate = true; }
        });
      }
      if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent?.matches?.(CHAPTER_TITLE_SELECTOR) || parent?.matches?.(CHAPTER_HEADER_SELECTOR)) shouldUpdate = true;
      }
    });
    if (shouldUpdate) setTimeout(() => { updateHorizontalChapters(); }, 100);
  });
  horizontalChaptersObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
  updateHorizontalChapters();
}

function extractVideoDataField(fieldName) {
  try {
    const pubsub = window['ytPubsubPubsubInstance'];
    if (!pubsub) return null;
    const visited = new WeakSet();
    function search(obj, depth = 0) {
      if (!obj || typeof obj !== 'object' || depth > 20 || visited.has(obj)) return null;
      visited.add(obj);
      if (obj.videoData && typeof obj.videoData[fieldName] === 'string') {
        const videoId = obj.videoData.videoId;
        const currentVideoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(document.location.href);
        if (videoId && typeof videoId === 'string' && videoId !== currentVideoId) {}
        else { return obj.videoData[fieldName]; }
      }
      const children = Array.isArray(obj) ? obj : Object.values(obj);
      for (const child of children) { const res = search(child, depth + 1); if (res) return res; }
      return null;
    }
    return search(pubsub);
  } catch (err) { window.YoutubeAntiTranslate?.logDebug?.('extractVideoDataField(' + fieldName + ') failed', err); return null; }
}

async function getTitle(url) {
  const videoId = window.YoutubeAntiTranslate.extractVideoIdFromUrl(url);
  if (!videoId) return null;
  let response = await window.YoutubeAntiTranslate.cachedRequest('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + videoId);
  if (!response || !response.response || !response.response.ok || !response.data?.title) {
    if (response?.response?.status === 401) { response = await window.YoutubeAntiTranslate.getVideoTitleFromYoutubeI(videoId); if (!response?.response?.ok || !response.data?.title) { window.YoutubeAntiTranslate.logWarning('YoutubeI title request failed for video ' + videoId); return; } }
    else { return; }
  }
  return response.data.title;
}

async function getDescriptionMobile() {
  return {
    shortDescription: extractVideoDataField('shortDescription') || (await getTitle(document.location.href)),
    title: (await getTitle(document.location.href)) || null,
    channelId: extractVideoDataField('channelId') || null,
    videoId: getCurrentVideoId() || null,
  };
}

function getAuthorMobile() { return extractVideoDataField('author'); }

function _timecodeClickHandler(event) {
  const link = event.target.closest('.yt-timecode-link');
  if (!link) return;
  event.preventDefault();
  const seconds = parseInt(link.getAttribute('data-seconds'), 10);
  if (isNaN(seconds)) return;
  const player = window.YoutubeAntiTranslate.getFirstVisible(window.YoutubeAntiTranslate.querySelectorAll(window.YoutubeAntiTranslate.getPlayerSelector()));
  if (player && typeof player['seekTo'] === 'function') { try { player['seekTo'](seconds, true); } catch (error) { window.YoutubeAntiTranslate.logWarning('Error seeking to timestamp:', error); } }
  else { window.YoutubeAntiTranslate.logInfo('Player not found or seekTo not available'); }
}

/**
 * Initializes description, chapter, and snippet untranslation.
 * Must be called after initAntiTranslateCore().
 */
export function initAntiTranslateDescription() {
  if (!window.YoutubeAntiTranslate) return;

  // Register timecode click handler
  document.addEventListener('click', _timecodeClickHandler);

  // Start MutationObserver
  const observer = new MutationObserver(window.YoutubeAntiTranslate.debounce(handleDescriptionMutation));
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['style', 'class'],
  });

  // Initialize horizontal chapters observer
  setupHorizontalChaptersObserver();
}

