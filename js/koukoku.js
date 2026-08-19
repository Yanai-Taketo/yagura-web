/* ==========================================================
   やぐら 読みもの — 広告（こうこく）の差し込み
   依存なしの素の JavaScript。

   考え方
     ・紙面に入る手前まで、外への通信はしない（遅延読み込み）。
     ・一つの紙面に出すのは三つまで。本文の切れ目にだけ置く。
     ・埋まらなかった枠・出さぬと決めた枠は、自前の案内に差し替える。
       —— 空白も、崩れた枠も残さない。
     ・通信量を抑えたい設定（Save-Data）の読み手には、外の広告を出さない。
     ・読み手は ?koukoku=off で自分で止められる（?koukoku=on で戻る）。

   設けかたは docs/koukoku.md を参照。
   ========================================================== */
(function () {
  'use strict';

  /* ---------- 設定 —— ここだけ書き換えればよい ---------- */
  var SETTEI = {
    /* Google AdSense のパブリッシャー ID。例: 'ca-pub-0000000000000000'
       空のままなら外部の広告は一切読み込まず、自前の案内だけを出す。 */
    client: '',

    /* 枠の名と、AdSense で発行される広告ユニットのスロット ID（数字）の対応。
       空の枠は自前の案内になる。 */
    waku: {
      'honbun-hajime':  '',   /* 本文のはじめ（一段目のあと） */
      'honbun-naka':    '',   /* 本文のなか（中ほどの段の前） */
      'kiji-shita':     '',   /* 記事の下（結びのあと） */
      'mokuroku-shita': ''    /* 目録の下（読みもの一覧の末） */
    },

    kagiri: 3,      /* 一つの紙面に出す上限 */
    mae: '600px',   /* 画面に入る何 px 手前で読み込みはじめるか */
    machi: 8000     /* 応答を待つ上限（ms）。過ぎたら自前の案内へ */
  };

  /* ---------- 下ごしらえ ---------- */

  var moto = (document.body && document.body.getAttribute('data-root')) || '';

  /* 読み手の取りやめ（?koukoku=off で覚え、?koukoku=on で戻す）。
     枠のない紙面（取扱の頁）でも切り替えられるよう、先に済ませておく。 */
  var KAGI = 'yagura:koukoku';
  function yomidasu() { try { return window.localStorage.getItem(KAGI); } catch (e) { return null; } }
  function kakikomu(v) { try { window.localStorage.setItem(KAGI, v); } catch (e) {} }
  var toi = /[?&]koukoku=(on|off)/.exec(location.search);
  if (toi) kakikomu(toi[1]);
  var tomeru = yomidasu() === 'off';

  /* 今どちらになっているかを、置き場があれば知らせる */
  var shirase = document.getElementById('koukoku-jotai');
  if (shirase) {
    shirase.textContent = (tomeru
      ? '現在の設定 — この browser では広告を表示しません。'
      : '現在の設定 — この browser では広告を表示します。') +
      'この設定は、お使いの browser にのみ保存されます（localStorage）。';
  }

  var wakuRa = Array.prototype.slice.call(document.querySelectorAll('.koukoku[data-koukoku]'));
  if (!wakuRa.length) return;
  if (wakuRa.length > SETTEI.kagiri) wakuRa = wakuRa.slice(0, SETTEI.kagiri);

  /* 通信量を惜しむ設定なら、外の広告は出さない */
  var tsunagi = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var karui = !!(tsunagi && tsunagi.saveData) ||
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-data: reduce)').matches);

  /* ---------- 自前の案内（差し替えの中身） ---------- */

  var JIMAE = [
    {
      dai: 'Yagura（やぐら）を据ゑる',
      bun: 'Windows にそのまま置ける OSS の syslog 集約サーバ。MSI をひとつ実行すれば、設定ファイルなしで受信と保存が始まります。ライセンス費用はありません。',
      botan: '配布の段へ',
      saki: moto + '#haifu',
      shu: true
    },
    {
      dai: '企業導入ガイド',
      bun: 'システム構成と要件、セキュリティ設計、Apache License 2.0 の取り扱い、導入プロセスと体制 —— 情報システム部門向けの検討資料です。',
      botan: '資料を読む',
      saki: moto + 'enterprise/'
    },
    {
      dai: '読みもの — syslog とログ集約の帖',
      bun: 'syslog の仕組みの基礎から、Windows での構築、機器の送信設定、容量と保持期間の見積りまで。現場で使う順に並べた解説です。',
      botan: '一覧を見る',
      saki: moto + 'blog/'
    }
  ];

  /* 今いる紙面そのものへの案内は出さない */
  function onaji(saki) {
    var a = document.createElement('a');
    a.href = saki;
    return a.pathname === location.pathname;
  }

  var kazu = 0;
  function erabu() {
    for (var i = 0; i < JIMAE.length; i++) {
      var k = JIMAE[(kazu + i) % JIMAE.length];
      if (!onaji(k.saki)) { kazu = (kazu + i + 1) % JIMAE.length; return k; }
    }
    return JIMAE[0];
  }

  /* ---------- 組み立て ---------- */

  function fuda(moji) {
    var p = document.createElement('p');
    p.className = 'koukoku-fuda';
    p.textContent = moji;
    return p;
  }

  function jimaeDasu(waku) {
    if (waku.getAttribute('data-jotai') === 'jimae') return;
    waku.setAttribute('data-jotai', 'jimae');
    while (waku.firstChild) waku.removeChild(waku.firstChild);

    var k = erabu();
    waku.appendChild(fuda('案内'));

    var hako = document.createElement('aside');
    hako.className = 'koukoku-jimae';
    var dai = document.createElement('p');
    dai.className = 'koukoku-dai';
    dai.textContent = k.dai;
    var bun = document.createElement('p');
    bun.className = 'koukoku-bun';
    bun.textContent = k.bun;
    var a = document.createElement('a');
    a.className = k.shu ? 'btn btn-shu' : 'btn';
    a.href = k.saki;
    a.textContent = k.botan;
    hako.appendChild(dai);
    hako.appendChild(bun);
    hako.appendChild(a);
    waku.appendChild(hako);
  }

  /* ---------- AdSense の読み込み ---------- */

  var yonda = false;    /* 読み込みを始めたか */
  var shippai = false;  /* 読み込めなかったか（遮断・不通） */
  var machiRetsu = [];  /* まだ決着していない枠 */

  function tsunagu(saki) {
    var l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = saki;
    l.crossOrigin = '';
    document.head.appendChild(l);
  }

  function korobu() {
    shippai = true;
    var nokori = machiRetsu.slice();
    machiRetsu.length = 0;
    for (var i = 0; i < nokori.length; i++) nokori[i]();
  }

  function yomu() {
    if (yonda) return;
    yonda = true;
    tsunagu('https://pagead2.googlesyndication.com');
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
            encodeURIComponent(SETTEI.client);
    s.onerror = korobu;
    document.head.appendChild(s);
  }

  /* 埋まったか・埋まらなかったかを見届ける */
  function mihari(waku, ins) {
    var sunda = false;
    var kanshi = null;
    var tokei = null;

    function shimau() {
      sunda = true;
      if (kanshi) kanshi.disconnect();
      if (tokei) clearTimeout(tokei);
      var i = machiRetsu.indexOf(orosu);
      if (i !== -1) machiRetsu.splice(i, 1);
    }

    /* 自前の案内へ落とす */
    function orosu() {
      if (sunda) return;
      shimau();
      jimaeDasu(waku);
    }

    function kimeru() {
      if (sunda) return;
      var jotai = ins.getAttribute('data-ad-status');
      if (jotai === 'filled') { shimau(); waku.setAttribute('data-jotai', 'koukoku'); return; }
      if (jotai === 'unfilled') { orosu(); }
    }

    machiRetsu.push(orosu);

    if (window.MutationObserver) {
      kanshi = new MutationObserver(kimeru);
      kanshi.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    }
    tokei = setTimeout(function () {
      if (sunda) return;
      if (ins.getAttribute('data-ad-status') === 'filled' && ins.offsetHeight > 20) {
        shimau();
        waku.setAttribute('data-jotai', 'koukoku');
        return;
      }
      orosu();
    }, SETTEI.machi);

    if (shippai) orosu();
  }

  /* ---------- 一つの枠を出す ---------- */

  function dasu(waku) {
    var na = waku.getAttribute('data-koukoku');
    var ban = SETTEI.waku[na];

    if (!SETTEI.client || !ban || tomeru || karui) { jimaeDasu(waku); return; }

    waku.setAttribute('data-jotai', 'yomikomi');
    waku.appendChild(fuda('広告'));

    var ba = document.createElement('div');
    ba.className = 'koukoku-ba';
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', SETTEI.client);
    ins.setAttribute('data-ad-slot', ban);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    ba.appendChild(ins);
    waku.appendChild(ba);

    yomu();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      jimaeDasu(waku);
      return;
    }
    mihari(waku, ins);
  }

  /* ---------- 近づいたら読み込む ---------- */

  var i;
  if (!('IntersectionObserver' in window)) {
    /* 近づいたかを測れない古い環境では、外への通信はせず案内だけを出す */
    for (i = 0; i < wakuRa.length; i++) jimaeDasu(wakuRa[i]);
    return;
  }

  var me = new IntersectionObserver(function (kumi) {
    for (var j = 0; j < kumi.length; j++) {
      if (!kumi[j].isIntersecting) continue;
      me.unobserve(kumi[j].target);
      dasu(kumi[j].target);
    }
  }, { rootMargin: SETTEI.mae + ' 0px' });

  for (i = 0; i < wakuRa.length; i++) me.observe(wakuRa[i]);
})();
