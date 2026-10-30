/* Gemeinsame Funktionen für Eintragen (index.html) und Übersichtsplan (plan.html) */
(function () {
  'use strict';
  var STORE_KEY = 'adventsmarkt2026.eintraege';
  var KEKS_KEY = 'adventsmarkt2026.kekse';
  var ADMIN_KEY = 'adventsmarkt2026.adminpin';

  function apiUrl() {
    var u = (window.APP_CONFIG && window.APP_CONFIG.apiUrl) || '';
    return /^https?:\/\//.test(u) ? u : '';
  }

  // Anfrage an das Apps-Script-Backend. text/plain vermeidet den CORS-Preflight.
  function api(action, payload) {
    var url = apiUrl();
    if (!url) return Promise.reject(new Error('In config.js ist noch keine Web-App-URL eingetragen.'));
    var body = Object.assign({ action: action }, payload || {});
    return fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('Der Server antwortet gerade nicht (' + r.status + ').');
      return r.json();
    }, function () {
      throw new Error('Keine Verbindung. Bitte Internet prüfen und noch einmal versuchen.');
    });
  }

  // --- auf diesem Gerät gemerkte Einträge (kind: 'helfer' oder 'keks') ---
  function key(kind) { return kind === 'keks' ? KEKS_KEY : STORE_KEY; }
  function loadMine(kind) {
    try { return JSON.parse(localStorage.getItem(key(kind)) || '[]').filter(function (x) { return x && x.id && x.code; }); }
    catch (e) { return []; }
  }
  function saveMine(list, kind) { try { localStorage.setItem(key(kind), JSON.stringify(list)); } catch (e) {} }
  function rememberMine(entry, kind) {
    var list = loadMine(kind).filter(function (x) { return x.id !== entry.id; });
    list.push({ id: entry.id, code: entry.code, name: entry.name });
    saveMine(list, kind);
  }
  function forgetMine(id, kind) { saveMine(loadMine(kind).filter(function (x) { return x.id !== id; }), kind); }

  function getAdminPin() { try { return sessionStorage.getItem(ADMIN_KEY) || ''; } catch (e) { return ''; } }
  function setAdminPin(p) { try { p ? sessionStorage.setItem(ADMIN_KEY, p) : sessionStorage.removeItem(ADMIN_KEY); } catch (e) {} }

  // --- Belegung ---
  function occupancy(entries, excludeId) {
    var occ = { s1: { bude: 0, springer: 0, units: {} }, s2: { bude: 0, springer: 0, units: {} }, aufbau: 0, abbau: 0 };
    entries.forEach(function (x) {
      if (x.id === excludeId) return;
      ['s1', 's2'].forEach(function (sh) {
        var v = x[sh];
        if (!v) return;
        occ[sh].units[v] = (occ[sh].units[v] || []).concat([x]);
        if (/^Springer/.test(v)) occ[sh].springer++; else occ[sh].bude++;
      });
      if (x.aufbau) occ.aufbau++;
      if (x.abbau) occ.abbau++;
    });
    return occ;
  }

  function freeCounts(state, excludeId) {
    var c = state.config, o = occupancy(state.entries, excludeId);
    function sh(k) { return { bude: c.buden * c.proBude - o[k].bude, springer: c.springer - o[k].springer }; }
    return { s1: sh('s1'), s2: sh('s2'), aufbau: c.aufbau - o.aufbau, abbau: c.abbau - o.abbau };
  }

  function springerBuden(n) { return 'Buden ' + (2 * n - 1) + ' + ' + (2 * n); }

  function slotText(v, cfg) {
    var m = String(v || '').match(/^Springer (\d+)$/);
    return m ? 'Springer:in ' + m[1] + ' (für ' + springerBuden(Number(m[1])) + ')' : v;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function fmtCode(c) { c = String(c || ''); return c.length === 6 ? c.slice(0, 3) + '-' + c.slice(3) : c; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function busy(btn, on, text) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + esc(text || 'Bitte warten …'); }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  // --- Plätzchen: Sortenabgleich (identisch in apps-script/Code.gs) ---
  function sortKey(s) {
    s = String(s || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
    var raw = s;
    ['plaetzchen', 'gebackenes', 'gebaeck', 'kekse', 'keks'].forEach(function (suf) {
      if (s.length - suf.length >= 4 && s.slice(-suf.length) === suf) s = s.slice(0, -suf.length);
    });
    if (s.length > 6 && s.slice(-2) === 'en') s = s.slice(0, -2);
    else if (s.length > 6 && /[nes]$/.test(s)) s = s.slice(0, -1);
    return s || raw;
  }
  function levenshtein(a, b) {
    if (a === b) return 0;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function keyDistance(a, b) {
    if (!a || !b) return -1;
    if (a === b) return 0;
    var short = a.length <= b.length ? a : b, long = a.length <= b.length ? b : a;
    var d = levenshtein(a, b);
    var allowed = short.length >= 10 ? 2 : short.length >= 5 ? 1 : 0;
    if (d <= allowed) return d;
    if (short.length >= 7 && (long.indexOf(short) === 0 || long.slice(-short.length) === short)) return 3;
    return -1;
  }
  function keksGroups(state, excludeId) {
    var P = state.config.plaetzchen, groups = [], byName = {};
    function add(name, wunsch) {
      var k = name.toLowerCase();
      if (!byName[k]) { byName[k] = { name: name, wunsch: !!wunsch, keys: [], count: 0, stueck: 0, members: [] }; groups.push(byName[k]); }
      return byName[k];
    }
    P.wunschsorten.forEach(function (w) {
      var g = add(w, true);
      g.keys.push(sortKey(w));
      (P.synonyme[w] || []).forEach(function (s) { g.keys.push(sortKey(s)); });
    });
    (state.kekse || []).forEach(function (x) {
      if (x.id === excludeId) return;
      var g = add(x.gruppe || x.sorte, false);
      g.keys.push(sortKey(g.name), sortKey(x.sorte));
      g.count++; g.stueck += Number(x.stueck) || 0; g.members.push(x);
    });
    return groups;
  }
  function matchGroup(sorte, groups) {
    var key = sortKey(sorte), best = null, bestD = 99;
    if (key.length < 3) return null;
    groups.forEach(function (g) {
      g.keys.forEach(function (k) {
        var d = keyDistance(key, k);
        if (d >= 0 && d < bestD) { best = g; bestD = d; }
      });
    });
    return best;
  }
  function keksStats(state) {
    var P = state.config.plaetzchen, k = state.kekse || [];
    var stueck = k.reduce(function (s, x) { return s + (Number(x.stueck) || 0); }, 0);
    var families = {};
    k.forEach(function (x) { families[x.name.toLowerCase()] = 1; });
    var groups = keksGroups(state);
    return {
      stueck: stueck,
      tueten: Math.floor(stueck / P.stueckProTuete),
      familien: Object.keys(families).length,
      sorten: groups.filter(function (g) { return g.count > 0; }).length,
      einpacken: k.filter(function (x) { return x.einpacken; }),
      groups: groups
    };
  }

  // Kickstarter-Balken: Ziel, Zusatzziel, Bonus
  function goalBar(state, compact) {
    var P = state.config.plaetzchen, st = keksStats(state);
    var t = st.tueten, z1 = P.zielTueten, z2 = P.zusatzZielTueten;
    var max = Math.max(Math.round(z2 * 1.3), t);
    function pct(v) { return Math.min(100, 100 * v / max).toFixed(2) + '%'; }
    var msg;
    if (t < z1) msg = 'Noch <b>' + (z1 - t) + ' Tüten</b> bis zum Ziel von ' + z1 + '.';
    else if (t < z2) msg = '🎉 Ziel erreicht! Noch <b>' + (z2 - t) + ' Tüten</b> bis zum Zusatzziel von ' + z2 + '.';
    else if (t === z2) msg = '🎉 Zusatzziel erreicht! Alles, was jetzt noch kommt, ist Bonus.';
    else msg = '🌟 Alle Ziele erreicht, dazu <b>' + (t - z2) + ' Bonus-Tüten</b>!';
    return '<div class="goal' + (compact ? ' compact' : '') + '">' +
      '<div class="goal-head"><div><span class="goal-num">' + t + '</span> <span class="goal-unit">Tüten</span></div>' +
      '<div class="goal-sub">≈ ' + st.stueck + ' Plätzchen · ' + st.familien + (st.familien === 1 ? ' Familie' : ' Familien') + ' · ' + st.sorten + (st.sorten === 1 ? ' Sorte' : ' Sorten') + '</div></div>' +
      '<div class="goal-track" role="img" aria-label="' + t + ' von ' + z1 + ' Tüten">' +
      '<i class="f1" style="width:' + pct(Math.min(t, z1)) + '"></i>' +
      (t > z1 ? '<i class="f2" style="left:' + pct(z1) + ';width:calc(' + pct(Math.min(t, z2)) + ' - ' + pct(z1) + ')"></i>' : '') +
      (t > z2 ? '<i class="f3" style="left:' + pct(z2) + ';width:calc(' + pct(t) + ' - ' + pct(z2) + ')"></i>' : '') +
      '<span class="mark" style="left:' + pct(z1) + '"></span><span class="mark" style="left:' + pct(z2) + '"></span></div>' +
      '<div class="goal-labels"><span style="left:' + pct(z1) + '">Ziel ' + z1 + '</span><span style="left:' + pct(z2) + '">Zusatz ' + z2 + '</span><span class="bonus">Bonus</span></div>' +
      '<div class="goal-msg">' + msg + '</div></div>';
  }

  window.AM = {
    sortKey: sortKey, keyDistance: keyDistance, keksGroups: keksGroups, matchGroup: matchGroup, keksStats: keksStats, goalBar: goalBar,
    api: api, apiUrl: apiUrl, loadMine: loadMine, rememberMine: rememberMine, forgetMine: forgetMine,
    getAdminPin: getAdminPin, setAdminPin: setAdminPin, occupancy: occupancy, freeCounts: freeCounts,
    springerBuden: springerBuden, slotText: slotText, esc: esc, fmtCode: fmtCode, $: $, $$: $$, busy: busy
  };
})();
