// The learner's interface language and the one dictionary of UI strings.
// Lesson content is L10n data resolved with tr(); the chrome around it (buttons,
// labels, help) is looked up here by key. The app adds its own entries with
// define_ui() so the shell, its pages and the lesson view share one table.
//
//   set_ui_lang('zh');
//   t('continue')                    // '继续'
//   t('items_due', { n: 3, s: 's' }) // '3 项待复习'
import { tr, type Lang } from '@mathnim/core';

type Entry = { en: string; zh: string };
let lang: Lang = 'en';
const listeners = new Set<(l: Lang) => void>();

/** Switch the interface language; listeners (the app shell) re-render. */
export function set_ui_lang(l: Lang): void {
  if (l === lang) return;
  lang = l;
  for (const f of [...listeners]) f(l);
}
export const ui_lang = (): Lang => lang;
/** Be told when the language changes; returns the unsubscribe function. */
export function on_ui_lang(f: (l: Lang) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

const DICT: Record<string, Entry> = {
  // ---- player bar and steps
  play_pause: { en: 'Play or pause', zh: '播放或暂停' },
  scene_position: { en: 'Scene position', zh: '场景进度' },
  speed: { en: 'Speed', zh: '速度' },
  export_mp4: { en: 'Export MP4', zh: '导出 MP4' },
  exporting: { en: 'Exporting {p}%', zh: '正在导出 {p}%' },
  export_failed: { en: 'Export failed: {why}', zh: '导出失败：{why}' },
  narration_toggle: { en: 'Narration on or off', zh: '打开或关闭旁白' },
  replay: { en: 'Replay', zh: '重播' },
  continue: { en: 'Continue', zh: '继续' },
  kind_watch: { en: 'watch', zh: '观看' },
  kind_explore: { en: 'your turn: explore', zh: '轮到你：动手探索' },
  kind_question: { en: 'question', zh: '问题' },
  kind_sketch: { en: 'draw a prediction', zh: '画出预测' },
  kind_read: { en: 'read', zh: '阅读' },
  kind_derive: { en: 'derivation', zh: '推导' },
  kind_code: { en: 'code walkthrough', zh: '代码讲解' },
  locked: { en: 'locked', zh: '未解锁' },
  n_of_3_stars: { en: '{n} of 3 stars', zh: '{n}/3 颗星' },
  // ---- worlds
  your_turn: { en: 'Your turn', zh: '轮到你了' },
  drag_numbers: { en: 'Drag the underlined numbers, or ', zh: '左右拖动带下划线的数字，或者' },
  drag_handle: { en: 'Drag the glowing handle on the figure - or click the figure, press Tab, then use the arrow keys.', zh: '拖动图上发光的手柄；也可以先点一下图，按 Tab，再用方向键。' },
  hint: { en: 'Hint', zh: '提示' },
  // the "drag me" pill on a figure's unused handle ({label}: the handle's own name)
  drag_hint: { en: 'Drag {label}', zh: '拖动{label}' },
  drag_hint_plain: { en: 'Drag me', zh: '拖动这里' },
  common_idea: { en: 'Common idea: {d}', zh: '常见想法：{d}' },
  level_complete: { en: 'Level complete', zh: '过关！' },
  done: { en: 'Done', zh: '完成' },
  next: { en: 'Next', zh: '下一步' },
  play_again: { en: 'Play again', zh: '再玩一次' },
  // ---- questions
  watch: { en: 'Watch', zh: '观看' },
  correct: { en: 'Correct.', zh: '正确。' },
  predict_match: { en: 'Your prediction matches. Now watch why.', zh: '预测对了。来看看为什么。' },
  not_yet: { en: 'Not yet - try again.', zh: '还不对，再试一次。' },
  predict_miss: { en: "Interesting bet - let's see what really happens.", zh: '有意思的猜测——来看看实际会怎样。' },
  not_this_time: { en: 'Not this time.', zh: '这次没答对。' },
  answer_is: { en: 'Answer: {a}', zh: '答案：{a}' },
  your_sketch: { en: 'your sketch', zh: '你画的' },
  real_graph: { en: 'the real graph', zh: '真实的图像' },
  your_answer: { en: 'Your answer', zh: '你的答案' },
  type_expression: { en: 'Type an expression', zh: '输入一个表达式' },
  answer_label: { en: 'Answer', zh: '答案' },
  answer_in: { en: 'Answer in {unit}. ', zh: '单位：{unit}。' },
  number_help: { en: 'You can type a number or a calculation, like <code>3.14*6^2</code> or <code>sqrt(144)</code>.', zh: '可以输入数字，也可以输入算式，例如 <code>3.14*6^2</code> 或 <code>sqrt(144)</code>。' },
  expr_help: { en: 'Use <code>^</code> for powers, <code>sqrt()</code>, <code>pi</code>; <code>2x</code> means 2·x.', zh: '用 <code>^</code> 表示乘方，<code>sqrt()</code> 开方，<code>pi</code> 表示 π；<code>2x</code> 就是 2·x。' },
  draw_here: { en: 'Draw here: press and sweep from left to right', zh: '在这里画：按住并从左往右划' },
  click_here: { en: 'Click where you think it is', zh: '点在你认为的位置' },
  draw_prediction: { en: 'Draw your prediction', zh: '画出你的预测' },
  mark_prediction: { en: 'Mark your prediction', zh: '标出你的预测' },
  sketch_help: { en: 'Press on the shaded area of the figure and draw one stroke from left to right. Draw again to replace it.', zh: '在图中阴影区域按住，从左往右画一笔。再画一次会替换上一笔。' },
  point_help: { en: 'Click on the figure.', zh: '在图上点一下。' },
  redraw: { en: 'Redraw', zh: '重画' },
  how_sure: { en: 'How sure are you?', zh: '你有多确定？' },
  guessing: { en: 'Guessing', zh: '猜的' },
  fairly: { en: 'Fairly', zh: '比较确定' },
  certain: { en: 'Certain', zh: '很确定' },
  commit: { en: 'Commit prediction', zh: '提交预测' },
  check: { en: 'Check', zh: '检查' },
  show_answer: { en: 'Show answer', zh: '显示答案' },
  answer_first: { en: 'Answer first.', zh: '请先作答。' },
  pick_sure: { en: 'Pick how sure you are.', zh: '请先选一下你有多确定。' },
  // ---- mastery and the end of a lesson
  mastery: { en: 'Mastery', zh: '掌握程度' },
  items_due: { en: '{n} item{s} due for review', zh: '{n} 项待复习' },
  summary: { en: '**Lesson complete.** {c} of {a} answers correct, {h} hint{hs} used, {t} spent.', zh: '**本课完成。** 答对 {c}/{a} 题，用了 {h} 次提示，用时 {t}。' },
  ideas_worked: { en: 'Ideas we worked on:', zh: '这次练到的想法：' },
  review_later_n: { en: '{n} question{s} will come back for review - spacing them out makes them stick.', zh: '有 {n} 道题会在之后回来复习——隔一段时间再练，记得更牢。' },
  review_later: { en: 'Questions you answered will come back for a quick review in a day or two.', zh: '你答过的题会在一两天后回来，快速复习一下。' },
  back_to_lessons: { en: 'Back to lessons', zh: '返回课程' },
  start_again: { en: 'Start again', zh: '从头再来' },
  lesson_complete: { en: 'Lesson complete!', zh: '本课完成！' },
  stars_of: { en: '/ {max} stars', zh: '/ {max} 颗星' },
  ideas_you_worked: { en: 'Ideas you worked on: {list}', zh: '你练到的想法：{list}' },
  no_tricky: { en: 'No tricky ideas came up - well played.', zh: '没有出现容易混淆的想法——玩得漂亮。' },
  only_english: { en: 'English only', zh: '本课只有英文版' },
  // ---- cases and free-text answers
  case_label: { en: 'Case', zh: '案例' },
  case_brief: { en: 'The case', zh: '案例背景' },
  question_k_of_n: { en: 'Question {k} of {n}', zh: '第 {k} 题，共 {n} 题' },
  text_placeholder: { en: 'Write your answer in a few sentences…', zh: '用几句话写下你的回答……' },
  text_help: { en: 'Explain in your own words; the key ideas count, not the exact wording. Ctrl+Enter checks.', zh: '用自己的话解释；看的是要点，不是措辞。Ctrl+Enter 提交。' },
  checking: { en: 'Checking your answer…', zh: '正在批改……' },
  self_title: { en: 'Compare with a model answer', zh: '和参考答案对照一下' },
  self_tick: { en: 'Tick the key points your answer made:', zh: '勾选你的回答讲到了的要点：' },
  self_done: { en: 'Done', zh: '对照完了' },
  self_offline: { en: 'No AI grader is available, so you check your own answer.', zh: '现在没有可用的 AI 批改，请你自己对照。' },
  points_got: { en: '{k} of {n} key points', zh: '讲到 {k}/{n} 个要点' },
  text_good: { en: 'Your answer makes the key points.', zh: '你的回答讲到了要点。' },
  text_missed: { en: 'Your answer makes {k} of {n} key points - compare with the model answer for the rest.', zh: '你的回答讲到了 {k}/{n} 个要点——其余的对照参考答案看看。' },
  key_points: { en: 'Key points', zh: '要点' },
  model_answer: { en: 'Model answer', zh: '参考答案' },
  // ---- text pages
  on_this_page: { en: 'On this page', zh: '本页内容' },
  min_read: { en: '{n} min read', zh: '约 {n} 分钟读完' },
  next_step: { en: 'Next step', zh: '下一步' },
  show_all: { en: 'Show all steps', zh: '显示全部步骤' },
  why: { en: 'Why?', zh: '为什么？' },
  why_hide: { en: 'Hide why', zh: '收起' },
  step_k_of_n: { en: 'Step {k} of {n}', zh: '第 {k} 步，共 {n} 步' },
  derive_help: { en: 'Reveal one line at a time. Before each step, try to say what comes next and why.', zh: '一次展开一行。每一步之前，先试着说出下一行是什么、为什么。' },
  derive_done: { en: 'Derivation complete.', zh: '推导完成。' },
  blank_prompt: { en: 'Your turn: write this line yourself.', zh: '轮到你：自己写出这一行。' },
  blank_help: { en: 'Type it as an expression: <code>^</code> for powers, <code>sqrt()</code>, <code>log()</code>, <code>exp()</code>, and the names used above.', zh: '按表达式输入：<code>^</code> 表示乘方，可用 <code>sqrt()</code>、<code>log()</code>、<code>exp()</code>，变量名照上面公式里的写。' },
  blank_answer: { en: 'Your line', zh: '你写的这一行' },
  show_me: { en: 'Show me', zh: '直接看答案' },
  blank_right: { en: "Right - that's the line.", zh: '对，就是这一行。' },
  blank_wrong: { en: 'Not quite - compare with the line above and try again.', zh: '还不对——对照上一行，再试一次。' },
  blank_shown: { en: 'Here it is. Open "Why?" to see how it follows, then go on.', zh: '答案在这里。点开"为什么？"看它怎么得来，再继续。' },
  blank_pending: { en: 'Write the missing line (or ask to see it) to go on.', zh: '写出空缺的这一行（或直接看答案）才能继续推导。' },
  copy: { en: 'Copy', zh: '复制' },
  copied: { en: 'Copied', zh: '已复制' },
  copy_failed: { en: 'Select the code to copy it', zh: '请手动选中代码复制' },
  sources: { en: 'Sources', zh: '参考资料' },
  callout_note: { en: 'Note', zh: '说明' },
  callout_warning: { en: 'Watch out', zh: '注意' },
  callout_misconception: { en: 'Common misconception', zh: '常见误区' },
  callout_open: { en: 'Open question', zh: '开放问题' },
  lines_range: { en: 'lines {a}–{b}', zh: '第 {a}–{b} 行' },
  line_one: { en: 'line {a}', zh: '第 {a} 行' },
  code_help: { en: 'Click a note (or use ↑ ↓) to highlight its lines.', zh: '点一条讲解（或用 ↑ ↓ 键），对应的代码行会高亮。' },
  shapes: { en: 'Shapes', zh: '张量形状' },
  visual_play: { en: 'Play', zh: '播放' },
  visual_explore: { en: '<b>Your turn:</b> drag the glowing handle to explore.', zh: '<b>轮到你：</b>拖动发光的手柄来探索。' },
  visual_missing: { en: 'This figure ({name}) cannot be shown here.', zh: '这里无法显示这幅图（{name}）。' },
  source_credit: { en: 'Source: {c}', zh: '出处：{c}' },
  figure_missing: { en: 'Image not found: {src}', zh: '找不到图片：{src}' },
};

/** Add or override entries (the app's own strings). */
export function define_ui(entries: Record<string, Entry>): void {
  Object.assign(DICT, entries);
}
/** The UI string `key` in the current (or given) language, with {name} filled from `vars`; unknown keys are returned as they are. */
export function t(key: string, vars?: Record<string, string | number>, l: Lang = lang): string {
  const e = DICT[key];
  const s = e ? tr(e, l) : key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}
/** English plural suffix: '' for 1, else 's'. */
export const plural_s = (n: number): string => (n === 1 ? '' : 's');
/** Does the dictionary have an entry for every key in both languages? (tests) */
export function ui_entries(): Record<string, Entry> {
  return { ...DICT };
}

/**
 * The template for the "drag me" pill of AffordanceLayer (manim-web): English as
 * before; in Chinese the handle's name is used when it is Chinese, else a plain
 * 拖动这里 (an English name, or none, would read as "拖动the tip of…" / "拖动me").
 */
export function drag_hint(handles: readonly { spec: { label?: string } }[], l: Lang = lang): string {
  if (l === 'en') return t('drag_hint', undefined, 'en');
  const named = handles.length > 0 && handles.every((h) => !!h.spec.label && /[\u3400-\u9fff]/.test(h.spec.label));
  return t(named ? 'drag_hint' : 'drag_hint_plain', undefined, l);
}
