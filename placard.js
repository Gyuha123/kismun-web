// Raise Placard — one button per delegation. The first request for a country
// is kept on the shared list; anything that arrives after it is dropped, and
// the delegate sees that straight away.
(function () {
  var data = window.KISMUN_ALLOCATION;
  var $ = function (id) { return document.getElementById(id); };
  var countryEl = $('placardCountry');
  var flagWrap = $('placardFlagWrap');
  var flagImg = $('placardFlag');
  var msg = $('placardMessage');
  var btn = $('placardBtn');
  var status = $('placardStatus');

  function setStatus(text) { status.textContent = text || ''; }

  var code = new URLSearchParams(location.search).get('d');
  if (!data || !code || !data.names[code] || !data.flags[code] || code === 'UN') {
    btn.hidden = true;
    msg.hidden = false;
    msg.textContent = 'Open this page by tapping your flag in My allocation.';
    return;
  }

  var name = data.names[code];
  var flag = data.flags[code];
  // Firebase keys cannot contain . # $ [ ] /
  var key = code.replace(/[.#$\[\]\/]/g, '_');
  var MINE = 'kismunPlacard:' + key;

  countryEl.textContent = name;
  flagImg.src = 'flags/4x3/' + flag + '.svg';
  flagImg.alt = name + ' flag';
  flagWrap.hidden = false;
  btn.hidden = false;

  if (!window.PlacardData || !PlacardData.configured()) {
    btn.disabled = true;
    setStatus('The placard service is not connected yet.');
    return;
  }

  function mine() {
    try { return localStorage.getItem(MINE); } catch (e) { return null; }
  }
  function remember(id) {
    try { localStorage.setItem(MINE, id); } catch (e) { /* private mode: state just won't survive a reload */ }
  }
  function showRaised() {
    btn.disabled = true;
    btn.textContent = 'Placard raised';
    setStatus('Your placard is raised.');
  }
  function showTaken() {
    btn.disabled = true;
    setStatus('Another delegate of ' + name + ' raised the placard first.');
  }

  // while we look at the shared list, don't allow a press
  btn.disabled = true;
  PlacardData.get(key).then(function (existing) {
    if (!existing) { btn.disabled = false; return; }
    if (mine() && existing.id === mine()) showRaised();
    else showTaken();
  }).catch(function () {
    setStatus('Could not reach the placard service. Please try again.');
  });

  btn.addEventListener('click', function () {
    if (btn.disabled) return;
    btn.disabled = true;
    setStatus('Raising…');
    var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    PlacardData.claim(key, {
      id: id,
      name: name,
      flag: flag,
      t: PlacardData.SERVER_TIME
    }).then(function (won) {
      if (won) { remember(id); showRaised(); }
      else { showTaken(); }
    }).catch(function () {
      btn.disabled = false;
      setStatus('Could not raise the placard. Please try again.');
    });
  });
})();
