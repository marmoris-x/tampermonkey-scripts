/**
 * @fileoverview Centralized CSS selectors, attribute names, and tag patterns
 * used throughout the Reddit Content Unlocker. Single source of truth —
 * if Reddit changes their DOM, only this file needs updating.
 *
 * @module _selectors
 */

/** Selectors for elements to be removed entirely */
export const SELECTORS = {
  // Modals and dialogs
  FACEPLATE_MODAL_BLOCKING: 'faceplate-modal[blocking]',
  FACEPLATE_MODAL_ID: 'faceplate-modal#blocking-modal',
  FACEPLATE_DIALOG_NSFW: 'faceplate-dialog[id*="nsfw"]',
  FACEPLATE_DIALOG_QR: 'faceplate-dialog[id*="qr"]',
  FACEPLATE_DIALOG_NSFW_QR: 'faceplate-dialog#nsfw-qr-dialog',

  // NSFW blocking containers
  XPROMPO_NSFW_VIEW_APP: 'xpromo-nsfw-blocking-container a[slot="view-in-app-button"]',
  VIEW_IN_APP_BUTTON: '[slot="view-in-app-button"]',

  // Blur overlays
  DIV_PROMPT: 'div.prompt',
  THUMBNAIL_SHADOW: 'div.thumbnail-shadow',
  BG_MEDIA_BACKGROUND: '.bg-media-background',

  // Backdrop filter fixed overlays
  BACKDROP_FILTER_FIXED: '[style*="backdrop-filter"]',

  // Color scrim elements
  COLOR_SCRIM: '[style*="color-scrim"]',

  // Reddit app root
  REDDIT_APP: 'shreddit-app',

  // Blurred containers
  SHREDDIT_BLURRED_CONTAINER: 'shreddit-blurred-container',
  SHREDDIT_ASYNC_LOADER: 'shreddit-async-loader',

  // Blurred slots inside aspect-ratio containers
  ASPECT_RATIO_BLURRED: 'shreddit-aspect-ratio [slot="blurred"]',

  // Image selectors
  BLURRED_IMAGES: 'img:not([data-unblurred])',
  IMAGES_WITH_BLUR_SRC: 'img[src*="blur="]:not([data-unblurred])',
  IMAGES_WITH_BLUR_STYLE: 'img[style*="blur"]:not([data-unblurred])',

  // Menu anchor points (tried in order)
  HEADER_NAV_V2: 'header.v2 > nav',
  HEADER_NAV: 'header nav',
  HEADER: 'header'
};

/** Attribute names */
export const ATTRS = {
  DATA_UNBLURRED: 'data-unblurred',
  IS_NSFW_BLOCKED: 'is-nsfw-blocked',
  BLURRED: 'blurred',
  CLICKED: 'clicked',
  REASON: 'reason',
  BUNDLENAME: 'bundlename',
  OPEN: 'open',
  SLOT: 'slot'
};

/** Slot names */
export const SLOTS = {
  BLURRED: 'blurred',
  REVEALED: 'revealed'
};

/** CSS class names for opacity */
export const OPACITY_CLASSES = ['opacity-30', 'opacity-50'];

/** URL patterns for image cleaning */
export const URL_PATTERNS = {
  BLUR_PARAM: /[?&]blur=\d+/g,
  FORMAT_PJPG: /[?&]format=pjpg/g,
  DOUBLE_AMPERSAND: /&&/g,
  QUESTION_AMPERSAND: /\?&/
};

/** Inline style patterns */
export const STYLE_PATTERNS = {
  BLUR_FILTER: /filter:\s*blur\([^)]+\)/g
};

/** Shadow DOM style IDs */
export const SHADOW_STYLE_IDS = {
  U_REVEAL: 'u-reveal',
  UNBLUR_CSS: 'unblur-css'
};

/** Bundlename patterns for NSFW async loaders */
export const BUNDLE_PATTERNS = {
  NSFW: 'nsfw'
};
