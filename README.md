# Elternbeirat-Tools

Kleine Web-Apps für den Elternbeirat, gehostet über GitHub Pages.

| Pfad | Inhalt |
|---|---|
| `index.html` | Startseite mit allen Tools |
| `adventsmarkt/` | Adventsmarkt 2026: Helferliste (`index.html`), Plätzchen-Liste (`plaetzchen.html`) und Übersicht mit PDF (`plan.html`) |
| `apps-script/Code.gs` | Backend für Helfer- und Plätzchen-Liste (läuft in Google Apps Script, nicht auf GitHub) |
| `lib/` | jsPDF und jsPDF-AutoTable (MIT-Lizenz) für den PDF-Export |

---

## Adventsmarkt-Helferliste einrichten

GitHub Pages liefert nur Dateien aus. Damit alle Eltern dieselben Einträge sehen, speichert die App in einer Google Tabelle. Ein kleines Skript in der Tabelle nimmt die Einträge an und verteilt die Plätze. Einmalige Einrichtung: etwa 10 Minuten.

### 1. Google Tabelle anlegen

1. Mit dem Google-Konto, das die Daten haben soll (am besten ein privates oder ein Elternbeirats-Konto), unter [sheets.new](https://sheets.new) eine neue Tabelle anlegen.
2. Einen Namen geben, z. B. „Adventsmarkt 2026 – Helferliste“.

Das Tabellenblatt „Eintraege“ legt das Skript beim ersten Aufruf selbst an.

### 2. Skript einfügen

1. In der Tabelle: **Erweiterungen → Apps Script**.
2. Den vorhandenen Inhalt von `Code.gs` komplett löschen und den Inhalt von `apps-script/Code.gs` aus diesem Repository einfügen.
3. Oben auf das Disketten-Symbol (**Speichern**) klicken.

### 3. Admin-PIN festlegen

Mit der Admin-PIN kannst du im Übersichtsplan alle Einträge ändern oder löschen und siehst die persönlichen Codes, falls jemand seinen vergessen hat.

1. Im Apps-Script-Editor links auf das Zahnrad (**Projekteinstellungen**).
2. Ganz unten bei **Skripteigenschaften** auf **Skripteigenschaft hinzufügen**.
3. Eigenschaft: `ADMIN_PIN`, Wert: eine selbst gewählte PIN, am besten mindestens 6 Zeichen.
4. **Skripteigenschaften speichern**.

Die PIN gehört bewusst nicht in `Code.gs`, weil diese Datei öffentlich auf GitHub liegt.

### 4. Als Web-App bereitstellen

1. Oben rechts **Bereitstellen → Neue Bereitstellung**.
2. Beim Zahnrad neben „Typ auswählen“ **Web-App** wählen.
3. Einstellungen:
   - Beschreibung: z. B. `Helferliste`
   - **Ausführen als: Ich**
   - **Wer hat Zugriff: Jeder**
4. **Bereitstellen** klicken, dann **Zugriff autorisieren** und dein Konto wählen. Google zeigt „Google hat diese App nicht überprüft“, weil es dein eigenes Skript ist: **Erweitert → Zu … wechseln (unsicher)** und dann **Zulassen**.
5. Die **Web-App-URL** kopieren. Sie endet auf `/exec`.

### 5. URL in die App eintragen

In `adventsmarkt/config.js` die URL eintragen:

```js
window.APP_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/…/exec'
};
```

### 6. Auf GitHub hochladen

1. Auf GitHub ein neues, öffentliches Repository anlegen, z. B. `elternbeirat-tools`.
2. **Add file → Upload files** und den gesamten Inhalt dieses Ordners hineinziehen (die Ordner `adventsmarkt`, `apps-script` und `lib` mit). **Commit changes**.
3. **Settings → Pages**: bei „Source“ **Deploy from a branch** wählen, Branch `main`, Ordner `/ (root)`, **Save**.
4. Nach ein bis zwei Minuten ist die Seite erreichbar unter
   `https://duffvader78.github.io/elternbeirat-tools/`
   und die Helferliste direkt unter
   `https://duffvader78.github.io/elternbeirat-tools/adventsmarkt/`

### 7. Kurz testen

1. Die Helferliste öffnen und dich probeweise eintragen.
2. In der Google Tabelle prüfen, ob die Zeile angekommen ist.
3. Den Testeintrag in der App wieder löschen.

Den Link für die Eltern-WhatsApp-Gruppe am besten direkt auf `…/adventsmarkt/` setzen.

---

## Update: Plätzchen-Liste hinzufügen

Wenn die Helferliste schon läuft, sind für die Plätzchen nur zwei Schritte nötig:

1. **Skript aktualisieren:** Im Apps-Script-Editor den Inhalt von `Code.gs` komplett durch die neue Version ersetzen und speichern. Dann **Bereitstellen → Bereitstellungen verwalten → Stift-Symbol → Version: Neue Version → Bereitstellen**. Die URL bleibt gleich, `config.js` muss nicht geändert werden.
2. **Dateien auf GitHub ersetzen** (alle außer `adventsmarkt/config.js`):
   - Hauptordner: `index.html`, `README.md`
   - `adventsmarkt/`: `index.html`, `plan.html`, `plaetzchen.html` (neu), `app.js`, `style.css`
   - `apps-script/`: `Code.gs`

Das Tabellenblatt „Plaetzchen“ legt das Skript beim ersten Aufruf selbst an. Die bestehenden Helfer-Einträge bleiben erhalten.

Link für die Eltern: `…/adventsmarkt/plaetzchen.html`

---

## So funktioniert die Plätzchen-Liste

- **Eintragen:** Name, Plätzchensorte (Freitext), ungefähre Stückzahl und ob man beim Einpacken hilft.
- **Höchstens 3 Familien pro Sorte.** Ähnliche Schreibweisen werden zusammen gezählt, z. B. „Vanillekipferl“, „Vanille-Kipferln“, „vanille kipferl“ und „Vanillekipfel“. Schon beim Tippen sieht man, ob die Sorte noch frei ist, und eine volle Sorte lässt sich nicht mehr eintragen.
- **Wunschsorten:** 10 gängige Sorten werden als „Gesucht“ angezeigt und lassen sich antippen. Sobald jemand eine davon einträgt, verschwindet sie aus der Liste.
- **Andere Namen für dieselbe Sorte** (z. B. Hildabrötchen = Spitzbuben, Husarenkrapfen = Engelsaugen) stehen in `Code.gs` unter `synonyme` und werden gemeinsam gezählt.
- **Tüten-Ziel:** Aus der Gesamtstückzahl berechnet die App die Tüten (Stückzahl ÷ Plätzchen pro Tüte) und zeigt sie als Fortschrittsbalken: Ziel 150, Zusatzziel 200, alles darüber ist Bonus.
- **Übersicht:** Unter „Übersicht → Plätzchen“ stehen der Balken, die Wunschsorten, alle Sorten mit Bäcker:innen und die Helfer:innen fürs Einpacken. Das PDF enthält Helferplan und Plätzchen-Seite.
- **Ändern und Löschen** funktioniert wie bei der Helferliste mit persönlichem Code, die Verwaltung mit derselben Admin-PIN.
- **Rückfrage beim Zusammenfassen:** Ordnet die App eine Sorte über einen anderen Namen oder eine Teilübereinstimmung zu (z. B. „Kipferl“ → Vanillekipferl), fragt sie vor dem Speichern nach: „Ist das dieselbe Sorte?“. Bei „Nein“ gibt man der Sorte einen genaueren Namen. Reine Tippfehler wie „Vanillekipfel“ werden ohne Rückfrage zugeordnet.
- **Trotzdem falsch zusammengefasst?** In der Tabelle im Blatt „Plaetzchen“ die Spalte **Gruppe** korrigieren. Die App zählt nach dieser Spalte.

### Plätzchen anpassen

Alles steht in `Code.gs` im Block `CONFIG` unter `plaetzchen`:

| Einstellung | Bedeutung |
|---|---|
| `stueckProTuete` | geschätzte Plätzchen pro Tüte, aktuell 15 (Probetüte) |
| `zielTueten`, `zusatzZielTueten` | 150 und 200 |
| `maxProSorte` | 3 |
| `wunschsorten` | die 10 gesuchten Sorten |
| `synonyme` | andere Namen, die zur selben Sorte zählen |
| `abgabe`, `einpacken` | Texte für Abgabe und Einpacken |
| `offen` | `false` schließt die Plätzchen-Liste |

Danach wie immer eine neue Version bereitstellen.

---

## So funktioniert die Helferliste

- **Plätze:** 6 Buden mit je 2 Personen pro Schicht, 3 Springer:innen pro Schicht (je eine:r für zwei Buden), 6 Plätze Aufbau, 10 Plätze Abbau.
- **Automatische Verteilung:** Halb besetzte Buden werden zuerst aufgefüllt, damit niemand allein steht. Wer beide Schichten wählt, bleibt nach Möglichkeit an derselben Bude. Bei einer Änderung behält man seinen Platz, solange Schicht und Aufgabe gleich bleiben.
- **Volle Optionen** werden im Formular ausgegraut. Sind alle Schichtplätze belegt, schlägt die App automatisch Aufbau oder Abbau vor, solange dort noch Plätze frei sind.
- **Ändern und Löschen:** Nach dem Eintragen gibt es einen persönlichen 6-stelligen Code und einen Link. Das eigene Gerät merkt sich den Eintrag automatisch. Ohne Code kann niemand fremde Einträge ändern.
- **Verwaltung:** Im Übersichtsplan ganz unten auf **Verwaltung** tippen und die Admin-PIN eingeben. Dann siehst du die persönlichen Codes und kannst jeden Eintrag bearbeiten (✎) oder löschen (🗑).
- **Datenschutz:** Erfasst werden nur Name und Klasse des Kindes. Beides ist im Übersichtsplan für alle mit dem Link sichtbar. Im Formular steht der Hinweis, dass die Angaben nur für den Markt genutzt, nicht weitergegeben und nach dem Markt gelöscht werden. Nach dem Markt deshalb die Zeilen in der Tabelle löschen.

## Anpassen

Zahlen, Zeiten, Titel und Datum stehen oben in `Code.gs` im Block `CONFIG`. Die App übernimmt sie automatisch, `config.js` musst du dafür nicht anfassen.

- Anmeldung schließen: `anmeldungOffen: false`
- Mehr Buden oder Aufbauplätze: `buden`, `aufbau`, `abbau` ändern

**Wichtig:** Nach jeder Änderung an `Code.gs` im Apps-Script-Editor speichern und dann **Bereitstellen → Bereitstellungen verwalten → Stift-Symbol → Version: Neue Version → Bereitstellen**. Die URL bleibt dabei gleich. Ohne neue Version läuft weiter der alte Stand.

Einträge kannst du auch direkt in der Tabelle korrigieren. Dabei das Format beibehalten: `Bude 3` bzw. `Springer 2` in den Schicht-Spalten und `ja` bei Aufbau/Abbau. Achte darauf, keine Bude dreifach zu belegen, denn die Tabelle prüft das nicht.

## Neues Tool hinzufügen

Einen neuen Ordner anlegen (z. B. `sommerfest/`) und in der Startseite `index.html` eine weitere Kachel nach dem Muster der Adventsmarkt-Kachel einfügen, vor dem „Hier ist Platz …“-Platzhalter.
