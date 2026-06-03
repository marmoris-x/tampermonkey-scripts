markdown

# Claude Code Plan — Marketplace Deal Finder v31.0.18
## Bug Identification, Root Cause Analysis & Fix Instructions

---

## Übersicht der gefundenen Bugs

|
#
|
 Severity 
|
 Datei 
|
 Titel 
|
 Status 
|
|
---
|
----------
|
-------
|
-------
|
--------
|
|
 1 
|
 🔴 Critical 
|
`_crawler.js`
 + 
`_ui-progress.js`
|
 Live Top-Deals zeigt alte Seite als #1 wegen unkalibrierter Per-Page-Scores 
|
 Reported 
|
|
 2 
|
 🔴 Critical 
|
`_crawler.js`
 + 
`_ui-settings.js`
|
 Finales Re-Ranking: 
`sortDealsByScore`
 entfernt, Array-Reihenfolge ist undeterministisch 
|
 Reported 
|
|
 3 
|
 🟠 High 
|
`_crawler.js`
|
 ClaudeProvider: 
`thinking: { type: 'adaptive' }`
 ist kein gültiger Anthropic API-Wert → 400 Error 
|
**
Neu
**
|
|
 4 
|
 🟠 High 
|
`_crawler.js`
|
 Captcha-Resume ignoriert 
`maxPages`
 aus gespeichertem Crawl-State 
|
**
Neu
**
|
|
 5 
|
 🟡 Medium 
|
`_crawler.js`
|
 Description-Fetch-Race: Promises laufen nach 
`Promise.race`
-Deadline weiter und mutieren 
`adsData`
|
**
Neu
**
|
|
 6 
|
 🟡 Medium 
|
`_crawler.js`
|
 URL-Deduplication nutzt nicht-normalisierte URLs beim Scraping und beim Deal-Push 
|
**
Neu
**
|
|
 7 
|
 🟢 Low 
|
`_crawler.js`
|
`updateProgress`
 wird überall mit 5. Argument aufgerufen, das die Funktion nicht akzeptiert (dead code) 
|
**
Neu
**
|

---

## BUG 1 — Live Top-Deals: Alte Seite dominiert dauerhaft

### Severity: 🔴 Critical

### Ursache (komplett)

Das Problem hat **zwei unabhängige Wurzeln**, die zusammen den Bug erzeugen:

**Wurzel A — Premature Display beim Resume:**
In `resumeCrawlIfActive()` wird `S.allTopDeals = rawState.allTopDeals` geladen und sofort `updateLiveRanking()` aufgerufen — *bevor* `processCurrentPage()` läuft. Der User sieht also die Deals der letzten abgeschlossenen Seite als "Live Top-Deals", während die neue Seite noch analysiert wird. Das ist irreführend, aber nicht der Hauptbug.

**Wurzel B — Unkalibrierte Per-Page-Scores (der Hauptbug):**
`buildAnalysisPrompt()` berechnet `computePriceStats(adsData)` **pro Seite** und gibt die Preisstatistik an die AI. Die AI kalibriert ihre Scores relativ zu dieser Per-Page-Statistik:
- Seite 1: breite Preisspanne → AI gibt Scores 88–92
- Seite 3: enge Preisspanne → AI gibt Scores 72–78

`updateLiveRanking()` sortiert dann nach Roh-Score (`b.score - a.score`). Deal mit Score 92 von Seite 1 gewinnt immer gegen Deal mit Score 78 von Seite 3, **obwohl der Score 78 auf Seite 3 relativ zur dortigen Konkurrenz genauso gut oder besser sein kann.**

Der finale Re-Ranking-Call in `finishDealFinder()` korrigiert das — aber erst nach dem gesamten Crawl, nicht während.

### Betroffene Stellen

```
resumeCrawlIfActive()    → updateLiveRanking() vor processCurrentPage()
processCurrentPage()     → S.allTopDeals.push() + updateLiveRanking()
updateLiveRanking()      → b.score - a.score (kein Normalisierungs-Kontext)
buildAnalysisPrompt()    → computePriceStats(adsData) pro Seite → Score-Drift
```

### Fix-Plan

**Fix 1A — Keine vorzeitige Live-Anzeige beim Resume:**

