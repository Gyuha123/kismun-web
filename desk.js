// Vote desk: password gate, topic, open/close voting, live summary,
// All clear and unblock. The password is kept only in this page's memory and
// is checked by the server on every action.
(function () {
  var data = window.KISMUN_ALLOCATION;
  var $ = function (id) { return document.getElementById(id); };
  var pw = '';

  var gate = $('paGate'), panel = $('paPanel'), form = $('paForm'), pass = $('paPass'), err = $('paError');
  var topicForm = $('topicForm'), topicInput = $('topicInput'), topicNote = $('topicNote');
  var note = $('paNote');
  var list = $('paList');
  var placardList = $('placardList');

  VoteData.useFreshReads();
  var countries = VoteData.voters(data);
  var LABEL = { 'for': 'For', 'against': 'Against', 'abstain': 'Abstain' };
  var votes = {}, session = {};

  function say(el, text) { el.textContent = text || ''; }

  function errorText(code) {
    if (code === 'password') return 'Wrong password.';
    if (code === 'locked') return 'Too many wrong passwords from this network. Try again in 15 minutes.';
    if (code === 'origin') return 'This request was refused.';
    return 'Something went wrong. Please try again.';
  }

  function deskCall(action, extra) {
    return VoteData.api(action, Object.assign({ password: pw }, extra || {}));
  }

  function failure(e) {
    return 'The server could not save this' + (e && e.detail ? ' (' + e.detail + ')' : '') + '. Please try again.';
  }

  function flagSrc(x) { return x.kind === 'un' ? 'unflag.png' : 'flags/4x3/' + x.flag + '.svg'; }

  function item(x, className, title) {
    var li = document.createElement('li');
    li.className = className;
    li.title = title;
    var flag = document.createElement('img');
    flag.className = 'pa-flag';
    flag.src = flagSrc(x);
    flag.alt = '';
    var name = document.createElement('span');
    name.textContent = x.label;
    li.appendChild(flag);
    li.appendChild(name);
    return li;
  }

  function renderPlacards() {
    var raised = session.placard || {};
    var pick = session.pick ? session.pick.id : '';
    var count = 0, picked = null;
    placardList.textContent = '';
    countries.forEach(function (x) {
      var k = VoteData.key(x.id);
      var up = !!raised[k];
      if (up) count++;
      if (k === pick) picked = x;
      placardList.appendChild(item(x, 'pa-item' + (k === pick ? ' is-picked' : up ? ' is-raised' : ''), x.label + (up ? ' — raised' : ' — not raised')));
    });
    $('sRaised').textContent = count;
    $('sLowered').textContent = countries.length - count;

    var box = $('pickResult');
    box.textContent = '';
    if (picked) {
      var img = document.createElement('img');
      img.src = flagSrc(picked);
      img.alt = '';
      var label = document.createElement('span');
      label.textContent = picked.label;
      box.appendChild(img);
      box.appendChild(label);
    } else {
      var empty = document.createElement('span');
      empty.className = 'pa-pick-empty';
      empty.textContent = 'No delegation picked';
      box.appendChild(empty);
    }
  }

  function showTab(name) {
    $('deskTabs').setAttribute('data-active', name);
    Array.prototype.forEach.call($('deskTabs').querySelectorAll('.desk-tab'), function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('deskVote').hidden = name !== 'vote';
    $('deskPlacard').hidden = name !== 'placard';
  }
  $('deskTabs').addEventListener('click', function (e) {
    var t = e.target.closest('.desk-tab');
    if (t) showTab(t.getAttribute('data-tab'));
  });

  function clearLocally() {
    votes = {};
    delete session.placard;
    delete session.pick;
    renderSummary();
    renderPlacards();
  }

  function renderSummary() {
    var c = { 'for': 0, against: 0, abstain: 0, none: 0 };
    countries.forEach(function (x) {
      var v = votes[VoteData.key(x.id)];
      if (v && c.hasOwnProperty(v.choice)) c[v.choice]++; else c.none++;
    });
    $('sFor').textContent = c['for'];
    $('sAgainst').textContent = c.against;
    $('sAbstain').textContent = c.abstain;
    $('sNone').textContent = c.none;

    list.textContent = '';
    countries.forEach(function (x) {
      var v = votes[VoteData.key(x.id)];
      list.appendChild(item(x, 'pa-item' + (v ? ' is-' + v.choice : ''), x.label + (v ? ' — ' + LABEL[v.choice] : ' — not voted')));
    });
  }

  function renderSession() {
    var open = !!session.open;
    $('voteState').textContent = open ? 'Open' : 'Closed';
    $('voteState').classList.toggle('is-open', open);
    $('openBtn').disabled = open;
    $('closeBtn').disabled = !open;
    if (document.activeElement !== topicInput) topicInput.value = session.topic || '';
    renderPlacards();
  }

  function start() {
    renderSummary();
    renderSession();
    if (!VoteData.configured()) { say(note, 'The vote service is not connected yet.'); return; }
    VoteData.watch('votes', function (v, e) {
      if (e) { say(note, 'Lost the connection. Reload to continue.'); return; }
      votes = v || {};
      renderSummary();
    });
    VoteData.watch('session', function (s, e) {
      if (e) return;
      session = s || {};
      renderSession();
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
        start();
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
    deskCall('set_topic', { topic: topic }).then(function (r) {
      say(topicNote, r.ok ? 'Topic saved.' : errorText(r.error));
      if (r.ok) { session.topic = topic; VoteData.refresh(); }
    }).catch(function () { say(topicNote, 'Could not save the topic.'); });
  });

  function toggle(action) {
    if (action === 'close' && !confirm('Close voting and delete every vote and placard?')) return;
    say(note, '');
    $('openBtn').disabled = true;
    $('closeBtn').disabled = true;
    deskCall(action).then(function (r) {
      if (r.ok) {
        session.open = action === 'open';
        say(note, session.open ? 'Voting is open.' : 'Voting is closed. All votes and placards deleted.');
        if (!session.open) clearLocally();
        VoteData.refresh();
      } else {
        say(note, errorText(r.error));
      }
      renderSession();
    }).catch(function (e) { renderSession(); say(note, failure(e)); });
  }
  $('openBtn').addEventListener('click', function () { toggle('open'); });
  $('closeBtn').addEventListener('click', function () { toggle('close'); });

  $('resetBtn').addEventListener('click', function () {
    if (!confirm('Clear every vote and placard and start a new round?')) return;
    say(note, '');
    deskCall('reset_votes').then(function (r) {
      say(note, r.ok ? 'All votes and placards cleared.' : errorText(r.error));
      if (r.ok) { clearLocally(); VoteData.refresh(); }
    }).catch(function (e) { say(note, failure(e)); });
  });

  $('pickBtn').addEventListener('click', function () {
    say($('pickNote'), '');
    $('pickBtn').disabled = true;
    deskCall('pick_random').then(function (r) {
      $('pickBtn').disabled = false;
      if (r.ok) { session.pick = { id: r.id }; renderPlacards(); VoteData.refresh(); return; }
      say($('pickNote'), r.error === 'no-placards' ? 'No placards are raised yet.' : errorText(r.error));
    }).catch(function (e) { $('pickBtn').disabled = false; say($('pickNote'), failure(e)); });
  });

  $('unblockBtn').addEventListener('click', function () {
    if (!confirm('Unblock every network that was locked by wrong codes?')) return;
    say(note, '');
    deskCall('unblock_all').then(function (r) {
      say(note, r.ok ? 'All networks unblocked.' : errorText(r.error));
    }).catch(function (e) { say(note, failure(e)); });
  });
})();
