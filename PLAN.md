# 10finger.rosenbaum.hamburg – Umsetzungsplan

2026-10-17 · @Benedikt Rosenbaum

## Ziel und Grundprinzipien

10finger.rosenbaum.hamburg wird ein statischer Web-Trainer für das Zehnfingersystem auf der deutschen QWERTZ-Tastatur – mit eigenem Profil und gespeichertem Fortschritt für jedes Familienmitglied, ohne Server und ohne Konto.

**Zielgruppe und was daraus folgt**

| Person | Alter | Modus | Einheit |
|---|---|---|---|
| Moritz | 12 | Kurs, Standard | 10 Minuten |
| Lukas | 9 | Kurs, kindgerechte Texte, mehr Belohnung | 5–8 Minuten |
| Anna | 6 | Entdecker-Modus (siehe unten) | 3–5 Minuten |
| Ehefrau | erwachsen | Kurs, Erwachsenentexte | 10–15 Minuten |

Anna kommt gerade in die Vorschule. Ein Kurs, der auf Silben, Wörtern und Sätzen aufbaut, setzt flüssiges Lesen voraus und wird sie eher frustrieren. Meine Empfehlung: Sie bekommt einen eigenen Entdecker-Modus (Buchstaben auf der Bildschirmtastatur finden, Grundstellung spielerisch, große Schrift, Ton), und der richtige Kurs wird freigeschaltet, wenn sie lesen kann.

**Grundprinzipien**

- Genauigkeit vor Tempo: Die nächste Lektion öffnet sich erst ab 95 % Trefferquote, Tempo zählt erst später.
- Blick auf den Bildschirm: Eine Bildschirmtastatur mit Fingerfarben zeigt die nächste Taste, damit niemand auf die Hände schaut.
- Kurze, häufige Einheiten statt langer Sitzungen; ein Tagesziel in Minuten, nicht in Lektionen.
- Jeder misst sich an der eigenen Bestleistung. Eine Geschwister-Rangliste würde Lukas gegenüber Moritz dauerhaft demotivieren.
- Nur mit echter Tastatur: Auf Tablet-Bildschirmtastaturen ist Zehnfingerschreiben nicht sinnvoll; die App weist darauf hin.

## Fortschritt speichern

Ja, das geht – am einfachsten im Browser selbst: Jedes Familienmitglied wählt beim Start sein Profil, und Lektion, Bestwerte und Tastenstatistik bleiben im Browser des Übungsrechners erhalten. Dazu kommt eine Sicherungsdatei als Netz und doppelter Boden.

| Weg | Wo liegen die Daten | Geräteübergreifend | Aufwand | Bewertung |
|---|---|---|---|---|
| A: Browser-Speicher (localStorage) mit Profilen | im Browser des Übungsgeräts | nein | gering, läuft auf GitHub Pages | empfohlen für den Start |
| B: A plus Sicherungsdatei (Export/Import als JSON) | Browser und Datei | per Hand | gering | empfohlen, gehört zu A dazu |
| C: eigener kleiner Sync-Server (z. B. PHP-Skript auf IONOS-Webspace) | eigener Server | ja | mittel: Familien-PIN, Pflege, Datenschutz | erst, wenn mehrere Geräte genutzt werden |
| D: Fremddienst (Firebase, Supabase o. ä.) | Drittanbieter | ja | mittel | nicht empfohlen: Kinderdaten bei Dritten |

**Empfehlung:** A + B jetzt bauen, den Speicherzugriff aber in einem eigenen Modul kapseln. Dann lässt sich C später nachrüsten, ohne den Rest der App anzufassen.

**Worauf du achten musst**

