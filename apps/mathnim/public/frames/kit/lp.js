/* A small linear-programming engine for exam-size problems: dense two-phase simplex with Bland's rule, and the
   sensitivity ranges Excel Solver reports. Plain JS, no dependencies; classic script (instruments run in sandboxed
   frames, where module scripts cannot load), also loadable from Node (module.exports).

   model = { sense: 'max' | 'min', c: number[], rows: [{ a: number[], op: '<=' | '>=' | '=', b: number }] }
   Every variable is >= 0. */
(function (root) {
  'use strict';
  var EPS = 1e-9;

  /** Standard form: b >= 0 (rows flipped when needed), a slack (<=) or surplus (>=) column per inequality, artificials for >= and =. */
  function standard(model) {
    var n = model.c.length, m = model.rows.length;
    var rows = model.rows.map(function (r) {
      var flip = r.b < 0;
      return { a: r.a.map(function (v) { return flip ? -v : v; }), b: flip ? -r.b : r.b, op: flip ? (r.op === '<=' ? '>=' : r.op === '>=' ? '<=' : '=') : r.op, flip: flip };
    });
    var cols = n, slack = [], art = [];
    rows.forEach(function (r, i) {
      if (r.op === '<=') slack[i] = cols++;
      else if (r.op === '>=') slack[i] = cols++;
    });
    var nstruct = cols;
    rows.forEach(function (r, i) { if (r.op !== '<=') art[i] = cols++; });
    var A = rows.map(function (r, i) {
      var row = new Array(cols).fill(0);
      for (var j = 0; j < n; j++) row[j] = r.a[j] || 0;
      if (r.op === '<=') row[slack[i]] = 1;
      if (r.op === '>=') row[slack[i]] = -1;
      if (art[i] !== undefined) row[art[i]] = 1;
      return row;
    });
    var basis = rows.map(function (r, i) { return r.op === '<=' ? slack[i] : art[i]; });
    return { n: n, m: m, cols: cols, nstruct: nstruct, A: A, b: rows.map(function (r) { return r.b; }), basis: basis, flip: rows.map(function (r) { return r.flip; }), slack: slack, art: art, isart: function (j) { return j >= nstruct; } };
  }

  /** Tableau T (m + 1 rows): T[i] = [A_i | b_i]; T[m] = [reduced costs | -objective] for a maximisation with costs `cost`. */
  function make_tableau(S, cost) {
    var T = S.A.map(function (row, i) { return row.concat([S.b[i]]); });
    var obj = cost.concat([0]);
    for (var i = 0; i < S.m; i++) {
      var cb = cost[S.basis[i]];
      if (cb) for (var j = 0; j <= S.cols; j++) obj[j] -= cb * T[i][j];
    }
    T.push(obj);
    return T;
  }

  function pivot(T, r, col) {
    var p = T[r][col], w = T[r].length;
    for (var j = 0; j < w; j++) T[r][j] /= p;
    for (var i = 0; i < T.length; i++) {
      if (i === r) continue;
      var f = T[i][col];
      if (Math.abs(f) < 1e-15) continue;
      for (var k = 0; k < w; k++) T[i][k] -= f * T[r][k];
      T[i][col] = 0;
    }
  }

  /** Maximise until no reduced cost is positive. `allowed(j)` says which columns may enter. */
  function run(T, basis, S, allowed) {
    var m = S.m, last = S.cols, guard = 0;
    while (guard++ < 5000) {
      var enter = -1;
      for (var j = 0; j < S.cols; j++) if (allowed(j) && T[m][j] > EPS) { enter = j; break; }
      if (enter < 0) return 'optimal';
      var leave = -1, best = Infinity;
      for (var i = 0; i < m; i++) {
        if (T[i][enter] > EPS) {
          var ratio = T[i][last] / T[i][enter];
          if (ratio < best - 1e-12 || (Math.abs(ratio - best) <= 1e-12 && basis[i] < basis[leave])) { best = ratio; leave = i; }
        }
      }
      if (leave < 0) return 'unbounded';
      pivot(T, leave, enter);
      basis[leave] = enter;
    }
    return 'stalled';
  }

  function solve(model) {
    var S = standard(model), n = S.n, m = S.m, sign = model.sense === 'min' ? -1 : 1;
    var basis = S.basis.slice();
    var cost1 = new Array(S.cols).fill(0);
    for (var j = S.nstruct; j < S.cols; j++) cost1[j] = -1;
    var T = make_tableau({ A: S.A, b: S.b, basis: basis, cols: S.cols, m: m }, cost1);
    if (S.cols > S.nstruct) {
      run(T, basis, S, function () { return true; });
      var infeas = 0;
      for (var i = 0; i < m; i++) if (S.isart(basis[i])) infeas += T[i][S.cols];
      if (infeas > 1e-7) return { status: 'infeasible' };
      // an artificial left in the basis sits at 0: pivot it out when the row has a real entry, else the row is redundant
      for (var r = 0; r < m; r++) {
        if (!S.isart(basis[r])) continue;
        for (var c = 0; c < S.nstruct; c++) if (Math.abs(T[r][c]) > 1e-9) { pivot(T, r, c); basis[r] = c; break; }
      }
    }
    var cost2 = new Array(S.cols).fill(0);
    for (var k = 0; k < n; k++) cost2[k] = sign * model.c[k];
    var T2 = make_tableau({ A: T.slice(0, m).map(function (row) { return row.slice(0, S.cols); }), b: T.slice(0, m).map(function (row) { return row[S.cols]; }), basis: basis, cols: S.cols, m: m }, cost2);
    var status = run(T2, basis, S, function (j) { return !S.isart(j); });
    if (status !== 'optimal') return { status: status };
    var x = new Array(n).fill(0);
    for (var q = 0; q < m; q++) if (basis[q] < n) x[basis[q]] = Math.max(0, T2[q][S.cols]);
    var obj = 0;
    for (var t = 0; t < n; t++) obj += model.c[t] * x[t];
    return { status: 'optimal', x: x, obj: obj, basis: basis, S: S, T: T2 };
  }

  /** Excel's sensitivity report: reduced costs, objective ranges, shadow prices and right-hand-side ranges (Infinity = "1E+30"). */
  function sensitivity(model, sol) {
    if (!sol || sol.status !== 'optimal') return null;
    var S = sol.S, T = sol.T, m = S.m, n = S.n, sign = model.sense === 'min' ? -1 : 1, basis = sol.basis;
    var inb = {};
    basis.forEach(function (b, i) { inb[b] = i; });
    // dual values y_i = -(reduced cost of the unit column of row i) in the maximisation; read them off the slack/surplus/artificial columns
    var y = [];
    for (var i = 0; i < m; i++) {
      var col = S.art[i] !== undefined ? S.art[i] : S.slack[i];
      var unit = S.art[i] !== undefined ? 1 : (S.A[i][S.slack[i]]);
      // cost of the unit column is 0 (phase 2), so its reduced cost is -y_i * unit
      y.push(-T[m][col] / unit);
    }
    var vars = [];
    for (var j = 0; j < n; j++) {
      var d = T[m][j]; // reduced cost in the maximisation (<= 0 at optimum)
      var rc = sign * d;
      var inc, dec;
      if (inb[j] === undefined) {
        inc = sign === 1 ? -d : Infinity;
        dec = sign === 1 ? Infinity : -d;
        if (sign === 1) { inc = -d; dec = Infinity; } else { dec = -d; inc = Infinity; }
        vars.push({ value: 0, cost: model.c[j], reduced: rc, inc: inc, dec: dec });
      } else {
        var r = inb[j], up = Infinity, down = Infinity; // in the maximisation's coefficient c'
        for (var q = 0; q < S.cols; q++) {
          if (S.isart(q) || inb[q] !== undefined) continue;
          var al = T[r][q], dq = T[m][q];
          if (al > EPS) down = Math.min(down, -dq / al);
          else if (al < -EPS) up = Math.min(up, dq / al);
        }
        up = Math.abs(up); down = Math.abs(down);
        vars.push({ value: Math.max(0, T[r][S.cols]), cost: model.c[j], reduced: 0, inc: sign === 1 ? up : down, dec: sign === 1 ? down : up });
      }
    }
    var rows = [];
    for (var k = 0; k < m; k++) {
      var orig = model.rows[k], lhs = 0;
      for (var v = 0; v < n; v++) lhs += (orig.a[v] || 0) * sol.x[v];
      // the column of B^-1 for row k is the slack/artificial column of the final tableau
      var colk = S.art[k] !== undefined ? S.art[k] : S.slack[k];
      var unitk = S.art[k] !== undefined ? 1 : S.A[k][S.slack[k]];
      var beta = [];
      for (var z = 0; z < m; z++) beta.push(T[z][colk] / unitk * (S.flip[k] ? -1 : 1)); // d x_B / d b_k in the original orientation
      var xb = []; for (var w = 0; w < m; w++) xb.push(T[w][S.cols]);
      var rinc = Infinity, rdec = Infinity;
      for (var u = 0; u < m; u++) {
        if (beta[u] > EPS) rdec = Math.min(rdec, xb[u] / beta[u]);
        else if (beta[u] < -EPS) rinc = Math.min(rinc, xb[u] / -beta[u]);
      }
      var shadow = sign * y[k] * (S.flip[k] ? -1 : 1);
      rows.push({ lhs: lhs, rhs: orig.b, slack: orig.op === '<=' ? orig.b - lhs : orig.op === '>=' ? lhs - orig.b : 0, binding: Math.abs(lhs - orig.b) < 1e-7, shadow: shadow === 0 ? 0 : shadow, inc: rinc, dec: rdec });
    }
    return { vars: vars, rows: rows };
  }

  var api = { solve: solve, sensitivity: sensitivity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LP = api;
})(typeof window !== 'undefined' ? window : globalThis);
