// Persistent TeX -> SVG server backed by MathJax.
// Protocol: one JSON object per line on stdin {"id", "tex", "display"},
// one JSON object per line on stdout {"id", "svg"} or {"id", "error"}.
// Keeping one process alive makes each formula a few milliseconds instead of
// a full latex + dvisvgm round trip.
const readline = require('readline');
const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({
  packages: AllPackages.filter((p) => !['bussproofs', 'require', 'autoload'].includes(p)),
  formatError: (jax, err) => { throw err; },
});
const svg = new SVG({ fontCache: 'none' });
const doc = mathjax.document('', { InputJax: tex, OutputJax: svg });

function render(source, display) {
  const node = doc.convert(source, { display, em: 16, ex: 8, containerWidth: 1280 });
  let out = adaptor.innerHTML(node);
  // Drop size/style attributes so the viewBox (1000 units = 1em) is authoritative.
  out = out.replace(/<svg([^>]*)>/, (m, attrs) =>
    '<svg' + attrs.replace(/\s(width|height|style)="[^"]*"/g, '') + '>');
  return out;
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch (e) { return; }
  let res;
  try {
    res = { id: req.id, svg: render(req.tex, req.display !== false) };
  } catch (e) {
    res = { id: req.id, error: String(e && e.message ? e.message : e) };
  }
  process.stdout.write(JSON.stringify(res) + '\n');
});
