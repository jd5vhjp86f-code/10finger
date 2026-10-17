# 10finger

10-Finger-Schreibtrainer (QWERTZ) für 10finger.rosenbaum.hamburg – mit eigenem Profil und
gespeichertem Fortschritt für jedes Familienmitglied, ohne Konto. Optional gleicht der eigene
LernSync-Server Profile und Fortschritt zwischen den Geräten der Familie ab (Familien-Code).
Der vollständige Plan steht in [PLAN.md](PLAN.md).

## Funktionen (Phasen 1–3)

**Kurs**
- 16 Lektionen von der Grundstellung bis zu Ziffern und Satzzeichen, als Landkarte mit Stationen
- Jede Lektion: neue Tasten vorstellen → Tastenfolgen → Silben → Zahlen/Satzzeichen → Wörter → Sätze
- Nächste Lektion erst ab 95 % Genauigkeit; Bestwerte pro Lektion
- Wortliste mit rund 2.800 Wörtern und rund 250 Sätzen (Kinder/Erwachsene getrennt), selbst erstellt

**Üben**
- Bildschirmtastatur (deutsches QWERTZ, Fingerfarben, Umschalt der Gegenhand) und Handgrafik
- Aufwärmen: 1 Minute bekannte Tasten, automatisch vor der ersten Lektion einer Sitzung
- Schwächentraining aus der Tastenstatistik (Fehlerquote und Reaktionszeit)
- Eigene Texte (Lernwörter, Diktate) – typografische Zeichen werden tippbar gemacht
- Blindmodus: Tastatur verschwindet, sobald eine Lektion sicher sitzt (≥ 97 %), und blitzt bei Fehlern kurz auf

**Motivation**
- Tagesziel in Minuten, Serie (Tage in Folge), 16 Abzeichen, eigene Bestleistung
- Spiele: Wörterregen und Rennen gegen den „Geist“ der eigenen besten Runde
- Familienübersicht mit Tempo- und Genauigkeitsverlauf, Minuten pro Woche, Problemtasten – ohne Rangliste

**Für Vorschulkinder**
- Entdecker-Modus: große Buchstaben auf der Tastatur finden, Grundstellung ertasten (F und J),
  Sterne, Töne und Vorlesen (nur mit lokal installierten Stimmen)

**Alltag**
- Ergonomie-Hinweis vor der ersten Übung, Pausenhinweis nach 15 Minuten
- Einstellungen: Töne, Schriftgröße, Dunkelmodus, hoher Kontrast, Fehlermodus, Tagesziel, PIN
- Installierbar als App und offline nutzbar (Manifest und Service Worker)
- Speichern im Browser (`localStorage`, Schlüssel `10finger.v1`), Sicherung als Datei, Erinnerung alle 14 Tage
- Geräte verbinden (Familienübersicht): mit dem Familien-Code werden Profile und Fortschritt über den
  eigenen LernSync-Server (Cloudflare Worker, Daten in der EU) abgeglichen; ohne Code bleibt alles lokal
- Warnungen bei Feststelltaste, Fokusverlust, Geräten ohne Tastatur, blockiertem Speicher und Safari

## Lokal starten

ES-Module brauchen einen Webserver (Doppelklick auf `index.html` reicht nicht):

```sh
python3 -m http.server 8080   # dann http://localhost:8080 öffnen
```

## Tests

```sh
npm test   # node --test, keine Abhängigkeiten
```

## Aufbau

Reines HTML, CSS und JavaScript (ES-Module), kein Framework, kein Build-Schritt, keine externen
Ressourcen. Nur `js/storage.js` und `js/sync.js` greifen auf den Speicher zu. Einzige Anfrage nach
außen ist der optionale Abgleich mit dem LernSync-Server (`https://lernsync.2n7vt787wn.workers.dev`).

| Datei | Aufgabe |
|---|---|
| `js/main.js` | Start, Ansichten, Übungsstart (Ergonomie, Aufwärmen), Darstellung, Service Worker |
| `js/storage.js` | Laden, Speichern, Export/Import, Schema-Migration |
| `js/sync.js` | Abgleich der Profile zwischen Geräten (LernSync, je Profil das neuere gewinnt, Löschen wird mitgenommen) |
| `js/profiles.js` | Profile anlegen, wählen, PIN (nur als SHA-256-Hash) |
| `js/keyboard.js` | QWERTZ-Layout, Fingerzuordnung, Bildschirmtastatur, Handgrafik |
| `js/lessons.js` | die 16 Lektionen als Daten |
| `js/generator.js` | Übungstexte: Lektionen, Aufwärmen, Schwächen, Rennen, Wörterregen, eigene Texte |
| `js/engine.js` | Tippkern: Eingabe, Vergleich, Fehler, Messwerte, Pause, Zeitverlauf |
| `js/stats.js` | Auswertung, Bestwerte, Serie, Abzeichen, Schwächen, Geist |
| `js/views/` | Profil, Kurs, Übung, Ergebnis, Familie, eigene Texte, Entdecker, Spiele, Ergonomie, Einstellungen |
| `data/` | Wortliste und Sätze |
| `sw.js`, `manifest.webmanifest` | Offline-Betrieb und Installation |

**Wichtig bei Änderungen:** In `sw.js` die `VERSION` erhöhen, sonst sehen installierte Apps die
Änderung erst verzögert. Neue Dateien müssen in die `ASSETS`-Liste – `tests/sw.test.js` prüft das.

## Veröffentlichung

GitHub Pages aus dem Hauptzweig, `CNAME` ist enthalten. Bei IONOS einen CNAME-Eintrag `10finger`
auf die `…github.io`-Adresse setzen und in GitHub Pages „Enforce HTTPS“ aktivieren (Pflicht für
Service Worker und dauerhaften Speicher). Die Seite trägt vorerst `noindex`, bis der Familientest
abgeschlossen ist.

Kachel für die Startseite (liegt in einem anderen Repo und ist hier nicht enthalten):

```html
<a class="tile" href="https://10finger.rosenbaum.hamburg/">
  <span class="tile-icon">⌨️</span>
  <span class="tile-title">10finger</span>
  <span class="tile-text">Zehnfingerschreiben lernen</span>
</a>
```