In `resumeCrawlIfActive()` die Zeile
```js
updateLiveRanking(prefix, S.allTopDeals, S.cachedSettings);
```
entweder **entfernen** oder erst nach der ersten neuen `processCurrentPage()`-Runde anzeigen. Alternativ ein Label hinzufügen: "Letzte Seite (wird aktualisiert...)".

**Fix 1B — Globale Preisstats für Live-Ranking:**

Option A (empfohlen): **Separate Score-Normalisierung** — beim Berechnen der Live-Ranking-Anzeige nicht den Roh-Score verwenden, sondern einen normalisierten Wert. Da die Scores per-page kalibriert sind, gibt es keinen perfekten Fix ohne globale Stats. Der pragmatischste Ansatz:

In `updateLiveRanking()` die Deals **nach Score-Perzentil** innerhalb des Arrays gewichten:
```js
// Statt: sorted nach b.score - a.score
// Berechne: pro Seite den maximalen Score, normalisiere relativ dazu
const pageMaxScores = {};
allTopDeals.forEach(d => {
  if (!pageMaxScores[d.page] || d.score > pageMaxScores[d.page]) {
    pageMaxScores[d.page] = d.score;
  }
});
const normalized = allTopDeals.map(d => ({
  ...d,
  _normalizedScore: pageMaxScores[d.page] > 0 ? (d.score / pageMaxScores[d.page]) * 100 : d.score
}));
const sorted = normalized.slice().sort((a, b) => b._normalizedScore - a._normalizedScore);
```

Option B (minimaler Eingriff): In `buildAnalysisPrompt()` die globalen Preisstats mitgeben. Dazu müssen globale Stats über alle bisherigen Seiten akkumuliert werden:
```js
// In state: S.globalPriceStats = { allPrices: [] }
// Vor jedem AI-Call: S.globalPriceStats.allPrices.push(...pageAds.prices)
// buildAnalysisPrompt bekommt zusätzlich globalStats und schreibt:
// "Global context: median across all pages = X EUR"
// → AI kann ihre Scores relativ zum globalen Kontext kalibrieren
```

**Empfehlung:** Fix 1B (globale Stats) + Fix 2 (sortDealsByScore nach Re-Ranking) zusammen lösen das Problem dauerhaft. Fix 1A (kein vorzeitiges Display) ist ein Quick-Fix für die UX.

---

## BUG 2 — Finales Re-Ranking: Falsche Sortierung im Results-View

### Severity: 🔴 Critical

### Ursache (komplett)

In `finishDealFinder()` wurde in v31.0.16 ein `sortDealsByScore`-Call nach dem `concat` entfernt. Der Kommentar im Code lautet:
```js
// Do NOT re-sort — per-page and re-ranking scores are not calibrated
```

Diese Logik ist **falsch** aus folgendem Grund:

1. `reRankResult.topDeals` kommt von der AI mit der Instruction `"Sort the top X deals by quality (best first)"`
2. Kein LLM ist deterministisch in der Reihenfolge von 30 Items
3. Häufige AI-Fehlverhalten:
   - AI gibt Items in der **Eingabe-Reihenfolge** zurück (= per-page score DESC, kein echtes Re-Ranking)
   - AI gibt Items in **umgekehrter Reihenfolge** zurück (worst → best)
   - AI gibt teilweise Items aus und lässt andere weg
4. `reRankedDeals.concat(remainingDeals)` → `Array[0]` ist der erste AI-Return, **nicht zwingend der beste Deal**
5. `renderResultsView()` liest Array-Position direkt als Rang: `index === 0 → #1 Medaille`
6. `updateLiveRanking()` sortiert selbst neu (`b.score - a.score`) → **maskiert den Bug** während des Crawls

Der User sieht im Live-Ranking eine korrekte Reihenfolge, aber im finalen Results-View eine falsche — weil `updateLiveRanking` sortiert und `renderResultsView` nicht.

### Betroffene Stellen

```
finishDealFinder()       → reRankedDeals.concat(remainingDeals) ohne sortDealsByScore
_ui-settings.js          → renderResultsView() sortiert nicht, zeigt Array-Index als Rang
_ui-progress.js          → updateLiveRanking() sortiert immer → maskiert Bug 2
```

### Fix-Plan

**Fix 2A — `sortDealsByScore` nach dem `concat` wiedereinfügen (Minimal-Fix):**

