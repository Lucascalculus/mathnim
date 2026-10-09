import { set_ui_lang } from '@mathnim/present';
import './i18n';
import { dashboard } from './pages/dashboard';
import { home } from './pages/home';
import { lesson_page } from './pages/lesson';
import { review } from './pages/review';
import { settings_page } from './pages/settings';
import { detect_server_providers, load_settings } from './settings';
import { mount_shell } from './shell';
import { enable_dom_tex } from './tex_dom';

set_ui_lang(load_settings().lang);
Promise.allSettled([enable_dom_tex(), detect_server_providers()]).finally(() => mount_shell({ '': home, lesson: lesson_page, review, dashboard, settings: settings_page }));
