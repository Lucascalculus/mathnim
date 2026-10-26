// Real paths, routed with the history API (docs/SITE-STRUCTURE.md):
//   /                         home: continue learning, all courses
//   /<course-slug>            a course page
//   /<course-slug>/<lesson>   a lesson
//   /<course-slug>/labs/<lab> a lab tutorial
//   /review /dashboard /settings
// Old hash links (#/, #/lesson/<id>, #/course/<id>, #/review ...) are redirected.
// Links inside the app are plain <a href="/..."> elements: a click is turned
// into a pushState navigation (no reload); the server answers every path with
// index.html (vite dev/preview, and Cloudflare Pages without a 404.html).
import { course_by_slug, course_path, find_course, find_lesson, lesson_path, type Course } from './course';

export type Route =
  | { page: 'home' }
  | { page: 'course'; course: Course }
  | { page: 'lesson'; course: Course; lesson: string }
  | { page: 'lab'; course: Course; lab: string }
  | { page: 'review' | 'settings' };

const OTHER = new Set(['review', 'settings']);

/** The route of a path; unknown paths go home (and wrong course slugs to the lesson's own course). */
export function parse(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { page: 'home' };
  if (parts.length === 1 && OTHER.has(parts[0])) return { page: parts[0] as 'review' | 'settings' };
  const course = course_by_slug(parts[0]);
  if (course && parts.length === 1) return { page: 'course', course };
  if (course && parts[1] === 'labs' && parts[2]) return { page: 'lab', course, lab: parts[2] };
  if (parts[1] && find_lesson(parts[1])) {
    const real = lesson_path(parts[1]).split('/')[1];
    return { page: 'lesson', course: course_by_slug(real) ?? course!, lesson: parts[1] };
  }
  return { page: 'home' };
}

/** The path an old hash link stands for (null when the URL has none). */
export function legacy_path(hash: string): string | null {
  if (!hash.startsWith('#/')) return null;
  const [path, query = ''] = hash.slice(1).split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const q = query ? `?${query}` : '';
  if (parts[0] === 'lesson' && parts[1]) return find_lesson(parts[1]) ? lesson_path(parts[1]) + q : '/';
  if (parts[0] === 'course' && parts[1]) {
    const c = find_course(parts[1]);
    return c ? course_path(c) : '/';
  }
  if (parts[0] && OTHER.has(parts[0])) return `/${parts[0]}${q}`;
  return '/';
}

type Listener = () => void;
let on_change: Listener = () => {};
/** The shell's re-render (set once by mount_shell). */
export function set_router(f: Listener): void {
  on_change = f;
}
/** Go to a path inside the app without reloading (replace: no new history entry). */
export function navigate(href: string, replace = false): void {
  if (replace) history.replaceState(null, '', href);
  else history.pushState(null, '', href);
  on_change();
}

/** Turn clicks on in-app links into navigations (files, new tabs and other sites keep the browser's default). */
export function intercept_links(root: Document): void {
  root.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || a.target || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/') || href.startsWith('//') || href.startsWith('/api/')) return;
    // a file (a thumbnail, a lab's code) is not a page
    if (/\.[a-z0-9]{1,5}(\?|#|$)/i.test(href.split('?')[0])) return;
    e.preventDefault();
    navigate(href);
  });
}
