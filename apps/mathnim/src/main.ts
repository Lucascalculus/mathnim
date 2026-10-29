import { on_ui_lang, set_ui_lang } from '@mathnim/present';
import type { Lang } from '@mathnim/core';
import { set_ft_lang } from '@mathnim/visuals/ft/f/kit';
import { cjk_ready } from './cjk_font';
import './i18n';
import { load_me, on_user } from './account';
import { course_page, home } from './pages/home';
import { lab_page, lesson_page } from './pages/lesson';
import { review } from './pages/review';
import { settings_page } from './pages/settings';
import { studio_page } from './pages/studio';
import { navigate } from './router';
import { detect_server_providers, load_settings } from './settings';
import { mount_shell } from './shell';
import { load_studio_courses } from './studio_courses';
import { enable_dom_tex } from './tex_dom';

// Visuals draw their labels in the learner's language (lang 'auto'): Chinese once a Chinese font is loaded
// (set_language waits for it), English otherwise. Subscribed before the shell, so a page re-rendered for a
// new language already draws in it.
const visual_lang = (l: Lang) => set_ft_lang(l === 'zh' && !cjk_ready() ? 'en' : l);
on_ui_lang(visual_lang);
const start_lang = load_settings().lang;
// (the Chinese font for the visuals is not waited for here: a page loads it when it draws one, see ready_visuals)
// the account (and its progress) and the courses made from uploads come first: routes and the learner model need them
const account = load_me().catch(() => null).then(load_studio_courses);
// (MathJax is not waited for: the pages with formulas wait for it themselves, see tex_dom.ts)
Promise.allSettled([detect_server_providers(), account]).finally(() => {
  visual_lang(start_lang);
  set_ui_lang(start_lang);
  mount_shell({ home, course: course_page, lesson: lesson_page, lab: lab_page, review, settings: settings_page, studio: studio_page });
  // ... and it loads once the first page is up, so a lesson opened from here does not wait for it
  const idle = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 300));
  idle(() => void enable_dom_tex(), { timeout: 2000 });
  // signing in or out changes which courses exist: list them again and show the page anew
  on_user(() => void load_studio_courses().then(() => navigate(location.pathname + location.search, true)));
});
