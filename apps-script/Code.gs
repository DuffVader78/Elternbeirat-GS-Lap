/**
 * Schichtplan Adventsmarkt – Backend für Google Apps Script
 * ----------------------------------------------------------
 * Gehört zu einer Google Tabelle (Erweiterungen → Apps Script).
 * Speichert alle Einträge im Tabellenblatt "Eintraege" und verteilt
 * die Plätze automatisch. Einrichtung: siehe README.md im Repository.
 *
 * Admin-PIN NICHT hier eintragen (diese Datei liegt öffentlich auf GitHub),
 * sondern unter Projekteinstellungen → Script-Properties → ADMIN_PIN.
 */

// ===== Einstellungen ======================================================
var CONFIG = {
  titel: 'Adventsmarkt 2026',
  datum: 'Montag, 07.12.2026',
  buden: 6,          // Anzahl Buden
  proBude: 2,        // Verkäufer:innen pro Bude und Schicht
  springer: 3,       // Springer:innen pro Schicht (je einer für zwei Buden)
  aufbau: 6,         // Plätze Aufbau
  abbau: 10,         // Plätze Abbau
  zeiten: {
    aufbau: '14:00–16:00 Uhr',
    s1: '16:00–17:00 Uhr',
    s2: '17:00–18:00 Uhr',
    abbau: '18:00–19:00 Uhr'
  },
  klassen: ['1a', '1b', '1c', '2a', '2b', '2c', '3a', '3b', '3c', '4a', '4b', '4c'],
  anmeldungOffen: true  // auf false setzen, um neue Einträge zu sperren
};

var SHEET_NAME = 'Eintraege';
var HEADER = ['ID', 'Code', 'Name', 'Klasse', 'Schicht 1', 'Schicht 2', 'Aufbau', 'Abbau', 'Erstellt', 'Geändert'];
var COL = { id: 0, code: 1, name: 2, klasse: 3, s1: 4, s2: 5, aufbau: 6, abbau: 7, erstellt: 8, geaendert: 9 };
var CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// ===== Web-App-Einstieg ===================================================
function doGet(e) {
  var p = (e && e.parameter) || {};
  return respond(run({ action: p.action || 'state' }));
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return respond({ ok: false, error: 'Ungültige Anfrage.' });
  }
  return respond(run(req));
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function run(req) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return { ok: false, error: 'Gerade ist viel los. Bitte in ein paar Sekunden noch einmal versuchen.' };
  }
  try {
    return handle(req || {});
  } catch (err) {
    if (err && err.userMessage) return { ok: false, error: err.userMessage, state: publicState(readAll()) };
    console.error(err);
    return { ok: false, error: 'Unerwarteter Fehler: ' + (err && err.message ? err.message : err) };
  } finally {
    lock.releaseLock();
  }
}

function fail(msg) {
  var e = new Error(msg);
  e.userMessage = msg;
  throw e;
}

// ===== Aktionen ===========================================================
function handle(req) {
  var entries = readAll();
  switch (req.action) {
    case 'state':
      return { ok: true, state: publicState(entries) };

    case 'create': {
      if (!CONFIG.anmeldungOffen) fail('Die Anmeldung ist geschlossen.');
      var input = validate(req.data);
      var slots = assign(entries, input, null);
      var entry = {
        id: 'e' + new Date().getTime().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
        code: newCode(entries),
        name: input.name, klasse: input.klasse,
        s1: slots.s1, s2: slots.s2, aufbau: slots.aufbau, abbau: slots.abbau,
        erstellt: now(), geaendert: ''
      };
      sheet().appendRow(toRow(entry));
      entries.push(entry);
      return { ok: true, entry: ownView(entry), state: publicState(entries) };
    }

    case 'get': {
      var found = authorize(entries, req);
      return { ok: true, entry: ownView(found), state: publicState(entries) };
    }

    case 'update': {
      var cur = authorize(entries, req);
      var data = validate(req.data);
      var others = entries.filter(function (x) { return x.id !== cur.id; });
      var s = assign(others, data, cur);
      cur.name = data.name; cur.klasse = data.klasse;
      cur.s1 = s.s1; cur.s2 = s.s2; cur.aufbau = s.aufbau; cur.abbau = s.abbau;
      cur.geaendert = now();
      sheet().getRange(cur._row, 1, 1, HEADER.length).setValues([toRow(cur)]);
      return { ok: true, entry: ownView(cur), state: publicState(entries) };
    }

    case 'delete': {
      var del = authorize(entries, req);
      sheet().deleteRow(del._row);
      var rest = entries.filter(function (x) { return x.id !== del.id; });
      return { ok: true, state: publicState(rest) };
    }

    case 'admin': {
      checkAdmin(req.pin);
      return { ok: true, entries: entries.map(ownView), state: publicState(entries) };
    }

    default:
      fail('Unbekannte Aktion.');
  }
}

