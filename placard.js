// Raise Placard — one button per delegation. The first request for a country
// is kept on the shared list; anything that arrives after it is dropped, and
// the delegate sees that straight away. The page follows the shared entry live,
// so when the desk clears the list the button comes back without a reload.
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

  var busy = false;   // a press is in flight; ignore the live feed until it settles

  function mine() {
    try { return localStorage.getItem(MINE); } catch (e) { return null; }
  }
  function remember(id) {
    try { localStorage.setItem(MINE, id); } catch (e) { /* private mode */ }
  }
  function forget() {
    try { localStorage.removeItem(MINE); } catch (e) { /* ignore */ }
  }
  function showIdle() {
    btn.textContent = 'Raise Placard';
    btn.disabled = false;
    setStatus('');
  }
  function showRaised() {
    btn.textContent = 'Placard raised';
    btn.disabled = true;
    setStatus('Your placard is raised.');
  }
  function showTaken() {
    btn.textContent = 'Raise Placard';
    btn.disabled = true;
    setStatus('Another delegate of ' + name + ' raised the placard first.');
  }

  // every live update of this country's entry goes through here
  function apply(existing) {
    if (busy) return;
    if (!existing) { forget(); showIdle(); return; }
    if (mine() && existing.id === mine()) showRaised();
    else showTaken();
  }

  btn.disabled = true;   // until the first live value arrives
  PlacardData.watch(key, function (value, error) {
    if (error) { setStatus('Could not reach the placard service. Please try again.'); return; }
    apply(value);
  });

  btn.addEventListener('click', function () {
    if (btn.disabled || busy) return;
    busy = true;
    btn.disabled = true;
    setStatus('Raising…');
    var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    remember(id);   // so the live feed recognises our own entry as ours
    PlacardData.claim(key, {
      id: id,
      name: name,
      flag: flag,
      t: PlacardData.SERVER_TIME
    }).then(function (won) {
      busy = false;
      if (won) showRaised();
      else { forget(); showTaken(); }
    }).catch(function () {
      busy = false;
      forget();
      btn.disabled = false;
      setStatus('Could not raise the placard. Please try again.');
    });
  });
})();
