// @mathnim/present - presenters that put a lesson on screen. The essay view
// (chaptered scenes, checkpoints, explorations, text pages) is LessonView; the
// game view is the same class with mode 'game'.
export { LessonView, type ViewOptions, type TextGrader } from './view';
export { SketchPad, type SketchMapping } from './sketchpad';
export { CueGuide } from './cue';
export { Narrator } from './narrator';
export { math_html, display_math_html, set_math, set_tex_renderer, esc, type TexRenderer, type MarkupOptions } from './math';
export { inject_styles, CSS } from './styles';
export { t, set_ui_lang, ui_lang, on_ui_lang, define_ui, plural_s, ui_entries, drag_hint } from './i18n';
export { highlight_lines, tokenize, code_lang, lang_label } from './highlight';
export { BlockRenderer, blocks_html, code_lines_html, fit_display_math, text_page, read_page, derive_page, code_page, reset_derivations, type EmbeddedVisual, type VisualResolver, type PageContext, type PageController } from './text_pages';
