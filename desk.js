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
      var li = document.createElement('li');
      li.className = 'pa-item' + (v ? ' is-' + v.choice : '');
      li.title = x.label + (v ? ' — ' + LABEL[v.choice] : ' — not voted');
      var flag = document.createElement('img');
      flag.className = 'pa-flag';
      flag.src = x.kind === 'un' ? 'unflag.png' : 'flags/4x3/' + x.flag + '.svg';
      flag.alt = '';
      var name = document.createElement('span');
      name.textContent = x.label;
      li.appendChild(flag);
      li.appendChild(name);
      list.appendChild(li);
    });
  }

  function renderSession() {
    var open = !!session.open;
    $('voteState').textContent = open ? 'Open' : 'Closed';
    $('voteState').classList.toggle('is-open', open);
    $('openBtn').disabled = open;
    $('closeBtn').disabled = !open;
    if (document.activeElement !== topicInput) topicInput.value = session.topic || '';
  }

  function start() {
    if (!VoteData.configured()) { say(note, 'The vote service is not connected yet.'); return; }
    VoteData.watch('votes', function (v, e) {
      if (e) { say(note, 'Lost the connection. Reload to continue.'); return; }
      votes = v || {};
      renderSummary();
    });
    VoteData.watch('session', function (s) {
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
    }).catch(function () { say(topicNote, 'Could not save the topic.'); });
  });

  function toggle(action) {
    say(note, '');
    deskCall(action).then(function (r) {
      if (!r.ok) say(note, errorText(r.error));
    }).catch(function () { say(note, 'Could not reach the server.'); });
  }
  $('openBtn').addEventListener('click', function () { toggle('open'); });
  $('closeBtn').addEventListener('click', function () { toggle('close'); });

  $('resetBtn').addEventListener('click', function () {
    if (!confirm('Clear every vote and start a new round?')) return;
    say(note, '');
    deskCall('reset_votes').then(function (r) {
      say(note, r.ok ? 'All votes cleared.' : errorText(r.error));
    }).catch(function () { say(note, 'Could not reach the server.'); });
  });

  $('unblockBtn').addEventListener('click', function () {
    if (!confirm('Unblock every network that was locked by wrong codes?')) return;
    say(note, '');
    deskCall('unblock_all').then(function (r) {
      say(note, r.ok ? 'All networks unblocked.' : errorText(r.error));
    }).catch(function () { say(note, 'Could not reach the server.'); });
  });
})();
