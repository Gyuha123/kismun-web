// Full-screen board with two views.
//  Vote:    the live vote grid, with the overview (topic, open state, counts).
//  Placard: the same grid of units, lit when a placard is raised. No overview.
// Read-only: it follows the shared data live.
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
  var tiles = {};
  countries.forEach(function (c) {
    var el = document.createElement('div');
    el.className = 'bd-tile is-none';
    var img = document.createElement('img');
    img.src = c.kind === 'un' ? 'unflag.png' : 'flags/4x3/' + c.flag + '.svg';
    img.alt = '';
    var label = document.createElement('span');
    label.textContent = c.label;
    el.appendChild(img);
    el.appendChild(label);
    grid.appendChild(el);
    tiles[VoteData.key(c.id)] = el;
  });

  var votes = {}, raised = {}, view = 'vote';

  function paint() {
    var counts = { 'for': 0, 'against': 0, 'abstain': 0, none: 0 };
    countries.forEach(function (c) {
      var k = VoteData.key(c.id);
      var v = votes[k];
      if (v && counts.hasOwnProperty(v.choice)) counts[v.choice]++; else counts.none++;
      var el = tiles[k];
      if (view === 'placard') {
        el.className = 'bd-tile ' + (raised[k] ? 'is-raised' : 'is-none');
      } else {
        el.className = 'bd-tile ' + (v ? 'is-' + v.choice : 'is-none');
      }
    });
    $('nFor').textContent = counts['for'];
    $('nAgainst').textContent = counts.against;
    $('nAbstain').textContent = counts.abstain;
    $('nNone').textContent = counts.none;
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
    paint();
  }
  document.querySelector('.board-tabs').addEventListener('click', function (e) {
    var t = e.target.closest('.board-tab');
    if (t) setView(t.getAttribute('data-view'));
  });

  if (!VoteData.configured()) {
    note.textContent = 'The vote service is not connected yet.';
    paint();
    return;
  }

  VoteData.watch('votes', function (v, err) {
    if (err) { note.textContent = 'Lost the connection. Reload to continue.'; return; }
    note.textContent = '';
    votes = v || {};
    paint();
  });

  VoteData.watch('session/placard', function (p, err) {
    if (err) return;
    raised = p || {};
    paint();
  });

  VoteData.watch('session', function (s, err) {
    if (err) return;
    $('boardTopic').textContent = s && s.topic ? s.topic : 'Waiting for the topic';
    $('boardOpen').textContent = s && s.open ? 'Voting is open' : 'Voting is closed';
    $('boardOpen').classList.toggle('is-open', !!(s && s.open));
  });

  paint();
})();