In `finishDealFinder()` nach Zeile:
```js
S.allTopDeals = reRankedDeals.concat(remainingDeals);
```
einfügen:
```js
S.allTopDeals = sortDealsByScore(S.allTopDeals);
```

Der Kommentar "Do NOT re-sort" ist zu entfernen. Die Befürchtung der Unkalibrierung ist berechtigt, aber ohne Sortierung ist der Output immer undeterministisch falsch. Mit Sortierung nach Score ist er wenigstens deterministisch und konsistent mit `updateLiveRanking`.

**Fix 2B — `renderResultsView` selbst sortieren lassen (Defense-in-Depth):**

In `renderResultsView()` am Anfang:
```js
function renderResultsView(prefix, deals) {
  // Defensiv sortieren — stellt sicher dass #1 immer der höchste Score ist
  const sortedDeals = deals.slice().sort((a, b) => ((b.score ?? 0) - (a.score ?? 0)));
  const items = sortedDeals.map(function(deal, index) { ... });
```

Das entkoppelt die View-Schicht von der Array-Reihenfolge des State. Robuster gegen zukünftige Bugs.

**Fix 2C — AI-Prompt für Re-Ranking verbessern:**

Den Re-Ranking-Prompt anpassen, um deterministischere Reihenfolge zu erzwingen:
```js
// Statt:
"Sort the top X deals by quality (best first). Score is 0-100."
// Besser:
"Re-evaluate and assign new scores to all provided deals. " +
"Return ALL deals sorted by score descending (highest first, index 0 = best). " +
"Do not omit any deal. If a deal is poor quality, assign score 1-30. " +
"Your output order MUST be: best deal first, worst deal last."
```

**Empfehlung:** Fix 2A + 2B implementieren. Fix 2C als Bonus für bessere AI-Konsistenz.

---

## BUG 3 — ClaudeProvider: `thinking: { type: 'adaptive' }` ist kein gültiger API-Wert

### Severity: 🟠 High (betrifft alle Claude-User)

### Ursache

In `MODEL_PRESETS.claude`:
```js
{ id: "claude-opus-4-7", options: { thinking: { type: "adaptive" } } }
{ id: "claude-sonnet-4-6", options: { thinking: { type: "adaptive" } } }
```

In `ClaudeProvider.buildRequest()`:
```js
const opts = this.config.providerOptions || {};
if (opts.thinking) body.thinking = opts.thinking;
// → body.thinking = { type: "adaptive" }
```

Die Anthropic Messages API akzeptiert für Extended Thinking **nur**:
- `{ type: "enabled", budget_tokens: N }` — aktiviert, mit Token-Budget
- `{ type: "disabled" }` — explizit deaktiviert

`{ type: "adaptive" }` ist **kein gültiger Wert** und führt zu einem `400 Bad Request`. Da `callAI` diesen Fehler nicht als Rate-Limit behandelt, schlägt der komplette AI-Call fehl. Jede Seite mit Claude-Provider gibt "AI analysis failed" zurück.

### Fix

In `MODEL_PRESETS.claude` die `options` auf gültige API-Werte ändern:
```js
claude: [
  {
    id: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    icon: "🧠",
    desc: "Latest flagship, extended thinking",
    options: { thinking: { type: "enabled", budget_tokens: 10000 } }
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    icon: "🎯",
    desc: "Best balance, extended thinking",
    options: { thinking: { type: "enabled", budget_tokens: 8000 } }
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    icon: "⚡",
    desc: "Fast & cheap",
    options: {}  // Haiku unterstützt kein Extended Thinking
  }
]
```

In `ClaudeProvider.buildRequest()` zusätzliche Validierung:
```js
if (opts.thinking && opts.thinking.type === 'enabled') {
  if (!opts.thinking.budget_tokens || typeof opts.thinking.budget_tokens !== 'number') {
    console.warn('[MDF] Claude thinking enabled but budget_tokens missing — disabling thinking');
  } else {
    body.thinking = opts.thinking;
    // Extended thinking erfordert temperature = 1
    body.temperature = 1;
  }
}
```

**Wichtig:** Extended Thinking bei Claude erfordert `temperature: 1` (exakt). Wenn `temperature: 0.1` gesetzt wird (wie im aktuellen Code), gibt die API einen Fehler zurück. In `callAI` wird `temperature: 0.1` übergeben — das muss für Claude überschrieben werden.

