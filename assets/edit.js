/**
 * 굿프랜드유아체육연구소 & 이벤트 홈페이지 — 대표님 직접 수정 모드
 *
 * 대표님이 하는 일
 *   1. 큰길브리지가 문자로 보낸 주소로 들어간다:  https://gfevent.co.kr/?edit=열쇠
 *   2. 글자를 누르고 고친다 (히어로 포함 모든 글). 사진을 누르고 갤러리에서 고른다.
 *   3. 다른 페이지(광양 · 순천 · 여수)로 옮겨 다니며 고쳐도 된다 — 고친 것은 이 기기에 자동 보관된다.
 *   4. 「수정 내용 보내기」를 누르면 큰길브리지 메일로 글 수정이 바로 가고,
 *      사진이 있으면 수정 파일이 만들어져 카톡 · 메일로 보낼 수 있다.
 *   5. 큰길브리지가 tools/apply_edits.py 로 반영하고 사이트에 올린다 (보통 1영업일).
 *
 * 열쇠가 틀리면 아무것도 안 한다. ?edit=off 로 편집을 끝낸다.
 * 레이아웃 · 색 · 순서는 못 건드린다. 대표님이 사이트를 망가뜨릴 길이 없다.
 *
 * 건드리지 않는 곳(SKIP): app.js 가 글을 직접 써 넣는 자리들 —
 *   숫자 카운트업([data-count]) · 선언문 낱말 점등([data-words]) · 키워드 마퀴 ·
 *   출장 지역 칩(#areaChips 는 app.js 의 AREAS 배열이 innerHTML 을 통째로 다시 쓴다) ·
 *   연혁 연도 표시(#storyYear) · 문의 결과 문구(#formMsg) · 진행률 바 · 문의 폼.
 *   여기를 편집 대상으로 두면 고쳐도 새로고침하면 사라져 대표님이 헷갈린다.
 */
