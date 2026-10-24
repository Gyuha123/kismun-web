// my allocation — name search with live dropdown, then show committee + delegation flag
(function () {
  var data = window.KISMUN_ALLOCATION;
  var input = document.getElementById('allocInput');
  if (!data || !input) return;

  var dropdown = document.getElementById('allocDropdown');
  var clearBtn = document.getElementById('allocClear');
  var committeeEl = document.getElementById('allocCommittee');
  var delegationEl = document.getElementById('allocDelegation');
  var flagEl = document.getElementById('allocFlag');
  var flagPlaceholder = document.getElementById('allocFlagPlaceholder');
  var selectedEl = document.getElementById('allocSelected');
  var committeeCard = document.getElementById('allocCommitteeCard');
  var delegationCard = document.getElementById('allocDelegationCard');

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
    // fill text through textContent so names are never treated as markup
    Array.prototype.forEach.call(dropdown.children, function (btn, i) {
      btn.querySelector('.alloc-option-name').textContent = matches[i].n;
      btn.querySelector('.alloc-option-id').textContent = matches[i].s;
    });
    dropdown.hidden = false;
  }

  function showNoResult() {
    dropdown.innerHTML = '<div class="alloc-noresult">검색 결과가 없습니다 / No match found</div>';
    dropdown.hidden = false;
  }

  function select(d) {
    committeeEl.textContent = d.c;
    committeeCard.classList.add('filled');

    var code = data.flags[d.d];
    var label = data.names[d.d] || d.d;
    delegationEl.textContent = label;
    delegationCard.classList.add('filled');

    if (code) {
      flagEl.src = 'flags/4x3/' + code + '.svg';
      flagEl.alt = label;
      flagEl.hidden = false;
      flagPlaceholder.hidden = true;
    } else {
      flagEl.hidden = true;
      flagPlaceholder.hidden = false;
    }

    selectedEl.textContent = d.n + ' · ' + d.s;
    selectedEl.hidden = false;

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
    committeeEl.textContent = '—';
    delegationEl.textContent = '—';
    flagEl.hidden = true;
    flagEl.removeAttribute('src');
    flagPlaceholder.hidden = false;
    selectedEl.hidden = true;
    selectedEl.textContent = '';
    committeeCard.classList.remove('filled');
    delegationCard.classList.remove('filled');
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
    if (!e.target.closest('.alloc-search-card')) dropdown.hidden = true;
  });

  input.addEventListener('focus', function () {
    if (matches.length) dropdown.hidden = false;
  });
})();
