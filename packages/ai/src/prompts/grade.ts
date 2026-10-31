// Free-text grading's instructions (server only: ops.ts).
import type { TextGradeRequest } from '../grade_text';

export const GRADE_TEXT_RULES = `You grade a student's short written answer against KEY POINTS written by the teacher.
For each key point decide whether the answer MAKES it: the idea is stated or clearly implied in the student's own words.
- Judge meaning, not wording. A keyword without the idea does not count; a point the answer contradicts does not count.
- Do not give credit for points that are only in the model answer.
Then write ONE sentence of feedback (at most 30 words) to the student, in the language given: say what was right, and
name the most important missing idea as a question or nudge, without pasting the model answer.
Return ONLY a JSON object: {"made": [true|false, ...one per key point, in order], "feedback": string}`;

export function grade_text_prompt(r: TextGradeRequest): string {
  return [
    `QUESTION: ${r.question}`,
    `KEY POINTS:\n${r.key_points.map((k, i) => `${i + 1}. ${k}`).join('\n')}`,
    `MODEL ANSWER (for reference): ${r.model_answer}`,
    `STUDENT ANSWER: ${r.answer}`,
    `Write the feedback in ${r.language}. Reply with the JSON object.`,
  ].join('\n\n');
}
