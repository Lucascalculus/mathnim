// The quiet white theme ("素白") used by this lesson's scenes.
import { config } from 'manim-web';
import type { ScenePlayer } from 'manim-web/ext/player';

export const C = {
  bg: '#FFFFFF',
  ink: '#111113',
  muted: '#86868B',
  faint: '#E6E6EA',
  accent: '#2563EB',
  gold: '#B8860B',
  coral: '#E4572E',
  good: '#1F8A5B',
  grassA: '#EEF5EE',
  grassB: '#E6F0E6',
  line: '#FFFFFF',
};

export function apply_theme(p: ScenePlayer): void {
  config.background_color = C.bg as any;
  const cam = p.scene.camera as any;
  cam.background_color = C.bg;
  cam.effects = { background: { kind: 'linear', top: '#FFFFFF', bottom: '#F5F5F7' }, lineCap: 'round', lineJoin: 'round' };
}
