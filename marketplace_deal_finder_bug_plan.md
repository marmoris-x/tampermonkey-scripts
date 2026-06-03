# Claude Code Plan — Bug-Analyse & Fix-Plan: Marketplace Deal Finder (v31.0.21)

Stand: Juni 2026. Analyse des kompilierten `dist`-Userscripts. Quellort der zu ändernden Dateien: `src/marketplace-deal-finder/` und die Entry-Datei in `entries/`. Es wird hier auf den `dist`-Code referenziert, weil nur dieser vorlag — jeder Fix muss im **Quellmodul** vorgenommen und anschließend per `node build.mjs` neu gebaut werden.

Zwei API-Annahmen wurden gegen aktuelle Provider-Dokumentation (Juni 2026) verifiziert und sind bestätigt:

1. Anthropic: `budget_tokens` **muss strikt kleiner als** `max_tokens` sein, sonst HTTP 400 (`max_tokens must be greater than thinking.budget_tokens`).
2. Gemini REST-API: Thinking-Konfiguration erwartet **camelCase** (`thinkingConfig.thinkingBudget` / `thinkingConfig.thinkingLevel`). snake_case-Felder werden vom REST-Endpoint **stillschweigend ignoriert**.

---

## 0. Schweregrad-Übersicht

| ID | Schweregrad | Kurzbeschreibung |
|----|-------------|------------------|
| B1 | KRITISCH | `clearResults()` ist nie definiert → ReferenceError beim Klick auf „Löschen" |
| B2 | KRITISCH | Claude-Opus-4.7-Preset: `budget_tokens` (10000) > `max_tokens` (8192) → HTTP 400 |
| B3 | KRITISCH | Gemini-Thinking wird wegen snake_case-Feldnamen komplett ignoriert |
| B4 | HOCH | Abbruch (`abort`) stoppt den GM-Netzwerk-Request nicht → API-Kosten laufen weiter |
| B5 | HOCH | `fetchFullDescription` ignoriert `abortController` vollständig |
| B6 | HOCH | `init()` ruft sich bei Dauerfehler endlos selbst auf (Endlosschleife) |
| B7 | HOCH | `startDealFinder` setzt `currentProvider` nicht → Settings landen im falschen Provider-Slot |
| B8 | HOCH | `crawl_state`-JSON wächst unbegrenzt → „Message length exceeded" möglich |
| B9 | MITTEL | Doppelter `finishDealFinder`-Aufruf → falscher „Keine Deals"-Alert |
| B10 | MITTEL | Abort-Listener-Leak auf gemeinsam genutztem `AbortSignal` |
| B11 | MITTEL | UI/Modal im Light-DOM statt Closed-Shadow-DOM → API-Key durch Host-Seite lesbar |
| B12 | MITTEL | Willhaben-Pagination ohne `href` beendet Crawl nach Seite 1 |
| B13 | MITTEL | Stop-Pfad überspringt Deduplizierung → Duplikate in gespeicherten Ergebnissen |
| B14 | MITTEL | Verwaiste Description-Requests (60 s Timeout vs. 8 s Deadline) stapeln sich |
| B15 | MITTEL | Claude-Thinking setzt `temperature` explizit → potenziell inkompatibel |
| B16 | NIEDRIG | `@require` ohne SRI-Hash und ohne Versions-Pinning (main-Branch) |
| B17 | NIEDRIG | `@sandbox JavaScript` statt `@sandbox raw` (Gold-Standard-Abweichung) |
| B18 | NIEDRIG | Toter Code: `getRetryDelay`, immer-`undefined` `err.status` in Retry-Logik |
| B19 | NIEDRIG | Re-Ranking mischt KI-Preis mit Original-Titel → Datenintegrität |
| B20 | NIEDRIG | Architektur: voller Page-Reload pro Seite + scroll-basiertes Lazy-Load |
| B21 | NIEDRIG | Diverse Code-Qualität: doppelter Logger, rohes `console.log`, `innerHTML` |

---

## 1. KRITISCHE BUGS (funktionsbrechend)

### B1 — `clearResults()` ist nie definiert

**Vollständige Beschreibung:** In `makeResultsCallbacks(prefix)` wird im Callback `clearResults` die Funktion `clearResults(prefix)` aufgerufen:

```js
clearResults: async function() {
  if (!confirm("Moechtest du die gespeicherten Results wirklich loeschen?")) return;
  await clearResults(prefix);          // <-- diese Funktion existiert nicht
  setupSettingsView(S.scraper);
}
```

Im gesamten Bundle existieren `saveResults`, `loadResults`, `saveCrawlState`, `loadCrawlState` und `clearCrawlState` — aber **keine** Funktion `clearResults`. Sobald die Nutzerin in der Ergebnis-Ansicht auf „Löschen" klickt und den Bestätigungsdialog mit „OK" beantwortet, wirft die Zeile einen `ReferenceError: clearResults is not defined`. Der Promise wird abgelehnt, die Ergebnisse werden **nicht** gelöscht, und es gibt keinerlei sichtbares Feedback für die Nutzerin.

**Fundstelle:** `makeResultsCallbacks` (UI-Callbacks), Quellmodul vermutlich `ui-panel.js` oder `controller.js`.

