// The language switch (top bar and settings): a pill that slides to the language chosen, then the page is re-set in it.
import { LANGS, type Lang } from '@mathnim/core';
import { t, ui_lang } from '@mathnim/present';
import { set_language } from './settings';

const LANG_LABEL: Record<Lang, string> = { en: 'EN', zh: '中文' };

export function lang_switch(): HTMLElement {
  const lang = ui_lang();
  const el = document.createElement('span');
  el.className = 'langs';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', `${t('language')} / Language`);
  el.dataset.on = String(LANGS.indexOf(lang));
  el.innerHTML = LANGS.map((l) => `<button type="button" data-lang="${l}" lang="${l === 'zh' ? 'zh-CN' : 'en'}" aria-pressed="${l === lang}">${LANG_LABEL[l]}</button>`).join('');
  for (const b of el.querySelectorAll<HTMLButtonElement>('button')) {
    b.onclick = async () => {
      if (b.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-busy') === 'true') return;
      const to = b.dataset.lang as Lang;
      // the pill moves first; the page follows once it has arrived
      el.dataset.on = String(LANGS.indexOf(to));
      for (const x of el.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      el.setAttribute('aria-busy', 'true');
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise((r) => setTimeout(r, 260));
      // (switching to Chinese may first load the Chinese font for the visuals: a second or two, once)
      await set_language(to);
    };
  }
  return el;
}
