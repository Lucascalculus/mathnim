/* Reads a learner's LP written the way the exam is written ("4x11 + 3x21 <= 600", "x11 <= 0.3(x11 + x21 + x31)") and
   compares it with the reference model by meaning: which real limits it enforces, which of its own lines are real
   limits, and a witness plan wherever they differ. Needs lp.js. Classic script; also loadable from Node. */
(function (root) {
  'use strict';
  var LP = root.LP;
  var TOL = 1e-6;

  // ------------------------------------------------------------------ reading the text
  var SUB = { '₀': 0, '₁': 1, '₂': 2, '₃': 3, '₄': 4, '₅': 5, '₆': 6, '₇': 7, '₈': 8, '₉': 9 };
  function normalise(s) {
    return String(s)
      .replace(/[₀-₉]/g, function (c) { return String(SUB[c]); })
      .replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/≤|⩽|=</g, '<=').replace(/≥|⩾|=>/g, '>=')
      .replace(/＝/g, '=').replace(/（/g, '(').replace(/）/g, ')');
  }
  function tokens(s) {
    var out = [], re = /\s*(\d+\.?\d*|\.\d+|[A-Za-z][A-Za-z0-9_]*|<=|>=|=|<|>|[-+*\/()])/y, m, i = 0;
    s = normalise(s);
    while (i < s.length) {
      re.lastIndex = i;
      m = re.exec(s);
      if (!m) { if (/^\s*$/.test(s.slice(i))) break; throw new Error('unexpected "' + s.slice(i).trim().charAt(0) + '"'); }
      i = re.lastIndex;
      out.push(m[1]);
    }
    return out;
  }

  // a linear form: { c: { name: coef }, k: constant }
  function lin_const(k) { return { c: {}, k: k }; }
  function lin_add(a, b, s) { var r = { c: Object.assign({}, a.c), k: a.k + s * b.k }; for (var n in b.c) r.c[n] = (r.c[n] || 0) + s * b.c[n]; return r; }
  function lin_scale(a, f) { var r = { c: {}, k: a.k * f }; for (var n in a.c) r.c[n] = a.c[n] * f; return r; }
  function is_const(a) { for (var n in a.c) if (Math.abs(a.c[n]) > 0) return false; return true; }

  /** Parses one side of a relation into a linear form, or throws a plain message. */
  function parse_expr(toks, pos, vars) {
    var p = pos;
    function peek() { return toks[p]; }
    function expr() {
      var v = term();
      while (peek() === '+' || peek() === '-') { var op = toks[p++]; v = lin_add(v, term(), op === '+' ? 1 : -1); }
      return v;
    }
    function term() {
      var v = factor();
      for (;;) {
        var t = peek();
        if (t === '*') { p++; v = mul(v, factor()); }
        else if (t === '/') { p++; var d = factor(); if (!is_const(d) || Math.abs(d.k) < 1e-12) throw new Error('only division by a number'); v = lin_scale(v, 1 / d.k); }
        else if (t !== undefined && (/^[A-Za-z(]/.test(t))) v = mul(v, factor()); // 4x11, 0.3(x + y)
        else return v;
      }
    }
    function mul(a, b) {
      if (is_const(a)) return lin_scale(b, a.k);
      if (is_const(b)) return lin_scale(a, b.k);
      throw new Error('not linear (two variables multiplied)');
    }
    function factor() {
      var t = toks[p++];
      if (t === undefined) throw new Error('the line ends too early');
      if (t === '-') return lin_scale(factor(), -1);
      if (t === '+') return factor();
      if (t === '(') { var v = expr(); if (toks[p++] !== ')') throw new Error('missing )'); return v; }
      if (/^[\d.]/.test(t)) return lin_const(parseFloat(t));
      if (/^[A-Za-z]/.test(t)) {
        if (vars.indexOf(t) < 0) throw new Error('"' + t + '" is not one of the variables');
        var c = {}; c[t] = 1; return { c: c, k: 0 };
      }
      throw new Error('unexpected "' + t + '"');
    }
    var v = expr();
    return { form: v, end: p };
  }

  /** "2x1 + 3x2 <= 40" -> { a: [..], op, b }, a in the order of `vars`. */
  function parse_row(text, vars) {
    var toks = tokens(text);
    var at = toks.findIndex(function (t) { return t === '<=' || t === '>=' || t === '=' || t === '<' || t === '>'; });
    if (at < 0) throw new Error('needs <=, >= or =');
    var op = toks[at] === '<' ? '<=' : toks[at] === '>' ? '>=' : toks[at];
    var L = parse_expr(toks.slice(0, at), 0, vars), R = parse_expr(toks.slice(at + 1), 0, vars);
    if (L.end !== at || R.end !== toks.length - at - 1) throw new Error('could not read the whole line');
    var f = lin_add(L.form, R.form, -1);
    return { a: vars.map(function (n) { return f.c[n] || 0; }), op: op, b: -f.k, text: text };
  }
  /** "10x11 + 14x12 + ..." (an objective; "z =" in front is allowed) -> coefficient list. */
  function parse_objective(text, vars) {
    var toks = tokens(text);
    if (toks.length >= 2 && toks[1] === '=' && /^[A-Za-z]/.test(toks[0]) && vars.indexOf(toks[0]) < 0) toks = toks.slice(2);
    var r = parse_expr(toks, 0, vars);
    if (r.end !== toks.length) throw new Error('could not read the whole line');
    return vars.map(function (n) { return r.form.c[n] || 0; });
  }

  // ------------------------------------------------------------------ comparing by meaning
  function dot(a, x) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * x[i]; return s; }

  /** A plan in `model` that breaks the line `row` (violating it by at least `margin`), the smallest such plan; null if none exists. */
  function breaking_plan(model, row, side, margin) {
    var extra = { a: row.a, op: side, b: side === '>=' ? row.b + margin : row.b - margin };
    var s = LP.solve({ sense: 'min', c: model.c.map(function () { return 1; }), rows: model.rows.concat([extra]) });
    return s.status === 'optimal' ? s.x : null;
  }
  function margin_of(row) { return Math.max(1, 0.05 * Math.abs(row.b)); }

  /** Does `model` force the line `row` to hold? Returns { ok, plan } (plan = a plan of `model` that breaks it). */
  function forces(model, row) {
    var sides = row.op === '<=' ? ['>='] : row.op === '>=' ? ['<='] : ['>=', '<='];
    for (var i = 0; i < sides.length; i++) {
      var plan = breaking_plan(model, row, sides[i], margin_of(row));
      if (plan) return { ok: false, plan: plan, side: sides[i] };
    }
    return { ok: true };
  }

  /**
   * ref:     { sense, c, rows: [{ a, op, b, label }] }
   * learner: { sense, c, rows: [{ a, op, b, text }] }  (already read)
   */
  function compare(ref, learner) {
    var out = { sense_ok: ref.sense === learner.sense, objective_ok: true, objective_diff: [], enforced: [], valid: [], learner_solution: null, ref_solution: null, same_model: false };
    for (var i = 0; i < ref.c.length; i++) if (Math.abs(ref.c[i] - learner.c[i]) > TOL) { out.objective_ok = false; out.objective_diff.push({ index: i, ref: ref.c[i], got: learner.c[i] }); }
    ref.rows.forEach(function (r, k) {
      var f = forces(learner, r);
      var e = { index: k, label: r.label, ok: f.ok };
      if (!f.ok) { e.plan = f.plan; e.side = f.side; e.lhs = dot(r.a, f.plan); }
      out.enforced.push(e);
    });
    learner.rows.forEach(function (r, j) {
      var f = forces(ref, r);
      var e = { index: j, text: r.text, ok: f.ok };
      if (!f.ok) { e.plan = f.plan; e.side = f.side; e.lhs = dot(r.a, f.plan); }
      out.valid.push(e);
    });
    out.learner_solution = LP.solve(learner);
    out.ref_solution = LP.solve(ref);
    out.same_model = out.sense_ok && out.objective_ok && out.enforced.every(function (e) { return e.ok; }) && out.valid.every(function (e) { return e.ok; });
    return out;
  }

  var api = { parse_row: parse_row, parse_objective: parse_objective, compare: compare, forces: forces };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LPCheck = api;
})(typeof window !== 'undefined' ? window : globalThis);
