// Settings: a small panel that drops from the gear at the right of the top bar
// (and the same panel on /settings). Changes apply at once. The language is in
// the top bar itself; the model choice and keys are under "Advanced"; clearing
// this browser's records asks first.
import { esc, t } from '@mathnim/present';
import { lang_switch } from '../lang_switch';
import { log } from '../store';
import { active_provider, load_settings, provider_label, save_settings, server_providers, type ProviderChoice, type Settings } from '../settings';

// the lesson narrator keeps its own switches under this key (see Narrator)
const NARRATION = 'mathnim.narration';
function narration_on(): boolean {
  try {
    return JSON.parse(localStorage.getItem(NARRATION) ?? '{}').on ?? true;
  } catch {
    return true;
  }
}
/** What clearing keeps: the settings themselves. */
const KEEP = new Set(['mathnim.settings', NARRATION]);

const CSS = `
.set-panel{display:flex;flex-direction:column;font-size:14px}
.set-row,.set-adv>summary,.set-foot{display:flex;align-items:center;gap:14px;min-height:60px;padding:10px 0;box-sizing:border-box}
.set-panel>*+*{border-top:1px solid var(--mn-border)}
.set-what{flex:1;min-width:0}
.set-what b{display:block;font-size:14px;font-weight:600;line-height:1.4;color:var(--mn-fg)}
.set-what small{display:block;font-size:12.5px;line-height:1.45;color:var(--mn-muted);margin-top:1px}
.set-switch{position:relative;flex:none;width:38px;height:22px;border-radius:11px;border:0;padding:0;background:var(--mn-border);cursor:pointer;transition:background-color .2s}
.set-switch::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s}
.set-switch[aria-checked=true]{background:var(--mn-accent)}
.set-switch[aria-checked=true]::after{transform:translateX(16px)}
.set-adv>summary{cursor:pointer;list-style:none}
.set-adv>summary::-webkit-details-marker{display:none}
.set-chev{flex:none;width:16px;height:16px;color:var(--mn-muted);transition:transform .2s}
.set-adv[open] .set-chev{transform:rotate(90deg)}
.set-fields{display:flex;flex-direction:column;gap:12px;padding:2px 0 14px}
.set-fields[hidden],.set-fields>[hidden],.set-keynote[hidden]{display:none}
.set-fields .set-fields{padding:0}
.set-keynote{display:block;font-size:12px;color:var(--mn-muted);margin:-4px 0 0}
.set-field{display:flex;flex-direction:column;gap:5px;margin:0;font-size:12.5px;color:var(--mn-muted)}
.set-panel .mn-input{box-sizing:border-box;width:100%;height:36px;margin:0;padding:0 10px;font-size:14px;border-radius:8px;color:var(--mn-fg)}
.set-panel select.mn-input{-webkit-appearance:none;appearance:none;font:inherit;font-size:14px;line-height:34px;padding:0 30px 0 10px;background:var(--mn-panel) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5' fill='none' stroke='%236b7077' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 8px center/16px 16px;text-overflow:ellipsis;cursor:pointer}
.set-panel input.mn-input{font:inherit;font-size:14px}
.set-clear{border:0;background:none;padding:0;font:inherit;font-size:14px;font-weight:600;color:var(--mn-bad);cursor:pointer;text-align:left}
.set-clear:hover{text-decoration:underline}
`;
let injected = false;

