'use strict';

const ORIGINAL_TRANSLATIONS = [
  'original', 'оригинал', 'オリジナル', '原始', '원본', 'origineel',
  'original', 'originale', 'oryginał', 'původní', 'αρχικό', 'orijinal',
  '原創', 'gốc', 'asli', 'מקורי', 'أصلي', 'मूल', 'मूळ', 'ਪ੍ਰਮਾਣਿਕ',
  'అసలు', 'மூலம்', 'মূল', 'അസലി', 'ต้นฉบับ',
];

function getTrackInfo(track) {
  const defaultInfo = { isOriginal: false, language: null, isDubbed: false, isAI: false };
  if (!track || !track.id || typeof track.id !== 'string') return defaultInfo;
  const parts = track.id.split(';');
  if (parts.length < 2) return defaultInfo;
  try {
    const decoded = atob(parts[1]);
    const isOriginal = decoded.includes('original');
    const isAI = decoded.includes('dubbed-auto');
    const isDubbed = decoded.includes('dubbed') || isAI;
    const langMatch = decoded.match(/lang..([-a-zA-Z]+)/);
    const language = langMatch ? langMatch[1].toLowerCase() : null;
    return { isOriginal, language, isDubbed, isAI };
  } catch { return defaultInfo; }
}

function isOriginalTrack(track, languageFieldName) {
  if (!track) return false;
  if (languageFieldName && track[languageFieldName] && track[languageFieldName].name) {
    const trackName = track[languageFieldName].name.toLowerCase();
    for (const originalWord of ORIGINAL_TRANSLATIONS) {
      if (trackName.includes(originalWord.toLowerCase())) return true;
    }
  }
  return getTrackInfo(track).isOriginal;
}

function getOriginalTrack(tracks) {
  if (!tracks || !Array.isArray(tracks)) return null;
  let languageFieldName = null;
  for (const track of tracks) {
    if (!track || typeof track !== 'object') continue;
    for (const [fieldName, field] of Object.entries(track)) {
      if (field && typeof field === 'object' && field.name) { languageFieldName = fieldName; break; }
    }
    if (languageFieldName) break;
  }
  if (!languageFieldName) return;
  for (const track of tracks) {
    if (isOriginalTrack(track, languageFieldName)) {
      window.YoutubeAntiTranslate.logInfo(`setting original audio track with id ${track.id}`);
      return track;
    }
  }
  window.YoutubeAntiTranslate.logError(`
    The language you set YouTube to is not yet supported by YoutubeAntiTranslate.
    Please reach out to its authors on GitHub. Listing all audio tracks: ${tracks}
  `);
}

async function untranslateAudioTrack() {
  const player = window.YoutubeAntiTranslate.getFirstVisible(
    window.YoutubeAntiTranslate.querySelectorAll(
      window.YoutubeAntiTranslate.getPlayerSelector(),
    ),
  );
  if (!player || !player['getPlayerResponse'] || typeof player['getPlayerResponse'] !== 'function' ||
      !player['getAvailableAudioTracks'] || typeof player['getAvailableAudioTracks'] !== 'function' ||
      !player['getAudioTrack'] || typeof player['getAudioTrack'] !== 'function' ||
      !player['setAudioTrack'] || typeof player['setAudioTrack'] !== 'function') {
    return;
  }
  const playerResponse = await player['getPlayerResponse']();
  const tracks = await player['getAvailableAudioTracks']();
  const currentTrack = await player['getAudioTrack']();
  if (!playerResponse || !tracks || !currentTrack) return;

  if ((await window.YoutubeAntiTranslate.getSettings())?.untranslateAudioOnlyAI && !getTrackInfo(currentTrack).isAI) return;

  const currentVideoId = playerResponse.videoDetails.videoId;
  if (!currentVideoId || player['lastUntranslated'] === `${currentVideoId}+${currentTrack}`) return;

  if (await window.YoutubeAntiTranslate.isWhitelistedChannel('whiteListUntranslateAudio', null, null, playerResponse.videoDetails?.channelId)) {
    window.YoutubeAntiTranslate.logInfo('Channel is whitelisted, skipping audio dubbing untranslation');
    return;
  }

  const originalTrack = getOriginalTrack(tracks);
  if (originalTrack) {
    if (`${originalTrack}` === `${currentTrack}`) {
      if (player['lastUntranslated'] !== `${currentVideoId}+${currentTrack}`) player['lastUntranslated'] = `${currentVideoId}+${originalTrack}`;
      return;
    }
    const isAudioTrackSet = await player['setAudioTrack'](originalTrack);
    if (isAudioTrackSet) player['lastUntranslated'] = `${currentVideoId}+${originalTrack}`;
  }
}

/**
 * Initializes audio track untranslation.
 * Uses YouTube's player API to switch to the original audio track.
 * Works on both desktop and mobile.
 */
export function initAntiTranslateAudio() {
  if (!window.YoutubeAntiTranslate) return;

  const observer = new MutationObserver(
    window.YoutubeAntiTranslate.debounce(async () => {
      await untranslateAudioTrack();
    }),
  );
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['style', 'class'],
  });
}
