// mobile nav toggle
document.querySelectorAll('.nav-toggle').forEach(function (btn) {
  btn.addEventListener('click', function () {
    btn.closest('.sitenav').classList.toggle('mobile-open');
  });
});

// nav pill — the gray ellipse that marks the current section slides over
// from wherever it sat on the page you came from, so moving between
// committee / staff / secretariat / director feels continuous across
// full page loads instead of a flat swap.
(function () {
  var links = document.querySelector('.sitenav .links');
  if (!links) return;

  var items = Array.prototype.slice.call(links.querySelectorAll('a'));
  var activeIndex = items.findIndex(function (a) { return a.classList.contains('active'); });
  if (activeIndex === -1) return; // index / allocation have no section to mark

  // only the desktop pill nav has real widths to measure — the mobile
  // dropdown keeps its own static highlight instead
  if (links.offsetWidth === 0) return;

  var pill = document.createElement('span');
  pill.className = 'nav-pill';
  pill.setAttribute('aria-hidden', 'true');
  links.insertBefore(pill, links.firstChild);

  function setRect(i) {
    var a = items[i];
    pill.style.transform = 'translateX(' + a.offsetLeft + 'px)';
    pill.style.width = a.offsetWidth + 'px';
  }

  var STORE_KEY = 'kismunNavPillIndex';
  var fromRaw = sessionStorage.getItem(STORE_KEY);
  var fromIndex = fromRaw === null ? -1 : parseInt(fromRaw, 10);
  sessionStorage.setItem(STORE_KEY, String(activeIndex));

  if (fromIndex >= 0 && fromIndex < items.length && fromIndex !== activeIndex) {
    // land exactly where the pill was on the page we came from (no
    // transition yet), then let it glide over to the real tab
    setRect(fromIndex);
    pill.classList.add('is-placed');
    requestAnimationFrame(function () {
      pill.classList.add('is-ready');
      requestAnimationFrame(function () { setRect(activeIndex); });
    });
  } else {
    setRect(activeIndex);
    pill.classList.add('is-placed', 'is-ready');
  }

  window.addEventListener('resize', function () { setRect(activeIndex); });
})();

// conference day tabs
document.querySelectorAll('.day-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    var day = tab.getAttribute('data-day');
    document.querySelectorAll('.day-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.day-panel').forEach(function (p) { p.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById('day-' + day).classList.add('active');
  });
});


// gallery swipe carousel
(function () {
  var carousel = document.getElementById('galleryCarousel');
  if (!carousel) return;

  var fill = document.getElementById('galleryProgressFill');
  var hint = document.getElementById('galleryHint');

  function updateProgress() {
    var max = carousel.scrollWidth - carousel.clientWidth;
    var pct = max > 0 ? (carousel.scrollLeft / max) * 100 : 0;
    fill.style.width = pct + '%';

    if (hint && carousel.scrollLeft > 4) {
      hint.classList.add('hidden');
    }
  }

  carousel.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  // mouse drag-to-scroll for desktop
  var isDown = false;
  var startX = 0;
  var startScroll = 0;

  carousel.addEventListener('mousedown', function (e) {
    isDown = true;
    carousel.classList.add('dragging');
    startX = e.pageX;
    startScroll = carousel.scrollLeft;
  });

  window.addEventListener('mouseup', function () {
    isDown = false;
    carousel.classList.remove('dragging');
  });

  window.addEventListener('mousemove', function (e) {
    if (!isDown) return;
    e.preventDefault();
    var delta = e.pageX - startX;
    carousel.scrollLeft = startScroll - delta;
  });
})();
