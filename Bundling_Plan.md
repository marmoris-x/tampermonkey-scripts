# Claude Code Instruktion: Userscript-Modernisierung & Bundling

**Kontext:**
Dieses Projekt ist ein modulares Userscript (Manga Panel Downloader), das aktuell auf einer `@require`-Struktur basiert. Das Ziel ist es, den Workflow auf ein professionelles Bundling umzustellen, ohne die bestehende Ordnerstruktur zu zerstören.

**DEINE AUFGABEN (Strikt nach diesen Schritten vorgehen):**

1.  **Recherche & Vorbereitung (Web Search & Web Fetch):**
    *   Nutze **Web Search**, um die aktuellsten Dokumentationen von `vite` und `vite-plugin-monkey` zu finden.
    *   Verwende **Web Fetch**, um die Konfigurations-Optionen für den Userscript-Header in `vite-plugin-monkey` zu prüfen (insbesondere `build` und `meta` Optionen).

2.  **Umgebung aufsetzen:**
    *   Installiere `vite` und `vite-plugin-monkey` als Dev-Dependencies im bestehenden Projektordner.
    *   Stelle sicher, dass Node.js korrekt initialisiert ist (`package.json`), falls noch nicht vorhanden.

3.  **Integration in bestehende Struktur:**
    *   Ändere **nichts** an der aktuellen Anordnung deiner `.js`-Dateien.
    *   Konfiguriere Vite so, dass es deine vorhandene Hauptdatei als Einstiegspunkt nutzt.
    *   Implementiere den Build-Prozess so, dass das Ergebnis (die fertige, zusammengesetzte `.user.js`) in einem **separaten Distributions-Ordner** (z. B. `/dist`) gespeichert wird.

4.  **Header & Sync-Logik konfigurieren:**
    *   Konfiguriere den Header innerhalb der Build-Pipeline so, dass `@updateURL` und `@downloadURL` auf die zusammengesetzte Datei im GitHub-Repo via **jsDelivr** zeigen (um MIME-Type-Probleme zu vermeiden).
    *   Stelle `@match *://*/*` ein, aber stelle sicher, dass die Skript-Logik strikt nur durch eine manuelle Nutzer-Interaktion (UI/Menü-Kommando) aktiviert wird (Opt-in).

5.  **Modularisierungs-Technik:**
    *   Unterstütze den Umstieg von einfachen Skript-Injektionen auf moderne `import`/`export` Statements innerhalb der bestehenden Dateien, damit der Bundler die Abhängigkeiten korrekt auflösen kann.

**RESTRIKTIONEN:**
*   Erstelle **keine** neue Projektstruktur. Arbeite im vorhandenen Verzeichnis.
*   Gib keine ausschweifenden Code-Beispiele, sondern führe die notwendigen Terminal-Befehle und Konfigurationsschritte direkt aus.
*   Beachte die Sicherheits-Best-Practices: Keine automatische Ausführung auf fremden Domains ohne Nutzer-Trigger.

---

**Quellenhinweise für Claude:**
*   *Vite-Plugin-Monkey Dokumentation (GitHub)*: Für die korrekte Handhabung des GM-API-Mappings.
*   *jsDelivr Dokumentation*: Für die korrekte URL-Struktur von GitHub-Releases/Branches.
*   *Tampermonkey Dokumentation*: Für die Anforderungen an den Metadata-Block (`@updateURL`, `@downloadURL`).