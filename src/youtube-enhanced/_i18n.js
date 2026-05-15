// src/youtube-enhanced/_i18n.js — Internationalization utilities
'use strict';

/**
 * Detects browser language. Returns 'de' if German, otherwise 'en'.
 * @returns {'de'|'en'}
 */
export function getLanguage() {
  const browserLang = navigator.language;
  if (browserLang && browserLang.toLowerCase().startsWith('de')) return 'de';
  return 'en';
}

const isGerman = getLanguage() === 'de';

/**
 * Localized strings for the Channel Speed panel and menu.
 * @type {{ isGerman: boolean, backToPreviousMenu: string, channelSpeed: string,
 *          decreaseSpeed: string, increaseSpeed: string, standard: string,
 *          channelSpeedLabel: string }}
 */
export const LANG = {
  isGerman: isGerman,
  backToPreviousMenu: isGerman ? 'Zurück zum vorherigen Menü' : 'Back to previous menu',
  channelSpeed: isGerman ? 'Kanalgeschwindigkeit' : 'Channel speed',
  decreaseSpeed: isGerman ? 'Kanalgeschwindigkeit reduzieren 0,05' : 'Decrease speed 0.05',
  increaseSpeed: isGerman ? 'Kanalgeschwindigkeit erhöhen 0,05' : 'Increase speed 0.05',
  standard: isGerman ? 'Normal' : 'Normal',
  channelSpeedLabel: isGerman ? 'Kanalgeschwindigkeit' : 'Channel speed'
};
