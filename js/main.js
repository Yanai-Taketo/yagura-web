/* ==========================================================
   やぐら 紹介サイト — 巻物の操作と最新リリースの取得
   依存なしの素の JavaScript。API トークンは使わない（未認証）。
   ========================================================== */
(function () {
  'use strict';

  var REPO = 'Yanai-Taketo/Yagura';
  var RELEASES_URL = 'https://github.com/' + REPO + '/releases';
  var API_URL = 'https://api.github.com/repos/' + REPO + '/releases/latest';

  var emaki = document.getElementById('emaki');
  var wide = window.matchMedia('(min-width: 768px)');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 巻物の操作（広い画面のみ） ---------- */

  // 縦ホイールを横の「繰り」に読み替える。
  // rtl の巻物では scrollLeft は 0（巻頭）から負へ進む。
  function onWheel(e) {
    if (!wide.matches) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // 横入力は素通し
    // 中に縦へ延びる要素（はみ出した段など）があれば、そちらを優先
    var el = e.target;
    while (el && el !== emaki) {
      if (el.scrollHeight > el.clientHeight + 2) {
        var down = e.deltaY > 0;
        var canScroll = down
          ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
          : el.scrollTop > 0;
        if (canScroll) return;
      }
      el = el.parentElement;
    }
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 32; // 行単位のホイール
    emaki.scrollLeft -= delta;
    e.preventDefault();
  }
  emaki.addEventListener('wheel', onWheel, { passive: false });

  // 矢印キー。読む向きに合わせ、左が「進む」。
  document.addEventListener('keydown', function (e) {
    if (!wide.matches) return;
    if (hiken && hiken.open) return; // 披見の間は巻物を動かさない
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    var page = Math.round(emaki.clientWidth * 0.72);
    switch (e.key) {
      case 'ArrowLeft':  emaki.scrollLeft -= 220; break;
      case 'ArrowRight': emaki.scrollLeft += 220; break;
      case 'PageDown':   emaki.scrollLeft -= page; break;
      case 'PageUp':     emaki.scrollLeft += page; break;
      case 'Home':       emaki.scrollLeft = 0; break;
      case 'End':        emaki.scrollLeft = -(emaki.scrollWidth); break;
      default: return;
    }
    e.preventDefault();
  });

  // 栞・段内リンク：なめらかに該当の段へ
  function goTo(id) {
    var sec = document.getElementById(id);
    if (!sec) return;
    sec.scrollIntoView({
      behavior: calm.matches ? 'auto' : 'smooth',
      inline: 'center',
      block: wide.matches ? 'nearest' : 'start'
    });
    sec.setAttribute('tabindex', '-1');
    sec.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!document.getElementById(id)) return;
    e.preventDefault();
    goTo(id);
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });
  if (location.hash.length > 1) {
    // 描画後に位置を合わせる（rtl の初期位置と競合しないように）
    setTimeout(function () { goTo(location.hash.slice(1)); }, 60);
  }

  // 進み具合の朱線と、栞の現在地、手引きの消灯
  var bar = document.getElementById('susumi-bar');
  var tebiki = document.getElementById('tebiki');
  var shioriLinks = Array.prototype.slice.call(document.querySelectorAll('.shiori a'));
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var max = emaki.scrollWidth - emaki.clientWidth;
      var pos = Math.min(Math.abs(emaki.scrollLeft) / (max || 1), 1);
      if (bar) bar.style.width = (pos * 100) + '%';
      if (tebiki && pos > 0.02) tebiki.classList.add('is-hidden');

      // 画面中央にある段を現在地とする
      var center = emaki.clientWidth / 2;
      var current = null;
      for (var i = 0; i < shioriLinks.length; i++) {
        var sec = document.getElementById(shioriLinks[i].getAttribute('href').slice(1));
        if (!sec) continue;
        var r = sec.getBoundingClientRect();
        if (r.left <= center && r.right >= center) { current = shioriLinks[i]; break; }
      }
      for (var j = 0; j < shioriLinks.length; j++) {
        shioriLinks[j].classList.toggle('now', shioriLinks[j] === current);
      }
    });
  }
  emaki.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 披見（貼り込みの拡大表示） ---------- */

  var hiken = document.getElementById('hiken');
  var hikenImg = document.getElementById('hiken-img');
  var hikenCap = document.getElementById('hiken-cap');

  if (hiken && hiken.showModal) {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.harikomi-btn') : null;
      if (!btn) return;
      var img = btn.querySelector('img');
      if (!img) return;
      var fig = btn.closest('figure');
      var cap = fig ? fig.querySelector('figcaption') : null;
      hikenImg.src = img.currentSrc || img.src;
      hikenImg.alt = img.alt;
      hikenCap.textContent = cap ? cap.textContent : '';
      hiken.showModal();
    });
    document.getElementById('hiken-close').addEventListener('click', function () {
      hiken.close();
    });
    // 枠の外（幕）を押しても閉じる。Esc は dialog が標準で受ける。
    hiken.addEventListener('click', function (e) {
      var r = hiken.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        hiken.close();
      }
    });
  }

  /* ---------- 最新リリースの取得（GitHub REST API・未認証） ---------- */

  var elStatus = document.getElementById('dl-status');
  var elVersion = document.getElementById('release-version');
  var elDate = document.getElementById('release-date');
  var elNotes = document.getElementById('release-notes');

  function fmtSize(bytes) {
    return '約 ' + Math.max(1, Math.round(bytes / 1048576)) + ' MB';
  }

  function setAsset(rel, kind, btnId, sizeId, shaId) {
    var btn = document.getElementById(btnId);
    var msi = null;
    for (var i = 0; i < rel.assets.length; i++) {
      var n = rel.assets[i].name.toLowerCase();
      if (n.slice(-4) !== '.msi') continue;
      var isArm = n.indexOf('arm64') !== -1;
      if ((kind === 'arm64') === isArm) { msi = rel.assets[i]; break; }
    }
    if (!msi || !btn) return;
    btn.href = msi.browser_download_url;
    var sizeEl = document.getElementById(sizeId);
    if (sizeEl) sizeEl.textContent = fmtSize(msi.size);
    for (var k = 0; k < rel.assets.length; k++) {
      if (rel.assets[k].name === msi.name + '.sha256') {
        var sha = document.getElementById(shaId);
        if (sha) { sha.href = rel.assets[k].browser_download_url; sha.hidden = false; }
        break;
      }
    }
  }

  function applyRelease(rel) {
    if (!rel || !rel.tag_name) throw new Error('empty');
    if (elVersion) { elVersion.textContent = rel.tag_name; elVersion.hidden = false; }
    if (elDate && rel.published_at) {
      var d = new Date(rel.published_at);
      elDate.textContent = d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) + ' 公開';
    }
    if (elNotes && rel.html_url) elNotes.href = rel.html_url;
    if (elStatus) elStatus.textContent = '';
    setAsset(rel, 'x64', 'dl-x64', 'dl-x64-size', 'dl-x64-sha');
    setAsset(rel, 'arm64', 'dl-arm64', 'dl-arm64-size', 'dl-arm64-sha');

    // v1.0 到達後は、そこまでの道の段（公開基準・試用の誘い）を畳む
    var m = /^v?(\d+)/.exec(rel.tag_name);
    if (m && parseInt(m[1], 10) >= 1) {
      var until = document.querySelectorAll('[data-until-v1]');
      for (var i = 0; i < until.length; i++) until[i].style.display = 'none';
    }
  }

  function fallback() {
    // 取得できなかったことが分かる形で、Releases へ誘導する（版の表示はしない）
    if (elStatus) {
      elStatus.textContent = '最新版の取得ができませんでした。GitHub の Releases でご確認ください。';
    }
    // 各ボタンの href は HTML 既定のまま（= Releases ページ）
  }

  function fetchRelease() {
    if (!window.fetch) { fallback(); return; }
    if (elStatus) elStatus.textContent = '最新の版を確かめています……';
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : null;
    fetch(API_URL, {
      headers: { 'Accept': 'application/vnd.github+json' },
      signal: ctl ? ctl.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(applyRelease)
      .catch(fallback)
      .then(function () { if (timer) clearTimeout(timer); });
  }
  fetchRelease();
})();
