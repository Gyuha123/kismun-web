// Shared vote data for the allocation page, the live board and the desk.
//
// Reads go straight to the Firebase Realtime Database (public read on the
// "votes" and "session" paths only). Every write goes through the server
// function at /.netlify/functions/api, which checks codes and the desk password.
//
// Fill in the web-app settings from the Firebase console
// (Project settings → Your apps → Web app → SDK setup and configuration).
var PLACARD_CONFIG = {
  apiKey: "AIzaSyAdDxZ4XEO707F9z1nxYUL7SLbOOA85Dfs",
  authDomain: "kismun-placard.firebaseapp.com",
  databaseURL: "https://kismun-placard-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kismun-placard",
  appId: "1:207700636090:web:7e9f6a1b4a38418f54ed83"
};

(function () {
  var APP = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
  var DB = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
  var API = '/.netlify/functions/api';
  var loaded = null;

  function load() {
    if (!PLACARD_CONFIG.databaseURL) return Promise.reject(new Error('not-configured'));
    if (!loaded) {
      loaded = Promise.all([import(APP), import(DB)]).then(function (m) {
        var app = m[0].initializeApp(PLACARD_CONFIG);
        return { db: m[1].getDatabase(app), sdk: m[1] };
      });
    }
    return loaded;
  }

  window.VoteData = {
    configured: function () { return !!PLACARD_CONFIG.databaseURL; },

    // Live value of one path. Calls back now and on every change; returns unsubscribe.
    watch: function (path, cb) {
      var unsubscribe = null, stopped = false;
      load().then(function (x) {
        if (stopped) return;
        unsubscribe = x.sdk.onValue(x.sdk.ref(x.db, path), function (s) { cb(s.val()); });
      }).catch(function (err) { cb(undefined, err); });
      return function () { stopped = true; if (unsubscribe) unsubscribe(); };
    },

    // Every write and every code check goes to the server.
    api: function (action, body) {
      var payload = Object.assign({ action: action }, body || {});
      return fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error('http-' + res.status);
        return res.json();
      });
    },

    // Firebase keys cannot contain . # $ [ ] /
    key: function (name) { return String(name).replace(/[.#$\[\]\/]/g, '_'); },

    // Everyone who can vote, one entry per voting unit. Each delegation is its own
    // country. The 18 committee chairs form ONE unit, "UN", that votes with the UN
    // flag, exactly like a country. The Secretariat does not vote.
    voters: function (data) {
      var out = [], seen = {}, chairs = 0;
      if (!data) return out;
      data.delegates.forEach(function (d) {
        if (d.c === 'Secretariat') return;
        if (d.d === 'UN') { chairs++; return; }
        if (!data.flags[d.d] || seen[d.d]) return;
        seen[d.d] = true;
        out.push({ id: d.d, kind: 'country', name: data.names[d.d] || d.d, label: data.names[d.d] || d.d, flag: data.flags[d.d] });
      });
      if (chairs) out.push({ id: 'UN', kind: 'un', name: 'UN', label: 'UN (Chairs)', flag: 'unflag' });
      out.sort(function (a, b) { return a.label.localeCompare(b.label); });
      return out;
    },

    // Firebase keys cannot contain . # $ [ ] /
    key: function (name) { return String(name).replace(/[.#$\[\]\/]/g, '_'); }
  };
})();
