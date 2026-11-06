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
    key: function (name) { return String(name).replace(/[.#$\[\]\/]/g, '_'); }
  };
})();