- Safari löscht Website-Speicher: WebKit entfernt localStorage und IndexedDB nach 7 Tagen ohne Nutzerinteraktion mit der Seite. Nach den Herbstferien wäre der Fortschritt dann weg. Webanwendungen, die auf dem iPhone/iPad zum Home-Bildschirm hinzugefügt wurden, sind davon ausgenommen ([WebKit: Tracking Prevention](https://webkit.org/tracking-prevention/)). Praktisch heißt das: auf dem Übungsrechner Chrome, Edge oder Firefox nutzen oder die Seite als Web-App installieren.
- Die App fragt beim ersten Start mit navigator.storage.persist() nach dauerhaftem Speicher. Der Browser darf das ablehnen; die App zeigt das Ergebnis dann still in den Einstellungen an ([MDN: persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)).
- „Browserdaten löschen“ oder ein privates Fenster vernichten bzw. verhindern die Speicherung. Die App erinnert deshalb alle 14 Tage an eine Sicherung und erkennt den privaten Modus.
- Der Speicher gilt pro Browser und Gerät. Üben alle am selben Familienrechner, ist das ideal; übt jemand zusätzlich am eigenen Laptop, ist Weg C sinnvoll.
- Profile schützen: optional eine 4-stellige Profil-PIN, damit Geschwister nicht im fremden Profil üben. Das ist eine Bequemlichkeitssperre, keine Sicherheit.

## Funktionsumfang

Der Kern ist ein geführter Kurs mit Bildschirmtastatur; dazu kommen Schwächentraining, Motivation und eine Familienübersicht. Stufe 1 ist sofort nutzbar, Stufe 2 und 3 machen die App langfristig interessant.

| Funktion | Was sie tut | Stufe |
|---|---|---|
| Profile | Name, Avatar, Altersgruppe (Vorschule / Kind / Erwachsen); die Altersgruppe steuert Texte, Schriftgröße, Einheitslänge und Tempoziel | 1 |
| Übungsbildschirm | Textzeile mit hervorgehobenem nächsten Zeichen; Tippfehler werden rot markiert, der Cursor wartet auf die richtige Taste | 1 |
| Bildschirmtastatur | Deutsches QWERTZ-Layout, Tasten nach Finger eingefärbt, nächste Taste leuchtet, Handgrafik zeigt den Finger, Umschalt-Hinweis für die Gegenhand | 1 |
| Geführter Kurs | Lektionen in festen Schritten: neue Taste vorstellen, Tastenfolgen, Silben, Wörter, Sätze; nächste Lektion ab 95 % Genauigkeit | 1 |
| Messwerte | Anschläge pro Minute (deutsche Konvention), Fehlerquote, Dauer; Timer pausiert nach 5 s ohne Eingabe | 1 |
| Speichern und Sicherung | Automatisches Speichern nach jeder Übung, Export/Import als Datei, Erinnerung alle 14 Tage | 1 |
| Schutzhinweise | Warnung bei Feststelltaste, bei Fokusverlust („Hier klicken zum Weiterschreiben“) und bei Touch-Geräten ohne Tastatur | 1 |
| Schwächentraining | Statistik pro Taste (Fehler, Reaktionszeit); ein Generator baut Übungen aus den schwächsten Tasten | 2 |
| Aufwärmen | 1 Minute Wiederholung bekannter Tasten zu Beginn jeder Sitzung | 2 |
| Motivation | Tagesziel in Minuten, Serie (Tage in Folge), Abzeichen, Kurs als Landkarte mit freigeschalteten Stationen, eigene Bestleistung | 2 |
| Familienübersicht | Pro Profil: letzte Übung, Minuten pro Woche, Tempo- und Fehlerverlauf, Problemtasten | 2 |
| Eigene Texte | Text einfügen und abtippen, z. B. Lernwörter oder Diktate aus der Schule | 2 |
| Entdecker-Modus | Für Anna: Buchstaben auf der Tastatur finden, Grundstellung ertasten (Rillen auf F und J), große Schrift, Töne | 2 |
| Spiele | Wörterregen (fallende Wörter abtippen), Rennen gegen den „Geist“ der eigenen besten Runde | 3 |
| Blindmodus | Bildschirmtastatur ausblenden, sobald eine Lektion sicher sitzt | 3 |
| Ergonomie | Kurze Grafik zu Sitzhaltung und Grundstellung vor der ersten Übung, Pausenhinweis nach 15 Minuten | 3 |
| Einstellungen | Ton, Schriftgröße, Dunkelmodus, Fehlermodus (warten oder weiterschreiben), hoher Kontrast | 1–3 |

Farben allein tragen keine Bedeutung: Jede Taste der Bildschirmtastatur zeigt zusätzlich ihren Buchstaben, und die Handgrafik benennt den Finger, damit die App auch bei Farbsehschwäche funktioniert.

## Lektionsplan (deutsche QWERTZ-Tastatur)

16 Lektionen führen von der Grundreihe zu Großschreibung, Umlauten, Ziffern und Satzzeichen. Die Reihenfolge ist mein Vorschlag nach Häufigkeit deutscher Buchstaben; die Umschalttaste kommt früh, weil im Deutschen jedes Nomen groß beginnt.

| Nr. | Neue Tasten | Finger | Beispielwörter (nur bekannte Buchstaben) |
|---|---|---|---|
| 1 | a s d f – j k l ö, Leertaste | Grundstellung, Daumen | das, als, all, fall, lass |
| 2 | e, i | Mittelfinger links / rechts | sie, die, alle, leise, elf |
| 3 | r, u | Zeigefinger links / rechts | auf, rad, du, kurs, sauer |
| 4 | g, h | Zeigefinger links / rechts | hier, haus, sehr, frage, ruhig |
| 5 | t, n | Zeigefinger links / rechts | und, gut, ein, hund, kind |
| 6 | Umschalttaste | kleiner Finger der Gegenhand | Hund, Kind, Tag, Insel, Garten |
| 7 | c, m | Mittelfinger links / Zeigefinger rechts | ich, mich, milch, schule, machen |
| 8 | w, o | Ringfinger links / rechts | wo, wir, wort, wolke, oma |
| 9 | b, z | Zeigefinger links / rechts | baum, zeit, zug, buch, bitte |
| 10 | Komma, Punkt | Mittelfinger / Ringfinger rechts | Ich habe Zeit. Der Hund ist gut. |
| 11 | v, p | Zeigefinger links / kleiner Finger rechts | viel, vogel, papa, post |
| 12 | ü, ä | kleiner Finger rechts | über, müde, bär, tür, mädchen |
| 13 | ß, Bindestrich | kleiner Finger rechts | straße, groß, fuß, Fußball-Tor |
| 14 | q, x, y | kleiner / Ringfinger / kleiner Finger links | quelle, hexe, taxi, typ |
| 15 | Ziffern 1–0 | Finger der Spalte darunter | 3 Hunde, 12 Katzen, 2026 |
| 16 | ! " ? : ( ) | Umschalttaste + Spaltenfinger | Wie spät ist es? Super! |

**Fingerzuordnung für die Bildschirmtastatur**

| Finger | Tasten |
|---|---|
| kleiner Finger links | ^ 1 q a y <, Tab, Feststelltaste, Umschalt links |
| Ringfinger links | 2 w s x |
| Mittelfinger links | 3 e d c |
| Zeigefinger links | 4 5 r t f g v b |
| Zeigefinger rechts | 6 7 z u h j n m |
| Mittelfinger rechts | 8 i k , |
| Ringfinger rechts | 9 o l . |
| kleiner Finger rechts | 0 ß ´ p ü + ö ä # -, Umschalt rechts, Enter, Rücktaste |
| Daumen | Leertaste |

Für die 6 gibt es in Lehrwerken beide Zuordnungen; die App legt sich auf den rechten Zeigefinger fest. Die Tottasten ^, ´ und ` sowie AltGr-Zeichen wie @ und € bleiben im Kurs außen vor und kommen höchstens als Zusatzlektion.

**Aufbau jeder Lektion**

1. Vorstellen: neue Taste auf der Bildschirmtastatur zeigen, Finger in der Handgrafik markieren.
2. Tastenfolgen: fff jjj fjf jfj, dann mit der neuen Taste gemischt.
3. Silben und Wortbausteine aus allen bekannten Tasten.
4. Echte Wörter, automatisch aus einer Wortliste gefiltert, die nur freigeschaltete Buchstaben enthält.
5. Ab Lektion 6: kurze Sätze, für Kinder und Erwachsene getrennt.

Die Wortliste (rund 3.000 häufige, kindgerechte Wörter) und die Sätze lässt du von Claude Code selbst erstellen. Fremde Texte aus Büchern oder Websites kommen nicht hinein; gemeinfreie Texte wie Grimms Märchen sind für längere Abschnitte möglich.

## Technische Architektur

Eine statische Web-App aus HTML, CSS und reinem JavaScript (ES-Module), ohne Framework, ohne Build-Schritt und ohne externe Abhängigkeiten zur Laufzeit. Als installierbare Web-App (Manifest + Service Worker) läuft sie auch offline.

Ansichten und Kernlogik kennen den Speicher nicht; nur storage.js liest und schreibt, deshalb ist der Sync-Server später ein Austausch an einer einzigen Stelle.

**Dateistruktur**

```text
10finger/
  index.html
  manifest.webmanifest      Name, Icons, Startfarbe (installierbar)
  sw.js                     Service Worker: offline nutzbar
  CNAME                     10finger.rosenbaum.hamburg
  css/app.css
  js/
    main.js                 Start, Wechsel zwischen Ansichten
    storage.js              EINZIGES Modul mit Speicherzugriff: laden, speichern, Export/Import, Schema-Migration
    profiles.js             Profile anlegen, wählen, PIN
    keyboard.js             QWERTZ-Layout, Fingerzuordnung, Bildschirmtastatur, Handgrafik
    lessons.js              die 16 Lektionen als Daten
    generator.js            Übungstexte aus Wortliste, Lektion und Schwächen
    engine.js               Tippkern: Eingabe, Vergleich, Fehler, Messwerte, Pause
    stats.js                Auswertung, Bestwerte, Serie, Abzeichen
    views/                  profile, course, exercise, results, family, settings, explorer, games
  data/
    words-de.json           Wort + Altersgruppe
    sentences-kids.json
    sentences-adults.json
  assets/                   Avatare, Töne, Handgrafik (SVG)
  fonts/                    selbst gehostete Schrift
  tests/                    Tests für generator, engine, storage (node --test)
```

**Datenmodell (ein JSON-Objekt im localStorage, Schlüssel `10finger.v1`)**

```json
{
  "schemaVersion": 1,
  "lastBackup": "2026-10-17",
  "profiles": [{
    "id": "p_x7k2",
    "name": "Lukas",
    "avatar": "fuchs",
    "ageGroup": "kind",
    "pinHash": null,
    "settings": { "sound": true, "fontSize": "gross", "errorMode": "wait", "showKeyboard": true },
    "progress": {
      "currentLesson": 3,
      "lessons": { "1": { "done": true, "bestApm": 62, "bestAccuracy": 97.5, "attempts": 4 } }
    },
    "keyStats": { "f": { "hits": 412, "errors": 9, "avgMs": 380 } },
    "sessions": [{ "date": "2026-10-17T15:02", "lesson": 3, "seconds": 300, "apm": 58, "accuracy": 96.1 }],
    "streak": { "current": 3, "lastDay": "2026-10-17" },
    "badges": ["erste-lektion"]
  }]
}
```

- `sessions` auf 500 Einträge begrenzen; ältere werden zu Wochenwerten zusammengefasst.
- `schemaVersion` erlaubt spätere Änderungen, ohne dass alte Sicherungen unlesbar werden.
- Die PIN wird nur als Hash gespeichert, nie im Klartext.

**Tastatureingabe: QWERTZ-Fallstricke**

- Zeichen über `event.key` vergleichen: Es liefert das tatsächlich getippte Zeichen inklusive ö, ß und Großbuchstaben.
- `event.code` folgt dem US-Layout (ö heißt dort `Semicolon`, z heißt `KeyY`). Die Bildschirmtastatur leuchtet deshalb über eine eigene Layout-Tabelle nach dem erwarteten Zeichen auf, nicht nach `event.code`.
- Tottasten (^, ´, `) liefern `Dead` und werden ignoriert, nicht als Fehler gezählt.
- Feststelltaste per `event.getModifierState("CapsLock")` erkennen und warnen.
- Leertaste und Rücktaste mit `preventDefault()` abfangen, damit die Seite nicht scrollt oder zurückspringt.
- Mac-Tastaturen weichen bei einzelnen Sonderzeichen ab (z. B. @ über Option+L). Der Kurs nutzt nur Tasten, die bei PC und Mac gleich belegt sind.
- Anschläge pro Minute = getippte Zeichen inklusive Leerzeichen pro Minute; ein Großbuchstabe zählt als ein Anschlag.

## Hosting, Subdomain, Datenschutz

Veröffentlichung wie bei deinen anderen Subdomains: Repo „10finger“ auf GitHub, GitHub Pages, DNS bei IONOS.

1. Repo „10finger“ anlegen (öffentlich, da kein privater Inhalt), GitHub Pages aus dem Hauptzweig aktivieren.
2. Datei `CNAME` mit `10finger.rosenbaum.hamburg` ins Repo.
3. Bei IONOS einen CNAME-Eintrag `10finger` auf deine `…github.io`-Adresse setzen.
4. In GitHub Pages „Enforce HTTPS“ aktivieren – Pflicht, weil Service Worker und `persist()` nur über HTTPS funktionieren.
5. Kachel auf der Zettelkasten-Startseite ergänzen.

**Datenschutz**

- Alle Übungsdaten bleiben im Browser; die App sendet nichts, setzt keine Cookies und nutzt kein Tracking.
- Keine externen Schriften, CDNs oder Skripte: Alles liegt im Repo, damit keine IP-Adressen an Dritte gehen.
- Der Hoster (GitHub) verarbeitet beim Seitenaufruf technisch bedingt IP-Adressen; das gehört in einen kurzen Datenschutzhinweis.
- Das Speichern des Fortschritts ist die ausdrücklich gewünschte Kernfunktion. Ob dafür ein Hinweis nach § 25 TDDDG genügt, solltest du kurz prüfen lassen; ich bin kein Jurist.
- Praktisch: Impressum und Datenschutz einmal zentral auf der Startseite pflegen und von allen Subdomains verlinken.
- Bei Weg C (Sync-Server) ändert sich das: Dann liegen Namen und Lernstände deiner Kinder auf einem Server, und der Datenschutzhinweis muss das abbilden.

## Umsetzung mit Claude Code

In drei Phasen bauen und nach jeder Phase selbst mit echter Tastatur testen. Phase 1 deckt das Wichtigste ab: Profile, Lektionen 1–6, Speichern.

| Phase | Inhalt | Fertig, wenn … |
|---|---|---|
| 1 Grundgerüst | Repo, index.html, keyboard.js, engine.js, Lektionen 1–6, Profile, Speichern, Export/Import, Ergebnisansicht, CNAME | Moritz und Lukas üben Lektion 1–3 und finden nach einem Neustart ihren Stand wieder |
| 2 Kurs komplett | Lektionen 7–16, Wortliste und Sätze, Schwächentraining, Aufwärmen, Motivation, Familienübersicht, Entdecker-Modus, eigene Texte | Alle vier Profile laufen eine Woche im Alltag |
| 3 Feinschliff | Spiele, Blindmodus, Service Worker und Manifest, Ergonomie-Hinweise, Kachel auf der Startseite | App ist installierbar und offline nutzbar |

**So gehst du vor**

1. Diesen Plan als Markdown exportieren und als `PLAN.md` ins neue Repo legen.
2. Claude Code im Repo starten und den Prompt unten verwenden; zuerst den Umsetzungsplan zeigen lassen.
3. Nach jeder Phase committen, testen, Rückmeldung geben, dann die nächste Phase starten.

**Start-Prompt für Phase 1**

```text
Lies PLAN.md. Baue Phase 1 des 10-Finger-Trainers für 10finger.rosenbaum.hamburg.
Vorgaben: reines HTML, CSS und JavaScript (ES-Module), kein Framework, kein Build-Schritt,
keine externen Ressourcen. Halte dich genau an Dateistruktur, Datenmodell, Fingerzuordnung
und die QWERTZ-Hinweise aus dem Plan. Jeder Speicherzugriff läuft ausschließlich über storage.js.
Oberfläche auf Deutsch, kindgerecht, große Schrift, funktioniert ab 1280 px Breite.
Schreibe Tests für engine.js und storage.js (node --test).
Zeig mir vor dem Programmieren deinen Umsetzungsplan in 10–15 Punkten.
```

## Offene Entscheidungen

Die erste Frage entscheidet, ob Weg A + B reicht oder ein Sync-Server nötig wird; die übrigen kannst du auch während Phase 1 klären.

- [ ] Üben alle an einem Familienrechner oder an mehreren Geräten?
- [ ] Welcher Browser läuft auf dem Übungsrechner? Bei Safari: Web-App installieren oder anderen Browser nutzen.
- [ ] PC- oder Mac-Tastatur?
- [ ] Profil-PIN ja oder nein?
- [ ] Entdecker-Modus für Anna jetzt oder später?
- [ ] Kachel auf der Startseite sofort oder erst nach dem Familientest; Seite vorerst mit noindex?
- [ ] Nur für Weg C: Unterstützt dein IONOS-Tarif PHP?
- [ ] Gestaltung: eigener kindgerechter Stil mit Namen oder Maskottchen?

## Quellen

- [WebKit: Tracking Prevention in WebKit – 7-Day Cap on All Script-Writeable Storage, Home Screen Web Application Exemption](https://webkit.org/tracking-prevention/)
- [MDN: StorageManager.persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
