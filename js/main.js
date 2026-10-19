(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.classList.add('js');

  /* Theme toggle ------------------------------------------------------- */

  var themeBtn = document.getElementById('theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function syncThemeUi() {
    var t = currentTheme();
    themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    if (themeMeta) themeMeta.setAttribute('content', t === 'dark' ? '#12110f' : '#f5f1ea');
  }

  themeBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncThemeUi();
  });
  syncThemeUi();

  /* Mobile menu -------------------------------------------------------- */

  var menuBtn = document.getElementById('menu-toggle');
  var navLinks = document.getElementById('nav-links');

  function setMenu(open) {
    navLinks.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  menuBtn.addEventListener('click', function () {
    setMenu(!navLinks.classList.contains('is-open'));
  });
  navLinks.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
      setMenu(false);
      menuBtn.focus();
    }
  });

  /* Nav border on scroll, active section ------------------------------ */

  var nav = document.querySelector('.nav');
  var ticking = false;

  function onScroll() {
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

  var navMap = {};
  Array.prototype.forEach.call(navLinks.querySelectorAll('a[href^="#"]'), function (a) {
    navMap[a.getAttribute('href').slice(1)] = a;
  });

  if ('IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = navMap[entry.target.id];
        if (!link || !entry.isIntersecting) return;
        Object.keys(navMap).forEach(function (k) { navMap[k].classList.remove('is-active'); });
        link.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(navMap).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });
  }

  /* Reveal + count-up -------------------------------------------------- */

  function formatNum(n, el) {
    var v = Math.round(n);
    var s = el.dataset.format === 'comma' ? v.toLocaleString('en-US') : String(v);
    return (el.dataset.prefix || '') + s;
  }

  function countUp(el) {
    var target = parseFloat(el.dataset.count);
    if (reduceMotion || isNaN(target)) return;
    var dur = 1600;
    var start = null;
    el.textContent = formatNum(0, el);
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 4);
      el.textContent = formatNum(target * eased, el);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var reveals = document.querySelectorAll('.reveal');

  // Stagger siblings that enter together.
  Array.prototype.forEach.call(reveals, function (el) {
    var siblings = Array.prototype.filter.call(el.parentElement.children, function (c) {
      return c.classList.contains('reveal');
    });
    var idx = siblings.indexOf(el);
    if (idx > 0) el.style.setProperty('--delay', Math.min(idx * 80, 400) + 'ms');
  });

  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-in');
        Array.prototype.forEach.call(el.querySelectorAll('[data-count]'), countUp);
        revealObserver.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(reveals, function (el) { revealObserver.observe(el); });
  } else {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
  }

  document.getElementById('year').textContent = String(new Date().getFullYear());

  /* Forecast chart (synthetic, illustrative data) ----------------------- */

  var svg = document.getElementById('forecast-chart');
  var tip = document.getElementById('chart-tip');
  var NS = 'http://www.w3.org/2000/svg';
  var HIST = 64;
  var HORIZON = 16;
  var data = null;
  var geom = null;

  function rng(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }

  function gauss(rand) {
    var u = 1 - rand();
    var v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function makeData(seed) {
    var rand = rng(seed);
    var phase = rand() * Math.PI * 2;
    var trend = 0.25 + rand() * 0.35;
    var promoWeeks = [10 + Math.floor(rand() * 6), 34 + Math.floor(rand() * 6), 56 + Math.floor(rand() * 4), 70 + Math.floor(rand() * 4)];

    function signal(t) {
      var promo = 0;
      promoWeeks.forEach(function (w) {
        var d = t - w;
        if (d >= 0 && d < 3) promo += [26, 12, -6][d];
      });
      return 100 + trend * t + 16 * Math.sin((2 * Math.PI * t) / 26 + phase) + 6 * Math.sin((2 * Math.PI * t) / 8.5) + promo;
    }

    var actual = [];
    var fit = [];
    var fc = [];
    for (var t = 0; t < HIST; t++) {
      fit.push(signal(t));
      actual.push(signal(t) + gauss(rand) * 5.5);
    }
    for (var h = 0; h < HORIZON; h++) {
      var tt = HIST + h;
      var sd = 6 + 2.6 * Math.sqrt(h + 1);
      fc.push({ mid: signal(tt), lo: signal(tt) - 1.28 * sd, hi: signal(tt) + 1.28 * sd });
    }
    return { actual: actual, fit: fit, fc: fc };
  }

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(node);
    return node;
  }

  function pathFrom(points) {
    return points.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  }

  function render(animate) {
    if (!data) return;
    var w = svg.clientWidth;
    var h = svg.clientHeight;
    if (!w || !h) return;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.classList.remove('is-drawn');
    el('title', {}, svg).textContent = 'Click to draw a new scenario';

    var pad = { l: 0, r: 0, t: 26, b: 24 };
    var n = HIST + HORIZON;
    var all = data.actual.concat(data.fc.map(function (f) { return f.hi; }), data.fc.map(function (f) { return f.lo; }));
    var min = Math.min.apply(null, all) - 6;
    var max = Math.max.apply(null, all) + 6;
    var x = function (i) { return pad.l + (i / (n - 1)) * (w - pad.l - pad.r); };
    var y = function (v) { return pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b); };
    geom = { x: x, y: y, w: w, h: h, pad: pad };

    var grid = el('g', { class: 'grid' }, svg);
    for (var g = 0; g <= 3; g++) {
      var gy = pad.t + (g / 3) * (h - pad.t - pad.b);
      el('line', { x1: 0, x2: w, y1: gy, y2: gy }, grid);
    }

    var upper = data.fc.map(function (f, i) { return [x(HIST + i), y(f.hi)]; });
    var lower = data.fc.map(function (f, i) { return [x(HIST + i), y(f.lo)]; }).reverse();
    var start = [x(HIST - 1), y(data.fit[HIST - 1])];
    el('path', { class: 'band', d: pathFrom([start].concat(upper, lower, [start])) + ' Z' }, svg);

    var nowX = x(HIST - 1);
    el('line', { class: 'now', x1: nowX, x2: nowX, y1: pad.t - 10, y2: h - pad.b + 6 }, svg);
    var label = el('text', { class: 'now-label', x: nowX + 8, y: h - 4 }, svg);
    label.textContent = 'TODAY';

    var fitLine = el('path', { class: 'line-fit', d: pathFrom(data.fit.map(function (v, i) { return [x(i), y(v)]; })) }, svg);
    var actLine = el('path', { class: 'line-actual', d: pathFrom(data.actual.map(function (v, i) { return [x(i), y(v)]; })) }, svg);
    var fcLine = el('path', { class: 'line-fc', d: pathFrom([start].concat(data.fc.map(function (f, i) { return [x(HIST + i), y(f.mid)]; }))) }, svg);

    el('line', { class: 'cross', id: 'chart-cross', x1: 0, x2: 0, y1: pad.t - 10, y2: h - pad.b }, svg);
    el('circle', { class: 'dot', id: 'chart-dot', r: 4.5, cx: 0, cy: 0 }, svg);

    if (animate && !reduceMotion) {
      [[actLine, 0, 1600], [fitLine, 500, 1400], [fcLine, 1500, 1000]].forEach(function (cfg) {
        var path = cfg[0];
        var len = path.getTotalLength();
        path.style.strokeDasharray = len + ' ' + len;
        path.style.strokeDashoffset = String(len);
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset ' + cfg[2] + 'ms cubic-bezier(0.22, 1, 0.36, 1) ' + cfg[1] + 'ms';
        path.style.strokeDashoffset = '0';
        if (path === fitLine) {
          path.addEventListener('transitionend', function () {
            path.style.strokeDasharray = '';
          }, { once: true });
        }
      });
      requestAnimationFrame(function () { svg.classList.add('is-drawn'); });
    } else {
      svg.classList.add('is-drawn');
    }
  }

  function onMove(e) {
    if (!geom) return;
    var r = svg.getBoundingClientRect();
    var px = ((e.clientX - r.left) / r.width) * geom.w;
    var n = HIST + HORIZON;
    var i = Math.round(((px - geom.pad.l) / (geom.w - geom.pad.l - geom.pad.r)) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    var cx = geom.x(i);
    var val;
    var html;
    if (i < HIST) {
      val = data.actual[i];
      html = 'Week ' + (i + 1) + ' &middot; actual <b>' + Math.round(val) + '</b>';
    } else {
      var f = data.fc[i - HIST];
      val = f.mid;
      html = 'Week ' + (i + 1) + ' &middot; forecast <b>' + Math.round(f.mid) + '</b> (' + Math.round(f.lo) + ' to ' + Math.round(f.hi) + ')';
    }
    var cross = document.getElementById('chart-cross');
    var dot = document.getElementById('chart-dot');
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', geom.y(val));
    svg.classList.add('is-hover');

    tip.innerHTML = html;
    tip.classList.add('is-visible');
    var bodyRect = svg.parentElement.getBoundingClientRect();
    var left = r.left - bodyRect.left + (cx / geom.w) * r.width;
    var half = tip.offsetWidth / 2;
    left = Math.max(half, Math.min(bodyRect.width - half, left));
    tip.style.left = left + 'px';
  }

  function onLeave() {
    svg.classList.remove('is-hover');
    tip.classList.remove('is-visible');
  }

  if (svg) {
    var seed = 20261019;
    var started = false;
    data = makeData(seed);

    var start = function () {
      if (started) return;
      started = true;
      render(true);
    };

    if ('IntersectionObserver' in window) {
      var chartObserver = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          start();
          chartObserver.disconnect();
        }
      }, { threshold: 0.3 });
      chartObserver.observe(svg);
    } else {
      start();
    }

    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerleave', onLeave);

    // Click or tap the chart to draw a new scenario.
    svg.addEventListener('click', function () {
      seed += 7919;
      data = makeData(seed);
      onLeave();
      render(true);
    });

    var resizeTimer;
    var lastW = svg.clientWidth;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (svg.clientWidth !== lastW && started) {
          lastW = svg.clientWidth;
          render(false);
        }
      }, 150);
    });
  }
})();
