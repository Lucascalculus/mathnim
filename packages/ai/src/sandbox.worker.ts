// Validation worker: runs model-written scene code off the main thread, so a
// crash or an infinite loop cannot freeze the page (the host kills us on timeout).
import { describe_text } from 'manim-web/ext/describe';
import { lint_timeline } from 'manim-web/ext/lint';
import { compile_answer, load_answer } from './run';
import { apply_white } from './theme';

self.onmessage = async (e: MessageEvent<{ code: string; width: number; height: number }>) => {
  const t0 = performance.now();
  try {
    const mod = compile_answer(e.data.code);
    const canvas = new OffscreenCanvas(e.data.width, e.data.height);
    const player = await load_answer(mod, canvas, apply_white);
    const issues = lint_timeline(player).map((i) => ({ rule: i.rule, severity: i.severity, message: i.message, time: i.time }));
    player.show_end();
    (self as any).postMessage({ ok: true, issues, duration: player.duration, description: describe_text(player.scene), ms: performance.now() - t0 });
  } catch (err: any) {
    (self as any).postMessage({ ok: false, error: `${err?.name ?? 'Error'}: ${err?.message ?? err}`, stack: String(err?.stack ?? '').split('\n').slice(0, 4).join('\n'), ms: performance.now() - t0 });
  }
};
