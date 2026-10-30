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
    'UNHRC(1)': { workshop: '시청각실',     kismun: '교과 1실' },
    'UNHRC(2)': { workshop: '8-1 교실',     kismun: '교과 4실' },
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

    // 위원회 페이지가 있는 경우에만 링크로 만든다 (Secretariat 등은 해당 없음)
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
    delegationEl.textContent = '';
    flagEl.removeAttribute('src');
    flagEl.hidden = true;
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
