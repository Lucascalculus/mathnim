// A generated lesson's plan (server only: ops.ts): its steps, scenes briefed for the animator.
import type { SyllabusEntry } from '../generate';

export const LESSON_PLAN_RULES = `You design short interactive math lessons that follow predict -> observe -> explain.
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
