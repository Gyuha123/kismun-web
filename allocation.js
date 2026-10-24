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
  var chip = document.getElementById('allocChip');
  var chipName = document.getElementById('allocChipName');
  var chipId = document.getElementById('allocChipId');
  var committeeCard = document.getElementById('allocCommitteeCard');
  var delegationCard = document.getElementById('allocDelegationCard');
  var committeeEl = document.getElementById('allocCommittee');
  var committeeFullEl = document.getElementById('allocCommitteeFull');
  var delegationEl = document.getElementById('allocDelegation');
  var flagEl = document.getElementById('allocFlag');

  var MAX_RESULTS = 12;
  var matches = [];
  var activeIndex = -1;

  // the full guidance does not fit a phone-width input, so move it into the
  // hint line there instead of letting the placeholder get cut off
  var hint = document.querySelector('.alloc-hint');
  var WIDE_PLACEHOLDER = 'Type your name (KIS: 한글 이름 / SIKS, TAS: English name)';
  var NARROW_PLACEHOLDER = 'Type your name (한글 / English)';
  var WIDE_HINT = 'Every result shows a student number or school, so you can pick the right person.';
  var NARROW_HINT = 'KIS: 한글 이름 · SIKS, TAS: English name. Every result shows a student number or school.';
  var narrow = window.matchMedia('(max-width: 700px)');

  function applyCopy() {
    input.placeholder = narrow.matches ? NARROW_PLACEHOLDER : WIDE_PLACEHOLDER;
    if (hint) hint.textContent = narrow.matches ? NARROW_HINT : WIDE_HINT;
  }
  applyCopy();
  if (narrow.addEventListener) narrow.addEventListener('change', applyCopy);
  else if (narrow.addListener) narrow.addListener(applyCopy);

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
    committeeEl.classList.toggle('is-long', d.c.length > 12);
    committeeCard.classList.remove('is-empty');

    // chairs and the secretariat get their role under the UN flag instead of a country
    var label = d.r || data.names[d.d] || d.d;
    delegationEl.textContent = label;
    if (d.d === 'UN') {
      flagEl.src = 'unflag.png';
      flagEl.alt = 'United Nations flag';
    } else if (data.flags[d.d]) {
      flagEl.src = 'flags/4x3/' + data.flags[d.d] + '.svg';
      flagEl.alt = label + ' flag';
    } else {
      flagEl.removeAttribute('src');
      flagEl.alt = '';
    }
    delegationCard.classList.remove('is-empty');

    chipName.textContent = d.n;
    chipId.textContent = d.s;
    chip.hidden = false;

    // restart the reveal animation on every new pick
    [committeeCard, delegationCard].forEach(function (el) {
      el.classList.remove('revealed');
      void el.offsetWidth;
      el.classList.add('revealed');
    });

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
    chip.hidden = true;
    committeeCard.classList.add('is-empty');
    delegationCard.classList.add('is-empty');
    committeeCard.classList.remove('revealed');
    delegationCard.classList.remove('revealed');
    committeeEl.textContent = '';
    committeeFullEl.textContent = '';
    delegationEl.textContent = '';
    flagEl.removeAttribute('src');
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
