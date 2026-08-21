/* ═══════════════════════════════════════════════
   굿프랜드유아체육연구소 & 이벤트 — 스크롤 인터랙션
   외부 라이브러리 없음. IntersectionObserver + rAF.
   ═══════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mqSmall = window.matchMedia('(max-width: 760px)');

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ── 스크롤 상태를 한 곳에서 모아 rAF 로 배분 ───────── */
  var scrollY = window.scrollY;
  var lastY = scrollY;
  var velocity = 0;
  var ticking = false;
  var handlers = [];

  function onFrame(fn) { handlers.push(fn); }

  function tick() {
    ticking = false;
    var y = window.scrollY;
    velocity = y - lastY;
    lastY = y;
    scrollY = y;
    for (var i = 0; i < handlers.length; i++) handlers[i](y, velocity);
  }

  function requestTick() {
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', function () { requestTick(); measureRail(); }, { passive: true });

  /* ── 1. 상단 진행률 바 ────────────────────────────── */
  var progressBar = document.getElementById('progressBar');
  onFrame(function (y) {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
  });

  /* ── 2. 내비 : 아래로 내리면 숨기고, 올리면 보이기 ──── */
  var nav = document.getElementById('nav');
  onFrame(function (y, v) {
    if (y > 260 && v > 4) nav.classList.add('is-hidden');
    else if (v < -4 || y < 160) nav.classList.remove('is-hidden');
  });

  /* ── 3. 리빌 (data-reveal) ───────────────────────── */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var d = parseInt(e.target.getAttribute('data-delay') || '0', 10);
      setTimeout(function () { e.target.classList.add('is-in'); }, reduce ? 0 : d);
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  document.querySelectorAll('[data-reveal]').forEach(function (el) { revealIO.observe(el); });

  /* 섹션 타이틀 밑줄 */
  var titleIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); titleIO.unobserve(e.target); }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.sec__title, .spot__title').forEach(function (el) { titleIO.observe(el); });

  /* ── 4. 히어로 : 스크롤에 따라 영상 확대 + 흐림 ────── */
  var heroVideo = document.getElementById('heroVideo');
  var hero = document.getElementById('hero');
  if (heroVideo && !reduce) {
    onFrame(function (y) {
      var h = hero.offsetHeight;
      if (y > h) return;
      var p = clamp(y / h, 0, 1);
      heroVideo.style.transform = 'scale(' + (1 + p * 0.16).toFixed(4) + ') translateY(' + (p * 34).toFixed(1) + 'px)';
      heroVideo.style.filter = 'blur(' + (p * 5).toFixed(2) + 'px)';
    });
  }

  /* ── 5. 키워드 마퀴 : 스크롤 속도에 반응 ──────────── */
  var WORDS_A = ['찾아가는 물놀이', '에어슬라이드', '에어풀장', '에어바운스', '워터슬라이드'];
  var WORDS_B = ['운동회', '체육대회', '키즈놀이터', '버블쇼', '매직쇼', '인형극', '체험부스'];

  function fillTrack(el, words) {
    var html = '';
    for (var r = 0; r < 4; r++) {
      for (var i = 0; i < words.length; i++) html += '<span>' + words[i] + '</span>';
    }
    el.innerHTML = html;
  }
  var mq1 = document.getElementById('mq1');
  var mq2 = document.getElementById('mq2');
  if (mq1) fillTrack(mq1, WORDS_A);
  if (mq2) fillTrack(mq2, WORDS_B);

  var marquees = [];
  document.querySelectorAll('[data-marquee]').forEach(function (row) {
    var track = row.querySelector('.marquee__track');
    marquees.push({
      track: track,
      dir: parseFloat(row.getAttribute('data-dir')) || 1,
      x: 0,
      half: 0
    });
  });

  function measureMarquee() {
    marquees.forEach(function (m) { m.half = m.track.scrollWidth / 2; });
  }
  window.addEventListener('load', measureMarquee);
  setTimeout(measureMarquee, 400);

  var boost = 0;
  onFrame(function (y, v) { boost = clamp(Math.abs(v) * 0.22, 0, 14); });

  (function loopMarquee() {
    if (!reduce) {
      marquees.forEach(function (m) {
        if (!m.half) return;
        m.x -= m.dir * (0.7 + boost);
        if (m.x <= -m.half) m.x += m.half;
        if (m.x >= 0) m.x -= m.half;
        m.track.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,0,0)';
      });
      boost = lerp(boost, 0, 0.08);
    }
    requestAnimationFrame(loopMarquee);
  })();

  /* ── 6. 선언문 : 단어 단위로 차오르기 ──────────────── */
  var stmt = document.querySelector('[data-words]');
  if (stmt) {
    var words = stmt.textContent.trim().split(/\s+/);
    stmt.innerHTML = words.map(function (w) {
      return '<span class="word">' + w + '</span>';
    }).join(' ');
    var spans = stmt.querySelectorAll('.word');

    onFrame(function () {
      var r = stmt.getBoundingClientRect();
      var start = window.innerHeight * 0.86;
      var end = window.innerHeight * 0.28;
      var p = clamp((start - r.top) / (start - end), 0, 1);
      var lit = Math.round(p * spans.length);
      for (var i = 0; i < spans.length; i++) {
        spans[i].classList.toggle('on', i < lit);
      }
    });
  }

  /* ── 7. 숫자 카운트업 ─────────────────────────────── */
  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      var target = parseInt(el.getAttribute('data-count'), 10);
      countIO.unobserve(el);
      if (reduce) { el.textContent = target; return; }
      var dur = 1400, t0 = performance.now();
      (function step(now) {
        var p = clamp((now - t0) / dur, 0, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(function (el) { countIO.observe(el); });

  /* ── 8. 프로그램 : 세로 스크롤 → 가로 이동 ─────────── */
  var railSection = document.querySelector('.rail');
  var railTrack = document.getElementById('railTrack');
  var railBar = document.getElementById('railBar');
  var railDistance = 0;

  function measureRail() {
    if (!railSection || !railTrack) return;
    if (mqSmall.matches || reduce) {
      railSection.style.height = '';
      railTrack.style.transform = '';
      railDistance = 0;
      return;
    }
    railDistance = Math.max(0, railTrack.scrollWidth - window.innerWidth + window.innerWidth * 0.1);
    /* 가로로 밀어야 할 거리 + 한 화면 = 섹션이 붙잡고 있어야 할 높이 */
    var h = Math.round(window.innerHeight + railDistance) + 'px';
    /* 값이 같으면 쓰지 않는다 — ResizeObserver 재진입 방지 */
    if (railSection.style.height !== h) railSection.style.height = h;
  }

  if (railSection && railTrack) {
    measureRail();
    window.addEventListener('load', measureRail);
    /* 폰트·이미지가 늦게 들어오면 카드 크기가 바뀌므로 다시 잰다.
       (첫 측정만 믿으면 sticky 구간 높이가 어긋난다) */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureRail);
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { measureRail(); });
      ro.observe(railTrack);
    }
    mqSmall.addEventListener('change', measureRail);
    onFrame(function () {
      if (!railDistance) return;
      var r = railSection.getBoundingClientRect();
      var p = clamp(-r.top / railDistance, 0, 1);
      railTrack.style.transform = 'translate3d(' + (-p * railDistance).toFixed(1) + 'px,0,0)';
      if (railBar) railBar.style.transform = 'translateX(' + (p * 525).toFixed(1) + '%)';
    });
  }

  /* ── 9. 물놀이 배경 패럴랙스 ──────────────────────── */
  document.querySelectorAll('[data-parallax]').forEach(function (el) {
    var rate = parseFloat(el.getAttribute('data-parallax')) || 0.15;
    var host = el.closest('section');
    if (reduce) return;
    onFrame(function () {
      var r = host.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var mid = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.transform = 'translate3d(0,' + (-mid * rate).toFixed(1) + 'px,0)';
    });
  });

  /* ── 10. 연혁 : 화면 중앙에 걸린 항목의 연도 표시 ──── */
  var storyItems = Array.prototype.slice.call(document.querySelectorAll('.story__item'));
  var storyYear = document.getElementById('storyYear');
  if (storyItems.length && storyYear) {
    onFrame(function () {
      var center = window.innerHeight * 0.45;
      var best = null, bestDist = Infinity;
      storyItems.forEach(function (it) {
        var r = it.getBoundingClientRect();
        var d = Math.abs(r.top + r.height / 2 - center);
        if (d < bestDist) { bestDist = d; best = it; }
      });
      storyItems.forEach(function (it) { it.classList.toggle('is-active', it === best); });
      if (best) {
        var y = best.getAttribute('data-year');
        if (storyYear.textContent !== y) storyYear.textContent = y;
      }
    });
  }

  /* ── 11. 출장 지역 칩 : 순차 팝인 ─────────────────── */
  var AREAS = [
    { n: '여수', base: true }, { n: '순천', base: true }, { n: '광양', base: true },
    { n: '곡성' }, { n: '구례' }, { n: '보성' }, { n: '화순' }, { n: '장흥' },
    { n: '강진' }, { n: '해남' }, { n: '완도' }, { n: '진도' }, { n: '영암' },
    { n: '무안' }, { n: '함평' }, { n: '영광' }, { n: '장성' }, { n: '신안' },
    { n: '고흥' }, { n: '담양' }, { n: '목포' }, { n: '나주' }, { n: '광주' },
    { n: '남원' }, { n: '전주' }, { n: '하동' }, { n: '진주' }, { n: '사천' },
    { n: '고성' }, { n: '함안' }, { n: '의령' }, { n: '제주' }
  ];
  var chipWrap = document.getElementById('areaChips');
  if (chipWrap) {
    chipWrap.innerHTML = AREAS.map(function (a) {
      return '<li' + (a.base ? ' class="is-base"' : '') + '>' + a.n + '</li>';
    }).join('');
    var chips = chipWrap.querySelectorAll('li');
    var chipIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        chipIO.unobserve(e.target);
        chips.forEach(function (c, i) {
          setTimeout(function () { c.classList.add('on'); }, reduce ? 0 : i * 38);
        });
      });
    }, { threshold: 0.2 });
    chipIO.observe(chipWrap);
  }

  /* ── 12. 문의 섹션 물방울 ─────────────────────────── */
  var bubbleBox = document.querySelector('.cta__bubbles');
  if (bubbleBox && !reduce) {
    var html = '';
    for (var i = 0; i < 18; i++) {
      var size = 10 + Math.random() * 54;
      html += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;'
        + 'width:' + size.toFixed(0) + 'px;height:' + size.toFixed(0) + 'px;'
        + 'animation-duration:' + (9 + Math.random() * 11).toFixed(1) + 's;'
        + 'animation-delay:' + (-Math.random() * 16).toFixed(1) + 's"></i>';
    }
    bubbleBox.innerHTML = html;
  }

  /* ── 13. 자석 버튼 ────────────────────────────────── */
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-magnet]').forEach(function (el) {
      el.addEventListener('mousemove', function (ev) {
        var r = el.getBoundingClientRect();
        var mx = ev.clientX - r.left - r.width / 2;
        var my = ev.clientY - r.top - r.height / 2;
        el.style.transform = 'translate(' + (mx * 0.18).toFixed(1) + 'px,' + (my * 0.28).toFixed(1) + 'px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform .45s cubic-bezier(.16,1,.3,1)';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 460);
      });
    });
  }

  /* ── 14. 부드러운 앵커 이동 (고정 내비 높이 보정) ──── */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      ev.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* 첫 프레임 계산 */
  requestTick();
})();
