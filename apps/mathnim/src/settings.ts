// App settings (kept in this browser only) and the model provider they select.
import type { Lang } from '@mathnim/core';
import { set_ui_lang, t } from '@mathnim/present';
import { ensure_cjk_font } from './cjk_font';
import { log } from './store';
import { AnthropicProvider, MockProvider, OpenAICompatibleProvider, recorded_lesson_responses, recorded_responses, recorded_text_answers, type Provider } from '@mathnim/ai';

/**
 * Where answers come from: 'gift' is the model this site offers (DeepSeek, its key held by the server; nothing to set),
 * or the learner's own: GPT, Claude, or any OpenAI-compatible endpoint ('custom'). Their keys stay in this browser.
 */
export type ProviderChoice = 'gift' | 'openai' | 'anthropic' | 'custom';
export interface Settings {
  provider: ProviderChoice;
  deepseek_model: string;
  /** Anthropic key typed in this browser (sent only to api.anthropic.com). */
  api_key: string;
  /** Claude model. */
  model: string;
  /** Proxy that adds the Anthropic key server-side, e.g. '/api/anthropic'. */
  base_url: string;
  openai_key: string;
  openai_model: string;
  /** An OpenAI-compatible endpoint (its base URL, e.g. https://api.example.com/v1), key and model. */
  custom_url: string;
  custom_key: string;
  custom_model: string;
  dark: boolean;
  /** The learner's language: the interface, and lessons written in both languages. */
  lang: Lang;
}
const KEY = 'mathnim.settings';
/** A browser set to Chinese starts in Chinese; everyone else in English. */
const DEFAULTS: Settings = { provider: 'gift', deepseek_model: 'deepseek-flash', api_key: '', model: 'claude-opus-5-5', base_url: '', openai_key: '', openai_model: 'gpt-5', custom_url: '', custom_key: '', custom_model: '', dark: false, lang: 'en' }; // a first visit opens in English, whatever the browser's language; the switch in the top bar is remembered

export function load_settings(): Settings {
  try {
    const s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } as Settings;
    // earlier choices ('auto', 'deepseek', 'offline') are the site's own model now
    if (!['gift', 'openai', 'anthropic', 'custom'].includes(s.provider)) s.provider = 'gift';
    return s;
  } catch {
    return { ...DEFAULTS };
  }
}
export function save_settings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
/** Switch the learner's language (saved; the shell re-renders the page in it once Chinese visuals can be drawn). */
export async function set_language(lang: Lang): Promise<void> {
  try {
    save_settings({ ...load_settings(), lang });
  } catch {
    /* no storage: this session only */
  }
  log.emit({ verb: 'set', lesson: '', object: 'lang', data: { value: lang } });
  // the canvas needs a Chinese font before visuals are drawn in Chinese (without one they stay English)
  if (lang === 'zh') await ensure_cjk_font();
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

/** What answers right now: the choice, or recorded offline answers when it cannot (no server key, no key typed). */
export type ActiveProvider = 'deepseek' | 'openai' | 'anthropic' | 'custom' | 'offline';
export function active_provider(s = load_settings()): ActiveProvider {
  switch (s.provider) {
    case 'openai':
      return s.openai_key ? 'openai' : 'offline';
    case 'anthropic':
      return server.anthropic || s.api_key || s.base_url ? 'anthropic' : 'offline';
    case 'custom':
      return s.custom_url && s.custom_model ? 'custom' : 'offline';
    default:
      return server.deepseek ? 'deepseek' : 'offline';
  }
}
export const has_model = (s = load_settings()) => active_provider(s) !== 'offline';
/** The provider's name in the interface language. */
export function provider_label(p: ActiveProvider, s = load_settings()): string {
  return { deepseek: t('provider_gift'), openai: 'GPT', anthropic: 'Claude', custom: s.custom_model || t('provider_custom'), offline: t('offline_answers') }[p];
}

let mock: MockProvider | null = null;
/** The configured model, or recorded answers when none is available. */
export function provider(): Provider {
  const s = load_settings();
  switch (active_provider(s)) {
    case 'deepseek':
      return new OpenAICompatibleProvider({ name: 'deepseek', base_url: '/api/deepseek', model: s.deepseek_model || DEFAULTS.deepseek_model, default_max_tokens: 32000 });
    case 'openai':
      return new OpenAICompatibleProvider({ name: 'openai', base_url: 'https://api.openai.com/v1', api_key: s.openai_key, model: s.openai_model || DEFAULTS.openai_model });
    case 'custom':
      return new OpenAICompatibleProvider({ name: 'custom', base_url: s.custom_url, api_key: s.custom_key || undefined, model: s.custom_model });
    case 'anthropic':
      return new AnthropicProvider({ api_key: s.api_key || undefined, model: s.model, base_url: s.base_url || (server.anthropic ? '/api/anthropic' : undefined) });
    default:
      // recorded answers: scenes for the geometry lessons, words only for a few lesson questions (the "explain this" chat)
      mock ??= new MockProvider({ ...recorded_responses(MockProvider.key), ...recorded_lesson_responses(MockProvider.key) }, undefined, recorded_text_answers(MockProvider.key));
      return mock;
  }
}