**Zusätzlicher Fix in `callAI` oder `ClaudeProvider.buildRequest`:**
```js
buildRequest(prompt, options = {}) {
  const opts = this.config.providerOptions || {};
  const isThinking = opts.thinking && opts.thinking.type === 'enabled';
  const body = {
    model: this.config.modelId,
    max_tokens: options.maxOutputTokens ?? 8192,
    // Temperature muss 1 sein wenn thinking enabled
    ...(isThinking ? {} : { temperature: options.temperature ?? 0.1 }),
    ...
  };
```

---

## BUG 4 — Captcha-Resume ignoriert `maxPages` aus dem gespeicherten Crawl-State

### Severity: 🟠 High

### Ursache

Wenn während eines Crawls ein Captcha erkannt wird:
1. `processCurrentPage()` speichert den Crawl-State mit `settings.maxPages = rawState.maxPages`
2. `pauseDealFinder()` wird aufgerufen
3. User löst das Captcha, klickt "Fortsetzen"
4. `resumeDealFinder()` wird aufgerufen:

```js
function resumeDealFinder() {
  S.isPaused = false;
  if (S.isRunning && S.captchaPaused) {
    S.captchaPaused = false;
    const cs = S.cachedSettings || {};  // ← S.cachedSettings aus Storage
    processCurrentPage(cs)              // ← cs.maxPages kommt aus Storage
```

`S.cachedSettings` wird in `resumeCrawlIfActive()` via `loadSettings()` geladen **bevor** `settings.maxPages = maxPages` (aus rawState) gesetzt wird. Das temporär gesetzte `settings.maxPages` lebt nur in der lokalen Variable `settings`, nicht in `S.cachedSettings`.

**Konsequenz:**
- Crawl war für 20 Seiten konfiguriert, Captcha auf Seite 5
- `S.cachedSettings.maxPages` = 10 (Standardwert aus Storage)
- Nach Captcha-Resume läuft Crawl nur bis Seite 10, nicht 20

### Fix

`S.cachedSettings.maxPages` beim Resume aus dem Crawl-State aktualisieren:

In `resumeCrawlIfActive()` nach:
```js
const maxPages = rawState.maxPages || settings.maxPages || 10;
settings.maxPages = maxPages;
```
hinzufügen:
```js
// S.cachedSettings mit maxPages aus Crawl-State synchronisieren
// damit captcha-resume die korrekten Grenzen kennt
if (S.cachedSettings) {
  S.cachedSettings.maxPages = maxPages;
}
```

Alternativ (robuster): `resumeDealFinder()` mit dem korrekten `settings`-Objekt parametrisieren statt `S.cachedSettings` zu nutzen:

```js
// In resumeCrawlIfActive(), nach settings.maxPages = maxPages:
S._resumeSettings = settings; // Speichern für captcha-resume

// In resumeDealFinder():
const cs = S._resumeSettings || S.cachedSettings || {};
processCurrentPage(cs);
```

---

## BUG 5 — Description-Fetch-Race: Promises mutieren `adsData` nach Deadline

### Severity: 🟡 Medium

### Ursache

```js
const batchFns = batch.map(function(ad, idx) {
  const absoluteIndex = bi + idx;
  return fetchFullDescription(ad.url, ...).then(function(result) {
    adsData[absoluteIndex].description = result.description; // ← Mutation
  });
});

await Promise.race([
  Promise.all(batchFns),
  new Promise(r => setTimeout(r, 8000)) // Deadline
]);
// Wenn Deadline gewinnt: batchFns laufen WEITER im Hintergrund
// Ihre .then()-Callbacks mutieren adsData[absoluteIndex] nach dem race
```

`buildAnalysisPrompt(adsData)` wird erst nach **allen** Batches aufgerufen. Innerhalb eines Batches: wenn die Deadline feuert und das nächste Batch beginnt, können noch laufende Promises des vorherigen Batches `adsData` mutieren, während das nächste Batch parallel fetched. Da `adsData` ein geteiltes Array ist und der `absoluteIndex` korrekt ist, passiert **keine Korruption** — aber Descriptions können **leer sein** für Einträge, die nach der Deadline ankamen (deren `.then()` noch nicht gefeuert hat, weil die 500ms-Inter-Batch-Pause nicht immer reicht).

