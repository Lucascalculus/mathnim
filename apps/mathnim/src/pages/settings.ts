// Settings: a small panel that drops from the gear at the right of the top bar
// (and the same panel on /settings). Changes apply at once. The language is in
// the top bar itself; the model choice and keys are under "Advanced"; clearing
// this browser's records asks first.
import { esc, t } from '@mathnim/present';
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
.set-panel{display:flex;flex-direction:column;gap:2px;font-size:14px}
.set-row{display:flex;align-items:center;gap:14px;padding:12px 2px}
.set-row+.set-row,.set-adv,.set-foot{border-top:1px solid var(--mn-border)}
.set-row .set-what{flex:1;min-width:0}
.set-row b{display:block;font-weight:600}
.set-row small{display:block;color:var(--mn-muted);font-size:12.5px;margin-top:2px;line-height:1.45}
.set-switch{position:relative;flex:none;width:38px;height:22px;border-radius:11px;border:0;padding:0;background:var(--mn-border);cursor:pointer;transition:background-color .2s}
.set-switch::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s}
.set-switch[aria-checked=true]{background:var(--mn-accent)}
.set-switch[aria-checked=true]::after{transform:translateX(16px)}
.set-adv>summary{cursor:pointer;list-style:none;padding:12px 2px;color:var(--mn-muted);font-size:13px;display:flex;align-items:center;gap:6px}
.set-adv>summary::-webkit-details-marker{display:none}
.set-adv>summary::before{content:'›';transition:transform .15s;display:inline-block}
.set-adv[open]>summary::before{transform:rotate(90deg)}
.set-adv .field{margin:0 2px 12px;font-size:12.5px;color:var(--mn-muted);gap:5px}
.set-panel .mn-input{font-size:14px;padding:8px 10px;border-radius:8px;height:36px;color:var(--mn-fg)}
.set-panel select.mn-input{padding-right:28px}
.set-foot{padding:12px 2px 2px;display:flex;align-items:center;gap:10px}
.set-clear{border:0;background:none;padding:0;color:var(--mn-bad);font:inherit;font-size:13px;cursor:pointer}
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
  el.innerHTML = `
    <div class="set-row"><div class="set-what"><b>${esc(t('narration'))}</b><small>${esc(t('narration_help'))}</small></div>
      <button type="button" class="set-switch" role="switch" id="set-voice" aria-checked="${narration_on()}" aria-label="${esc(t('narration'))}"></button></div>
    <div class="set-row"><div class="set-what"><b>AI</b><small id="set-status"></small></div></div>
    <details class="set-adv"><summary>${esc(t('advanced'))}</summary>
      <label class="field">${esc(t('provider'))}<select class="mn-input" id="set-provider">
        ${opt('auto', t('provider_auto'))}
        ${opt('deepseek', `DeepSeek${srv.deepseek ? '' : t('no_key_here')}`)}
        ${opt('anthropic', 'Claude (Anthropic)')}
        ${opt('offline', t('provider_offline'))}
      </select></label>
      <div id="set-ds"><label class="field">${esc(t('deepseek_model'))}<input class="mn-input" id="set-dsmodel" value="${esc(s.deepseek_model)}"></label></div>
      <div id="set-an">
        <label class="field">${esc(t('anthropic_key'))}<input class="mn-input" id="set-key" type="password" autocomplete="off" placeholder="${srv.anthropic ? esc(t('key_held')) : 'sk-ant-…'}" value="${esc(s.api_key)}"></label>
        <label class="field">${esc(t('claude_model'))}<input class="mn-input" id="set-model" value="${esc(s.model)}"></label>
        <label class="field">${esc(t('proxy_url'))}<input class="mn-input" id="set-base" placeholder="/api/anthropic" value="${esc(s.base_url)}"></label>
      </div>
    </details>
    <div class="set-foot"><button type="button" class="set-clear" id="set-clear">${esc(t('clear_data'))}</button><span class="muted" id="set-note" style="font-size:12.5px"></span></div>`;
  const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => el.querySelector<T>('#set-' + id)!;
  const read = (): Settings => ({
    ...load_settings(),
    provider: $<HTMLSelectElement>('provider').value as ProviderChoice,
    deepseek_model: $('dsmodel').value.trim() || 'deepseek-flash',
    api_key: $('key').value.trim(),
    model: $('model').value.trim() || 'claude-opus-5-5',
    base_url: $('base').value.trim(),
  });
  const refresh = () => {
    const now = active_provider(read());
    $('status').textContent = now === 'offline' ? t('status_offline') : t('status_online', { p: provider_label(now) });
    const p = $<HTMLSelectElement>('provider').value;
    $('ds').style.display = p === 'deepseek' || (p === 'auto' && now === 'deepseek') ? '' : 'none';
    $('an').style.display = p === 'anthropic' || (p === 'auto' && now !== 'deepseek') ? '' : 'none';
  };
  // every change is kept at once
  for (const id of ['provider', 'dsmodel', 'key', 'model', 'base']) {
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
