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

## Settings Menu Items (German locale)

1. Anmerkungen
2. Untertitel (6)
3. Ruhemodus-Timer
4. Wiedergabegeschwindigkeit ← matches SPEED_TERMS "geschwindigkeit"
5. Qualität

## Notes

- All selectors confirmed working. No DOM changes detected.
- Consent dialog appears on first visit — must be dismissed.
- Settings menu items only appear after clicking `.ytp-settings-button`.
- Speed term "geschwindigkeit" matches German "Wiedergabegeschwindigkeit" via matchAnyTerm.