### Fix

Entweder die 500ms-Inter-Batch-Pause auf `> deadline / 2 = 4000ms` erhöhen (zu langsam), oder besser: die Promises nicht verwerfen, sondern mit einem `cancelled`-Flag abbrechen:

```js
// Batch-Cancellation-Flag pro Batch
let batchDeadlineReached = false;

const batchFns = batch.map(function(ad, idx) {
  const absoluteIndex = bi + idx;
  return fetchFullDescription(ad.url, ...).then(function(result) {
    if (!batchDeadlineReached) {
      adsData[absoluteIndex].description = result.description;
    }
    // Nach Deadline: still runs, aber ignoriert (keine Mutation mehr)
  });
});

await Promise.race([
  Promise.all(batchFns),
  new Promise(r => setTimeout(function() {
    batchDeadlineReached = true;
    r();
  }, deadline))
]);
```

Einfachster Fix: `batchDeadlineReached` pro Batch, schützt vor Post-Deadline-Mutationen ohne die Promise-Kette zu zerstören.

---

## BUG 6 — URL-Deduplication: Nicht-normalisierte URLs beim Scraping

### Severity: 🟡 Medium

### Ursache

`normalizeUrl()` existiert und entfernt Hash-Fragmente:
```js
function normalizeUrl(url) {
  if (!url) return url;
  return url.split("#")[0];
}
```

Aber in `processCurrentPage()`:
```js
const seenUrls = new Set();
const info = scraper.extractBasicInfo(adArray[adi]);
if (!seenUrls.has(info.url)) {        // ← info.url nicht normalisiert
  seenUrls.add(info.url);             // ← nicht normalisiert im Set
  adsData.push(info);
}
```

Und beim Deal-Push:
```js
S.allTopDeals.push(normalized);
// normalized.url = rawDeal.url = AI-returned URL = aus dem Prompt
// der Prompt enthält adsData[i].url = nicht normalisiert
```

`deduplicateDeals()` nutzt auch nicht `normalizeUrl`:
```js
function deduplicateDeals(deals) {
  const seen = new Map();
  for (let i = 0; i < deals.length; i++) {
    const d = deals[i];
    if (!seen.has(d.url)) seen.set(d.url, d);  // ← nicht normalisiert
  }
```

Willhaben-URLs enthalten manchmal Tracking-Fragmente (`#tracking=...`). Zwei Fetches derselben Anzeige mit und ohne Fragment werden als verschiedene Deals gezählt.

### Fix

An drei Stellen `normalizeUrl()` einfügen:

**1. In `processCurrentPage()` beim Scraping:**
```js
const info = scraper.extractBasicInfo(adArray[adi]);
info.url = normalizeUrl(info.url); // ← hinzufügen
if (!seenUrls.has(info.url)) {
```

**2. In `processCurrentPage()` beim Deal-Push:**
```js
const normalized = {
  ...
  url: normalizeUrl(rawDeal.url) || '',  // ← normalizeUrl
  ...
};
```

**3. In `deduplicateDeals()` (oder an der Aufrufstelle):**
```js
function deduplicateDeals(deals) {
  const seen = new Map();
  for (const d of deals) {
    const key = normalizeUrl(d.url) || d.url;
    if (!seen.has(key)) seen.set(key, d);
  }
  return Array.from(seen.values());
}
```

---

## BUG 7 — `updateProgress` 5. Argument: Silent Dead Parameter

### Severity: 🟢 Low (Dead Code, kein Laufzeit-Fehler)

### Ursache

`updateProgress` wird im gesamten Code mit 5 Argumenten aufgerufen:
```js
updateProgress(prefix, text, percentage, type, scraper.siteName === "WILLHABEN");
```

Die Funktionssignatur ist:
```js
function updateProgress(prefix, text, percentage, type) {  // nur 4 Parameter
```

Das 5. Argument `scraper.siteName === "WILLHABEN"` (ein `boolean`) wird stillschweigend ignoriert. Das verursacht keinen Fehler, ist aber in >20 Aufrufen im Code verbreitet und erzeugt unnötigen kognitiven Overhead beim Lesen.

### Fix