**Auswirkung:** Der „Löschen"-Button ist komplett funktionslos und erzeugt eine stille Exception.

**Lösung:** Eine `clearResults`-Funktion analog zu `clearCrawlState` ergänzen und aufrufen:

```js
async function clearResults(storagePrefix) {
  await saveSetting(storagePrefix + "_dealfinder_results", null);
}
```

Sicherstellen, dass diese Funktion im selben Modul exportiert/importiert wird wie `loadResults`/`saveResults`.

---

### B2 — Claude-Opus-4.7-Preset erzeugt zwingend HTTP 400

**Vollständige Beschreibung:** Das Preset für Opus setzt:

```js
{ id: "claude-opus-4-7", ..., options: { thinking: { type: "enabled", budget_tokens: 1e4 } } }
```

also `budget_tokens = 10000`. Der Request-Builder verwendet jedoch als Obergrenze:

```js
const MAX_OUTPUT_TOKENS = 8192;
// ...
max_tokens: options.maxOutputTokens ?? 8192
```

Bei jedem KI-Aufruf wird `maxOutputTokens: MAX_OUTPUT_TOKENS` (= 8192) übergeben. Damit gilt `budget_tokens (10000) > max_tokens (8192)`. Verifiziert gegen die Anthropic-Dokumentation: `budget_tokens` muss strikt **kleiner** als `max_tokens` sein, andernfalls antwortet die API mit `400 invalid_request_error: max_tokens must be greater than thinking.budget_tokens`. Das Opus-Preset ist damit **garantiert unbenutzbar**. Das Sonnet-4.6-Preset (`budget_tokens: 8000`) liegt nur knapp unter 8192 und funktioniert noch, lässt aber praktisch keinen Platz für die eigentliche Antwort (192 Tokens), was zu abgeschnittenen JSON-Antworten (`stop_reason: "max_tokens"`) und damit zu Parse-Fehlern führt.

**Zusatzbefund (aktuell):** `budget_tokens` ist laut Anthropic-Doku auf Opus 4.6 und Sonnet 4.6 **deprecated** und wird in einem zukünftigen Modell entfernt. Der Thinking-Ansatz über `budget_tokens` sollte mittelfristig durch das aktuelle Verfahren ersetzt werden.

**Fundstelle:** `MODEL_PRESETS.claude`, `ClaudeProvider.buildRequest`, Konstante `MAX_OUTPUT_TOKENS`.

**Auswirkung:** Opus 4.7 wirft immer 400; Sonnet 4.6 mit Thinking liefert abgeschnittenes JSON.

**Lösung:**
- `MAX_OUTPUT_TOKENS` deutlich anheben (Claude 4 unterstützt 64k–128k Output). Vorschlag: für Claude-Provider mindestens `max_tokens = budget_tokens + Sicherheitsmarge`.
- In `ClaudeProvider.buildRequest` `max_tokens` dynamisch erzwingen, falls Thinking aktiv ist:

```js
if (isThinking && typeof opts.thinking.budget_tokens === "number") {
  const minMax = opts.thinking.budget_tokens + 4096; // Marge für die Antwort
  body.max_tokens = Math.max(body.max_tokens, minMax);
  body.thinking = opts.thinking;
}
```

- Opus-Preset-Budget realistisch wählen (z. B. `budget_tokens: 16000`) und `max_tokens` entsprechend hochsetzen (z. B. 24000). Streaming beachten: Anthropic verlangt Streaming, wenn `max_tokens > 21333`. Da das Script über `GM_xmlhttpRequest` nicht streamt, `max_tokens` ggf. unter dieser Schwelle halten.

---

### B3 — Gemini-Thinking wird stillschweigend ignoriert (snake_case)

**Vollständige Beschreibung:** `GeminiProvider.buildRequest` setzt die Thinking-Konfiguration so:

```js
if (opts.thinking_budget !== void 0) {
  body.generationConfig.thinkingConfig = { thinking_budget: opts.thinking_budget };
} else if (opts.thinking_level) {
  body.generationConfig.thinkingConfig = { thinking_level: opts.thinking_level };
}
```

Verifiziert gegen die offizielle Gemini-REST-Dokumentation: Der REST-Endpoint `generativelanguage.googleapis.com` erwartet innerhalb von `generationConfig.thinkingConfig` **camelCase**: `thinkingBudget` (für Gemini 2.5) bzw. `thinkingLevel` (für Gemini 3.x). Die snake_case-Schreibweise stammt aus dem Python-SDK und wird vom REST-Endpoint **ohne Fehler ignoriert**. Folge: Bei keinem Gemini-Preset wird die gewünschte Thinking-Stufe tatsächlich angewendet. Die Presets (`thinking_budget: -1` für dynamisches Thinking, `thinking_level: "high"` für 3.x) bleiben wirkungslos.

**Fundstelle:** `GeminiProvider.buildRequest`, `MODEL_PRESETS.gemini`.

**Auswirkung:** Thinking-Steuerung bei Gemini funktioniert überhaupt nicht; Modellverhalten weicht still von der Konfiguration ab.

**Lösung:** Auf camelCase umstellen und Preset-Keys angleichen:

