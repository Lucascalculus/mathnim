// A figure's note about itself - what is a simulation, a toy model, exact, real data and where it comes from, or a
// short remark on how to read it - stays out of the picture: Mathnim draws no sentences in a figure (docs/TASTE.md).
// aside() keeps the note's words on the scene (asides_of) for the lesson to show in a faint line under the figure,
// and gives back an empty group in its place, so the visual's own code (its name, FadeIn, groups) stays as it was.
import { VGroup, type Mobject, type Scene } from 'manim-web';

/** The words of a note as drawn (a Text, or a group of them read top to bottom). */
function words_of(m: Mobject): string {
  const texts = (m.get_family() as Mobject[]).map((x) => (x as { original_text?: string }).original_text).filter((s): s is string => !!s);
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Keep `note` (a drawn note, or its words) beside the figure instead of in it; returns the empty group in its place. */
export function aside(scene: Scene, note: Mobject | string): VGroup {
  const text = typeof note === 'string' ? note.trim() : words_of(note);
  const s = scene as Scene & { asides?: string[] };
  if (text) (s.asides ??= []).push(text);
  return VGroup();
}

/** The notes a scene keeps beside its figure, in the order they were made. */
export const asides_of = (scene: Scene): string[] => (scene as Scene & { asides?: string[] }).asides ?? [];
