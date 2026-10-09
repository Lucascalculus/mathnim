// Settings: language, model access (kept in this browser only), narration and appearance.
import { LANGS, type Lang } from '@mathnim/core';
import { esc, t } from '@mathnim/present';
import { active_provider, load_settings, provider_label, save_settings, server_providers, set_language, type ProviderChoice, type Settings } from '../settings';

/** Unsaved edits, kept while the page re-renders in a new language. */
let draft: Settings | null = null;
const LANG_NAME: Record<Lang, string> = { en: 'English', zh: '中文' };

// the lesson narrator keeps its own switches under this key (see Narrator)
const NARRATION = 'mathnim.narration';
function narration(): { on: boolean; system: boolean } {
  try {
    const n = JSON.parse(localStorage.getItem(NARRATION) ?? '{}');
    return { on: n.on ?? true, system: n.system ?? false };
  } catch {
    return { on: true, system: false };
  }
}

export function settings_page(root: HTMLElement): void {
  const s = draft ?? load_settings();
  draft = null;
  const n = narration();
  const srv = server_providers();
  const opt = (v: ProviderChoice, label: string) => `<option value="${v}" ${s.provider === v ? 'selected' : ''}>${label}</option>`;
  root.innerHTML = `<div class="card" style="max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:16px">
    <h2>${esc(t('settings'))}</h2>
    <h3 style="margin:0">${esc(t('language'))} / Language</h3>
    <div class="row" role="radiogroup" aria-label="${esc(t('language'))}">${LANGS.map((l) => `<label class="row" style="gap:6px;cursor:pointer" lang="${l === 'zh' ? 'zh-CN' : 'en'}"><input type="radio" name="lang" value="${l}" ${s.lang === l ? 'checked' : ''}> ${LANG_NAME[l]}</label>`).join('')}</div>
    <p class="muted" style="margin:-8px 0 0;font-size:13px">${esc(t('language_help'))}</p>
    <h3 style="margin:8px 0 0">${esc(t('ai_model'))}</h3>
    <p class="muted" style="margin:0" id="status"></p>
    <label class="field">${esc(t('provider'))}<select class="mn-input" id="provider">
      ${opt('auto', t('provider_auto'))}
      ${opt('deepseek', `DeepSeek${srv.deepseek ? '' : t('no_key_here')}`)}
      ${opt('anthropic', 'Claude (Anthropic)')}
      ${opt('offline', t('provider_offline'))}
    </select></label>
    <div id="ds" class="col"><label class="field">${esc(t('deepseek_model'))}<input class="mn-input" id="dsmodel" value="${s.deepseek_model}"></label></div>
    <div id="an" class="col">
      <label class="field">${esc(t('anthropic_key'))}<input class="mn-input" id="key" type="password" autocomplete="off" placeholder="${srv.anthropic ? esc(t('key_held')) : 'sk-ant-…'}" value="${s.api_key}"></label>
      <p class="muted" style="margin:-8px 0 0;font-size:12px">${esc(t('key_note'))}</p>
      <label class="field">${esc(t('claude_model'))}<input class="mn-input" id="model" value="${s.model}"></label>
      <label class="field">${esc(t('proxy_url'))}<input class="mn-input" id="base" placeholder="/api/anthropic" value="${s.base_url}"></label>
    </div>
    <h3 style="margin:8px 0 0">${esc(t('narration'))}</h3>
    <label class="row"><input type="checkbox" id="voice" ${n.on ? 'checked' : ''}> ${esc(t('read_aloud'))}</label>
    <label class="row"><input type="checkbox" id="system" ${n.system ? 'checked' : ''}> ${esc(t('system_voice'))}</label>
    <h3 style="margin:8px 0 0">${esc(t('appearance'))}</h3>
    <label class="row"><input type="checkbox" id="dark" ${s.dark ? 'checked' : ''}> ${esc(t('dark_ui'))}</label>
    <div class="row"><button class="mn-btn primary" id="save">${esc(t('save'))}</button><span class="muted" id="saved"></span></div>
  </div>`;
  const $ = (id: string) => root.querySelector<HTMLInputElement>('#' + id)!;
  const lang_now = () => (root.querySelector<HTMLInputElement>('input[name=lang]:checked')?.value as Lang | undefined) ?? s.lang;
  const read = (): Settings => ({
    lang: lang_now(),
    provider: $('provider').value as ProviderChoice,
    deepseek_model: $('dsmodel').value.trim() || 'deepseek-flash',
    api_key: $('key').value.trim(),
    model: $('model').value.trim() || 'claude-opus-5-5',
    base_url: $('base').value.trim(),
    dark: $('dark').checked,
  });
  const refresh = () => {
    const now = active_provider(read());
    $('status').textContent = now === 'offline' ? t('status_offline') : t('status_online', { p: provider_label(now) });
    const p = $('provider').value;
    root.querySelector<HTMLElement>('#ds')!.style.display = p === 'deepseek' || (p === 'auto' && now === 'deepseek') ? '' : 'none';
    root.querySelector<HTMLElement>('#an')!.style.display = p === 'anthropic' || (p === 'auto' && now !== 'deepseek') ? '' : 'none';
  };
  for (const id of ['provider', 'key', 'base']) $(id).addEventListener('input', refresh);
  refresh();
  // the language applies at once (the page re-renders in it, keeping unsaved edits)
  root.querySelectorAll<HTMLInputElement>('input[name=lang]').forEach((r) => (r.onchange = () => {
    draft = read();
    set_language(r.value as Lang);
  }));
  $('save').onclick = () => {
    save_settings(read());
    try {
      localStorage.setItem(NARRATION, JSON.stringify({ on: $('voice').checked, system: $('system').checked }));
    } catch {
      /* no storage */
    }
    $('saved').textContent = t('saved');
    const mode = document.querySelector('.nav .mode');
    if (mode) mode.textContent = t('nav_ai', { p: provider_label(active_provider()) });
    document.getElementById('app')!.classList.toggle('dark', $('dark').checked);
  };
}
