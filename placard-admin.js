// Placard desk — password gate, then a live list of raised placards.
// Shows only the flag and the country name. "All clear" wipes the list so
// the same desk can run another round.
(function () {
  // SHA-256 of the desk password. The plain password is not stored here.
  var PASSWORD_SHA256 = '31ffc5f32537c7f67c787bf32e27a2d8aeac8efd2ad86f1ae4fd586369cab37e';
  var UNLOCK_KEY = 'kismunPlacardDesk';

  var $ = function (id) { return document.getElementById(id); };
  var gate = $('paGate');
  var panel = $('paPanel');
  var form = $('paForm');
  var pass = $('paPass');
  var err = $('paError');
  var count = $('paCount');
  var grid = $('paGrid');
  var empty = $('paEmpty');
  var note = $('paNote');
  var clearBtn = $('paClear');

  var seen = {};          // ids already shown, so only new tiles animate in
  var started = false;

  function sha256Hex(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  function tile(entry, isNew) {
    var el = document.createElement('div');
    el.className = 'pa-tile' + (isNew ? ' is-new' : '');
    var img = document.createElement('img');
    img.src = 'flags/4x3/' + entry.flag + '.svg';
    img.alt = '';
    var label = document.createElement('span');
    label.textContent = entry.name;
    el.appendChild(img);
    el.appendChild(label);
    return el;
  }

  function render(map) {
    var entries = map ? Object.keys(map).map(function (k) { return map[k]; }) : [];
    entries.sort(function (a, b) { return (a.t || 0) - (b.t || 0); });   // arrival order
    count.textContent = entries.length + ' raised';
    empty.hidden = entries.length > 0;
    grid.textContent = '';
    var nextSeen = {};
    entries.forEach(function (entry) {
      var fresh = !seen[entry.id];
      nextSeen[entry.id] = true;
      grid.appendChild(tile(entry, fresh));
    });
    seen = nextSeen;
  }

  function start() {
    if (started) return;
    started = true;
    if (!window.PlacardData || !PlacardData.configured()) {
      note.textContent = 'The placard service is not connected yet.';
      return;
    }
    PlacardData.watchAll(function (map, error) {
      if (error) { note.textContent = 'Lost the connection. Reload to try again.'; return; }
      note.textContent = '';
      render(map);
    });
  }

  function unlock() {
    gate.hidden = true;
    panel.hidden = false;
    try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch (e) { /* ignore */ }
    start();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.textContent = '';
    sha256Hex(pass.value).then(function (hex) {
      if (hex === PASSWORD_SHA256) { pass.value = ''; unlock(); }
      else { err.textContent = 'Wrong password.'; pass.select(); }
    }, function () {
      err.textContent = 'This browser cannot check the password (secure connection needed).';
    });
  });

  clearBtn.addEventListener('click', function () {
    if (!window.PlacardData || !PlacardData.configured()) return;
    if (!confirm('Clear every raised placard?')) return;
    clearBtn.disabled = true;
    PlacardData.clearAll().then(function () {
      note.textContent = '';
    }, function () {
      note.textContent = 'Could not clear. Please try again.';
    }).then(function () { clearBtn.disabled = false; });
  });

  try {
    if (sessionStorage.getItem(UNLOCK_KEY) === '1') unlock();
  } catch (e) { /* ignore */ }
})();
