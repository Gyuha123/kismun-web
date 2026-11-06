// Full-screen vote board. Read-only: it follows the shared votes live.
// Shows every voting delegation as a flag. Not voted = greyed flag; once a
// delegation has voted, its flag lights up in the colour of its choice.
(function () {
  var data = window.KISMUN_ALLOCATION;
  var $ = function (id) { return document.getElementById(id); };
  var grid = $('boardGrid');
  var note = $('boardNote');

  if (!data) { note.textContent = 'Country data is missing.'; return; }

  // delegations only: Secretariat and the UN have no vote
  var seen = {};
  var countries = [];
  data.delegates.forEach(function (d) {
    if (d.c === 'Secretariat' || d.d === 'UN' || !data.flags[d.d] || seen[d.d]) return;
    seen[d.d] = true;
    countries.push({ code: d.d, name: data.names[d.d] || d.d, flag: data.flags[d.d] });
  });
  countries.sort(function (a, b) { return a.name.localeCompare(b.name); });

  var LABEL = { 'for': 'For', 'against': 'Against', 'abstain': 'Abstain' };
  var tiles = {};
  countries.forEach(function (c) {
    var el = document.createElement('div');
    el.className = 'bd-tile is-none';
    var img = document.createElement('img');
    img.src = 'flags/4x3/' + c.flag + '.svg';
    img.alt = '';
    var label = document.createElement('span');
    label.textContent = c.name;
    el.appendChild(img);
    el.appendChild(label);
    grid.appendChild(el);
    tiles[VoteData.key(c.code)] = el;
  });

  function render(votes) {
    var counts = { 'for': 0, 'against': 0, 'abstain': 0, none: 0 };
    countries.forEach(function (c) {
      var k = VoteData.key(c.code);
      var v = votes && votes[k];
      var el = tiles[k];
      el.className = 'bd-tile ' + (v ? 'is-' + v.choice : 'is-none');
      if (v && counts.hasOwnProperty(v.choice)) counts[v.choice]++;
      else counts.none++;
    });
    $('nFor').textContent = counts['for'];
    $('nAgainst').textContent = counts.against;
    $('nAbstain').textContent = counts.abstain;
    $('nNone').textContent = counts.none;
  }

  if (!VoteData.configured()) {
    note.textContent = 'The vote service is not connected yet.';
    render({});
    return;
  }

  VoteData.watch('votes', function (votes, err) {
    if (err) { note.textContent = 'Lost the connection. Reload to continue.'; return; }
    note.textContent = '';
    render(votes || {});
  });

  VoteData.watch('session', function (s) {
    $('boardTopic').textContent = s && s.topic ? s.topic : 'Waiting for the topic';
    $('boardOpen').textContent = s && s.open ? 'Voting is open' : 'Voting is closed';
    $('boardOpen').classList.toggle('is-open', !!(s && s.open));
  });
  render({});
  void LABEL;
})();