```js
if (opts.thinkingBudget !== undefined) {
  body.generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget };
} else if (opts.thinkingLevel) {
  body.generationConfig.thinkingConfig = { thinkingLevel: opts.thinkingLevel };
}
```

Presets entsprechend ändern (`thinkingBudget: -1`, `thinkingLevel: "high"`). **Achtung:** `thinkingLevel` und `thinkingBudget` dürfen laut Doku **nicht gleichzeitig** gesetzt werden (sonst Fehler) — die `if/else if`-Struktur garantiert das bereits. Zusätzlich: Für Gemini-3.x-Modelle wird das explizite Setzen von `temperature` von Google nicht empfohlen — prüfen, ob `temperature: 0.1` bei 3.x weggelassen werden sollte.

---

## 2. NETZWERK- UND ABBRUCH-BUGS

### B4 — `abort()` stoppt den GM-Netzwerk-Request nicht

**Vollständige Beschreibung:** `gmRequest(params, signal)` registriert einen Abort-Handler, der das Promise mit `AbortError` ablehnt:

```js
const abortHandler = () => { reject(new DOMException("Aborted", "AbortError")); };
if (signal) signal.addEventListener("abort", abortHandler, { once: true });
try {
  GM_xmlhttpRequest(details);   // Rückgabewert wird NICHT gespeichert
} catch (err) { ... }
```

`GM_xmlhttpRequest` gibt ein Handle-Objekt mit einer `.abort()`-Methode zurück. Dieses Handle wird hier **verworfen**. Wenn `stopDealFinder` `S.abortController.abort()` aufruft, wird nur das **Promise** abgelehnt — der zugrundeliegende HTTP-Request an den KI-Anbieter läuft im Hintergrund weiter, wird vom Anbieter verarbeitet und **kostet Tokens/Geld**. Bei „Stopp" während einer laufenden, teuren Modellanfrage entstehen so unnötige Kosten.

**Fundstelle:** `gmRequest`.

**Auswirkung:** „Stopp" cancelt die Anfrage faktisch nicht; API-Kosten laufen weiter; bei vielen Stops summiert sich das.

**Lösung:** Handle speichern und im Abort-Handler tatsächlich abbrechen:

```js
let handle = null;
const abortHandler = () => {
  try { if (handle && handle.abort) handle.abort(); } catch (e) {}
  reject(new DOMException("Aborted", "AbortError"));
};
if (signal) signal.addEventListener("abort", abortHandler, { once: true });
try {
  handle = GM_xmlhttpRequest(details);
} catch (err) { ... }
```

---

### B5 — `fetchFullDescription` ignoriert den AbortController vollständig

**Vollständige Beschreibung:** `fetchFullDescription` verwendet das rohe `GM_xmlhttpRequest` ohne jeglichen Bezug zu `S.abortController`. Beim Klick auf „Stopp" werden zwar `S.shouldStop` gesetzt und der AbortController abgebrochen, aber die bereits gestarteten Beschreibungs-Requests (bis zu 8 parallel pro Batch) laufen weiter, und die rekursive Retry-Logik prüft nur `!S.shouldStop` — ein bereits in Flug befindlicher Request mit 60 s Timeout läuft trotzdem bis zum Ende.

**Fundstelle:** `fetchFullDescription`.

**Auswirkung:** Nach „Stopp" laufen Netzwerk-Requests weiter; Ressourcen-/Bandbreitenverschwendung.

**Lösung:** `signal` durchreichen und im `onload`/Retry prüfen sowie das GM-Handle für Abbruch speichern (analog B4). Mindestens: vor jedem Retry und vor `resolve` `S.shouldStop` bzw. `signal.aborted` prüfen und sofort mit `{success:false}` auflösen.

---

### B10 — Abort-Listener-Leak auf gemeinsam genutztem Signal

**Vollständige Beschreibung:** In `gmRequest` wird pro Aufruf ein `abort`-Listener am `signal` registriert (`{ once: true }`). Bei normalem Abschluss (`onload`/`onerror`/`ontimeout`) wird dieser Listener **nicht** entfernt — `{ once: true }` entfernt ihn erst, wenn das `abort`-Event tatsächlich feuert. Da über einen gesamten Crawl hinweg **dasselbe** `S.abortController.signal` an alle `callAI`-Aufrufe (inkl. aller Retries und des End-Re-Rankings) übergeben wird, sammeln sich auf einem einzigen Signal viele tote Listener an. Bei einem späteren `abort()` feuern dann alle gleichzeitig.

**Fundstelle:** `gmRequest`.

**Auswirkung:** Memory-Leak proportional zur Anzahl der Anfragen; bei `abort` redundante Mehrfach-Rejections.

**Lösung:** Listener in einem `finally` bzw. nach `resolve`/`reject` explizit entfernen:

```js
const cleanup = () => { if (signal) signal.removeEventListener("abort", abortHandler); };
// in onload/onerror/ontimeout jeweils cleanup() vor resolve/reject aufrufen
```

---

### B14 — Verwaiste Description-Requests durch Deadline-/Timeout-Diskrepanz

**Vollständige Beschreibung:** Pro Batch gilt eine harte Deadline von `8e3` (8 s):

