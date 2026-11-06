// Live placard list shared by placard.html (delegates) and placard-admin.html.
//
// Fill in the web-app settings from the Firebase console
// (Project settings → Your apps → Web app → SDK setup and configuration).
// Only the list of raised placards lives here; nothing is kept after All clear.
var PLACARD_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  appId: ""
};

(function () {
  var APP = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
  var DB = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
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

  // server-side timestamp placeholder: the database writes its own clock, so
  // arrival order is the server's order rather than each phone's clock
  window.PlacardData = {
    SERVER_TIME: { '.sv': 'timestamp' },
    configured: function () { return !!PLACARD_CONFIG.databaseURL; },

    // First request for a country is stored; every later one is dropped.
    // The transaction runs on the server, so simultaneous presses cannot
    // both win. Resolves true only for the entry that was actually stored.
    claim: function (key, entry) {
      return load().then(function (x) {
        var ref = x.sdk.ref(x.db, 'placard/' + key);
        return x.sdk.runTransaction(ref, function (cur) {
          return cur === null ? entry : undefined;   // undefined aborts: already taken
        }).then(function (res) {
          var v = res.snapshot.val();
          return !!(res.committed && v && v.id === entry.id);
        });
      });
    },

    get: function (key) {
      return load().then(function (x) {
        return x.sdk.get(x.sdk.ref(x.db, 'placard/' + key)).then(function (s) { return s.val(); });
      });
    },

    // Calls back immediately and again on every change, with no refresh needed.
    watchAll: function (cb) {
      var unsubscribe = null, stopped = false;
      load().then(function (x) {
        if (stopped) return;
        unsubscribe = x.sdk.onValue(x.sdk.ref(x.db, 'placard'), function (s) { cb(s.val()); });
      }).catch(function (err) { cb(null, err); });
      return function () { stopped = true; if (unsubscribe) unsubscribe(); };
    },

    clearAll: function () {
      return load().then(function (x) { return x.sdk.remove(x.sdk.ref(x.db, 'placard')); });
    }
  };
})();
