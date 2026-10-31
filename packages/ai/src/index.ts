// @mathnim/ai - answer questions with explanations and validated manim-web scenes.
export { AnthropicProvider, MockProvider, OpenAICompatibleProvider, read_usage, type OpenAICompatibleOptions, type Provider, type CompletionRequest, type Message, type Reasoning, type Usage } from './provider';
export { ask, parse_answer, type AskResult, type AskStatus, type AnswerJSON } from './pipeline';
export { system_prompt, user_prompt, type AskContext, type ScenePromptExtra } from './prompt';
export { explain, split_reply, tutor_prompt, context_block, TUTOR_RULES, type Explanation, type StudentContext } from './tutor';
export { plan_visual, parse_visual_plan, check_visual_plan, plan_repair_message, decide, offer, relevance, catalog_text, plan_system, plan_user, answer_language, load_visual, PLAN_RULES, type VisualPlan, type PlanCheck, type PlanResult, type PlanOptions, type PictureRoute } from './visual_plan';
export { grade_text, grade_text_prompt, parse_text_grade, GRADE_TEXT_RULES, type TextGradeRequest, type TextGradeResult } from './grade_text';
export { worker_validator, type Validator, type ValidationResult } from './sandbox';
export { compile_answer, load_answer, run_checks, type AnswerModule } from './run';
export { RECORDED, recorded_question, recorded_responses, type RecordedAnswer } from './recorded';
export { RECORDED_TEXT, recorded_text_answers, type RecordedText } from './recorded_text';
export { AskPanel, draw_saved, type AskPanelOptions, type SavedPicture, type VisualAnswer } from './ui/ask_panel';
export { propose_page, write_page, check_page, type PageAsk, type PageProposal, type WrittenPage } from './page_gen';
export { C as PALETTE } from './palette';
export { apply_white } from './theme';
export { generate_lesson, lesson_from_generated, plan_prompt, parse_plan, type SyllabusEntry, type LessonPlan, type GeneratedLesson, type GenerateStatus, type PlanStep } from './generate';
export { INSCRIBED_ENTRY, INSCRIBED_PLAN, recorded_lesson_responses } from './recorded_lessons';
