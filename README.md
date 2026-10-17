# 10finger

10-Finger-Schreibtrainer (QWERTZ) für 10finger.rosenbaum.hamburg – mit eigenem Profil und
gespeichertem Fortschritt für jedes Familienmitglied, ohne Server und ohne Konto.
Der vollständige Plan steht in [PLAN.md](PLAN.md).

## Stand: Phase 1 (Grundgerüst)

- Profile mit Tier, Altersgruppe (Vorschule / Kind / Erwachsen) und freiwilliger 4-stelliger PIN
- Geführter Kurs, Lektionen 1–6 (Grundreihe bis Großschreibung); nächste Lektion ab 95 % Genauigkeit
- Jede Lektion: neue Tasten vorstellen → Tastenfolgen → Silben → Wörter → (ab Lektion 6) Sätze
- Bildschirmtastatur (deutsches QWERTZ, Fingerfarben, Umschalt-Hinweis für die Gegenhand) und Handgrafik
- Messwerte: Anschläge pro Minute, Genauigkeit, Fehler, Dauer; Timer pausiert nach 5 s ohne Eingabe
- Speichern im Browser (`localStorage`, Schlüssel `10finger.v1`), Sicherung als Datei, Erinnerung alle 14 Tage
- Warnungen bei Feststelltaste, Fokusverlust, Geräten ohne Tastatur, blockiertem Speicher und Safari

Phase 2 (Lektionen 7–16, große Wortliste, Schwächentraining, Familienübersicht, Entdecker-Modus …)
und Phase 3 (Spiele, Blindmodus, Offline/Installierbar) folgen laut Plan.

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
Ressourcen. Nur `js/storage.js` greift auf den Speicher zu – ein späterer Sync-Server wird dort eingebaut.

| Datei | Aufgabe |
|---|---|
| `js/main.js` | Start, Wechsel zwischen Ansichten, Hinweisleisten |
| `js/storage.js` | Laden, Speichern, Export/Import, Schema-Migration |
| `js/profiles.js` | Profile anlegen, wählen, PIN (nur als SHA-256-Hash) |
| `js/keyboard.js` | QWERTZ-Layout, Fingerzuordnung, Bildschirmtastatur, Handgrafik |
| `js/lessons.js` | die 16 Lektionen als Daten |
| `js/generator.js` | Übungstexte aus Wortliste und Lektion |
| `js/engine.js` | Tippkern: Eingabe, Vergleich, Fehler, Messwerte, Pause |
| `js/stats.js` | Auswertung, Bestwerte, Serie, Abzeichen, Wochenwerte |
| `js/views/` | Profil, Kurs, Übung, Ergebnis, Einstellungen |
| `data/` | Wortliste und Sätze (selbst erstellt) |

## Veröffentlichung

GitHub Pages aus dem Hauptzweig, `CNAME` ist enthalten. Bei IONOS einen CNAME-Eintrag `10finger`
auf die `…github.io`-Adresse setzen und in GitHub Pages „Enforce HTTPS“ aktivieren.
Die Seite trägt vorerst `noindex`, bis der Familientest abgeschlossen ist.
