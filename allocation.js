// my allocation — name autocomplete, then reveal committee + delegation flag
(function () {
  var data = window.KISMUN_ALLOCATION;
  var input = document.getElementById('allocInput');
  if (!data || !input) return;

  var COMMITTEE_FULL = {
    'UNHRC(1)': 'United Nations Human Rights Council',
    'UNHRC(2)': 'United Nations Human Rights Council',
    'ECOSOC': 'Economic and Social Council',
    'WHO(1)': 'World Health Organization',
    'WHO(2)': 'World Health Organization',
    'UNODC': 'United Nations Office on Drugs and Crime',
    'ITU': 'International Telecommunication Union',
    'SPECPOL': 'Special Political and Decolonization Committee',
    'HSC': 'Historical Security Council'
  };

  var dropdown = document.getElementById('allocDropdown');
  var clearBtn = document.getElementById('allocClear');
  var result = document.getElementById('allocResult');
  var chipName = document.getElementById('allocChipName');
  var chipId = document.getElementById('allocChipId');
  var committeeEl = document.getElementById('allocCommittee');
  var committeeFullEl = document.getElementById('allocCommitteeFull');
  var delegationEl = document.getElementById('allocDelegation');
  var flagEl = document.getElementById('allocFlag');
  var voteBtn = document.getElementById('allocVoteBtn');
  var voteLine = document.getElementById('allocVoteLine');
  var voteTopic = document.getElementById('allocVoteTopic');
  var voteForm = document.getElementById('allocVoteCodeForm');
  var voteCodeInput = document.getElementById('allocVoteCode');
  var voteChoices = document.getElementById('allocVoteChoices');
  var voteMsg = document.getElementById('allocVoteMsg');
  var voteTabs = document.getElementById('allocVoteTabs');
  var placardPanel = document.getElementById('allocPlacardPanel');
  var placardBtn = document.getElementById('allocPlacardBtn');
  var placardMsg = document.getElementById('allocPlacardMsg');
  var committeeLink = document.getElementById('allocCommitteeLink');
  var roomWorkshopLine = document.getElementById('allocRoomWorkshopLine');
  var roomKismunLine = document.getElementById('allocRoomKismunLine');
  var roomWorkshopEl = document.getElementById('allocRoomWorkshop');
  var roomKismunEl = document.getElementById('allocRoomKismun');

  var COMMITTEE_PAGE = {
    'UNHRC(1)': 'unhrc.html', 'UNHRC(2)': 'unhrc2.html', 'ECOSOC': 'ecosoc.html',
    'WHO(1)': 'who1.html', 'WHO(2)': 'who2.html', 'UNODC': 'unodc.html',
    'ITU': 'itu.html', 'SPECPOL': 'specpol.html', 'HSC': 'hsc.html'
  };

  // classroom assignments by committee, exactly as printed on the official
  // room-allocation slides — Korean room names are kept as-is, untranslated
  var ROOMS = {
    'UNHRC(1)': { workshop: '시청각실',     kismun: '교과 4실' },
    'UNHRC(2)': { workshop: '8-1 교실',     kismun: '교과 1실' },
    'ECOSOC':   { workshop: '8-5 교실',     kismun: '미술실 A' },
    'WHO(1)':   { workshop: '8-3 교실',     kismun: '신한정보관' },
    'WHO(2)':   { workshop: '신한정보관',    kismun: '교과 3실' },
    'UNODC':    { workshop: '8-4 교실',     kismun: '시청각실' },
    'ITU':      { workshop: '교과 1실',     kismun: '과학실' },
    'SPECPOL':  { workshop: '8-2 교실',     kismun: '음악실 A' },
    'HSC':      { workshop: 'AI 컴퓨터실',  kismun: '회의실 (교장실 옆)' }
  };

  var MAX_RESULTS = 12;
  var matches = [];
  var activeIndex = -1;

  function norm(s) {
    return (s || '').toString().toLowerCase().replace(/\s+/g, '');
  }

  function search(q) {
    var query = norm(q);
    if (!query) return [];
    var starts = [];
    var contains = [];
    data.delegates.forEach(function (d) {
      var n = norm(d.n);
      if (n.indexOf(query) === 0) starts.push(d);
      else if (n.indexOf(query) > -1) contains.push(d);
    });
    return starts.concat(contains).slice(0, MAX_RESULTS);
  }

  function renderDropdown() {
    if (!matches.length) {
      dropdown.hidden = true;
      dropdown.innerHTML = '';
      return;
    }
    dropdown.innerHTML = matches.map(function (d, i) {
      return '<button type="button" class="alloc-option' + (i === activeIndex ? ' active' : '') +
        '" data-index="' + i + '">' +
        '<span class="alloc-option-name"></span>' +
        '<span class="alloc-option-id"></span>' +
        '</button>';
    }).join('');
    Array.prototype.forEach.call(dropdown.children, function (btn, i) {
      btn.querySelector('.alloc-option-name').textContent = matches[i].n;
      btn.querySelector('.alloc-option-id').textContent = matches[i].s;
    });
    dropdown.hidden = false;
  }

  function showNoResult() {
    dropdown.innerHTML = '<div class="alloc-noresult">No match found</div>';
    dropdown.hidden = false;
  }

  function select(d) {
    committeeEl.textContent = d.c;
    committeeFullEl.textContent = COMMITTEE_FULL[d.c] || '';

    // 위원회 페이지가 있는 경우에만 버튼을 보여준다 (Secretariat 등은 해당 없음)
    var page = COMMITTEE_PAGE[d.c];
    if (page) {
      committeeLink.href = page;
      committeeLink.classList.add('is-link');
    } else {
      committeeLink.removeAttribute('href');
      committeeLink.classList.remove('is-link');
    }

    // chairs and the secretariat get their role under the UN flag instead of a country
    var label = d.r || data.names[d.d] || d.d;
    delegationEl.textContent = label;
    if (d.d === 'UN') {
      flagEl.src = 'unflag.png';
      flagEl.alt = '';
      flagEl.hidden = false;
    } else if (data.flags[d.d]) {
      flagEl.src = 'flags/4x3/' + data.flags[d.d] + '.svg';
      flagEl.alt = '';
      flagEl.hidden = false;
    } else {
      flagEl.removeAttribute('src');
      flagEl.hidden = true;
    }

    // only committees with a printed room assignment show these two lines —
    // Secretariat / chair entries (d.c === 'Secretariat') have none
    var rooms = ROOMS[d.c];
    if (rooms) {
      roomWorkshopEl.textContent = rooms.workshop;
      roomKismunEl.textContent = rooms.kismun;
      roomWorkshopLine.hidden = false;
      roomKismunLine.hidden = false;
    } else {
      roomWorkshopEl.textContent = '';
      roomKismunEl.textContent = '';
      roomWorkshopLine.hidden = true;
      roomKismunLine.hidden = true;
    }

    // only delegations vote; Secretariat and the UN flag have no button
    setVoteCountry(voteTargetFor(d));

    chipName.textContent = d.n;
    chipId.textContent = d.s;

    // restart the reveal on every new pick
    result.hidden = false;
    result.classList.remove('revealed');
    void result.offsetWidth;
    result.classList.add('revealed');

    input.value = d.n;
    matches = [];
    activeIndex = -1;
    dropdown.hidden = true;
    clearBtn.hidden = false;
  }

  // ---- voting ---------------------------------------------------------
  // The code is only kept in memory for this page visit; every check and
  // every vote is verified by the server, which also counts wrong codes.
  var LABEL = { 'for': 'For', 'against': 'Against', 'abstain': 'Abstain' };
  var STALE_MS = 4000;      // a cached read may lag behind what this page just did
  var vote = null;          // {code, name} while a delegation is selected
  var checkedCode = '';     // the code that passed the check, used for Vote and Placard
  var sessionOpen = false;  // follows the desk live
  var myVote = null;        // this unit's choice, followed live
  var votedHere = false;    // the vote was cast on this page
  var sending = false;
  var activeTab = 'vote';
  var actedAt = { vote: 0, placard: 0 };
  var stopSession = null;
  var stopUnit = [];
  var recheck = { vote: function () {}, placard: function () {} };

  function say(text) { voteMsg.textContent = text || ''; }
  function say2(text) { placardMsg.textContent = text || ''; }

  function setPlacardRaised(raised) {
    placardBtn.disabled = raised;
    placardBtn.textContent = raised ? 'Placard raised' : 'Raise Placard';
    placardBtn.classList.toggle('is-raised', raised);
  }

  // The Vote tab always reflects the live session: when the desk opens voting the
  // choices appear by themselves; when it closes or clears, they follow.
  function renderVote() {
    if (!checkedCode || sending) return;
    voteChoices.hidden = activeTab !== 'vote' || !!myVote || !sessionOpen;
    if (myVote) say(votedHere ? 'Vote received: ' + LABEL[myVote] + '. Thank you.' : vote.name + ' has already voted: ' + LABEL[myVote] + '.');
    else if (sessionOpen) say('Choose one. ' + vote.name + ' can vote once.');
    else say('Voting is not open yet. This page updates by itself.');
  }

  function showTab(name) {
    activeTab = name;
    voteTabs.setAttribute('data-active', name);
    Array.prototype.forEach.call(voteTabs.querySelectorAll('.alloc-tab'), function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    placardPanel.hidden = name !== 'placard';
    voteMsg.hidden = name !== 'vote';
    voteTopic.hidden = name !== 'vote';   // the topic belongs to Vote only
    renderVote();
  }

  function stopFollowingUnit() {
    stopUnit.forEach(function (stop) { stop(); });
    stopUnit = [];
  }

  function followUnit() {
    stopFollowingUnit();
    var key = VoteData.key(vote.code);
    var seenVote = null, seenPlacard = null, stopped = false;
    stopUnit.push(function () { stopped = true; });

    function applyVote() {
      myVote = seenVote ? seenVote.choice : null;
      if (!seenVote) votedHere = false;
      renderVote();
    }
    function applyPlacard() {
      var raised = placardBtn.classList.contains('is-raised');
      // also when the desk's random pick raised it
      if (seenPlacard && !raised) { setPlacardRaised(true); say2('Your placard is raised.'); }
      if (!seenPlacard && raised) { setPlacardRaised(false); say2('Placard cleared. You can raise it again.'); }
    }
    // Cast and deleted between two reads, a vote never shows up as a change.
    // So the page compares once more after acting, when reads have caught up.
    recheck.vote = function () { if (!stopped) applyVote(); };
    recheck.placard = function () { if (!stopped) applyPlacard(); };
    stopUnit.push(VoteData.watch('votes/' + key, function (v, err) {
      if (err) return;
      seenVote = v;
      var wait = STALE_MS - (Date.now() - actedAt.vote);
      if (!v && wait > 0) { setTimeout(function () { if (!stopped) applyVote(); }, wait); return; }
      applyVote();
    }));
    stopUnit.push(VoteData.watch('session/placard/' + key, function (p, err) {
      if (err) return;
      seenPlacard = p;
      var wait = STALE_MS - (Date.now() - actedAt.placard);
      if (!p && wait > 0) { setTimeout(function () { if (!stopped) applyPlacard(); }, wait); return; }
      applyPlacard();
    }));
  }

  function leaveChecked() {
    stopFollowingUnit();
    checkedCode = '';
    myVote = null;
    votedHere = false;
    sending = false;
    voteChoices.hidden = true;
    voteTabs.hidden = true;
    placardPanel.hidden = true;
    voteMsg.hidden = false;
    voteTopic.hidden = false;
  }

  function showCodeStep() {
    leaveChecked();
    voteForm.hidden = false;
    voteCodeInput.value = '';
    voteCodeInput.disabled = false;
    voteCodeInput.focus();
  }

  function hideVote() {
    leaveChecked();
    if (stopSession) stopSession();
    stopSession = null;
    voteLine.hidden = true;
    voteForm.hidden = true;
    say('');
    say2('');
    setPlacardRaised(false);
  }
  function networkProblem() { say('Could not reach the vote server. Please try again.'); }

  // the voting unit a delegate belongs to: their country, or the UN group for chairs.
  // The Secretariat (and anyone without a flag) has no vote.
  function voteTargetFor(d) {
    if (d.c === 'Secretariat') return null;
    if (d.d === 'UN') return { code: 'UN', name: 'UN (Chairs)', flag: 'unflag.png' };
    if (!data.flags[d.d]) return null;
    return { code: d.d, name: data.names[d.d] || d.d, flag: 'flags/4x3/' + data.flags[d.d] + '.svg' };
  }

  function setVoteCountry(next) {
    vote = next;
    voteBtn.hidden = !next;
    hideVote();
  }

  function followSession() {
    if (stopSession || !window.VoteData || !VoteData.configured()) return;
    stopSession = VoteData.watch('session', function (s, err) {
      if (err) return;
      voteTopic.textContent = s && s.topic ? 'Topic: ' + s.topic : 'The voting topic will appear here.';
      sessionOpen = !!(s && s.open);
      renderVote();
    });
  }

  voteBtn.addEventListener('click', function () {
    if (!vote) return;
    if (!window.VoteData || !VoteData.configured()) { voteLine.hidden = false; say('Voting is not connected yet.'); return; }
    voteLine.hidden = false;
    followSession();
    showCodeStep();
    say('');
  });

  voteTabs.addEventListener('click', function (e) {
    var t = e.target.closest('.alloc-tab');
    if (t) showTab(t.getAttribute('data-tab'));
  });

  placardBtn.addEventListener('click', function () {
    if (!vote || !checkedCode || placardBtn.disabled) return;
    placardBtn.disabled = true;
    say2('Raising…');
    VoteData.api('placard', { country: vote.code, code: checkedCode }).then(function (r) {
      if (r.ok || r.error === 'already') {
        actedAt.placard = Date.now();
        setTimeout(recheck.placard, STALE_MS);
        setPlacardRaised(true);
        say2(r.ok ? 'Your placard is raised.' : 'The placard for ' + vote.name + ' is already raised.');
        return;
      }
      setPlacardRaised(false);
      if (r.error === 'blocked') { say2('This network has been blocked. Please ask the desk.'); return; }
      if (r.error === 'wrong') { showCodeStep(); say('The code no longer matches. Please enter it again.'); return; }
      say2('Something went wrong. Please try again.');
    }).catch(function () { setPlacardRaised(false); say2('Could not reach the vote server. Please try again.'); });
  });

  voteForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!vote) return;
    var code = voteCodeInput.value.trim();
    if (!/^\d{4}$/.test(code)) { say('Enter the 4 digits.'); return; }
    voteCodeInput.disabled = true;
    say('Checking…');
    VoteData.api('check', { country: vote.code, code: code }).then(function (r) {
      voteCodeInput.disabled = false;
      if (r.error === 'wrong') { say('Wrong code. Attempts are limited.'); voteCodeInput.select(); return; }
      if (r.error === 'blocked') { say('This network has been blocked after too many wrong codes. Please ask the desk.'); return; }
      if (r.error === 'format') { say('Enter the 4 digits.'); return; }
      if (r.error === 'unknown-country') { say('This delegation does not vote.'); return; }
      if (r.error) { say('Something went wrong. Please try again.'); return; }
      // from here the page follows the desk by itself: no second code entry
      var now = Date.now();
      checkedCode = code;
      sessionOpen = !!r.open;
      myVote = r.voted || null;
      votedHere = false;
      actedAt.vote = r.voted ? now : 0;
      actedAt.placard = r.placardRaised ? now : 0;
      setPlacardRaised(!!r.placardRaised);
      voteForm.hidden = true;
      voteTabs.hidden = false;
      followUnit();
      showTab('vote');
    }).catch(networkProblem);
  });

  voteChoices.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-choice]');
    if (!btn || !vote || !checkedCode || sending) return;
    var choice = btn.getAttribute('data-choice');
    sending = true;
    voteChoices.hidden = true;
    say('Sending…');
    VoteData.api('vote', { country: vote.code, code: checkedCode, choice: choice }).then(function (r) {
      sending = false;
      if (r.ok || r.error === 'already') {
        actedAt.vote = Date.now();
        setTimeout(recheck.vote, STALE_MS);
        myVote = r.choice;
        votedHere = !!r.ok;
        renderVote();
        return;
      }
      if (r.error === 'closed') { sessionOpen = false; renderVote(); return; }
      if (r.error === 'blocked') { leaveChecked(); say('This network has been blocked. Please ask the desk.'); return; }
      if (r.error === 'wrong') { showCodeStep(); say('The code no longer matches. Please enter it again.'); return; }
      renderVote();
      say('Something went wrong. Please try again.');
    }).catch(function () { sending = false; renderVote(); networkProblem(); });
  });

  function reset() {
    input.value = '';
    matches = [];
    activeIndex = -1;
    dropdown.hidden = true;
    dropdown.innerHTML = '';
    clearBtn.hidden = true;
    result.hidden = true;
    result.classList.remove('revealed');
    committeeEl.textContent = '';
    committeeFullEl.textContent = '';
    committeeLink.classList.remove('is-link');
    committeeLink.removeAttribute('href');
    delegationEl.textContent = '';
    flagEl.removeAttribute('src');
    flagEl.hidden = true;
    setVoteCountry(null);
    roomWorkshopEl.textContent = '';
    roomKismunEl.textContent = '';
    roomWorkshopLine.hidden = true;
    roomKismunLine.hidden = true;
    input.focus();
  }

  input.addEventListener('input', function () {
    var q = input.value;
    clearBtn.hidden = !q;
    activeIndex = -1;
    if (!q.trim()) {
      matches = [];
      dropdown.hidden = true;
      return;
    }
    matches = search(q);
    if (matches.length) renderDropdown();
    else showNoResult();
  });

  input.addEventListener('keydown', function (e) {
    if (dropdown.hidden || !matches.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % matches.length;
      renderDropdown();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + matches.length) % matches.length;
      renderDropdown();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(matches[activeIndex > -1 ? activeIndex : 0]);
    } else if (e.key === 'Escape') {
      dropdown.hidden = true;
    }
  });

  dropdown.addEventListener('click', function (e) {
    var btn = e.target.closest('.alloc-option');
    if (!btn) return;
    select(matches[parseInt(btn.getAttribute('data-index'), 10)]);
  });

  clearBtn.addEventListener('click', reset);

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.alloc-search')) dropdown.hidden = true;
  });

  input.addEventListener('focus', function () {
    if (matches.length) dropdown.hidden = false;
  });
})();
