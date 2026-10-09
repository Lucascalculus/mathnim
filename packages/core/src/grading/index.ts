// One entry point for grading any question type. Feedback comes back in the
// learner's language (authored feedback is L10n; the grader's own messages
// are below).
import { tr, type L10n, type Lang } from '../content';
import type { Grade, Question, Response, Vars } from '../schema';
import { equivalent, evaluate, form, parse, parse_error_text, ParseError, to_string } from './expr';
import { grade_sketch } from './sketch';

const num = (x: number) => String(+x.toPrecision(6));

/** The grader's own messages. */
const MSG = {
  pick: { en: 'Pick one of the options.', zh: '请选择一个选项。' },
  unreadable: { en: 'I could not read that: {why}.', zh: '这个输入我看不懂：{why}。' },
  unreadable_plain: { en: 'I could not read that.', zh: '这个输入我看不懂。' },
  enter_number: { en: 'Enter a number.', zh: '请输入一个数。' },
  too_big: { en: 'Too big.', zh: '大了。' },
  too_small: { en: 'Too small.', zh: '小了。' },
  close: { en: 'Close - check your rounding.', zh: '很接近了，检查一下四舍五入。' },
  form: { en: 'Right value - now write it in {form} form.', zh: '值是对的，请写成{form}形式。' },
  factored: { en: 'factored', zh: '因式分解' },
  expanded: { en: 'expanded', zh: '展开' },
  exact: { en: 'exact (no decimals)', zh: '精确（不用小数）' },
  unexpected: { en: 'Unexpected kind of answer.', zh: '答案的类型不对。' },
} satisfies Record<string, L10n>;
const say = (m: L10n, lang: Lang, vars: Record<string, string> = {}) => tr(m, lang).replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
const fb = (f: L10n | undefined, lang: Lang) => (f === undefined ? [] : [tr(f, lang)]);

export function grade(q: Question, r: Response, vars: Vars = {}, lang: Lang = 'en'): Grade {
  switch (q.type) {
    case 'choice': {
      if (r.type !== 'choice') break;
      const opt = q.options.find((o) => o.id === r.option);
      const right = q.options.find((o) => o.correct);
      if (!opt) return { correct: false, score: 0, feedback: [say(MSG.pick, lang)] };
      return {
        correct: !!opt.correct, score: opt.correct ? 1 : 0, misconception: opt.misconception,
        feedback: fb(opt.feedback, lang), expected: right ? tr(right.label, lang) : undefined,
      };
    }
    case 'number': {
      if (r.type !== 'number' && r.type !== 'expression') break;
      const answer = typeof q.answer === 'function' ? q.answer(vars) : q.answer;
      let value: number;
      try {
        const raw = r.type === 'number' ? r.value : r.text;
        value = typeof raw === 'number' ? raw : evalNumber(raw);
      } catch (e) {
        return { correct: false, score: 0, feedback: [e instanceof ParseError ? say(MSG.unreadable, lang, { why: parse_error_text(e, lang) }) : say(MSG.enter_number, lang)] };
      }
      const tol = q.tolerance ?? 0, rtol = q.rtol ?? 1e-6;
      const ok = Math.abs(value - answer) <= tol + rtol * Math.abs(answer);
      if (ok) return { correct: true, score: 1, feedback: [], expected: num(answer) };
      for (const w of q.wrong ?? []) {
        const wa = typeof w.answer === 'function' ? w.answer(vars) : w.answer;
        if (Math.abs(value - wa) > tol + rtol * Math.abs(wa)) continue;
        return { correct: false, score: 0, misconception: w.misconception, feedback: fb(w.feedback, lang), expected: num(answer) };
      }
      const off = say(value > answer ? MSG.too_big : MSG.too_small, lang);
      return { correct: false, score: 0, feedback: Math.abs(value - answer) < Math.abs(answer) * 0.1 + tol * 3 ? [say(MSG.close, lang)] : [off], expected: num(answer) };
    }
    case 'expression': {
      if (r.type !== 'expression') break;
      const answer = typeof q.answer === 'function' ? q.answer(vars) : q.answer;
      const opts = { ranges: q.ranges ?? Object.fromEntries((q.variables ?? []).map((v) => [v, [0.5, 4] as [number, number]])) };
      let node;
      try {
        node = parse(r.text, q.variables ?? []);
      } catch (e) {
        return { correct: false, score: 0, feedback: [e instanceof ParseError ? say(MSG.unreadable, lang, { why: parse_error_text(e, lang) }) : say(MSG.unreadable_plain, lang)] };
      }
      const expected = to_string(parse(answer, q.variables ?? []));
      if (equivalent(node, answer, opts)) {
        if (q.form && !form[q.form](node)) {
          return { correct: false, score: 0.5, feedback: [say(MSG.form, lang, { form: say(MSG[q.form], lang) })], expected };
        }
        return { correct: true, score: 1, feedback: [], expected };
      }
      for (const w of q.wrong ?? []) if (equivalent(node, typeof w.answer === 'function' ? w.answer(vars) : w.answer, opts)) {
        return { correct: false, score: 0, misconception: w.misconception, feedback: fb(w.feedback, lang), expected };
      }
      return { correct: false, score: 0, feedback: [], expected };
    }
    case 'sketch': {
      if (r.type !== 'sketch') break;
      const s = grade_sketch(r.points, { f: (x) => q.f(x, vars), x_range: q.x_range, y_range: q.y_range }, { pass: q.pass });
      return { correct: s.correct, score: s.score, feedback: s.feedback };
    }
    case 'point': {
      if (r.type !== 'point') break;
      const a = typeof q.answer === 'function' ? q.answer(vars) : q.answer;
      const d = Math.hypot(r.point[0] - a[0], r.point[1] - a[1]);
      return { correct: d <= q.tolerance, score: d <= q.tolerance ? 1 : Math.max(0, 1 - d / (4 * q.tolerance)), feedback: [], expected: `(${num(a[0])}, ${num(a[1])})` };
    }
    case 'text': {
      if (r.type !== 'text') break;
      // the key points were marked by the AI grader or ticked by the learner (self-assessment)
      const n = q.rubric.key_points.length;
      const points = q.rubric.key_points.map((_, i) => !!r.hits?.[i]);
      const got = points.filter(Boolean).length;
      const need = Math.max(1, Math.min(n, q.rubric.min_points ?? n));
      const correct = n ? got >= need : !!r.text.trim();
      return { correct, score: n ? got / n : correct ? 1 : 0, feedback: r.feedback ? [r.feedback] : [], expected: tr(q.rubric.model_answer, lang), points };
    }
  }
  return { correct: false, score: 0, feedback: [say(MSG.unexpected, lang)] };
}

const evalNumber = (text: string): number => evaluate(parse(text));

/** The correct answer in readable form (null for sketches). */
export function expected_answer(q: Question, vars: Vars = {}, lang: Lang = 'en'): string | null {
  switch (q.type) {
    case 'choice': {
      const right = q.options.find((o) => o.correct);
      return right ? tr(right.label, lang) : null;
    }
    case 'number': return num(typeof q.answer === 'function' ? q.answer(vars) : q.answer) + (q.unit ? ` ${tr(q.unit, lang)}` : '');
    case 'expression': return to_string(parse(typeof q.answer === 'function' ? q.answer(vars) : q.answer, q.variables ?? []));
    case 'point': {
      const a = typeof q.answer === 'function' ? q.answer(vars) : q.answer;
      return `(${num(a[0])}, ${num(a[1])})`;
    }
    case 'sketch': return null;
    case 'text': return tr(q.rubric.model_answer, lang);
  }
}
