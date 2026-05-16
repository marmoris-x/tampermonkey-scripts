'use strict';

// ── Language Mapping ───────────────────────────────────────────────────────────

/**
 * Maps ISO 639-1 language codes to speech recognition locales.
 * @type {Record<string, string>}
 */
export const LANG_MAP = {
  af:'af-ZA', am:'am-ET', ar:'ar-SA', az:'az-AZ', be:'be-BY',
  bg:'bg-BG', bn:'bn-BD', bs:'bs-BA', ca:'ca-ES', cs:'cs-CZ',
  cy:'cy-GB', da:'da-DK', de:'de-DE', el:'el-GR', es:'es-ES',
  et:'et-EE', eu:'eu-ES', fa:'fa-IR', fi:'fi-FI', fr:'fr-FR',
  ga:'ga-IE', gl:'gl-ES', gu:'gu-IN', he:'he-IL', hi:'hi-IN',
  hr:'hr-HR', hu:'hu-HU', hy:'hy-AM', id:'id-ID', is:'is-IS',
  it:'it-IT', ja:'ja-JP', ka:'ka-GE', kk:'kk-KZ', km:'km-KH',
  kn:'kn-IN', ko:'ko-KR', lt:'lt-LT', lv:'lv-LV', mk:'mk-MK',
  ml:'ml-IN', mn:'mn-MN', mr:'mr-IN', ms:'ms-MY', my:'my-MM',
  nb:'nb-NO', ne:'ne-NP', nl:'nl-NL', pa:'pa-IN', pl:'pl-PL',
  pt:'pt-BR', ro:'ro-RO', ru:'ru-RU', si:'si-SK', sk:'sk-SK',
  sl:'sl-SI', sq:'sq-AL', sr:'sr-RS', sv:'sv-SE', sw:'sw-KE',
  ta:'ta-IN', te:'te-IN', th:'th-TH', tl:'tl-PH', tr:'tr-TR',
  uk:'uk-UA', ur:'ur-PK', uz:'uz-UZ', vi:'vi-VN', zh:'zh-CN',
  zu:'zu-ZA'
};

/**
 * Detects the page or navigator language and maps it to a speech recognition locale.
 * Falls back to raw language tag if no mapping found.
 * @returns {string} Speech recognition locale (e.g., 'en-US' or 'de-DE')
 */
export function getLang() {
  const raw = (document.querySelector('html')?.getAttribute('lang'))
    || navigator.language
    || 'en-US';
  return LANG_MAP[raw] || raw;
}