```js
const deadline = 8e3;
await Promise.race([ Promise.all(batchFns), <8s-Timeout> ]);
```

Die einzelnen `GM_xmlhttpRequest` in `fetchFullDescription` haben jedoch `timeout: REQUEST_TIMEOUT` (= 60000 ms). Wird die 8-s-Deadline erreicht, setzt der Code `batchDeadlineReached = true`, verwirft die Ergebnisse der noch laufenden Requests (sie werden nicht in `adsData[...].description` geschrieben) und fährt fort — aber die HTTP-Requests laufen bis zu 60 s weiter. Über viele Seiten und Batches hinweg stapeln sich so verwaiste Verbindungen, deren Resultate niemand verwendet.

**Fundstelle:** `processCurrentPage` (Batch-Schleife), `fetchFullDescription`.

**Auswirkung:** Bandbreiten- und Verbindungsverschwendung; bei der Description-Phase werden Daten bezahlt/geladen, die verworfen werden.

**Lösung:** Per-Request-Timeout an die Batch-Deadline annähern (z. B. 8–10 s statt 60 s) und nach Deadline laufende Requests aktiv abbrechen (GM-Handle wie in B4). Alternativ die Description-Phase ganz an den AbortController koppeln.

---

## 3. LOGIK- UND STATE-BUGS

### B6 — `init()` ruft sich bei Dauerfehler endlos selbst auf

**Vollständige Beschreibung:** Der äußere `catch` von `init()` ruft `init()` erneut auf:

```js
async function init() {
  try { /* ... */ }
  catch (error) {
    Logger.error("Initialization error:", error);
    await new Promise(r => setTimeout(r, 3e3));
    init()["catch"](function(e) { /* nur loggen */ });
  }
}
```

`MAX_INIT_RETRIES` begrenzt nur die `waitForPage`-Schleife, **nicht** diese äußere Rekursion. Tritt im `init`-Körper ein dauerhafter Fehler auf (z. B. dauerhaft keine Suchergebnisse, DOM-Inkompatibilität), versucht sich `init` **alle 3 s endlos** neu. Es gibt keinen Abbruchzähler. Das ist zwar dank `await`/`setTimeout` kein Stack-Overflow, aber eine echte Endlosschleife mit periodischem Ressourcenverbrauch.

**Fundstelle:** `init`.

**Auswirkung:** Auf inkompatiblen Seiten dauerhafte 3-s-Schleife im Hintergrund.

**Lösung:** Retry-Zähler einführen:

```js
async function init(attempt = 0) {
  try { /* ... */ }
  catch (error) {
    if (attempt >= MAX_INIT_RETRIES) {
      Logger.error("Fatal init failure after retries:", error);
      return;
    }
    await new Promise(r => setTimeout(r, 3e3));
    return init(attempt + 1);
  }
}
```

---

### B7 — `startDealFinder` aktualisiert `currentProvider` nicht → falscher Provider-Slot

**Vollständige Beschreibung:** In `startDealFinder` wird der aus dem `<select>` gelesene `providerType` in `settings.provider.type` geschrieben, aber `settings.currentProvider` bleibt unverändert:

```js
settings.provider = { type: providerType, apiKey, modelId, baseUrl, options: settings.provider.options || {} };
// settings.currentProvider wird NICHT gesetzt
await saveSettings(prefix, settings);
```

`saveSettings` schreibt aber in `providers[currentProvider]`:

```js
toStore.providers[toStore.currentProvider] = { ...toStore.provider };
```

