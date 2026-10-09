/* =========================================================
   Portfolio – main.js
   1. Navbar: active link on click + scroll-spy
   2. Recommendations: infinite side-scrolling carousel
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initRecommendationSlider();
});

/* ---------- 1. NAVIGATION ---------- */
function initNavigation() {
  const links = Array.from(document.querySelectorAll('.nav-link'));
  if (!links.length) return;

  const setActive = (id) => {
    links.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
    });
  };

  links.forEach((link) => {
    link.addEventListener('click', () => setActive(link.getAttribute('href').slice(1)));
  });

  // Links to sections that don't exist yet (Skills, Education) are skipped
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (!('IntersectionObserver' in window) || !sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
    { rootMargin: '-40% 0px -55% 0px' }
  );
  sections.forEach((s) => observer.observe(s));
}

/* ---------- 2. RECOMMENDATIONS: INFINITE CAROUSEL ----------
   The track holds three copies of the cards (clones | originals | clones).
   The active card is always centred. Moving past either end of the
   originals lands on a clone, then silently jumps back to the matching
   original, so the strip scrolls forever in both directions.        */
function initRecommendationSlider() {
  const slider = document.getElementById('recSlider');
  const dotsWrap = document.querySelector('.slider-dots');
  if (!slider || !dotsWrap) return;

  const track = slider.querySelector('.slider-track');
  const originals = Array.from(track.children);
  const n = originals.length;
  if (n < 2) return;

  const DURATION = 500;
  const AUTOPLAY_MS = 4000;
  const SWIPE_THRESHOLD = 50;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Build clones: n before, n after
  const makeClone = (el) => {
    const c = el.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.classList.add('is-clone');
    return c;
  };
  originals.slice().reverse().forEach((el) => track.insertBefore(makeClone(el), track.firstChild));
  originals.forEach((el) => track.appendChild(makeClone(el)));

  const cards = Array.from(track.children);
  let active = Math.min(2, n - 1); // 0…n-1, shown by the dots
  let pos = n + active;            // index in the full track
  let busy = false;
  let timer = null;
  let settleTimer = null;

  // Dots
  const dots = originals.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Show recommendation ${i + 1}`);
    dot.addEventListener('click', () => {
      goTo(i);
      restartAutoplay();
    });
    dotsWrap.appendChild(dot);
    return dot;
  });

  // X offset that centres card `index` inside the viewport
  const offsetFor = (index) => {
    const card = cards[index];
    return slider.clientWidth / 2 - (card.offsetLeft + card.offsetWidth / 2);
  };

  const setTransform = (x, animate) => {
    track.style.transition = animate && !reduceMotion
      ? `transform ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : 'none';
    track.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  const updateDots = () => {
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === active);
      dot.setAttribute('aria-selected', i === active);
    });
  };

  // After a move, jump from a clone back to the identical original
  const settle = () => {
    busy = false;
    if (pos < n || pos >= 2 * n) {
      pos = n + active;
      setTransform(offsetFor(pos), false);
    }
  };

  function move(delta) {
    if (busy) return;
    busy = true;
    pos += delta;
    active = (((active + delta) % n) + n) % n;
    setTransform(offsetFor(pos), true);
    updateDots();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, reduceMotion ? 0 : DURATION + 30);
  }

  // Dot click: take the shortest way round
  function goTo(index) {
    const half = Math.floor(n / 2);
    const delta = ((index - active + n + half) % n) - half;
    if (delta !== 0) move(delta);
  }

  const next = () => move(1);
  const prev = () => move(-1);

  // Autoplay
  function startAutoplay() {
    if (reduceMotion || timer) return;
    timer = setInterval(next, AUTOPLAY_MS);
  }
  function stopAutoplay() {
    clearInterval(timer);
    timer = null;
  }
  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  slider.addEventListener('mouseenter', stopAutoplay);
  slider.addEventListener('mouseleave', () => !dragging && startAutoplay());
  dotsWrap.addEventListener('focusin', stopAutoplay);
  dotsWrap.addEventListener('focusout', startAutoplay);
  document.addEventListener('visibilitychange', () => (document.hidden ? stopAutoplay() : startAutoplay()));

  // Drag / swipe: the strip follows the pointer, then snaps
  let dragging = false;
  let startX = 0;
  let baseX = 0;

  slider.addEventListener('pointerdown', (e) => {
    if (busy) return;
    dragging = true;
    startX = e.clientX;
    baseX = offsetFor(pos);
    slider.setPointerCapture(e.pointerId);
    slider.classList.add('dragging');
    stopAutoplay();
    setTransform(baseX, false);
  });

  slider.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    setTransform(baseX + (e.clientX - startX), false);
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    slider.classList.remove('dragging');
    const dx = e.clientX - startX;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      dx < 0 ? next() : prev();
    } else {
      setTransform(baseX, true); // snap back
    }
    startAutoplay();
  };
  slider.addEventListener('pointerup', endDrag);
  slider.addEventListener('pointercancel', endDrag);

  // Let wheel/trackpad input browse cards without blocking page scrolling.
  slider.addEventListener('wheel', (e) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 10 || busy) return;
    delta > 0 ? next() : prev();
    restartAutoplay();
  }, { passive: true });

  // Arrow keys while a dot is focused
  dotsWrap.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { next(); }
    if (e.key === 'ArrowLeft') { prev(); }
  });

  // Keep the active card centred when the window resizes
  window.addEventListener('resize', () => setTransform(offsetFor(pos), false));

  // Wait for avatars to load so card positions are final, then centre
  const init = () => {
    setTransform(offsetFor(pos), false);
    updateDots();
    startAutoplay();
  };
  init();
  window.addEventListener('load', () => setTransform(offsetFor(pos), false));
}

