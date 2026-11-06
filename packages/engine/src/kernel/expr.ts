// A small, safe expression language for numbers that follow other numbers: a sentence's computed numbers
// ({{= 2.5*n, 2}}), a page's formulas (page.formula), anything a model writes as arithmetic. It never runs code: it
// reads + − * / ^ ( ), numbers, pi, the names it is given and a few functions, and throws on anything else.
//
//   eval_expr('2.5*n + sqrt(k)', new Map([['n', 3], ['k', 4]]))   // 9.5
//   expr_names('2.5*n + sqrt(k)')                                  // ['n', 'k']

const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max,
  log: Math.log, ln: Math.log, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan,
};
/** The functions an expression may call. */
export const EXPR_FUNCTIONS = Object.keys(FUNCS);

const normal = (src: string) => src.replace(/×|·/g, '*').replace(/÷/g, '/').replace(/−/g, '-');

/** + − * / ^ ( ), numbers, names from `vars`, pi, and the functions above. Throws on anything else. */
export function eval_expr(src: string, vars: ReadonlyMap<string, number>): number {
  const s = normal(src);
  let i = 0;
  const ws = () => { while (s[i] === ' ') i++; };
  const num = (): number => {
    ws();
    if (s[i] === '(') { i++; const v = add(); ws(); if (s[i++] !== ')') throw new Error('expected )'); return v; }
    if (s[i] === '-') { i++; return -pow(); }
    if (s[i] === '+') { i++; return pow(); }
    const m = /^\d+(?:\.\d+)?|^\.\d+/.exec(s.slice(i));
    if (m) { i += m[0].length; return +m[0]; }
    const w = /^[A-Za-z_]\w*/.exec(s.slice(i));
    if (!w) throw new Error(`unexpected ${s[i] ?? 'end'}`);
    i += w[0].length;
    ws();
    if (FUNCS[w[0]] && s[i] === '(') {
      i++;
      const args = [add()];
      ws();
      while (s[i] === ',') { i++; args.push(add()); ws(); }
      if (s[i++] !== ')') throw new Error('expected )');
      return FUNCS[w[0]](...args);
    }
    if (w[0] === 'pi') return Math.PI;
    if (!vars.has(w[0])) throw new Error(`unknown ${w[0]}`);
    return vars.get(w[0])!;
  };
  const pow = (): number => { const b = num(); ws(); if (s[i] === '^') { i++; return b ** pow(); } return b; };
  const mul = (): number => { let v = pow(); for (;;) { ws(); if (s[i] === '*') { i++; v *= pow(); } else if (s[i] === '/') { i++; v /= pow(); } else return v; } };
  const add = (): number => { let v = mul(); for (;;) { ws(); if (s[i] === '+') { i++; v += mul(); } else if (s[i] === '-') { i++; v -= mul(); } else return v; } };
  const v = add();
  ws();
  if (i < s.length) throw new Error(`unexpected ${s[i]}`);
  return v;
}

/** The names an expression reads (not its functions, not pi), in order, once each. */
export function expr_names(src: string): string[] {
  const out: string[] = [];
  for (const m of normal(src).matchAll(/[A-Za-z_]\w*/g)) {
    const w = m[0], next = normal(src).slice(m.index! + w.length).trimStart()[0];
    if (w === 'pi' || (FUNCS[w] && next === '(') || out.includes(w)) continue;
    out.push(w);
  }
  return out;
}
