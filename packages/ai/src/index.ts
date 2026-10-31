// @mathnim/ai - answer questions with explanations and validated manim-web scenes.
// The prompts are not exported: they are the server's (ops.ts, prompts/), and pages reach them through a Backend
// (backend.ts). Tools and tests that run the operations themselves import local_backend.ts.
export { AnthropicProvider, MockProvider, OpenAICompatibleProvider, read_usage, type OpenAICompatibleOptions, type Provider, type CompletionRequest, type Message, type Reasoning, type Usage } from './provider';
export { ServerBackend, RecordedBackend } from './backend';
export type { Backend, OpInputs, OpName, Round, RunOptions } from './ops_types';
export { ask, parse_answer, type AskResult, type AskStatus, type AnswerJSON } from './pipeline';
export type { AskContext, ScenePromptExtra } from './prompt';
export { explain, split_reply, type Explanation, type StudentContext } from './tutor';
export { plan_visual, parse_visual_plan, check_visual_plan, decide, offer, relevance, catalog_text, load_visual, type VisualPlan, type PlanCheck, type PlanResult, type PlanOptions, type PictureRoute } from './visual_plan';
export { grade_text, parse_text_grade, type TextGradeRequest, type TextGradeResult } from './grade_text';
export { worker_validator, type Validator, type ValidationResult } from './sandbox';
export { compile_answer, load_answer, run_checks, type AnswerModule } from './run';
export { RECORDED, recorded_question, recorded_responses, type RecordedAnswer } from './recorded';
export { RECORDED_TEXT, recorded_text_answers, type RecordedText } from './recorded_text';
export { AskPanel, draw_saved, type AskPanelOptions, type SavedPicture, type VisualAnswer } from './ui/ask_panel';
export { fit_into_text, propose_page, write_page, check_page, type PageAsk, type PageProposal, type WrittenPage } from './page_gen';
export { C as PALETTE } from './palette';
export { apply_white } from './theme';
export { generate_lesson, lesson_from_generated, parse_plan, type SyllabusEntry, type LessonPlan, type GeneratedLesson, type GenerateStatus, type PlanStep } from './generate';
export { INSCRIBED_ENTRY, INSCRIBED_PLAN, recorded_lesson_plans, recorded_lesson_responses } from './recorded_lessons';
