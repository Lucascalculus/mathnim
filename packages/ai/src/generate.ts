// Syllabus entry -> complete lesson: plan the steps (predict, watch, practise),
// then generate and validate each scene with the same pipeline as questions.
import type { CheckpointStep, Lesson, Misconception, Question, SceneStep, Skill, Step } from '@mathnim/core';
import { ask, type AskStatus } from './pipeline';
import type { Provider } from './provider';
import { compile_answer } from './run';
import type { Validator } from './sandbox';

export interface SyllabusEntry {
  id: string;
  title: string;
  unit?: string;
  objectives: string[];
  level?: string;
  prerequisites?: string[];
}
export type PlanStep =
  | { kind: 'scene'; id: string; chapter?: string; title?: string; narration: string; brief: string }
  | {
      kind: 'checkpoint'; id: string; chapter?: string; skill: string; purpose: 'predict' | 'practice' | 'check'; prompt: string;
      question: Question; hints?: string[]; explain?: string; reveal?: string; confidence?: boolean;
    };
export interface LessonPlan {
  title: string;
  description?: string;
  skills: Skill[];
  misconceptions?: Misconception[];
  steps: PlanStep[];
}
/** What gets cached: the plan plus the validated code of every scene. */
export interface GeneratedLesson {
  entry: SyllabusEntry;
  plan: LessonPlan;
  codes: Record<string, string>;
  verified: Record<string, boolean>;
}

export const PLAN_RULES = `You design short interactive math lessons that follow predict -> observe -> explain.
Return ONLY a JSON object:
{"title": string, "description": string,
 "skills": [{"id": string, "name": string}],
 "misconceptions": [{"id": string, "description": string, "remediation": string?}],   // remediation = id of a scene step marked for it
 "steps": [ ... 5 to 9 steps ... ]}
Step kinds:
{"kind": "scene", "id": string, "chapter": string?, "title": string, "narration": string (1-2 sentences, spoken),
 "brief": string (precise instructions for the animator: what to draw, where, what moves, which numbers appear; 8-25 s)}
{"kind": "checkpoint", "id": string, "chapter": string?, "skill": string, "purpose": "predict"|"practice"|"check",
 "prompt": string (inline TeX as $...$), "question": Q, "hints": [string, string]?, "explain": string?, "reveal": string? (scene id to play after), "confidence": boolean?}
Q is one of:
{"type": "choice", "options": [{"id": string, "label": string, "correct": true?, "misconception": string?, "feedback": string?}]}
{"type": "number", "answer": number, "tolerance": number, "unit": string?}
{"type": "expression", "answer": string (e.g. "sqrt(a*b)"), "variables": [string]}
Rules:
- Open with a concrete situation, then a PREDICT checkpoint before the key idea is shown (its reveal is the scene that shows it).
- Every wrong choice option names the misconception it reveals. Include at least one practice question with a number or expression answer.
- Hints form a ladder: nudge, then strategy, then a worked step.
- Scenes build on each other: keep one figure placement throughout; describe it in each brief.
- Write for the given level; use the objectives in order; no step without purpose.`;

export function plan_prompt(e: SyllabusEntry): string {
  return `LESSON: ${e.title}${e.unit ? ` (unit: ${e.unit})` : ''}\nLEVEL: ${e.level ?? 'secondary school'}\nOBJECTIVES:\n${e.objectives.map((o) => `- ${o}`).join('\n')}${e.prerequisites?.length ? `\nPREREQUISITES: ${e.prerequisites.join(', ')}` : ''}`;
}

export type GenerateStatus = { phase: 'planning' } | { phase: 'scene'; index: number; total: number; title: string; inner: AskStatus } | { phase: 'done' };

export async function generate_lesson(entry: SyllabusEntry, o: { provider: Provider; validate: Validator; on_status?: (s: GenerateStatus) => void; signal?: AbortSignal }): Promise<GeneratedLesson> {
  o.on_status?.({ phase: 'planning' });
  const reply = await o.provider.complete({ system: PLAN_RULES, messages: [{ role: 'user', content: plan_prompt(entry) }], max_tokens: 6000 }, o.signal);
  const plan = parse_plan(reply);
  const scenes = plan.steps.filter((s): s is Extract<PlanStep, { kind: 'scene' }> => s.kind === 'scene');
  const codes: Record<string, string> = {}, verified: Record<string, boolean> = {};
  let previous = '';
  for (const [i, s] of scenes.entries()) {
    const r = await ask(`${s.title ?? s.id}: ${s.brief}`, {
      provider: o.provider, validate: o.validate, signal: o.signal,
      context: { lesson: `${plan.title} - ${entry.objectives.join('; ')}`, level: entry.level, on_screen: previous ? `Previous scene: ${previous}` : undefined },
      on_status: (inner) => o.on_status?.({ phase: 'scene', index: i, total: scenes.length, title: s.title ?? s.id, inner }),
    });
    codes[s.id] = r.code;
    verified[s.id] = r.verified;
    previous = s.brief;
  }
  o.on_status?.({ phase: 'done' });
  return { entry, plan, codes, verified };
}

export function parse_plan(text: string): LessonPlan {
  const obj = parse_answer_like(text);
  if (!Array.isArray(obj.steps) || !obj.steps.length) throw new Error('The plan has no steps.');
  return obj as LessonPlan;
}
function parse_answer_like(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    return JSON.parse(text.slice(s, e + 1));
  }
}

/** Turn a generated lesson (plan + code) into a playable Lesson. */
export function lesson_from_generated(g: GeneratedLesson): Lesson {
  const steps: Step[] = g.plan.steps.map((s): Step => {
    if (s.kind === 'scene') {
      const code = g.codes[s.id];
      const step: SceneStep = { id: s.id, kind: 'scene', chapter: s.chapter, title: s.title, narration: s.narration, scene: code ? compile_answer(code).Answer : placeholder(s.brief) };
      const isRemediation = g.plan.misconceptions?.some((m) => m.remediation === s.id) || g.plan.steps.some((c) => c.kind === 'checkpoint' && c.reveal === s.id);
      if (isRemediation) step.branch_only = true;
      return step;
    }
    const c: CheckpointStep = { ...s, kind: 'checkpoint' };
    return c;
  });
  return { id: g.entry.id, title: g.plan.title, description: g.plan.description, skills: g.plan.skills, misconceptions: g.plan.misconceptions, steps };
}
function placeholder(brief: string): any {
  return compile_answer(`class Answer extends Scene { construct() { this.add(Text(${JSON.stringify(brief.slice(0, 60) + '…')}, { font_size: 26, color: C.muted })); this.wait(1); } }`).Answer;
}