Entweder das 5. Argument überall entfernen:
```bash
# Regex-Replace in _crawler.js:
# , scraper\.siteName === "WILLHABEN"\)  →  )
# , S\.scraper\.siteName === "WILLHABEN"\)  →  )
```

Oder die Funktion erweitern um das Argument tatsächlich zu nutzen (z.B. für site-spezifisches Styling).

---

## Reihenfolge der Implementierung (empfohlen)

```
1. BUG 3 (Claude thinking) — blockiert alle Claude-User, 5-Minuten-Fix
2. BUG 2A + 2B (sortDealsByScore + renderResultsView sort) — kritisch, 10 Minuten
3. BUG 4 (maxPages bei captcha-resume) — 5 Minuten
4. BUG 1B (globale Preisstats für Live-Ranking) — 20-30 Minuten
5. BUG 6 (normalizeUrl beim Scraping) — 10 Minuten
6. BUG 5 (description race flag) — 10 Minuten
7. BUG 7 (dead parameter cleanup) — Regex-Replace, 2 Minuten
```

---

## Zusammenfassung der Sortierungs-Tabelle (aktuell vs. nach Fix)

|
 Datei 
|
 Funktion 
|
 Aktuell 
|
 Nach Fix 
|
|
-------
|
----------
|
---------
|
----------
|
|
`_ranker.js:143`
|
`sortDealsByScore`
|
`b.score - a.score`
 ✅ 
|
 unverändert 
|
|
`_ui-progress.js:164`
|
`updateLiveRanking`
|
`b.score - a.score`
 ✅ 
|
+
 normalisierter Score 
|
|
`_ui-settings.js`
|
`renderResultsView`
|
**
keine Sortierung
**
 ⚠️ 
|
`deals.slice().sort(b.score-a.score)`
|
|
`_crawler.js:607`
|
`finishDealFinder`
|
**
kein sort nach concat
**
 ⚠️ 
|
`sortDealsByScore(S.allTopDeals)`
|
|
`_crawler.js:501`
|
`processCurrentPage`
|
`push`
 ohne normalize 
|
`push`
 + 
`normalizeUrl(url)`
|

---

## Files to Edit (Claude Code Task List)

```
EDIT  src/marketplace-deal-finder/_crawler.js
  - finishDealFinder():         Zeile ~607: sortDealsByScore nach concat einfügen          [BUG 2A]
  - finishDealFinder():         Re-Ranking-Prompt verbessern ("Return ALL deals sorted")   [BUG 2C]
  - resumeCrawlIfActive():      S.cachedSettings.maxPages = maxPages synchronisieren        [BUG 4]
  - resumeCrawlIfActive():      updateLiveRanking vor processCurrentPage entfernen/labeln   [BUG 1A]
  - processCurrentPage():       info.url = normalizeUrl(info.url)                          [BUG 6]
  - processCurrentPage():       normalized.url = normalizeUrl(rawDeal.url)                 [BUG 6]
  - processCurrentPage():       batchDeadlineReached-Flag pro Batch                        [BUG 5]
  - updateProgress() calls:     5. Argument überall entfernen                              [BUG 7]

EDIT  src/marketplace-deal-finder/_ui-settings.js
  - renderResultsView():        deals.slice().sort() am Anfang der Funktion                [BUG 2B]

EDIT  src/marketplace-deal-finder/_ui-progress.js
  - updateLiveRanking():        Normalisierte Scores für Cross-Page-Vergleich              [BUG 1B]

EDIT  src/marketplace-deal-finder/_ranker.js
  - deduplicateDeals():         normalizeUrl(d.url) als Map-Key                            [BUG 6]

EDIT  src/marketplace-deal-finder/_constants.js  (oder inline in _crawler.js)
  - MODEL_PRESETS.claude:       thinking: { type: 'enabled', budget_tokens: N }            [BUG 3]

EDIT  src/marketplace-deal-finder/_api-claude.js  (oder ClaudeProvider in dist)
  - buildRequest():             temperature = 1 wenn thinking enabled                      [BUG 3]
  - buildRequest():             Validierung budget_tokens vorhanden                        [BUG 3]
```

---

*Generated: Marketplace Deal Finder v31.0.18 — 7 Bugs (2 reported, 5 neu identifiziert)*
