// Validate generated scene code: must build without errors within a time
// limit, and the linter must find no errors on the settled frames.
export interface ValidationResult {
  ok: boolean;
  error?: string;
  stack?: string;
  issues: { rule: string; severity: 'error' | 'warning'; message: string; time?: number }[];
  duration?: number;
  description?: string;
  ms: number;
}
export type Validator = (code: string) => Promise<ValidationResult>;

/** Worker-based validator (browser). */
export function worker_validator(o: { timeout_ms?: number; width?: number; height?: number } = {}): Validator {
  return (code) =>
    new Promise((resolve) => {
      const w = new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' });
      const t0 = performance.now();
      const timer = setTimeout(() => {
        w.terminate();
        resolve({ ok: false, error: `Timeout: the scene took longer than ${(o.timeout_ms ?? 15000) / 1000} s to build (infinite loop or far too many objects).`, issues: [], ms: performance.now() - t0 });
      }, o.timeout_ms ?? 15000);
      w.onmessage = (e) => {
        clearTimeout(timer);
        w.terminate();
        resolve({ issues: [], ...e.data });
      };
      w.onerror = (e) => {
        clearTimeout(timer);
        w.terminate();
        resolve({ ok: false, error: e.message || 'worker failed to start', issues: [], ms: performance.now() - t0 });
      };
      w.postMessage({ code, width: o.width ?? 960, height: o.height ?? 540 });
    });
}
