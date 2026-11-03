// The lab page: one tile per material, built lazily when it comes into view (browsers cap live WebGL contexts),
// and an acceptance run that each material answers with a measured number.
const Q = new URLSearchParams(location.search);
const LANG = Q.get('lang') === 'en' ? 'en' : 'zh';
const VER = Q.get('v') || '1';
const SOLO = Q.get('m');
document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN';
for (const el of document.querySelectorAll('[data-zh]')) el.textContent = el.dataset[LANG];

const SETS = {
  '1': { label: { zh: '第一版 · 十种', en: 'First pass · ten' }, ids: ['caustics', 'soap', 'ink', 'metal', 'filings', 'particles', 'rd', 'loupe', 'plaster', 'foil'], dir: 'v1' },
  '2': { label: { zh: '第二版 · 十种', en: 'Second pass · ten' }, ids: ['caustics', 'soap', 'ink', 'metal', 'filings', 'particles', 'rd', 'loupe', 'plaster', 'foil'], dir: 'v2' },
  'new': { label: { zh: '全新十种', en: 'Ten new' }, ids: [], dir: 'new' },
};
const bar = document.getElementById('ver');
for (const [k, s] of Object.entries(SETS)) {
  const b = document.createElement('button'); b.textContent = s.label[LANG]; if (k === VER) b.className = 'on';
  b.onclick = () => { Q.set('v', k); location.search = Q.toString(); };
  bar.append(b);
}

const set = SETS[VER] || SETS['1'];
const grid = document.getElementById('grid');
const tiles = [];
if (SOLO) document.body.classList.add('solo');

async function load(id) {
  try { return await import(`./m/${set.dir}/${id}.js`); } catch (e) { console.warn('missing', id, e); return null; }
}

(async () => {
  let n = 0;
  for (const id of set.ids) {
    const mod = await load(id); if (!mod) continue; n++;
    const m = mod.meta, t = document.createElement('section');
    t.className = 'tile' + (m.wide ? ' wide' : '') + (SOLO === id ? ' show' : '');
    t.id = id;
    t.innerHTML = `<div class="stage${m.night ? ' night' : ''}"><canvas></canvas><div class="hud"></div></div>
      <div class="cap"><span class="n">${String(n).padStart(2, '0')}</span><h2>${m.name[LANG]}<small>${m.name[LANG === 'zh' ? 'en' : 'zh']}</small></h2></div>
      <p class="means">${m.means[LANG]}</p><div class="test"><i></i><span>${m.test[LANG]}</span></div>`;
    grid.append(t);
    if (SOLO && SOLO !== id) continue;
    const tile = { id, mod, el: t, inst: null, stage: t.querySelector('.stage'), canvas: t.querySelector('canvas'), hud: t.querySelector('.hud') };
    tiles.push(tile);
  }
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      const tile = tiles.find((x) => x.el === e.target); if (!tile) continue;
      if (e.isIntersecting && !tile.inst) {
        try { tile.inst = tile.mod.make({ stage: tile.stage, canvas: tile.canvas, hud: tile.hud, lang: LANG }); }
        catch (err) { console.error(tile.id, err); tile.hud.textContent = String(err.message || err); }
      }
      tile.inst?.visible?.(e.isIntersecting);
    }
  }, { rootMargin: '200px' });
  for (const t of tiles) io.observe(t.el);
  addEventListener('resize', () => { for (const t of tiles) t.inst?.resize?.(); });
  window.__ready = true;
})();

// run every live material's own test; returns [{id, pass, value}]
window.__accept = async (ids) => {
  const out = [];
  for (const t of tiles) {
    if (ids && !ids.includes(t.id)) continue;
    if (!t.inst) { try { t.inst = t.mod.make({ stage: t.stage, canvas: t.canvas, hud: t.hud, lang: LANG }); } catch (e) { out.push({ id: t.id, pass: false, value: String(e) }); continue; } }
    let r;
    try { r = await t.inst.accept(); } catch (e) { r = { pass: false, value: 'error: ' + (e.message || e) }; console.error(e); }
    const el = t.el.querySelector('.test');
    el.classList.toggle('pass', !!r.pass); el.classList.toggle('fail', !r.pass);
    el.querySelector('span').textContent = (t.mod.meta.test[LANG]) + ' — ' + r.value;
    out.push({ id: t.id, ...r });
  }
  return out;
};
// play every material's opening gesture, for screenshots
window.__demo = () => { for (const t of tiles) t.inst?.demo?.(); };
