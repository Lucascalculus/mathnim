// App settings (kept in this browser only) and the model provider they select.
import type { Lang } from '@mathnim/core';
import { set_ui_lang, t } from '@mathnim/present';
import { AnthropicProvider, MockProvider, OpenAICompatibleProvider, recorded_lesson_responses, recorded_responses, type Provider } from '@mathnim/ai';

export type ProviderChoice = 'auto' | 'deepseek' | 'anthropic' | 'offline';
export interface Settings {
  /** 'auto': a provider whose key the server holds (DeepSeek first), else a key typed here, else offline. */
  provider: ProviderChoice;
  deepseek_model: string;
  /** Anthropic key typed in this browser (prototype only; a server key is preferred). */
  api_key: string;
  model: string;
  /** Proxy that adds the Anthropic key server-side, e.g. '/api/anthropic'. */
  base_url: string;
  dark: boolean;
  /** The learner's language: the interface, and lessons written in both languages. */
  lang: Lang;
}
const KEY = 'mathnim.settings';
/** A browser set to Chinese starts in Chinese; everyone else in English. */
const browser_lang = (): Lang => (typeof navigator !== 'undefined' && /^zh\b/i.test(navigator.language ?? '') ? 'zh' : 'en');
const DEFAULTS: Settings = { provider: 'auto', deepseek_model: 'deepseek-flash', api_key: '', model: 'claude-opus-5-5', base_url: '', dark: false, lang: browser_lang() };

export function load_settings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}
export function save_settings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
/** Switch the learner's language now (saved; the shell re-renders the page in it). */
export function set_language(lang: Lang): void {
  try {
    save_settings({ ...load_settings(), lang });
  } catch {
    /* no storage: this session only */
  }
  set_ui_lang(lang);
}
/** The language's name as the AI tutor is told it. */
export const language_name = (l: Lang): string => (l === 'zh' ? 'Chinese' : 'English');

/** Providers whose keys the dev server holds (from /api/providers; names only, never keys). */
let server: { anthropic: boolean; deepseek: boolean } = { anthropic: false, deepseek: false };
export async function detect_server_providers(): Promise<void> {
  try {
    const r = await fetch('/api/providers');
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) server = await r.json();
  } catch {
    /* static hosting: no server keys */
  }
}
export const server_providers = () => ({ ...server });

/** Which provider the settings resolve to right now. */
export function active_provider(s = load_settings()): Exclude<ProviderChoice, 'auto'> {
  const anthropic = server.anthropic || !!s.api_key || !!s.base_url;
  if (s.provider === 'deepseek') return server.deepseek ? 'deepseek' : 'offline';
  if (s.provider === 'anthropic') return anthropic ? 'anthropic' : 'offline';
  if (s.provider === 'offline') return 'offline';
  return server.deepseek ? 'deepseek' : anthropic ? 'anthropic' : 'offline';
}
export const has_model = (s = load_settings()) => active_provider(s) !== 'offline';
export const PROVIDER_LABEL = { deepseek: 'DeepSeek', anthropic: 'Claude', offline: 'offline demo answers' } as const;
/** The provider's name in the interface language (the offline label is translated). */
export const provider_label = (p: keyof typeof PROVIDER_LABEL): string => (p === 'offline' ? t('offline_answers') : PROVIDER_LABEL[p]);

let mock: MockProvider | null = null;
/** The configured model, or recorded answers when none is available. */
export function provider(): Provider {
  const s = load_settings();
  switch (active_provider(s)) {
    case 'deepseek':
      return new OpenAICompatibleProvider({ name: 'deepseek', base_url: '/api/deepseek', model: s.deepseek_model || DEFAULTS.deepseek_model, default_max_tokens: 32000 });
    case 'anthropic':
      return new AnthropicProvider({ api_key: s.api_key || undefined, model: s.model, base_url: s.base_url || (server.anthropic ? '/api/anthropic' : undefined) });
    default:
      mock ??= new MockProvider({ ...recorded_responses(MockProvider.key), ...recorded_lesson_responses(MockProvider.key) });
      return mock;
  }
}