// Eintrag über persönlichen Code oder Admin-PIN freischalten
function authorize(entries, req) {
  if (req.pin) {
    checkAdmin(req.pin);
    var byId = entries.filter(function (x) { return x.id === req.id; })[0];
    if (!byId) fail('Diesen Eintrag gibt es nicht mehr.');
    return byId;
  }
  var code = normCode(req.code);
  if (code.length !== 6) fail('Der Code hat 6 Zeichen.');
  var hit = entries.filter(function (x) { return x.code === code; })[0];
  if (!hit) {
    tooManyTries('code');
    fail('Zu diesem Code gibt es keinen Eintrag. Bitte noch einmal prüfen.');
  }
  if (req.id && hit.id !== req.id) fail('Der Code passt nicht zu diesem Eintrag.');
  return hit;
}

function checkAdmin(pin) {
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (!real) fail('Für die Verwaltung ist noch keine Admin-PIN eingerichtet.');
  if (String(pin || '') !== String(real)) {
    tooManyTries('admin');
    fail('Admin-PIN falsch.');
  }
}

// einfache Bremse gegen Durchprobieren von Codes/PINs
function tooManyTries(kind) {
  var cache = CacheService.getScriptCache();
  var key = 'fails_' + kind;
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 600);
  if (n > 30) fail('Zu viele Fehlversuche. Bitte in 10 Minuten noch einmal versuchen.');
}

// ===== Prüfen und Verteilen ===============================================
function validate(d) {
  d = d || {};
  var name = String(d.name || '').replace(/\s+/g, ' ').trim();
  if (name.length < 2) fail('Bitte deinen Namen eintragen.');
  if (name.length > 60) fail('Der Name ist zu lang (höchstens 60 Zeichen).');
  var klasse = String(d.klasse || '');
  if (CONFIG.klassen.indexOf(klasse) < 0) fail('Bitte die Klasse deines Kindes auswählen.');
  var schicht = String(d.schicht || 'keine');
  if (['1', '2', 'beide', 'keine'].indexOf(schicht) < 0) fail('Bitte eine Schicht auswählen.');
  var rolle = String(d.rolle || '');
  if (schicht !== 'keine' && ['bude', 'springer'].indexOf(rolle) < 0) fail('Bitte auswählen: Bude oder Springer.');
  var aufbau = d.aufbau === true;
  var abbau = d.abbau === true;
  if (schicht === 'keine' && !aufbau && !abbau) fail('Bitte mindestens eine Schicht, den Aufbau oder den Abbau auswählen.');
  return { name: name, klasse: klasse, schicht: schicht, rolle: schicht === 'keine' ? '' : rolle, aufbau: aufbau, abbau: abbau };
}

