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
  // Function calls are budgeted (125,000 a month on this plan), so pages read the
  // state the CDN caches for one second: however many people watch, the function
  // runs about once a second. Only the page that just changed something reads past
  // the cache, for a moment, so its own change shows at once.
  var POLL_MS = 2000;       // delegates
  var POLL_FRESH_MS = 1000; // desk and board
  var FRESH_AFTER_ACTION_MS = 1500;
  var POLL_TIMEOUT_MS = 8000; // a hung request must not stop the page updating
  var loaded = null;

  // Two ways to follow the data. Firebase pushes changes instantly, but its host is
  // blocked on some networks, and then it fails silently. So every page polls this
  // site's own server until Firebase is confirmed connected, and goes back to polling
  // whenever Firebase drops. Either way the page keeps updating by itself.
  var watchers = [];
  var firebaseLive = false, firebaseDenied = false, connectionWatched = false;
  var fresh = false;
  var pollTimer = null, inFlight = 0, pollFails = 0, sequence = 0, applied = 0;
  // After this page changes something, a read that left before the change would
  // paint the old state over the new one. Each change starts a new epoch, and
  // reads from an older epoch are dropped.
  var epoch = 0, pollAgain = false, freshUntil = 0;

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

  function deliver(w, value) {
    var v = value === undefined ? null : value;
    var text = JSON.stringify(v);
    if (text === w.last) return;
    w.last = text;
    w.cb(v);
  }

  function pick(state, path) {
    return path.split('/').reduce(function (o, k) { return o === null || o === undefined ? null : o[k]; }, state);
  }

  function fetchState() {
    if (Date.now() < freshUntil) return window.VoteData.api('state');
    return fetch(API + '?state=1').then(function (res) {
      if (!res.ok) throw new Error('http-' + res.status);
      return res.json();
    });
  }

  // Reads overlap: the next one leaves on time even while the last is still on its
  // way, so a slow server answer does not slow the page down. Answers older than one
  // already shown, or older than this page's last action, are dropped.
  function pollNow() {
    clearTimeout(pollTimer);
    pollTimer = null;
    if (firebaseLive || !watchers.length) return;
    if (inFlight >= 2) { pollAgain = true; return; }
    inFlight++;
    var id = ++sequence, started = epoch;
    Promise.race([fetchState(), new Promise(function (resolve, reject) {
      setTimeout(function () { reject(new Error('timeout')); }, POLL_TIMEOUT_MS);
    })]).then(function (state) {
      pollFails = 0;
      if (firebaseLive || started !== epoch || id < applied) return;
      applied = id;
      watchers.slice().forEach(function (w) { deliver(w, pick(state, w.path)); });
    }).catch(function (err) {
      if (++pollFails < 3) return;
      watchers.slice().forEach(function (w) { w.last = '__error__'; w.cb(undefined, err); });
    }).then(function () {
      inFlight--;
      if (pollAgain) { pollAgain = false; pollNow(); }
    });
    schedulePoll();
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    pollTimer = null;
    if (firebaseLive || !watchers.length) return;
    pollTimer = setTimeout(function () {
      if (document.hidden) schedulePoll(); else pollNow();
    }, fresh ? POLL_FRESH_MS : POLL_MS);
  }

  function setFirebaseLive(live) {
    firebaseLive = live && !firebaseDenied;
    if (firebaseLive) { clearTimeout(pollTimer); pollTimer = null; } else if (!pollTimer) pollNow();
  }

  function watchConnection(x) {
    if (connectionWatched) return;
    connectionWatched = true;
    x.sdk.onValue(x.sdk.ref(x.db, '.info/connected'), function (s) { setFirebaseLive(s.val() === true); });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) pollNow();
  });

  window.VoteData = {
    configured: function () { return !!PLACARD_CONFIG.databaseURL; },

    // Desk and board: read a little more often than delegates.
    useFreshReads: function () { fresh = true; },

    // Fetch now, after this page changed something.
    refresh: function () { epoch++; freshUntil = Date.now() + FRESH_AFTER_ACTION_MS; pollNow(); },

    // Live value of one path. Calls back now and on every change; returns unsubscribe.
    watch: function (path, cb) {
      var w = { path: path, cb: cb, last: '__none__', stopped: false, unsubscribe: null };
      watchers.push(w);
      pollNow();
      load().then(function (x) {
        if (w.stopped) return;
        watchConnection(x);
        w.unsubscribe = x.sdk.onValue(x.sdk.ref(x.db, path), function (s) {
          deliver(w, s.val());
        }, function () {
          // refused by the rules: keep following through the server
          firebaseDenied = true;
          setFirebaseLive(false);
        });
      }).catch(function () { /* the polling above carries on */ });
      return function () {
        w.stopped = true;
        watchers = watchers.filter(function (o) { return o !== w; });
        if (w.unsubscribe) w.unsubscribe();
      };
    },

    // Every write and every code check goes to the server.
    api: function (action, body) {
      var payload = Object.assign({ action: action }, body || {});
      return fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (res.ok) return res.json();
        return res.json().catch(function () { return {}; }).then(function (b) {
          var err = new Error('http-' + res.status);
          err.detail = b.detail || 'http ' + res.status;
          throw err;
        });
      });
    },

    // Firebase keys cannot contain . # $ [ ] /
    key: function (name) { return String(name).replace(/[.#$\[\]\/]/g, '_'); },

    // Everyone who can vote, one entry per voting unit. Each delegation is its own
    // country. The chairs of each committee form one unit that votes with the UN
    // flag under the committee's name, exactly like a country (nine in all).
    // The Secretariat does not vote.
    voters: function (data) {
      var out = [], seen = {}, committees = [];
      if (!data) return out;
      data.delegates.forEach(function (d) {
        if (d.c === 'Secretariat') return;
        if (d.d === 'UN') { if (committees.indexOf(d.c) === -1) committees.push(d.c); return; }
        if (!data.flags[d.d] || seen[d.d]) return;
        seen[d.d] = true;
        // short labels for the longest names, shown on the board and desk
        var short = { 'DPRK': 'DPRK', 'DR CONGO': 'DRC', 'UAE': 'UAE' };
        var label = short[d.d] || data.names[d.d] || d.d;
        out.push({ id: d.d, kind: 'country', name: data.names[d.d] || d.d, label: label, flag: data.flags[d.d] });
      });
      out.sort(function (a, b) { return a.label.localeCompare(b.label); });
      // the committees follow the countries, in the conference's own order
      committees.forEach(function (c) { out.push({ id: 'UN ' + c, kind: 'un', name: c, label: c, flag: 'unflag' }); });
      return out;
    }
  };
})();
