// Named colours. Visuals only use these names, so a whole scene can switch
// between the quiet white theme and a 3b1b-like dark one (the learner chooses;
// see docs/PLAN.md WP11). Colours are read when a scene is built.
import { config } from 'manim-web';
import type { ScenePlayer } from 'manim-web/ext/player';

export interface Palette {
  bg: string;
  /** Background gradient (top, bottom). */
  bg_top: string;
  bg_bottom: string;
  ink: string;
  muted: string;
  faint: string;
  accent: string;
  gold: string;
  coral: string;
  good: string;
  purple: string;
  teal: string;
}
export type ThemeName = 'light' | 'dark';

export const THEMES: Record<ThemeName, Palette> = {
  light: {
    bg: '#FFFFFF', bg_top: '#FFFFFF', bg_bottom: '#F5F5F7',
    ink: '#111113', muted: '#86868B', faint: '#E6E6EA',
    accent: '#2563EB', gold: '#B8860B', coral: '#E4572E', good: '#1F8A5B', purple: '#7C3AED', teal: '#0D9488',
  },
  // Manim's own colours (BLUE_C, YELLOW_C, RED_C, GREEN_C, PURPLE_C, TEAL_C) on near-black
  dark: {
    bg: '#0E1014', bg_top: '#12151B', bg_bottom: '#0B0D10',
    ink: '#ECEFF4', muted: '#8B93A1', faint: '#2A2F38',
    accent: '#58C4DD', gold: '#F7D96F', coral: '#FC6255', good: '#83C167', purple: '#9A72AC', teal: '#5CD0B3',
  },
};

let current: ThemeName = 'light';
export function set_theme(t: ThemeName): void {
  current = t;
}
export function theme(): ThemeName {
  return current;
}
/** The palette of the current theme (read it inside scene construction). */
export function palette(): Palette {
  return THEMES[current];
}
/** Background and line style of the current theme on a player. */
export function apply_palette(p: ScenePlayer): void {
  const c = palette();
  config.background_color = c.bg as any;
  const cam = p.scene.camera as any;
  cam.background_color = c.bg;
  cam.effects = { background: { kind: 'linear', top: c.bg_top, bottom: c.bg_bottom }, lineCap: 'round', lineJoin: 'round' };
}
