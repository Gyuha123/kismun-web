// Vote board and desk in one page.
//  Board (left): the Vote | Placard bar and the grid of every voting unit. Vote shows
//  the overview (topic, open state, counts); Placard shows the same grid, lit when a
//  placard is raised and gold when the desk picked it. Anyone can watch it.
//  Desk (right): the controls. They open with the desk password, which is kept only
//  in this page's memory and checked by the server on every action. The panel
//  follows the bar: Vote controls on Vote, Placard controls on Placard.
(function () {
  var data = window.KISMUN_ALLOCATION;
  var $ = function (id) { return document.getElementById(id); };
  var grid = $('boardGrid');
  var note = $('boardNote');
  var main = document.querySelector('.board');

  if (!data) { note.textContent = 'Country data is missing.'; return; }

  VoteData.useFreshReads();

  // every voting unit: each country, plus the UN group of chairs
  var countries = VoteData.voters(data);
  var byKey = {};
  var tiles = {};
  countries.forEach(function (c) {
    var k = VoteData.key(c.id);
    byKey[k] = c;
    var el = document.createElement('div');
    el.className = 'bd-tile is-none';
    var img = document.createElement('img');
    img.src = flagSrc(c);
    img.alt = '';
    var label = document.createElement('span');
    label.textContent = c.label;
    el.appendChild(img);
    el.appendChild(label);
    grid.appendChild(el);
    tiles[k] = el;
  });

  function flagSrc(c) { return c.kind === 'un' ? 'unflag.png' : 'flags/4x3/' + c.flag + '.svg'; }

  // Pack the tiles to the space there is: as many columns as fit a compact tile, rows
  // to match, so every unit is on screen whether the desk is open or folded. The
  // text size follows the tile, so a tile carries its flag and name and little else.
  var GAP = 6;
  function layoutGrid() {
    var box = grid.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var n = countries.length;
    var minTile = box.width < 600 ? 112 : 150;
    var cols = Math.max(3, Math.min(n, Math.floor((box.width + GAP) / (minTile + GAP))));
    var rows = Math.ceil(n / cols);
    var tileW = (box.width - GAP * (cols - 1)) / cols;
    var tileH = (box.height - GAP * (rows - 1)) / rows;
    var flagW = tileH * 0.6 * 4 / 3;
    var font = Math.max(9, Math.min(18, tileH * 0.36, (tileW - flagW - 22) / 8.2));
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    grid.style.gridTemplateRows = 'repeat(' + rows + ', minmax(0, 1fr))';
    grid.style.gap = GAP + 'px';
    grid.style.setProperty('--tile-font', font.toFixed(1) + 'px');
  }
  if (window.ResizeObserver) new ResizeObserver(layoutGrid).observe(grid);
  window.addEventListener('resize', layoutGrid);

  // the random pick: { ids: [...] } (older data used { id })
  function pickIds(s) {
    if (!s || !s.pick) return [];
    if (s.pick.ids) return s.pick.ids.slice();
    return s.pick.id ? [s.pick.id] : [];
  }

  var votes = {}, session = {}, view = 'vote';

  // ---- board ---------------------------------------------------------
  function paint() {
    var counts = { 'for': 0, 'against': 0, 'abstain': 0, none: 0 };
    var raised = session.placard || {};
    var picked = pickIds(session);
    var up = 0;
    countries.forEach(function (c) {
      var k = VoteData.key(c.id);
      var v = votes[k];
      if (v && counts.hasOwnProperty(v.choice)) counts[v.choice]++; else counts.none++;
      if (raised[k]) up++;
      var el = tiles[k];
      if (view === 'placard') {
        el.className = 'bd-tile ' + (picked.indexOf(k) !== -1 ? 'is-picked' : raised[k] ? 'is-raised' : 'is-none');
      } else {
        el.className = 'bd-tile ' + (v ? 'is-' + v.choice : 'is-none');
      }
    });
    $('nFor').textContent = counts['for'];
    $('nAgainst').textContent = counts.against;
    $('nAbstain').textContent = counts.abstain;
    $('nNone').textContent = counts.none;

    $('boardTopic').textContent = session.topic ? session.topic : 'Waiting for the topic';
    $('boardOpen').textContent = session.open ? 'Voting is open' : 'Voting is closed';
    $('boardOpen').classList.toggle('is-open', !!session.open);

    $('sRaised').textContent = up;
    $('sLowered').textContent = countries.length - up;
    renderPick(picked);
    renderDesk();
  }

  function setView(name) {
    view = name;
    main.classList.toggle('view-placard', name === 'placard');
    document.querySelector('.board-tabs').setAttribute('data-active', name);
    Array.prototype.forEach.call(document.querySelectorAll('.board-tab'), function (t) {
      var on = t.getAttribute('data-view') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('deskVote').hidden = name !== 'vote';
    $('deskPlacard').hidden = name !== 'placard';
    paint();
    layoutGrid();
  }
  document.querySelector('.board-tabs').addEventListener('click', function (e) {
    var t = e.target.closest('.board-tab');
    if (t) setView(t.getAttribute('data-view'));
  });

  // ---- the desk panel can fold away, e.g. while projecting -------------
  var shell = $('boardShell');
  function setConsole(open) {
    shell.classList.toggle('console-closed', !open);
    $('consoleToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('consoleToggle').setAttribute('aria-label', open ? 'Hide the desk' : 'Show the desk');
    try { localStorage.setItem('kismun-console', open ? 'open' : 'closed'); } catch (e) { /* private mode */ }
  }
  var stored = null;
  try { stored = localStorage.getItem('kismun-console'); } catch (e) { /* private mode */ }
  setConsole(stored ? stored === 'open' : window.innerWidth > 900);
  $('consoleToggle').addEventListener('click', function () { setConsole(shell.classList.contains('console-closed')); });

  // ---- desk ----------------------------------------------------------
  var pw = '';
  var gate = $('paGate'), panel = $('paPanel'), form = $('paForm'), pass = $('paPass'), err = $('paError');
  var topicForm = $('topicForm'), topicInput = $('topicInput'), topicNote = $('topicNote');
  var deskNote = $('paNote');

  // ok = true shows the message as a success, otherwise as a warning
  function say(el, text, ok) {
    el.textContent = text || '';
    el.classList.toggle('is-ok', !!ok);
  }
  function errorText(code) {
    if (code === 'password') return 'Wrong password.';
    if (code === 'locked') return 'Too many wrong passwords from this network. Try again in 15 minutes.';
    if (code === 'origin') return 'This request was refused.';
    return 'Something went wrong. Please try again.';
  }
  function failure(e) {
    return 'The server could not save this' + (e && e.detail ? ' (' + e.detail + ')' : '') + '. Please try again.';
  }
  function deskCall(action, extra) {
    return VoteData.api(action, Object.assign({ password: pw }, extra || {}));
  }

  function renderDesk() {
    if (!pw) return;
    var open = !!session.open;
    $('voteState').textContent = open ? 'Open' : 'Closed';
    $('voteState').classList.toggle('is-open', open);
    $('openBtn').disabled = open;
    $('closeBtn').disabled = !open;
    if (document.activeElement !== topicInput) topicInput.value = session.topic || '';
  }

  function renderPick(picked) {
    var box = $('pickResult');
    box.textContent = '';
    if (!picked.length) {
      var empty = document.createElement('li');
      empty.className = 'pa-pick-empty';
      empty.textContent = 'No delegation picked';
      box.appendChild(empty);
      return;
    }
    picked.forEach(function (k) {
      var c = byKey[k];
      if (!c) return;
      var li = document.createElement('li');
      var img = document.createElement('img');
      img.src = flagSrc(c);
      img.alt = '';
      var label = document.createElement('span');
      label.textContent = c.label;
      li.appendChild(img);
      li.appendChild(label);
      box.appendChild(li);
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    say(err, '');
    var candidate = pass.value;
    VoteData.api('auth', { password: candidate }).then(function (r) {
      if (r.ok) {
        pw = candidate;
        pass.value = '';
        gate.hidden = true;
        panel.hidden = false;
        paint();
      } else {
        say(err, errorText(r.error));
        pass.select();
      }
    }).catch(function () { say(err, 'Could not reach the server. Please try again.'); });
  });

  topicForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var topic = topicInput.value.trim();
    if (!topic) { say(topicNote, 'Type the topic first.'); return; }
    var before = session.topic;
    session.topic = topic;
    say(topicNote, 'Topic saved.', true);
    paint();
    deskCall('set_topic', { topic: topic }).then(function (r) {
      if (r.ok) { VoteData.refresh(); return; }
      session.topic = before; paint();
      say(topicNote, errorText(r.error));
    }).catch(function () { session.topic = before; paint(); say(topicNote, 'Could not save the topic.'); });
  });

  function toggle(action) {
    if (action === 'close' && !confirm('Close voting and delete the topic and every vote?')) return;
    var before = { open: session.open, topic: session.topic, votes: votes };
    // show it straight away; the server confirms, or the page puts it back
    session.open = action === 'open';
    if (!session.open) { delete session.topic; topicInput.value = ''; say(topicNote, ''); votes = {}; }
    say(deskNote, session.open ? 'Voting is open.' : 'Voting is closed. Topic and votes deleted.', true);
    paint();
    function undo() {
      session.open = before.open;
      if (before.topic) session.topic = before.topic;
      votes = before.votes;
      paint();
    }
    deskCall(action).then(function (r) {
      if (!r.ok) { undo(); say(deskNote, errorText(r.error)); return; }
      VoteData.refresh();
    }).catch(function (e) { undo(); say(deskNote, failure(e)); });
  }
  $('openBtn').addEventListener('click', function () { toggle('open'); });
  $('closeBtn').addEventListener('click', function () { toggle('close'); });

  $('pickBtn').addEventListener('click', function () {
    var pickNote = $('pickNote');
    var count = parseInt($('pickCount').value, 10);
    if (!(count >= 1 && count <= countries.length)) { say(pickNote, 'Enter a number from 1 to ' + countries.length + '.'); return; }
    say(pickNote, '');
    $('pickBtn').disabled = true;
    deskCall('pick_random', { count: count }).then(function (r) {
      $('pickBtn').disabled = false;
      if (r.ok) {
        // the picks raise those placards, so the counts change right now
        session.placard = session.placard || {};
        (r.previous || []).forEach(function (k) { delete session.placard[k]; });
        r.ids.forEach(function (k) { session.placard[k] = { t: Date.now() }; });
        session.pick = { ids: r.ids };
        if (r.ids.length < count) say(pickNote, 'Only ' + r.ids.length + ' could be picked: the others have raised their placards.');
        paint();
        VoteData.refresh();
        return;
      }
      say(pickNote, r.error === 'no-candidates' ? 'No other delegation can be picked.' : errorText(r.error));
    }).catch(function (e) { $('pickBtn').disabled = false; say(pickNote, failure(e)); });
  });

  $('placardClearBtn').addEventListener('click', function () {
    if (!confirm('Clear every placard and the random pick?')) return;
    var placardNote = $('placardNote');
    say(placardNote, '');
    deskCall('clear_placards').then(function (r) {
      say(placardNote, r.ok ? 'All placards cleared.' : errorText(r.error), r.ok);
      if (r.ok) { delete session.placard; delete session.pick; paint(); VoteData.refresh(); }
    }).catch(function (e) { say(placardNote, failure(e)); });
  });

  function unblock(noteEl) {
    if (!confirm('Unblock every network that was locked by wrong codes?')) return;
    say(noteEl, '');
    deskCall('unblock_all').then(function (r) {
      say(noteEl, r.ok ? 'All networks unblocked.' : errorText(r.error), r.ok);
    }).catch(function (e) { say(noteEl, failure(e)); });
  }
  $('unblockBtn').addEventListener('click', function () { unblock(deskNote); });
  $('placardUnblockBtn').addEventListener('click', function () { unblock($('placardNote')); });

  // ---- live data -----------------------------------------------------
  if (!VoteData.configured()) {
    note.textContent = 'The vote service is not connected yet.';
    paint();
    return;
  }

  VoteData.watch('votes', function (v, e) {
    if (e) { note.textContent = 'Lost the connection. Reload to continue.'; return; }
    note.textContent = '';
    votes = v || {};
    paint();
  });

  VoteData.watch('session', function (s, e) {
    if (e) return;
    session = s || {};
    paint();
  });

  setView('vote');
})();
