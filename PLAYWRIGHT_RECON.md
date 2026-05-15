# Playwright Reconnaissance — YouTube Enhanced (2026-05-16)

## Watch Page (`/watch?v=dQw4w9WgXcQ`)

| Selector | Status | Count |
|----------|--------|-------|
| `.html5-main-video` | ✅ FOUND | 1 |
| `#upload-info #channel-name #text a` | ✅ FOUND | 1 |
| `.ytp-settings-menu` | ✅ FOUND | 1 |
| `.ytp-settings-button` | ✅ FOUND | 1 |
| `.ytp-panel` | ✅ FOUND | 1 |
| `.ytp-menuitem` | ✅ FOUND | 5 |
| `.ytp-menuitem-label` | ✅ FOUND | 5 |
| `ytd-player` | ✅ FOUND | 2 |
| `a[href*="/@"]` | ✅ FOUND | 1+ |
| `a[href*="/channel/"]` | ✅ FOUND | 1+ |

## Settings Menu Items (German locale)

1. Anmerkungen
2. Untertitel (6)
3. Ruhemodus-Timer
4. Wiedergabegeschwindigkeit ← matches SPEED_TERMS "geschwindigkeit"
5. Qualität

## Shorts Page (`/shorts/qswSBJqm_s0`)

| Selector | Status | Notes |
|----------|--------|-------|
| `.html5-main-video` | ✅ FOUND | Present on shorts |
| `ytd-player` | ✅ FOUND | Present on shorts |
| `ytd-reel-player-header-renderer` | ❌ NOT FOUND | YouTube no longer uses this element |
| `ytd-reel-player-header-renderer #channel-name a` | ❌ NOT FOUND | Superseded by new Shorts DOM |
| `a[href*="/@"]` | ✅ FOUND | **Fallback works** — channel-speed.js uses this as 3rd fallback |
| `a[href*="/channel/"]` | ✅ FOUND | 4th fallback in getChannelId() |
| `.ytp-settings-button` | ✅ FOUND | Present on shorts |
| `.ytp-settings-menu` | ✅ FOUND | Present on shorts |

**Note:** `ytd-reel-player-header-renderer` no longer exists in YouTube's Shorts DOM.
The `getChannelId()` fallback chain still works correctly via `a[href*="/@"]`.

## Channel Page (`/@YouTube`)

| Selector | Status |
|----------|--------|
| `.html5-main-video` | ✅ FOUND |
| `ytd-player` | ✅ FOUND |
| `a[href*="/@"]` | ✅ FOUND |
| `a[href*="/channel/"]` | ✅ FOUND |
| `.ytp-settings-button` | ✅ FOUND |

## Notes

- All critical selectors confirmed working across Watch, Shorts, and Channel pages.
- `ytd-reel-player-header-renderer` is no longer part of Shorts DOM — fallback selectors handle this.
- Consent dialog appears on first visit — must be dismissed.
- Settings menu items only appear after clicking `.ytp-settings-button`.
- Speed term "geschwindigkeit" matches German "Wiedergabegeschwindigkeit" via matchAnyTerm.