Wenn `providerType` (aus dem Dropdown) und `settings.currentProvider` (aus dem geladenen Settings-Objekt) **abweichen**, wird die neue Provider-Konfiguration (mit `type === providerType`) in den **falschen** Slot `providers[currentProvider]` geschrieben. Dadurch entsteht ein Slot, dessen Schlüssel nicht zu seinem `type`-Feld passt. Zwar synchronisiert der `providerChange`-Handler beide Werte beim Wechsel, aber bei Race-Conditions (Dropdown geändert, `blur`/`change` noch nicht durchgelaufen, dann „Start") ist die Inkonsistenz real.

**Zusätzlich:** `saveSettings` macht nur eine flache Kopie (`{ ...settings }`), wodurch `toStore.providers` dieselbe Referenz wie `settings.providers` ist — die Zeile `toStore.providers[...] = {...}` mutiert das Original-Settings-Objekt. Footgun, auch wenn meist auf deep-kopierten Objekten gearbeitet wird.

**Fundstelle:** `startDealFinder`, `saveSettings`.

**Auswirkung:** Mögliche Korruption des Provider-Slots; Konfiguration landet unter falschem Schlüssel.

**Lösung:**
```js
settings.currentProvider = providerType;
settings.provider = { type: providerType, apiKey, modelId, baseUrl, options: settings.provider.options || {} };
```
und in `saveSettings` die `providers` ebenfalls flach kopieren, bevor mutiert wird:
```js
const toStore = { ...settings, providers: { ...settings.providers } };
```

---

### B8 — `crawl_state`-JSON wächst unbegrenzt → „Message length exceeded"

**Vollständige Beschreibung:** Bei jeder Seitennavigation speichert `saveCrawlStateAndNavigate` den kompletten Zustand inkl. **aller** bisher gefundenen Deals samt voller Beschreibungstexte:

```js
const crawlState = { currentPage, currentUrl, allTopDeals: S.allTopDeals, maxPages };
await saveCrawlState(crawlState, S.scraper.storagePrefix);   // JSON.stringify
```

`S.allTopDeals` wächst mit jeder Seite (topX Deals × Beschreibung bis ~3000 Zeichen). Bei `maxPages` bis 100 kann das JSON mehrere MB erreichen. Laut Projekt-Standard liegt die praktische Grenze pro GM-Wert bei ~500 KB (Chrome-IPC-Message-Limit, „Message length exceeded"). Damit kann der Crawl bei großen Durchläufen still fehlschlagen — der Resume-Zustand wird nicht mehr gespeichert, und nach der Navigation ist der bisherige Fortschritt verloren.

**Fundstelle:** `saveCrawlStateAndNavigate`, `saveCrawlState`.

**Auswirkung:** Datenverlust / abgebrochener Crawl bei vielen Seiten.

**Lösung:**
- Im Crawl-State nur die zum Fortsetzen nötigen Felder speichern, Beschreibungen aus `allTopDeals` für den Zwischenstand entfernen oder kürzen.
- Für große Datenmengen auf `window.indexedDB` umsteigen (vom Projekt-Standard ausdrücklich empfohlen).
- Alternativ Deals seitenweise inkrementell in IndexedDB schreiben statt das gesamte Array bei jeder Navigation zu serialisieren.

---

### B9 — Doppelter `finishDealFinder`-Aufruf → falscher „Keine Deals"-Alert

**Vollständige Beschreibung:** `processCurrentPage` ruft am Ende selbst `finishDealFinder()` auf (bei `shouldStop`, fehlender Folgeseite oder Seitenlimit). `startDealFinder` umschließt `processCurrentPage` mit einem `try/catch`, dessen `catch` bei vorhandenen Deals erneut `finishDealFinder()` aufruft:

```js
try { await processCurrentPage(settings); }
catch (error) {
  if (S.allTopDeals.length > 0) { await finishDealFinder(); }
  else { resetUI(prefix); alert("Fehler: " + error.message); }
}
```

`finishDealFinder` setzt am Ende `S.allTopDeals = []`. Wenn `processCurrentPage` bereits intern `finishDealFinder` aufgerufen hat (Array geleert) und **danach** noch eine Exception wirft (z. B. in der Navigations-/Speicherlogik), läuft der `catch` mit `S.allTopDeals.length === 0` in den `else`-Zweig und zeigt fälschlich „Keine Top-Deals gefunden!" — obwohl gerade erfolgreich Deals gespeichert wurden.

**Fundstelle:** `startDealFinder` (catch), `processCurrentPage`, `finishDealFinder`.

**Auswirkung:** Irreführender Fehlerdialog trotz erfolgreichem Abschluss; potenziell doppelte Ergebnis-View-Umschaltung.

**Lösung:** Idempotenz über ein Flag (`S.finished`) oder klare Verantwortlichkeit: `processCurrentPage` ruft `finishDealFinder` **nicht** selbst auf, sondern signalisiert nur den Abschluss; der Aufrufer entscheidet einmalig. Mindestens: in `finishDealFinder` zu Beginn `if (S.finished) return;` setzen und Flag in `resetUI`/`startDealFinder` zurücksetzen.

---

### B12 — Willhaben-Pagination ohne `href` beendet Crawl nach Seite 1

**Vollständige Beschreibung:** `goToNextPage$1` (Willhaben) liefert nur dann eine URL zurück, wenn der „Weiter"-Button ein `href`-Attribut besitzt:

```js
if (!isDisabled && !ariaDisabled && href) { return href; }
```

Willhaben rendert die Pagination teilweise als `<button>` (JavaScript-Navigation, kein `href`) statt als `<a href>`. Findet der Code den primären Selektor `[data-testid="pagination-bottom-next-button"]`, dieser hat aber kein `href`, wird `false` zurückgegeben — der Crawl endet sofort nach der ersten Seite, obwohl weitere Seiten existieren.

**Fundstelle:** `goToNextPage$1` (Willhaben-Scraper).

**Auswirkung:** Crawl bricht auf Willhaben ggf. nach Seite 1 ab.

**Lösung:** Fallback ergänzen, der die Folgeseiten-URL aus dem aktuellen `URL`-Query (`page`-Parameter o. ä.) konstruiert, statt sich allein auf das `href` des Buttons zu verlassen. Willhaben-URL-Schema verifizieren und den `page`/`rows`-Parameter inkrementieren. Selektoren live gegen das aktuelle Willhaben-DOM prüfen (siehe B20).

---

### B13 — Stop-Pfad überspringt Deduplizierung

**Vollständige Beschreibung:** In `finishDealFinder` wird bei `S.shouldStop` früh gespeichert und zurückgekehrt — **vor** der Dedup-/Re-Ranking-Logik:

```js
if (S.shouldStop) {
  await saveResults({ deals: S.allTopDeals, ... }, prefix);
  ...
  return;
}
const deduped = deduplicateDeals(S.allTopDeals);   // wird bei Stop nie erreicht
```

Wird der Crawl gestoppt, können dieselben Anzeigen (über mehrere Seiten/Live-Rankings) mehrfach in den Ergebnissen stehen.

**Fundstelle:** `finishDealFinder`.

**Auswirkung:** Duplikate in gestoppten Ergebnissen.

**Lösung:** `deduplicateDeals(S.allTopDeals)` auch im Stop-Zweig vor dem Speichern anwenden.

---

### B15 — Claude-Thinking setzt `temperature` explizit

**Vollständige Beschreibung:** `ClaudeProvider.buildRequest` setzt bei aktivem Thinking `body.temperature = 1`:

```js
if (isThinking) { ...; body.thinking = opts.thinking; body.temperature = 1; }
```

Laut Anthropic-Dokumentation ist Extended Thinking **nicht** mit `temperature`/`top_p`/`top_k`-Modifikationen kompatibel. Das explizite Setzen von `temperature` (auch auf 1) kann je nach Modell/SDK-Version zu einem Fehler führen; sicherer ist, `temperature` bei aktivem Thinking **gar nicht** zu setzen.

**Fundstelle:** `ClaudeProvider.buildRequest`.

**Auswirkung:** Potenzieller 400-Fehler oder ignoriertes Feld bei Thinking-Anfragen.

**Lösung:** Bei aktivem Thinking `temperature` weglassen statt auf 1 zu setzen:

```js
if (isThinking && typeof opts.thinking.budget_tokens === "number") {
  body.thinking = opts.thinking;
  // KEIN body.temperature setzen
} else {
  body.temperature = options.temperature ?? 0.1;
}
```

---

## 4. SICHERHEIT

### B11 — UI/Modal im Light-DOM statt Closed-Shadow-DOM

**Vollständige Beschreibung:** Das gesamte Einstellungs-/Ergebnis-Panel (`createModal`, `renderSettingsView`, `renderResultsView`) wird als einfaches `<div>` an `document.body` gehängt und über `modal.innerHTML = ...` befüllt. Alle Eingabefelder — inklusive `#<prefix>-api-key` (Typ `password`) — liegen damit im **Light-DOM** der Host-Seite. Eine bösartige oder neugierige Host-Seite (Willhaben/Kleinanzeigen oder ein eingeschleustes Skript) kann diese Felder per `document.querySelector` auslesen und den **API-Key abgreifen**. Außerdem kann Host-CSS in das Panel „bluten". Das widerspricht dem Projekt-Gold-Standard, der für alle injizierten UIs ein `attachShadow({ mode: "closed" })` vorschreibt. (Nur der Toast nutzt korrekt Closed-Shadow-DOM.)

**Fundstelle:** `createModal`, `openModal`, `renderSettingsView`, `renderResultsView`, alle `document.getElementById`-Zugriffe.

**Auswirkung:** API-Key durch Host-Seite lesbar; CSS-Bleed; Gold-Standard-Verstoß.

**Lösung:** Panel in einen Closed-Shadow-DOM-Container verlagern; alle `getElementById`-Zugriffe auf `shadowRoot.getElementById`/`querySelector` umstellen; Styles via `GM_addElement(shadowRoot, "style", ...)` bzw. `adoptedStyleSheets` in den Shadow-Root injizieren; `:host { all: initial; contain: strict; }` als Reset. Das ist der größte strukturelle Umbau und sollte in einem eigenen Branch erfolgen.

---

### B16 — `@require` ohne SRI-Hash und ohne Versions-Pinning

**Vollständige Beschreibung:** Die Metadaten laden den Parallel-XHR-Shim ungepinnt vom `main`-Branch und ohne Integritätsprüfung:

```
// @require https://raw.githubusercontent.com/Tampermonkey/utils/refs/heads/main/requires/gh_2215_make_GM_xhr_more_parallel_again.js
```

Der Gold-Standard verlangt einen SRI-Hash (`#sha256=...`) für jede externe `@require`-URL und ein Pinning auf einen konkreten Commit. Ohne beides wird bei jeder Änderung am `main`-Branch automatisch potenziell verändeter Fremdcode mit denselben GM-Rechten wie das Script ausgeführt — ein Supply-Chain-Risiko.

**Fundstelle:** Metadatenblock.

**Auswirkung:** Supply-Chain-Risiko; keine Integritätsgarantie.

**Lösung:** Auf einen konkreten Commit-Hash pinnen und SRI ergänzen:
```
// @require https://raw.githubusercontent.com/Tampermonkey/utils/<COMMIT_SHA>/requires/gh_2215_make_GM_xhr_more_parallel_again.js#sha256=<HASH>
```

---

## 5. METADATEN / GOLD-STANDARD

### B17 — `@sandbox JavaScript` statt `@sandbox raw`

**Vollständige Beschreibung:** Das Script nutzt `@sandbox JavaScript`. Auf Chrome (Primärziel) fällt dieser Modus auf `raw` zurück, ohne Sonder-CSP-Behandlung — d. h. er verhält sich identisch zur Voreinstellung. `@sandbox JavaScript` ist primär eine Firefox-Funktion (USERSCRIPT_WORLD mit CSP-Umgehung). Da das Script GM-APIs nutzt und Chrome-primär ist, entspricht `@sandbox raw` dem Gold-Standard und ist eindeutiger.

**Fundstelle:** Metadatenblock.

**Auswirkung:** Keine Funktionsstörung, aber Gold-Standard-Abweichung und unklare Semantik.

**Lösung:** Auf `@sandbox raw` umstellen (bzw. bewusst dokumentieren, falls Firefox-CSP-Umgehung erforderlich ist).

**Weitere Metadaten-Hinweise (kein Bug, aber prüfen):**
- `@updateURL`/`@downloadURL` zeigen auf `raw.githubusercontent.com` statt auf den im Projekt-Standard vorgesehenen jsDelivr-CDN-Pfad. jsDelivr hat günstigeres Caching und ist der dokumentierte Distributionsweg.
- `@grant GM.getValue`/`GM.setValue` (Promise-APIs) sind korrekt deklariert. Das Script nutzt aber auch `GM_addElement` und `GM_xmlhttpRequest` (Callback-APIs) — beide sind deklariert, gut. Konsistenz prüfen, ob durchgängig die Promise-Variante (`GM.xmlHttpRequest`) gewünscht ist.
- `@antifeature` fehlt: Das Script sendet Anzeigendaten an Dritt-KI-Anbieter. Für GreasyFork ggf. relevant (Datenübertragung an Dritte) — prüfen, ob ein `@antifeature tracking`-/Transparenzhinweis nötig ist.

---

## 6. PERFORMANCE

### B20 — Architektur: Page-Reload pro Seite + scroll-basiertes Lazy-Load

**Vollständige Beschreibung:** Der Crawler navigiert per `window.location.href = href` zwischen den Ergebnisseiten und stellt den Zustand nach dem vollständigen Page-Reload aus dem GM-Storage wieder her. Pro Seite fallen an: `SCROLL_DELAY` (1500 ms) nach unten + 1500 ms nach oben (rein zeitbasiertes Auslösen des Lazy-Loadings), `PAGE_TRANSITION_DELAY` (1500 ms), voller Reload, erneute `init`-Initialisierung mit bis zu `MAX_INIT_RETRIES`-Wartezeiten und weiteren `setTimeout`-Verzögerungen. Bei `maxPages = 100` summiert sich das zu sehr langen Laufzeiten. Das scroll-/zeitbasierte Lazy-Load-Triggering ist zudem fragil: Wenn das Nachladen länger dauert als die festen 1500 ms, werden nicht alle Anzeigen erfasst.

**Fundstelle:** `processCurrentPage` (Scroll-/Delay-Logik), `saveCrawlStateAndNavigate`, `init`.

**Auswirkung:** Sehr langsame Crawls; unvollständige Anzeigenerfassung bei langsamem Nachladen.

**Lösung:**
- Lazy-Load nicht zeitbasiert, sondern über `MutationObserver` auf den Ergebniscontainer triggern und auf Stabilität (keine neuen Knoten mehr) warten, statt feste 1500-ms-Fenster zu nutzen.
- Description-Phase: `DOMParser` über die komplette HTML-Antwort pro Anzeige ist CPU-intensiv (B21). Stattdessen gezielt nur den relevanten Abschnitt parsen oder Regex auf den `<meta name="description">`/JSON-LD-Block anwenden.
- Architektur langfristig: Wenn die Seiten serverseitige Pagination mit stabilen URLs bieten, die Folgeseiten per `GM_xmlhttpRequest` + `DOMParser` **ohne** vollständigen Reload abrufen — das spart die teure Reinitialisierung pro Seite vollständig.

---

## 7. CODE-QUALITÄT / „ERGIBT KEINEN SINN"

### B18 — Toter Code und wirkungslose Bedingungen

**Vollständige Beschreibung:**
- `AIProvider.getRetryDelay(retryCount)` ist definiert, wird aber nirgends aufgerufen (`callAI` nutzt `calculateBackoff`). Toter Code.
- In der `callAI`-Retry-Logik prüft `!provider.isRateLimitError(err.status || 0)`. Geworfene `Error`-Objekte besitzen kein `.status`-Feld, also ist das Argument immer `0`, `isRateLimitError(0)` immer `false`, die Bedingung also konstant `true`. Die Prüfung ist faktisch wirkungslos und irreführend.

**Lösung:** `getRetryDelay` entfernen; die `err.status`-Prüfung entweder korrekt befüllen (HTTP-Status am Error-Objekt mitführen) oder entfernen.

### B19 — Re-Ranking mischt KI-Preis mit Original-Titel

**Vollständige Beschreibung:** Im globalen Re-Ranking werden Felder gemischt:

```js
return {
  title: orig && orig.title || rd.title,   // Original-Titel
  price: rd.price,                          // KI-Preis (potenziell halluziniert)
  ...
};
```

Der Titel stammt aus den Original-Scraping-Daten, der Preis dagegen aus der KI-Antwort. Halluziniert die KI einen abweichenden Preis, entsteht ein inkonsistenter Datensatz (Original-Titel + falscher Preis).

**Lösung:** Konsequent die Original-Felder bevorzugen (`price: orig && orig.price || rd.price`) und der KI im Re-Ranking nur Score/Reasoning entnehmen.

### B21 — Sonstige Code-Qualität

- **Doppelter Logger:** `Logger$1` und `Logger` werden beide als `createLogger("Marketplace Deal Finder")` angelegt — redundant. Einen entfernen.
- **Rohes `console.log`:** Die Scraper (`[MDF-WH]`, `[MDF-KA]`) und Teile der Pipeline nutzen rohes `console.log` statt `createLogger`. Projekt-Standard: über `createLogger` mit einheitlichem Prefix.
- **`innerHTML` mit Daten:** `renderSettingsView`/`renderResultsView`/`updateLiveRanking` setzen `innerHTML` mit Deal-Daten. Zwar wird über `esc()` escaped (XSS abgemildert), aber der Projekt-Standard bevorzugt `textContent`/`createElement`. Bei Migration in Shadow-DOM (B11) gleich auf DOM-Konstruktion umstellen.
- **`descriptionCache` überlebt Seitenwechsel nicht:** Da jeder Seitenwechsel ein voller Reload ist, wird die `Map` neu angelegt; seitenübergreifendes Caching greift nicht. Bei Architekturumbau (B20) automatisch gelöst.
- **`Notification.requestPermission()` bei jedem Start:** Bei jedem „Start"-Klick erneut angefragt. Einmalig prüfen (`Notification.permission`) genügt.
- **CAPTCHA-Erkennung über `body.innerText`:** `pageText.indexOf("captcha")` kann auf Seiten, die das Wort „captcha"/„challenge" im Inhalt führen, falsch-positiv auslösen. Spezifischere Indikatoren (bekannte CAPTCHA-Container/iFrames) verwenden.
- **`response_format: { type: "json_object" }`** wird für alle OpenAI-kompatiblen Provider außer Portkey-DeepSeek gesetzt. Nicht jeder OpenAI-kompatible Endpoint (insb. via OpenRouter durchgereichte Modelle) unterstützt `json_object`. Pro Modell prüfen und ggf. `skip_response_format` setzen, sonst drohen 400-Fehler.

---

## 8. Konkreter Umsetzungsplan für Claude Code

Reihenfolge nach Risiko/Nutzen. Jeder Schritt: Änderung im **Quellmodul** unter `src/marketplace-deal-finder/`, danach `node build.mjs` (Ziel: „18 built, 0 failed"), `@version` bumpen, Entry + dist im selben Commit.

**Phase 1 — Funktionsbrechende Bugs (sofort)**
1. B1: `clearResults()` definieren und korrekt aufrufen.
2. B2: `MAX_OUTPUT_TOKENS` anheben; in `ClaudeProvider.buildRequest` `max_tokens > budget_tokens` erzwingen; Opus-Preset-Budget korrigieren.
3. B3: Gemini-Thinking auf camelCase (`thinkingBudget`/`thinkingLevel`) umstellen, Presets angleichen.
4. B15: bei Claude-Thinking `temperature` weglassen.

**Phase 2 — Netzwerk/Abbruch & State (hoch)**
5. B4 + B10: GM-Handle in `gmRequest` speichern, `abort()` durchreichen, Listener cleanup.
6. B5: `fetchFullDescription` an AbortController koppeln.
7. B6: Retry-Zähler in `init()`.
8. B7: `currentProvider` in `startDealFinder` setzen; `saveSettings` flach-kopiert `providers`.
9. B8: Crawl-State verschlanken bzw. IndexedDB; Beschreibungen aus Resume-State entfernen.
10. B9: `finishDealFinder` idempotent machen.
11. B12: Willhaben-Pagination-Fallback über URL-Parameter.
12. B13: Dedup auch im Stop-Pfad.

**Phase 3 — Sicherheit & Metadaten (mittel)**
13. B11: Panel in Closed-Shadow-DOM (eigener Branch, größter Umbau; `getElementById` → `shadowRoot`).
14. B16: `@require` pinnen + SRI.
15. B17: `@sandbox raw`; `@updateURL`/`@downloadURL` auf jsDelivr; `@antifeature` prüfen.

**Phase 4 — Performance & Aufräumen (niedrig)**
16. B20: Lazy-Load über MutationObserver statt fester Delays; Description-Parsing verschlanken; ggf. Reload-freie Pagination.
17. B18/B19/B21: toten Code, doppelten Logger, `console.log`, `innerHTML`, Re-Ranking-Feldmischung, CAPTCHA-Heuristik, `response_format`-Handling.

**Begleitend (Projekt-Protokoll):**
- Vor jeder Änderung relevante `docs/`-Dateien (`Userscripts_Gold_Standards_2026.md`, `Tampermonkey_Documentation.md`, `Manifest_V3_UserScripts_Standards.md`) konsultieren und API-Stand per Websuche verifizieren (Modell-IDs, Thinking-Felder, GM-XHR-Verhalten unter MV3).
- Modell-IDs aller Provider gegen die aktuellen Anbieter-Docs prüfen, bevor Presets als „funktionierend" gelten.
- Nach jeder Phase: Build grün, `@version` bump, manueller Test auf Willhaben **und** Kleinanzeigen (Crawl-Start, Pause/Resume, CAPTCHA-Pfad, Stop, alle drei Exporte, „Löschen").