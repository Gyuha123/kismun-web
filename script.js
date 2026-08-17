// mobile nav toggle
document.querySelectorAll('.nav-toggle').forEach(function (btn) {
  btn.addEventListener('click', function () {
    btn.closest('.sitenav').classList.toggle('mobile-open');
  });
});

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

// keep the conference-info box a fixed height (tallest day) so switching tabs doesn't jump
(function () {
  var wrap = document.querySelector('.day-panels');
  var panels = document.querySelectorAll('.day-panel');
  if (!wrap || !panels.length) return;

  function syncHeight() {
    wrap.style.minHeight = '';
    var maxH = 0;
    panels.forEach(function (p) {
      var prevDisplay = p.style.display;
      p.style.display = 'block';
      if (p.scrollHeight > maxH) maxH = p.scrollHeight;
      p.style.display = prevDisplay;
    });
    wrap.style.minHeight = maxH + 'px';
  }

  syncHeight();
  window.addEventListener('resize', syncHeight);
  window.addEventListener('load', syncHeight);
})();

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
