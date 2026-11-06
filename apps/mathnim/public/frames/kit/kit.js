/* Shared helpers of the instruments: the learner's language, the lesson's parameters, SVG building, and the
   height report the lesson page listens for. Classic script. */
(function (root) {
  'use strict';
  var qs = new URLSearchParams(location.search);
  var lang = qs.get('lang') === 'zh' ? 'zh' : 'en';
  var P = {};
  // the lesson page passes the parameters in the hash (a long bilingual text does not fit in a URL a server accepts); ?p= still works
  try { P = JSON.parse(qs.get('p') || new URLSearchParams(location.hash.slice(1)).get('p') || '{}'); } catch (e) { P = {}; }
  function t(x) { return x && typeof x === 'object' && !Array.isArray(x) && ('en' in x || 'zh' in x) ? (x[lang] || x.en || '') : x == null ? '' : String(x); }
  function tx(en, zh) { return lang === 'zh' ? zh : en; }
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, html, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  /** 1 234.5 -> "1,234.5"; trims trailing zeros. */
  function fmt(v, d) {
    if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
    d = d == null ? 2 : d;
    var s = (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toString();
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.').replace('-', '−');
  }
  // the body's own height, not the document's: scrollHeight never drops below the frame's current height, so a frame that had grown could not shrink
  function report() { post({ mn: 'height', value: Math.ceil(document.body.getBoundingClientRect().height) + 2 }); }
  function ready() {
    report();
    if (window.ResizeObserver) new ResizeObserver(report).observe(document.body);
    window.addEventListener('load', report);
  }
  // What the learner did, told to the lesson page (packages/present/src/text_pages.ts, listen_frames), so it counts as
  // practice and the tutor in the margin knows what is on screen. Three messages, nothing else:
  //   answer(item, correct, response)  one attempt at one thing (a chip dropped, a model checked, a number typed);
  //                                    item names the thing ('m3', 'q2'), the same every time it is tried again
  //   done(score)                       the instrument's task is finished; score 0..1 when it has one
  //   state(text)                       what the instrument shows now, in the learner's language, in a sentence or two
  //                                     (the plan, the placements, the numbers); sent a moment after it settles
  function post(m) { try { parent.postMessage(m, '*'); } catch (e) {} }
  function answer(item, correct, response) {
    post({ mn: 'answer', item: String(item).slice(0, 80), correct: !!correct, response: response == null ? undefined : String(response).slice(0, 200) });
  }
  function done(score) { post({ mn: 'done', score: typeof score === 'number' && isFinite(score) ? Math.max(0, Math.min(1, score)) : undefined }); }
  var state_timer = 0, state_last = '';
  function state(text) {
    clearTimeout(state_timer);
    state_timer = setTimeout(function () {
      var s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, 600);
      if (s && s !== state_last) { state_last = s; post({ mn: 'state', text: s }); }
    }, 350);
  }
  /** Pointer position in the SVG's own coordinates. */
  function pt(svg, e) {
    var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    var m = svg.getScreenCTM().inverse(), r = p.matrixTransform(m);
    return { x: r.x, y: r.y };
  }
  root.Kit = { lang: lang, P: P, t: t, tx: tx, el: el, h: h, fmt: fmt, pt: pt, ready: ready, report: report, answer: answer, done: done, state: state };
})(window);