/** The panel: narration, the AI in use (the rest under Advanced), clearing this browser's records. */
export function settings_panel(): HTMLElement {
  if (!injected) {
    injected = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
  }
  const s = load_settings();
  const srv = server_providers();
  const opt = (v: ProviderChoice, label: string) => `<option value="${v}" ${s.provider === v ? 'selected' : ''}>${label}</option>`;
  const el = document.createElement('div');
  el.className = 'set-panel';
  const chev = '<svg class="set-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  el.innerHTML = `
    <div class="set-row"><div class="set-what"><b>${esc(t('language'))}</b><small>${esc(t('language_help_short'))}</small></div><span class="set-lang"></span></div>
    <div class="set-row"><div class="set-what"><b>${esc(t('narration'))}</b><small>${esc(t('narration_help'))}</small></div>
      <button type="button" class="set-switch" role="switch" id="set-voice" aria-checked="${narration_on()}" aria-label="${esc(t('narration'))}"></button></div>
    <div class="set-row"><div class="set-what"><b>AI</b><small id="set-status"></small></div></div>
    <details class="set-adv"><summary><div class="set-what"><b>${esc(t('advanced'))}</b><small>${esc(t('advanced_help'))}</small></div>${chev}</summary>
      <div class="set-fields">
        <label class="set-field">${esc(t('provider'))}<select class="mn-input" id="set-provider">
          ${opt('gift', t('provider_gift'))}
          ${opt('openai', 'GPT')}
          ${opt('anthropic', 'Claude')}
          ${opt('custom', t('provider_custom'))}
        </select></label>
        <div class="set-fields" data-for="openai">
          <label class="set-field">${esc(t('api_key'))}<input class="mn-input" id="set-okey" type="password" autocomplete="off" placeholder="sk-…" value="${esc(s.openai_key)}"></label>
          <label class="set-field">${esc(t('model_name'))}<input class="mn-input" id="set-omodel" value="${esc(s.openai_model)}"></label>
        </div>
        <div class="set-fields" data-for="anthropic">
          <label class="set-field">${esc(t('api_key'))}<input class="mn-input" id="set-key" type="password" autocomplete="off" placeholder="${srv.anthropic ? esc(t('key_held')) : 'sk-ant-…'}" value="${esc(s.api_key)}"></label>
          <label class="set-field">${esc(t('model_name'))}<input class="mn-input" id="set-model" value="${esc(s.model)}"></label>
        </div>
        <div class="set-fields" data-for="custom">
          <label class="set-field">${esc(t('custom_url'))}<input class="mn-input" id="set-curl" placeholder="https://api.example.com/v1" value="${esc(s.custom_url)}"></label>
          <label class="set-field">${esc(t('api_key'))}<input class="mn-input" id="set-ckey" type="password" autocomplete="off" value="${esc(s.custom_key)}"></label>
          <label class="set-field">${esc(t('model_name'))}<input class="mn-input" id="set-cmodel" value="${esc(s.custom_model)}"></label>
        </div>
        <small class="set-keynote" data-for="openai anthropic custom">${esc(t('key_local'))}</small>
      </div>
    </details>
    <div class="set-foot"><div class="set-what"><button type="button" class="set-clear" id="set-clear">${esc(t('clear_data'))}</button><small>${esc(t('clear_help'))}</small></div></div>`;
  el.querySelector('.set-lang')!.replaceWith(lang_switch());
  const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => el.querySelector<T>('#set-' + id)!;
  const read = (): Settings => ({
    ...load_settings(),
    provider: $<HTMLSelectElement>('provider').value as ProviderChoice,
    openai_key: $('okey').value.trim(),
    openai_model: $('omodel').value.trim() || 'gpt-5',
    api_key: $('key').value.trim(),
    model: $('model').value.trim() || 'claude-opus-5-5',
    custom_url: $('curl').value.trim().replace(/\/$/, ''),
    custom_key: $('ckey').value.trim(),
    custom_model: $('cmodel').value.trim(),
  });
  const refresh = () => {
    const now = read();
    const active = active_provider(now);
    $('status').textContent = active === 'offline' ? t('status_offline') : t('status_online', { p: provider_label(active, now) });
    // only the chosen provider's fields; the site's own model has none
    for (const f of el.querySelectorAll<HTMLElement>('[data-for]')) f.hidden = !f.dataset.for!.split(' ').includes(now.provider);
  };
  // every change is kept at once
  for (const id of ['provider', 'okey', 'omodel', 'key', 'model', 'curl', 'ckey', 'cmodel']) {
    $(id).addEventListener('change', () => {
      save_settings(read());
      refresh();
    });
    $(id).addEventListener('input', refresh);
  }
  $('voice').onclick = () => {
    const on = $('voice').getAttribute('aria-checked') !== 'true';
    $('voice').setAttribute('aria-checked', String(on));
    try {
      localStorage.setItem(NARRATION, JSON.stringify({ ...JSON.parse(localStorage.getItem(NARRATION) ?? '{}'), on }));
    } catch {
      /* no storage */
    }
    log.emit({ verb: 'set', lesson: '', object: 'narration', data: { value: on } });
  };
  $('clear').onclick = () => {
    if (!confirm(t('clear_confirm'))) return;
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('mathnim.') && !KEEP.has(k)) localStorage.removeItem(k);
    } catch {
      /* no storage */
    }
    location.reload();
  };
  refresh();
  return el;
}

/** /settings: the same panel on a page of its own. */
export function settings_page(root: HTMLElement): void {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'max-width:520px;margin:0 auto';
  card.innerHTML = `<h2 style="margin:0 0 4px">${esc(t('settings'))}</h2>`;
  card.append(settings_panel());
  root.append(card);
}