// Verteilt die Plätze. "others" enthält alle Einträge außer dem eigenen.
function assign(others, input, prev) {
  var occ = occupancy(others);
  var out = { s1: '', s2: '', aufbau: false, abbau: false };
  var shifts = input.schicht === 'beide' ? ['s1', 's2'] : input.schicht === '1' ? ['s1'] : input.schicht === '2' ? ['s2'] : [];
  var label = input.rolle === 'springer' ? 'Springer' : 'Bude';
  var cap = input.rolle === 'springer' ? 1 : CONFIG.proBude;
  var units = input.rolle === 'springer' ? CONFIG.springer : CONFIG.buden;

  function free(sh, n) { return (occ[sh][label + ' ' + n] || 0) < cap; }
  function load(sh, n) { return occ[sh][label + ' ' + n] || 0; }
  function prevUnit(sh) {
    if (!prev || !prev[sh]) return 0;
    var m = String(prev[sh]).match(/^(Bude|Springer) (\d+)$/);
    return m && m[1] === label ? Number(m[2]) : 0;
  }
  // beste Einheit: eigene bisherige > halb besetzte Bude (Paare auffüllen) > niedrigste Nummer
  function pick(shs) {
    for (var i = 0; i < shs.length; i++) {
      var p = prevUnit(shs[i]);
      if (p && shs.every(function (sh) { return free(sh, p); })) return p;
    }
    var best = 0, bestScore = -1;
    for (var n = 1; n <= units; n++) {
      if (!shs.every(function (sh) { return free(sh, n); })) continue;
      var score = shs.reduce(function (s, sh) { return s + load(sh, n); }, 0);
      if (score > bestScore) { best = n; bestScore = score; }
    }
    return best;
  }

  if (shifts.length === 2) {
    var both = pick(shifts);
    if (both) {
      out.s1 = label + ' ' + both; out.s2 = label + ' ' + both;
    } else {
      var a = pick(['s1']), b = pick(['s2']);
      if (!a || !b) fail(fullMsg(input, !a ? 's1' : 's2'));
      out.s1 = label + ' ' + a; out.s2 = label + ' ' + b;
    }
  } else if (shifts.length === 1) {
    var u = pick(shifts);
    if (!u) fail(fullMsg(input, shifts[0]));
    out[shifts[0]] = label + ' ' + u;
  }

  if (input.aufbau) {
    if (occ.aufbau >= CONFIG.aufbau && !(prev && prev.aufbau)) fail('Beim Aufbau sind inzwischen alle Plätze vergeben.');
    out.aufbau = true;
  }
  if (input.abbau) {
    if (occ.abbau >= CONFIG.abbau && !(prev && prev.abbau)) fail('Beim Abbau sind inzwischen alle Plätze vergeben.');
    out.abbau = true;
  }
  return out;
}

function fullMsg(input, sh) {
  var was = input.rolle === 'springer' ? 'Springer-Plätze' : 'Plätze an den Buden';
  return 'In Schicht ' + (sh === 's1' ? '1' : '2') + ' sind inzwischen alle ' + was + ' vergeben. Bitte eine andere Auswahl treffen.';
}

function occupancy(entries) {
  var occ = { s1: {}, s2: {}, aufbau: 0, abbau: 0 };
  entries.forEach(function (x) {
    ['s1', 's2'].forEach(function (sh) { if (x[sh]) occ[sh][x[sh]] = (occ[sh][x[sh]] || 0) + 1; });
    if (x.aufbau) occ.aufbau++;
    if (x.abbau) occ.abbau++;
  });
  return occ;
}

// ===== Tabelle ============================================================
function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1000, HEADER.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold').setBackground('#eeeeee');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, HEADER.length, 120);
    sh.setColumnWidth(3, 180);
  }
  return sh;
}

function readAll() {
  var sh = sheet();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, HEADER.length).getDisplayValues();
  var out = [];
  rows.forEach(function (r, i) {
    if (!r[COL.id]) return;
    out.push({
      _row: i + 2,
      id: r[COL.id], code: normCode(r[COL.code]), name: r[COL.name], klasse: r[COL.klasse],
      s1: r[COL.s1].trim(), s2: r[COL.s2].trim(),
      aufbau: isYes(r[COL.aufbau]), abbau: isYes(r[COL.abbau]),
      erstellt: r[COL.erstellt], geaendert: r[COL.geaendert]
    });
  });
  return out;
}

function toRow(x) {
  return [x.id, x.code, x.name, x.klasse, x.s1, x.s2, x.aufbau ? 'ja' : '', x.abbau ? 'ja' : '', x.erstellt, x.geaendert];
}

function isYes(v) { return /^(ja|x|true|1)$/i.test(String(v).trim()); }

// ===== Hilfen =============================================================
function publicState(entries) {
  return {
    config: CONFIG,
    entries: entries.map(function (x) {
      return { id: x.id, name: x.name, klasse: x.klasse, s1: x.s1, s2: x.s2, aufbau: x.aufbau, abbau: x.abbau, erstellt: x.erstellt };
    }),
    stand: now()
  };
}

function ownView(x) {
  return { id: x.id, code: x.code, name: x.name, klasse: x.klasse, s1: x.s1, s2: x.s2, aufbau: x.aufbau, abbau: x.abbau, erstellt: x.erstellt, geaendert: x.geaendert };
}

function newCode(entries) {
  var used = {};
  entries.forEach(function (x) { used[x.code] = true; });
  for (var t = 0; t < 1000; t++) {
    var c = '';
    for (var i = 0; i < 6; i++) c += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
    if (!used[c]) return c;
  }
  fail('Es konnte kein Code erzeugt werden.');
}

function normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function now() { return Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm'); }
