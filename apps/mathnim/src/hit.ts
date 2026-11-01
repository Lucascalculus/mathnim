// Page views for the data centre (server/stats.ts): each page sends its address once it is shown. Nothing that
// tells the visitor apart goes with it (the server keeps a hash that changes every day). The first page of a
// visit also says where the visit came from: a campaign tag (?ref= or utm_source), another site, or "direct".
import { ui_lang } from '@mathnim/present';

let first = true;
let last = '';
/** Count the page at `path` (a page re-drawn in another language is not counted again). */
export function count_view(path: string): void {
  if (path === last || path === '/admin' || path.startsWith('/admin/')) return;
  last = path;
  let ref: string | undefined;
  if (first) {
    first = false;
    const q = new URLSearchParams(location.search);
    let host = '';
    try {
      host = document.referrer ? new URL(document.referrer).hostname : '';
    } catch {
      /* not a URL */
    }
    // (a page of this site opened in a new tab is not a new source)
    ref = q.get('ref') || q.get('utm_source') || (host === location.hostname ? undefined : host || 'direct');
  }
  const body = JSON.stringify({ path, ref, lang: ui_lang(), w: innerWidth });
  void fetch('/api/hit', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body }).catch(() => undefined);
}
