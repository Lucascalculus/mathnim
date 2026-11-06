// The text's own interactions, for every page at once (one delegated listener): a definition opens in its sentence, a
// claim's reasons open under it. Nothing runs at rest.
let wired = false;
export function wire_text(root: Document | HTMLElement = document): void {
  if (wired || typeof document === 'undefined') return;
  wired = true;
  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement | null;
    const term = el?.closest?.('.mn-def-term') as HTMLElement | null;
    if (term) {
      const body = term.nextElementSibling as HTMLElement | null;
      const open = term.getAttribute('aria-expanded') !== 'true';
      term.setAttribute('aria-expanded', String(open));
      if (body) body.hidden = !open;
      return;
    }
    const ring = el?.closest?.('.mn-why-ring') as HTMLElement | null;
    if (ring) {
      const under = ring.parentElement?.nextElementSibling as HTMLElement | null;
      const open = ring.getAttribute('aria-expanded') !== 'true';
      ring.setAttribute('aria-expanded', String(open));
      if (under?.classList.contains('mn-why-because')) under.hidden = !open;
    }
  });
}
