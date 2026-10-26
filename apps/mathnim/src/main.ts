import { on_ui_lang, set_ui_lang } from '@mathnim/present';
import type { Lang } from '@mathnim/core';
import { set_ft_lang } from '@mathnim/visuals/ft/f/kit';
import { cjk_ready } from './cjk_font';
import './i18n';
import { course_page, home } from './pages/home';
import { lab_page, lesson_page } from './pages/lesson';
import { review } from './pages/review';
import { settings_page } from './pages/settings';
import { detect_server_providers, load_settings } from './settings';
import { mount_shell } from './shell';
import { enable_dom_tex } from './tex_dom';

// Visuals draw their labels in the learner's language (lang 'auto'): Chinese once a Chinese font is loaded
// (set_language waits for it), English otherwise. Subscribed before the shell, so a page re-rendered for a
// new language already draws in it.
const visual_lang = (l: Lang) => set_ft_lang(l === 'zh' && !cjk_ready() ? 'en' : l);
on_ui_lang(visual_lang);
const start_lang = load_settings().lang;
// (the Chinese font for the visuals is not waited for here: a page loads it when it draws one, see ready_visuals)
Promise.allSettled([enable_dom_tex(), detect_server_providers()]).finally(() => {
  visual_lang(start_lang);
  set_ui_lang(start_lang);
  mount_shell({ home, course: course_page, lesson: lesson_page, lab: lab_page, review, settings: settings_page });
});
