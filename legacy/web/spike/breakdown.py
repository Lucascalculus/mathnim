# Per-part cost of one interactive frame. Runs identically in Pyodide and native CPython.
import json, time
def _bd(n=20):
    out = {}
    names = ['trace_curve', 'drop_line', 'view_cone', 'glow_dot', 'readout_tex']
    for k, m in zip(names, dyn):
        t = time.perf_counter()
        for i in range(n):
            d.set_value(0.5 + 29 * i / n + 0.0137 * (hash(k) % 7))
            m.update()
        out[k] = round((time.perf_counter() - t) * 1000 / n, 2)
    t = time.perf_counter()
    for i in range(n):
        T(f"{i * 1.37 + 0.011:.2f}", font_size=34)
    out['one_new_tex'] = round((time.perf_counter() - t) * 1000 / n, 2)
    t = time.perf_counter()
    for i in range(n):
        pack(dyn)
    out['pack_for_js'] = round((time.perf_counter() - t) * 1000 / n, 2)
    return out
json.dumps(_bd())
