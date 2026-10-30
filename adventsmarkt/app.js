/* Gemeinsame Funktionen für Eintragen (index.html) und Übersichtsplan (plan.html) */
(function () {
  'use strict';
  var STORE_KEY = 'adventsmarkt2026.eintraege';
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

  // --- auf diesem Gerät gemerkte Einträge ---
  function loadMine() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]').filter(function (x) { return x && x.id && x.code; }); }
    catch (e) { return []; }
  }
  function saveMine(list) { try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) {} }
  function rememberMine(entry) {
    var list = loadMine().filter(function (x) { return x.id !== entry.id; });
    list.push({ id: entry.id, code: entry.code, name: entry.name });
    saveMine(list);
  }
  function forgetMine(id) { saveMine(loadMine().filter(function (x) { return x.id !== id; })); }

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

  window.AM = {
    api: api, apiUrl: apiUrl, loadMine: loadMine, rememberMine: rememberMine, forgetMine: forgetMine,
    getAdminPin: getAdminPin, setAdminPin: setAdminPin, occupancy: occupancy, freeCounts: freeCounts,
    springerBuden: springerBuden, slotText: slotText, esc: esc, fmtCode: fmtCode, $: $, $$: $$, busy: busy
  };
})();