(function () {
  'use strict';
  /* 큰길브리지 문의 서버(앱스 스크립트). 글 수정 내용이 이 주소로 메일 전송된다. */
  var SEND_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwvQ4UJRZklRX7bZB6C0s1yZgSvBAMCVccT580L_1BtiVDyh0DIxShCAvN9McZIB0b7FA/exec';
  var OUR_NAME = '큰길브리지', OUR_TEL = '1533-7295', OUR_MAIL = 'gilauto325@gmail.com';
  var SITE = 'goodfriend', SITE_KR = '굿프랜드';

  var meta = document.querySelector('meta[name="gf-edit"]');
  if (!meta) return;
  var hash = (meta.getAttribute('content') || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return;

  var page = location.pathname.split('/').pop() || 'index.html';
  var dir = location.pathname.slice(0, location.pathname.length - (location.pathname.split('/').pop() || '').length);

  /* ── 열쇠 ── */
  var key = '';
  try {
    var m = /[?&]edit=([^&#]+)/.exec(location.search || '');
    if (m) { var v = decodeURIComponent(m[1]); if (v === 'off') sessionStorage.removeItem('gf-edit-key'); else sessionStorage.setItem('gf-edit-key', v); }
    key = sessionStorage.getItem('gf-edit-key') || '';
  } catch (e) { key = m ? decodeURIComponent(m[1]) : ''; }
  if (!key || key === 'off' || sha256(key) !== hash) return;

  /* ══ 편집 모드 ══ */
  var SKIP = '#progressBar,#railBar,#storyYear,#formMsg,#areaChips,[data-count],[data-words],[data-marquee],.marquee__track,.cta__leaves,form,#gf-editbar,#gf-dlg';
  var INLINE = { B: 1, EM: 1, I: 1, SMALL: 1, BR: 1, STRONG: 1, SPAN: 1, A: 1, TIME: 1, U: 1 };
  var TAGS = 'h1,h2,h3,h4,p,li,b,small,span,a,label,summary,dt,dd,address,figcaption,em,time,i,td,th';
  var texts = {};   // sel → {old,new,occ}
  var images = {};  // src → dataURL
  var orig = {};    // sel → 원래 innerHTML
  var els = [];

  function leaf(el) {
    if (!el.textContent.trim()) return false;
    if (el.querySelector('[data-count],svg,img,input,button,select,textarea,video')) return false;
    for (var i = 0; i < el.children.length; i++) if (!INLINE[el.children[i].tagName]) return false;
    return true;
  }
  function cssPath(el) {
    var parts = [];
    while (el && el !== document.body) {
      var p = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(p + '#' + el.id); break; }
      var n = 1, s = el; while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) n++;
      parts.unshift(p + ':nth-of-type(' + n + ')'); el = el.parentElement;
    }
    return parts.join(' > ');
  }
  function sanitize(el) {
    var c = el.cloneNode(true);
    [].slice.call(c.querySelectorAll('*')).forEach(function (x) {
      if (!INLINE[x.tagName] || x.tagName === 'A' && !x.getAttribute('href')) {
        if (x.tagName === 'DIV' || x.tagName === 'P') x.insertAdjacentHTML('beforebegin', '<br>');
        while (x.firstChild) x.parentNode.insertBefore(x.firstChild, x);
        x.parentNode.removeChild(x);
      } else { ['style', 'contenteditable', 'spellcheck', 'data-e'].forEach(function (a) { x.removeAttribute(a); }); }
    });
    return c.innerHTML.replace(/^(<br>)+|(<br>)+$/g, '');
  }

  /* ── 글자 표시 ── */
  [].slice.call(document.querySelectorAll(TAGS)).forEach(function (el) {
    if (el.closest(SKIP) || el.closest('[data-e]') || !leaf(el)) return;
    var sel = cssPath(el); el.setAttribute('data-e', sel); els.push(el);
    orig[sel] = el.innerHTML;
    el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); el.classList.add('gf-e');
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); document.execCommand('insertLineBreak'); } });
    el.addEventListener('paste', function (ev) { ev.preventDefault(); document.execCommand('insertText', false, (ev.clipboardData || window.clipboardData).getData('text')); });
    el.addEventListener('input', function () {
      var nv = sanitize(el);
      if (nv === orig[sel]) delete texts[sel]; else texts[sel] = { old: orig[sel], new: nv, occ: occ(sel) };
      dirty();
    });
  });
  function occ(sel) { // 같은 원문이 페이지에 여러 번 있을 때 몇 번째인지
    var o = orig[sel], k = 0;
    for (var i = 0; i < els.length; i++) { var s = els[i].getAttribute('data-e'); if (s === sel) return k; if (orig[s] === o) k++; }
    return 0;
  }

  /* ── 사진 ── */
  var picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'image/*'; picker.style.display = 'none';
  document.body.appendChild(picker);
  var picking = null;
  function imgTarget(t) {
    var main = document.querySelector('main'); if (!main || !main.contains(t)) return null;
    var el = t.closest('img,[style*="background-image"]'); if (!el || el.closest('#gf-editbar,#gf-dlg')) return null;
    var src = el.tagName === 'IMG' ? el.getAttribute('src') : (el.getAttribute('data-src') || (/url\((['"]?)(.*?)\1\)/.exec(el.getAttribute('style') || '') || [])[2]);
    if (!src || /^data:/.test(src)) return null;
    var abs = new URL(src, location.href).pathname; if (abs.indexOf(dir) === 0) abs = abs.slice(dir.length);
    return { el: el, src: abs.replace(/^\//, '') };
  }
  document.addEventListener('mouseover', function (ev) { var t = imgTarget(ev.target); [].slice.call(document.querySelectorAll('.gf-img-hot')).forEach(function (x) { x.classList.remove('gf-img-hot'); }); if (t) t.el.classList.add('gf-img-hot'); }, true);
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('#gf-editbar,#gf-dlg')) return;
    var main = document.querySelector('main');
    var a = ev.target.closest('a');
    if (a && main && main.contains(a) && !a.hasAttribute('data-e')) ev.preventDefault();  // 편집 중엔 본문 링크로 이동하지 않는다
    var t = imgTarget(ev.target); if (!t) return;
    if (ev.target.closest('[data-e]')) return;  // 글자 위에서는 글자 편집이 우선
    ev.preventDefault(); ev.stopPropagation();
    picking = t; picker.value = ''; picker.click();
  }, true);
  picker.addEventListener('change', function () {
    var f = picker.files && picker.files[0]; if (!f || !picking) return;
    if (!/^image\//.test(f.type)) { toast('사진 파일만 올릴 수 있어요'); return; }
    var t = picking;
    shrink(f, 1920, 0.86, function (d) {
      if (!d) { toast('이 사진은 읽지 못했어요. 다른 사진으로 해보세요'); return; }
      setImage(t.src, d); dirty();
      toast('사진을 바꿨어요. 다른 곳도 고친 뒤 「수정 내용 보내기」를 눌러 주세요', true);
    });
  });
  function setImage(src, d) {
    images[src] = d;
    [].slice.call(document.querySelectorAll('main img,main [style*="background-image"]')).forEach(function (el) {
      var t = imgTarget(el); if (!t || t.src !== src) return;
      if (el.tagName === 'IMG') el.src = d; else el.style.backgroundImage = 'url(' + d + ')';
    });
  }
  function shrink(file, max, q, cb) {
    var r = new FileReader(); r.onerror = function () { cb(null); };
    r.onload = function () {
      var im = new Image(); im.onerror = function () { cb(null); };
      im.onload = function () {
        var s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        try { c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', q)); } catch (e) { cb(null); }
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  }

  /* ── 이 기기에 보관 (IndexedDB — 사진까지) ── */
  function db(cb) {
    var rq = indexedDB.open('gf-edit', 1);
    rq.onupgradeneeded = function () { rq.result.createObjectStore('pages'); };
    rq.onsuccess = function () { cb(rq.result); }; rq.onerror = function () { cb(null); };
  }
  function store(cb) { db(function (d) { if (!d) return cb && cb(); var tx = d.transaction('pages', 'readwrite'); tx.objectStore('pages').put({ texts: texts, images: images, at: Date.now() }, page); tx.oncomplete = function () { cb && cb(); }; }); }
  function loadAll(cb) { db(function (d) { if (!d) return cb({}); var out = {}, st = d.transaction('pages').objectStore('pages'), rq = st.openCursor(); rq.onsuccess = function () { var c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else cb(out); }; rq.onerror = function () { cb({}); }; }); }
  function clearAll(cb) { db(function (d) { if (!d) return cb(); var tx = d.transaction('pages', 'readwrite'); tx.objectStore('pages').clear(); tx.oncomplete = cb; }); }
  var saveTimer; function dirty() { refresh(); clearTimeout(saveTimer); saveTimer = setTimeout(function () { store(); }, 400); }

  // 전에 고친 것 입히기
  loadAll(function (all) {
    var mine = all[page]; if (!mine) { refresh(); return; }
    Object.keys(mine.texts || {}).forEach(function (sel) {
      var el = document.querySelector('[data-e="' + sel.replace(/"/g, '\\"') + '"]'); if (!el) return;
      el.innerHTML = mine.texts[sel].new; texts[sel] = mine.texts[sel];
    });
    Object.keys(mine.images || {}).forEach(function (src) { setImage(src, mine.images[src]); });
    refresh();
  });

  /* ── 막대 · 대화상자 ── */
  style();
  var bar = document.createElement('div'); bar.id = 'gf-editbar';
  bar.innerHTML = '<span class="dot"></span><span class="txt"><b>수정 모드</b> — 글자를 누르면 고칠 수 있고, 사진을 누르면 바꿀 수 있어요. 다른 페이지로 옮겨 다녀도 됩니다.</span>' +
    '<span class="st" id="gf-st"></span><button type="button" class="b undo">이 페이지 되돌리기</button><button type="button" class="b send">수정 내용 보내기</button><a class="b off" href="?edit=off">편집 끝</a>';
  document.body.appendChild(bar); document.body.style.paddingBottom = '76px';
  var st = bar.querySelector('#gf-st'), sendBtn = bar.querySelector('.send');
  bar.querySelector('.undo').addEventListener('click', function () {
    els.forEach(function (el) { el.innerHTML = orig[el.getAttribute('data-e')]; });
    texts = {}; images = {}; store(function () { location.reload(); });
  });
  sendBtn.addEventListener('click', openDialog);
  function count(all) { var n = 0; Object.keys(all).forEach(function (p) { n += Object.keys(all[p].texts || {}).length + Object.keys(all[p].images || {}).length; }); return n; }
  function refresh() { loadAll(function (all) { all[page] = { texts: texts, images: images }; var n = count(all); st.textContent = n ? '바뀐 곳 ' + n : ''; sendBtn.disabled = !n; }); }

  function openDialog() {
    loadAll(function (all) {
      all[page] = { texts: texts, images: images };
      var n = count(all); if (!n) { toast('바뀐 것이 없어요'); return; }
      var nImg = 0; Object.keys(all).forEach(function (p) { nImg += Object.keys(all[p].images || {}).length; });
      var dlg = document.getElementById('gf-dlg'); if (dlg) dlg.parentNode.removeChild(dlg);
      dlg = document.createElement('div'); dlg.id = 'gf-dlg';
      var saved = {}; try { saved = JSON.parse(localStorage.getItem('gf-edit-who') || '{}'); } catch (e) {}
      dlg.innerHTML = '<div class="box"><h3>수정 내용 보내기</h3><p class="d">바뀐 곳 <b>' + n + '</b>개' + (nImg ? ' (사진 ' + nImg + '장 포함)' : '') + '. 보내면 ' + OUR_NAME + '가 확인하고 보통 1영업일 안에 사이트에 반영합니다.</p>' +
        '<label>보내는 분<input id="gf-who" value="' + esc(saved.who || '황동훈') + '"></label><label>연락처<input id="gf-tel" value="' + esc(saved.tel || '') + '" placeholder="010-0000-0000"></label>' +
        '<label>남길 말 (선택)<textarea id="gf-memo" placeholder="예: 대문 첫 문장 바꿨고, 운동회 사진 두 장 교체했어요"></textarea></label>' +
        (nImg ? '<p class="n">사진은 메일로 보내기엔 커서 <b>수정 파일</b>로 만들어집니다. 만들어진 파일을 카톡이나 메일로 ' + OUR_NAME + '(' + OUR_TEL + ' · ' + OUR_MAIL + ')에 보내 주세요. 폰에서는 공유창이 바로 뜹니다.</p>' : '') +
        '<div class="row"><button type="button" class="b send2">보내기</button><button type="button" class="b file">수정 파일만 저장</button><button type="button" class="b x">닫기</button></div><p class="s" id="gf-dst"></p></div>';
      document.body.appendChild(dlg);
      dlg.querySelector('.x').addEventListener('click', function () { dlg.parentNode.removeChild(dlg); });
      dlg.querySelector('.file').addEventListener('click', function () { shareFile(payload(all, who()), true); });
      dlg.querySelector('.send2').addEventListener('click', function () {
        var w = who(); if (!w.tel) { alert('연락처를 적어 주세요. 반영 뒤 문자로 알려 드립니다.'); return; }
        try { localStorage.setItem('gf-edit-who', JSON.stringify(w)); } catch (e) {}
        var pl = payload(all, w), b = dlg.querySelector('.send2'); b.disabled = true; b.textContent = '보내는 중…';
        sendMail(pl, function (ok) {
          b.disabled = false; b.textContent = '보내기';
          var s = dlg.querySelector('#gf-dst');
          if (ok) { s.innerHTML = '글 수정 내용을 ' + OUR_NAME + ' 메일로 보냈어요. ' + (nImg ? '<b>이어서 사진이 든 수정 파일을 보내 주세요.</b>' : '반영되면 문자로 알려 드립니다.'); }
          else { s.innerHTML = '메일 전송이 안 됐어요. 아래 「수정 파일만 저장」으로 파일을 만들어 카톡 · 메일로 보내 주세요.'; }
          if (nImg) shareFile(pl, false);
        });
      });
      function who() { return { who: dlg.querySelector('#gf-who').value.trim(), tel: dlg.querySelector('#gf-tel').value.trim(), memo: dlg.querySelector('#gf-memo').value.trim() }; }
    });
  }
  function payload(all, w) {
    var pages = {};
    Object.keys(all).forEach(function (p) {
      var t = all[p].texts || {}, im = all[p].images || {};
      if (!Object.keys(t).length && !Object.keys(im).length) return;
      pages[p] = { texts: Object.keys(t).map(function (s) { return { sel: s, old: t[s].old, new: t[s].new, occ: t[s].occ || 0 }; }), images: Object.keys(im).map(function (s) { return { src: s, data: im[s] }; }) };
    });
    return { v: 1, site: SITE, at: new Date().toISOString(), who: w.who, tel: w.tel, memo: w.memo, pages: pages };
  }
  function summary(pl) {
    var lines = [];
    Object.keys(pl.pages).forEach(function (p) {
      var pg = pl.pages[p];
      pg.texts.forEach(function (t) { lines.push('[' + p + '] ' + strip(t.old).slice(0, 40) + ' → ' + strip(t.new).slice(0, 60)); });
      pg.images.forEach(function (i) { lines.push('[' + p + '] 사진 교체: ' + i.src + ' (수정 파일에 포함)'); });
    });
    return lines.join('\n');
  }
  function sendMail(pl, cb) {
    if (!SEND_ENDPOINT) return cb(false);
    var light = JSON.parse(JSON.stringify(pl));
    Object.keys(light.pages).forEach(function (p) { light.pages[p].images = light.pages[p].images.map(function (i) { return { src: i.src, data: '(수정 파일 참조)' }; }); });
    var msg = '[' + SITE_KR + ' 홈페이지 수정 요청]\n보낸 분: ' + pl.who + ' / ' + pl.tel + '\n' + (pl.memo ? '남긴 말: ' + pl.memo + '\n' : '') + '\n' + summary(pl) + '\n\n[JSON — tools/apply_edits.py 에 그대로 넣으면 반영됩니다]\n' + JSON.stringify(light);
    fetch(SEND_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ name: SITE_KR + ' / ' + pl.who, phone: pl.tel, email: '', service: SITE_KR + ' 홈페이지 수정 요청', message: msg, page: location.href, at: pl.at }) })
      .then(function (r) { return r.ok; }).then(function (ok) { cb(!!ok); }).catch(function () { cb(false); });
  }
  function shareFile(pl, quiet) {
    var name = SITE_KR + '-수정요청-' + pl.at.slice(0, 16).replace(/[-:T]/g, '') + '.json';
    var blob = new Blob([JSON.stringify(pl)], { type: 'application/json' });
    var done = function () { var s = document.querySelector('#gf-dst'); if (s) s.innerHTML += '<br>수정 파일 <b>' + name + '</b> — 카톡이나 메일로 ' + OUR_NAME + '(' + OUR_TEL + ' · ' + OUR_MAIL + ')에 보내 주세요.'; };
    try {
      var f = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: SITE_KR + ' 홈페이지 수정 파일' }).then(done).catch(function () { download(blob, name); done(); }); return; }
    } catch (e) {}
    download(blob, name); done();
  }
  function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  function strip(h) { var d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var tt; function toast(m, good) { var t = document.getElementById('gf-toast'); if (!t) { t = document.createElement('div'); t.id = 'gf-toast'; document.body.appendChild(t); } t.textContent = m; t.className = good ? 'on good' : 'on'; clearTimeout(tt); tt = setTimeout(function () { t.className = ''; }, 3600); }
  function style() {
    var s = document.createElement('style');
    s.textContent = '.gf-e{outline:2px dashed #D97706;outline-offset:3px;cursor:text;border-radius:2px;min-width:1em}.gf-e:hover,.gf-e:focus{outline:2px solid #2E1F14;background:rgba(240,169,43,.22)}' +
      '.gf-img-hot{outline:3px solid #D97706!important;outline-offset:-3px;cursor:pointer!important}' +
      '#gf-editbar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;align-items:center;gap:10px;padding:12px 16px;background:#2C1C0E;color:#FDF6EA;font:14px/1.4 "Gothic A1","Malgun Gothic",system-ui,sans-serif;box-shadow:0 -6px 24px rgba(0,0,0,.3);word-break:keep-all}' +
      '#gf-editbar .dot{width:9px;height:9px;border-radius:50%;background:#F0A92B;flex:none;animation:gfp 1.6s infinite}@keyframes gfp{50%{opacity:.35}}#gf-editbar .txt{flex:1;min-width:0}#gf-editbar .st{font-size:12px;opacity:.8;white-space:nowrap}' +
      '#gf-editbar .b{border:0;border-radius:8px;padding:9px 14px;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap;text-decoration:none;color:#F6EBD8;background:#4A3118}#gf-editbar .send{background:#F0A92B;color:#2E1F14}#gf-editbar .send:disabled{opacity:.4;cursor:default}' +
      '#gf-dlg{position:fixed;inset:0;z-index:2147483001;background:rgba(30,19,9,.6);display:grid;place-items:center;padding:16px}#gf-dlg .box{background:#fff;color:#2E1F14;border-radius:14px;padding:22px;width:min(520px,100%);display:grid;gap:10px;font:14px/1.5 "Gothic A1","Malgun Gothic",system-ui,sans-serif;max-height:90vh;overflow:auto}' +
      '#gf-dlg h3{font-size:19px;margin:0}#gf-dlg .d{color:#6B5440;margin:0}#gf-dlg .n{background:#FDF6EA;border-radius:8px;padding:10px 12px;color:#8A2C06;margin:0}#gf-dlg label{display:grid;gap:4px;font-weight:700;font-size:13px}#gf-dlg input,#gf-dlg textarea{font:inherit;font-weight:400;padding:10px;border:1.5px solid #D8C7AE;border-radius:8px;width:100%}#gf-dlg textarea{min-height:70px}' +
      '#gf-dlg .row{display:flex;gap:8px;flex-wrap:wrap}#gf-dlg .b{border:0;border-radius:8px;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer;background:#F6EBD8;color:#2E1F14}#gf-dlg .send2{background:#C2410C;color:#fff}#gf-dlg .s{margin:0;font-size:13px;color:#1F4733}' +
      '#gf-toast{position:fixed;left:50%;bottom:88px;transform:translate(-50%,10px);z-index:2147483002;opacity:0;background:#2C1C0E;color:#FDF6EA;padding:10px 16px;border-radius:10px;font:14px "Gothic A1",system-ui,sans-serif;transition:.25s;pointer-events:none;max-width:90vw;text-align:center}#gf-toast.on{opacity:1;transform:translate(-50%,0)}#gf-toast.good{background:#1F4733}' +
      '@media(max-width:640px){#gf-editbar{flex-wrap:wrap;font-size:13px}#gf-editbar .txt{flex-basis:100%}}';
    document.head.appendChild(s);
  }

  /* SHA-256 (https 가 아닌 곳에서도 돌게 직접 구현) */
  function sha256(s) {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var b = unescape(encodeURIComponent(s)), l = b.length, w = [], i, j;
    for (i = 0; i < l; i++) w[i >> 2] |= b.charCodeAt(i) << (24 - (i % 4) * 8);
    w[l >> 2] |= 0x80 << (24 - (l % 4) * 8); w[(((l + 8) >> 6) << 4) + 15] = l * 8;
    function R(x, n) { return (x >>> n) | (x << (32 - n)); }
    var W = new Array(64), a, bb, c, d, e, f, g, h, t1, t2;
    for (i = 0; i < w.length; i += 16) {
      a = H[0]; bb = H[1]; c = H[2]; d = H[3]; e = H[4]; f = H[5]; g = H[6]; h = H[7];
      for (j = 0; j < 64; j++) {
        if (j < 16) W[j] = w[i + j] | 0; else { var s0 = R(W[j-15],7) ^ R(W[j-15],18) ^ (W[j-15] >>> 3), s1 = R(W[j-2],17) ^ R(W[j-2],19) ^ (W[j-2] >>> 10); W[j] = (W[j-16] + s0 + W[j-7] + s1) | 0; }
        t1 = (h + (R(e,6) ^ R(e,11) ^ R(e,25)) + ((e & f) ^ (~e & g)) + K[j] + W[j]) | 0; t2 = ((R(a,2) ^ R(a,13) ^ R(a,22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0]=(H[0]+a)|0; H[1]=(H[1]+bb)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+d)|0; H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
    }
    var out = ''; for (i = 0; i < 8; i++) out += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8); return out;
  }
  window.__gfEdit = { setImage: setImage, dirty: dirty, payload: function (cb) { loadAll(function (all) { all[page] = { texts: texts, images: images }; cb(payload(all, { who: '시험', tel: '000', memo: '' })); }); }, count: function () { return els.length; } };
})();
