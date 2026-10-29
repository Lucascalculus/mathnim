// The syllabus: units of lessons. Authored lessons are code; the others are
// syllabus entries that the AI turns into lessons on demand (cached locally).
// Titles and summaries are L10n (plain strings are the same in every language).
import { INSCRIBED_ENTRY, lesson_from_generated, type GeneratedLesson, type SyllabusEntry } from '@mathnim/ai';
import { lesson_langs, tr } from '@mathnim/core';
import type { L10n, Lang, Lesson, Skill } from '@mathnim/core';
import { lesson as bestAngle } from './lessons/best-angle/lesson';
import { lesson as pizza } from './lessons/pizza/lesson';
import { lesson as pizzaGame } from './lessons/pizza-game/lesson';
import { lesson as eigenPca } from './lessons/eigen-pca/lesson';
import { lesson as textDemo } from './lessons/text-pages-demo/lesson';
import { labs_of, type LabMeta } from './labs';
// the fine-tuning and MPC courses are data until a lesson is opened (npm run manifest -w mathnim regenerates them)
import { LOADERS as FT_LOADERS, MANIFEST as FT_MANIFEST } from './lessons/ft/manifest.generated';
import { LOADERS as MPC_LOADERS, MANIFEST as MPC_MANIFEST } from './lessons/mpc/manifest.generated';

export interface CourseLesson {
  id: string;
  title: L10n;
  summary: L10n;
  /** Hand-authored lesson, or a syllabus entry to generate. */
  lesson?: Lesson;
  entry?: SyllabusEntry;
  minutes: number;
  /** Who it is for, e.g. 'grades 7-9' (generated lessons use their syllabus entry's level). */
  level?: L10n;
  /** Step whose figure (final frame) is the card thumbnail; default: the first step with a figure. */
  thumb?: string;
  /** A lesson loaded on demand (its code is a separate chunk): ensure_lesson() loads it and sets `lesson`. */
  load?: () => Promise<Lesson>;
  /** What the course map, the learner model and the review page need before the lesson is loaded. */
  meta?: LessonMeta;
}
/** A lesson as data (made from the real lesson by tools/course_manifest.ts). */
export interface LessonMeta {
  title: L10n;
  mode: 'essay' | 'game';
  langs: Lang[];
  has_scene: boolean;
  kinds: string[];
  skills: Skill[];
  checkpoints: number;
}
/** A course whose lessons load on demand, as data (src/lessons/<course>/manifest.generated.ts). */
export interface CourseManifest {
  units: { id: string; title: L10n; lessons: Pick<CourseLesson, 'id' | 'title' | 'summary' | 'minutes' | 'level' | 'thumb'>[] }[];
  lessons: Record<string, LessonMeta>;
}
export interface Unit {
  id: string;
  title: L10n;
  lessons: CourseLesson[];
  /** Not shown on the course page (its lessons still open by their address), e.g. platform demos. */
  hidden?: boolean;
}

/** A hands-on tutorial of a course: its card data (src/labs) and the lesson to finish first. */
export interface Lab extends LabMeta {
  /** The lesson after which the lab is suggested (its end card offers the lab). */
  after?: string;
}
/** The recommended setups of a lab in a few words ("推荐 A100 · 也可用 T4"); no single fixed environment is shown. */
export const lab_setups = (l: LabMeta, lang: Lang): string => (l.configs_summary ? tr(l.configs_summary, lang) : '');
/** What a learner should know before a course, and where to learn it. */
export interface Prerequisites {
  /** One or two lines. */
  summary: L10n;
  /** Starter material: a URL per language where it differs. */
  links: { title: L10n; url: L10n; note?: L10n }[];
}
export interface Course {
  id: string;
  /** Its address: /<slug>, and /<slug>/<lesson-id> for its lessons. */
  slug: string;
  title: L10n;
  /** One line on the course card and the course page. */
  summary?: L10n;
  /** Who it is for (shown on the course page; its English is told to the AI tutor). */
  audience?: L10n;
  /** "学完你能": what the learner can do afterwards (about three). */
  outcomes?: L10n[];
  /** The course's short name, which its unit titles may start with ("微调 A · …"); a course page leaves it out. */
  short?: L10n;
  /** What to know first, with starter links (shown under the audience line). */
  prerequisites?: Prerequisites;
  /**
   * The course page's moving cover: its most telling animation plays once when the page opens and rests on its
   * last frame (click to replay). `pack` loads the visual's code for a course whose lessons load on demand;
   * `feature` (a still of it) shows until it is ready, and instead of it for reduced motion.
   */
  cover_motion?: { visual: string; params?: Record<string, unknown>; pack?: () => Promise<unknown>; rate?: number };
  /** Where the course sits on the home page ("中学数学", "大学与工程"); courses with the same category are listed together. */
  category?: L10n;
  /** When set, only these lessons are shown (a course published in batches); the rest stay reachable by address and checked by the tools. */
  published?: string[];
  /** The cover: a lesson id (its thumbnail) or an image under public/ ('{lang}' replaced by en / zh; default: the first lesson's thumbnail). */
  cover?: string;
  /** A picture beside the course page's header: an image under public/, '{lang}' replaced by en / zh. */
  feature?: string;
  /** One colour of the light palette for the course's accents. */
  accent?: string;
  /** Shown first to a first-time visitor. */
  featured?: boolean;
  /** Questions offered by the course's ask panel. */
  suggestions?: L10n[];
  /** Hands-on tutorials ("动手实验"). */
  labs?: Lab[];
  /** Not listed on the home page yet (being built); its pages still open by their address. */
  hidden?: boolean;
  /** Made by the model from uploaded slides in one pass, with no person editing it (pages/studio.ts): what from. */
  generated?: { decks: number; exams: number; lessons: number };
  units: Unit[];
}

/** A lazily loaded course's units: the cards from its manifest, each lesson loaded when opened. */
const lazy_units = (m: CourseManifest, loaders: Record<string, () => Promise<Lesson>>): Unit[] =>
  m.units.map((u) => ({ id: u.id, title: u.title, lessons: u.lessons.map((cl) => ({ ...cl, meta: m.lessons[cl.id], load: loaders[cl.id] })) }));
/**
 * A course's labs, each with the lesson it follows. `after` maps a lab id to a lesson
 * code ("C2", "M5", see lesson_code); the lesson is looked up in the course's units.
 */
function course_labs(course: string, units: Unit[], after: Record<string, string>): Lab[] {
  const lessons = units.flatMap((u) => u.lessons);
  return labs_of(course).map((l) => ({ ...l, after: lessons.find((cl) => lesson_code(cl.id) === after[l.id])?.id }));
}

export const MATH_COURSE: Course = {
  id: 'math',
  // a circle cut into slices and laid out as a rectangle: the area formula, seen
  cover_motion: { visual: 'circle_slices', params: {} },
  category: { en: 'Secondary-school math', zh: '中学数学' },
  slug: 'geometry',
  title: { en: 'Geometry through motion', zh: '在运动中学几何' },
  audience: { en: 'Secondary school, and a first-year linear algebra chapter', zh: '中学生；另有一章大学一年级线性代数' },
  outcomes: [
    { en: 'See why a circle’s area is πr², and use it', zh: '看懂圆面积为什么是 πr²，并会用它' },
    { en: 'Find angles and best viewpoints with circle theorems', zh: '用圆的定理找角度和最佳视角' },
    { en: 'Read a matrix as a motion, and eigenvectors as the directions it keeps', zh: '把矩阵看成一种运动，把特征向量看成它不改变的方向' },
  ],
  accent: '#2563EB',
  // (for the user to check: the line and the two links)
  prerequisites: {
    summary: { en: 'For secondary-school students (the last chapter is first-year linear algebra): middle-school algebra and geometry are enough, that is equations, similar triangles and Pythagoras.', zh: '写给中学生（最后一章是大学一年级的线性代数）：会初中代数和几何就够了，比如解方程、相似三角形、勾股定理。' },
    links: [
      { title: { en: 'Khan Academy: Algebra basics', zh: '可汗学院：代数基础' }, url: 'https://www.khanacademy.org/math/algebra-basics' },
      { title: { en: 'Khan Academy: Geometry', zh: '可汗学院：几何' }, url: 'https://www.khanacademy.org/math/geometry' },
    ],
  },
  summary: { en: 'Circle area, angles in circles, eigenvectors', zh: '圆的面积、圆与角、特征向量' },
  units: [
    {
      id: 'area', title: { en: 'Circles and area', zh: '圆与面积' },
      lessons: [
        { id: pizzaGame.id, title: { en: 'Pizza shop (game layout test)', zh: '披萨店（游戏版式测试）' }, summary: 'A game: bet on the deal, cover, cut and rebuild the pizza, run the shop - and find out why a circle’s area is πr².', lesson: pizzaGame, minutes: 15, level: 'grades 7-9', thumb: 'bet' },
        { id: pizza.id, title: { en: 'Pizza shop (video legacy)', zh: '披萨店（视频旧版）' }, summary: 'One 16-inch pizza or two 8-inch ones? Slice a circle into a rectangle and see why its area is πr².', lesson: pizza, minutes: 15, level: 'grades 7-9' },
      ],
    },
    {
      id: 'linalg', title: { en: 'Linear algebra (university)', zh: '线性代数（大学）' },
      lessons: [
        { id: eigenPca.id, title: { en: 'Eigenvectors and eigenvalues', zh: '特征向量与特征值' }, summary: 'Eigenvectors and eigenvalues from the picture up - hold the matrix in your hands - and why they are exactly what PCA needs.', lesson: eigenPca, minutes: 20, level: 'university, first-year linear algebra', thumb: 'why' },
      ],
    },
    {
      id: 'circles', title: { en: 'Angles and circles', zh: '角与圆' },
      lessons: [
        { id: INSCRIBED_ENTRY.id, title: INSCRIBED_ENTRY.title, summary: 'Why every point on an arc sees a chord at the same angle.', entry: INSCRIBED_ENTRY, minutes: 8 },
        { id: bestAngle.id, title: bestAngle.title, summary: 'A winger runs in: where is the goal widest? Circles give the answer.', lesson: bestAngle, minutes: 15, thumb: 'explore', level: 'grades 9-11' },
        {
          id: 'tangent-secant', title: 'Tangents and secants', summary: 'The power of a point: why d² = a·b.', minutes: 10,
          entry: { id: 'tangent-secant', title: 'Tangents and secants', unit: 'Angles and circles', level: 'Grade 10', objectives: ['A tangent is perpendicular to the radius at the point of contact.', 'Tangent-secant theorem: the square of the tangent length equals the product of the secant segments.', 'Use it to find unknown lengths.'] },
        },
      ],
    },
    {
      id: 'functions', title: { en: 'Functions in motion', zh: '动起来的函数' },
      lessons: [
        {
          id: 'graph-transformations', title: 'Transforming graphs', summary: 'Slide, stretch and flip y = f(x) with sliders.', minutes: 12,
          entry: { id: 'graph-transformations', title: 'Transforming graphs', unit: 'Functions in motion', level: 'Grade 10-11', objectives: ['f(x) + k shifts the graph up by k.', 'f(x - h) shifts it right by h (not left).', 'a·f(x) stretches it vertically; negative a reflects it.'] },
        },
        {
          id: 'rates-of-change', title: 'Slopes and rates of change', summary: 'From the slope of a secant to the slope of a tangent.', minutes: 12,
          entry: { id: 'rates-of-change', title: 'Slopes and rates of change', unit: 'Functions in motion', level: 'Grade 11-12', objectives: ['Average rate of change is the slope of a secant line.', 'As the second point approaches the first, secant slopes approach the tangent slope.', 'The derivative of x^2 at x is 2x.'] },
        },
      ],
    },
    {
      id: 'platform', title: { en: 'Platform demos', zh: '平台演示' }, hidden: true,
      lessons: [
        {
          id: textDemo.id, title: textDemo.title, lesson: textDemo, minutes: 10, level: { en: 'authors and reviewers', zh: '课程作者与审阅者' },
          summary: { en: 'Every kind of text page in one short lesson: reading, a derivation to reveal, a code walkthrough, a case with written answers.', zh: '一节短课里展示所有文字类页面：阅读、逐行推导、代码讲解，以及带简答题的案例。' },
        },
      ],
    },
  ],
};

const FT_UNITS = lazy_units(FT_MANIFEST, FT_LOADERS);
/** Fine-tuning large language models: parts A-F (units are added as each part is finished). */
export const FT_COURSE: Course = {
  id: 'llm-finetuning',
  // the course's decision map, growing node by node
  cover_motion: { visual: 'decision_map', params: { upto: 'F1', show_out_of_scope: false }, pack: () => import('@mathnim/visuals/ft/f') },
  category: { en: 'AI', zh: 'AI' },
  slug: 'llm-finetuning',
  title: { en: 'Fine-tuning large language models', zh: '大模型微调' },
  audience: { en: 'University students and practitioners who know neural networks', zh: '懂神经网络的大学生与工程师' },
  outcomes: [
    { en: 'Choose well between prompting, RAG, SFT, preference training and RL', zh: '在提示词、RAG、SFT、偏好训练和强化学习之间选对方案' },
    { en: 'Work out memory and cost, and use LoRA and QLoRA well', zh: '算清显存和成本，用好 LoRA 与 QLoRA' },
    { en: 'Follow the derivations of DPO and GRPO, and how they fail', zh: '看懂 DPO、GRPO 的推导，以及它们会怎样失败' },
  ],
  short: { en: 'Fine-tuning', zh: '微调' },
  prerequisites: {
    summary: {
      en: 'For university students and engineers who know neural networks: Python, how networks are trained (loss, gradient descent, backpropagation), and ideally the rough shape of a Transformer.',
      zh: '写给懂神经网络的大学生和工程师：会用 Python，知道神经网络怎么训练（损失、梯度下降、反向传播），最好了解 Transformer 的大致结构。',
    },
    links: [
      { title: { en: 'Dive into Deep Learning', zh: '动手学深度学习' }, url: { en: 'https://d2l.ai/', zh: 'https://zh.d2l.ai/' }, note: { en: 'a free textbook with code, chapters 1-11', zh: '免费教材，带代码，前 11 章' } },
      { title: '3Blue1Brown: Neural networks', url: 'https://www.3blue1brown.com/topics/neural-networks', note: { en: 'how a network learns, in pictures', zh: '用动画讲清网络怎么学习' } },
      { title: 'Karpathy: Neural Networks: Zero to Hero', url: 'https://karpathy.ai/zero-to-hero.html', note: { en: 'backpropagation and a small GPT, by hand', zh: '手写反向传播，从零写一个小 GPT' } },
      { title: 'The Illustrated Transformer', url: 'https://jalammar.github.io/illustrated-transformer/', note: { en: 'the Transformer, step by step', zh: '一步步图解 Transformer' } },
      { title: { en: 'PyTorch: Learn the basics', zh: 'PyTorch 入门教程' }, url: 'https://pytorch.org/tutorials/beginner/basics/intro.html', note: { en: 'tensors, autograd, a training loop', zh: '张量、自动求导、训练循环' } },
    ],
  },
  feature: '/courses/llm-finetuning/map.{lang}.webp',
  cover: '/courses/llm-finetuning/map.{lang}.webp',
  accent: '#7C3AED',
  featured: true,
  // a lab is suggested after the lesson whose interactions it reproduces (labs.md, "对应交互")
  labs: course_labs('llm-finetuning', FT_UNITS, { L1: 'A2', L2: 'C2', L3: 'D3', L4: 'E1', L5: 'E3' }),
  summary: { en: 'Prompting, RAG, SFT, LoRA, preference and RL', zh: '提示词、RAG、SFT、LoRA、偏好与强化学习' },
  suggestions: [
    { en: 'When should I fine-tune instead of using RAG?', zh: '什么时候该微调，而不是用 RAG？' },
    { en: 'Why does LoRA save so much memory?', zh: 'LoRA 为什么能省这么多显存？' },
    { en: 'How is DPO different from RLHF?', zh: 'DPO 和 RLHF 有什么区别？' },
    { en: 'What does GRPO compare each answer against?', zh: 'GRPO 拿每个回答跟什么比？' },
  ],
  // order and cards from the parts' unit.ts files (tools/course_manifest.ts); lessons load when opened
  units: FT_UNITS,
};

const MPC_UNITS = lazy_units(MPC_MANIFEST, MPC_LOADERS);
/** Model predictive control (docs/lessons/mpc/README.md): eight lessons on one running example, a cart on a track. */
export const MPC_COURSE: Course = {
  id: 'mpc',
  // plan, apply the first step, plan again: the cart docks at the wall
  cover_motion: { visual: 'mpc_receding_loop', params: { N: 20 }, pack: () => import('@mathnim/visuals/mpc'), rate: 1.6 },
  category: { en: 'AI', zh: 'AI' },
  slug: 'mpc',
  title: { en: 'Model Predictive Control', zh: '模型预测控制（MPC）' },
  summary: {
    en: 'Prediction, cost, constraints, QP, stability, nonlinear MPC',
    zh: '预测、代价、约束、二次规划、稳定性、非线性 MPC',
  },
  audience: { en: 'University students and engineers who know linear algebra and calculus', zh: '懂线性代数和微积分的大学生与工程师' },
  outcomes: [
    { en: 'Say what MPC does: predict the future with a model, solve an optimization, apply only the first step, and start again at the next instant', zh: '说清 MPC 在做什么：用模型预测未来、解一个优化问题、只执行第一步、下一刻重来' },
    { en: 'Write a constrained control problem as a quadratic program (QP) and solve it in code', zh: '把一个带约束的控制问题写成二次规划（QP），并用代码解出来' },
    { en: 'Judge when to use MPC rather than PID or LQR, and weigh stability, feasibility and real-time limits', zh: '判断什么时候该用 MPC 而不是 PID / LQR，懂稳定性、可行性和实时性的取舍' },
  ],
  short: { en: 'MPC', zh: 'MPC' },
  // (each link opened with curl on 2026-10-26: the playlist "Control Bootcamp", the two book pages with their free PDFs)
  prerequisites: {
    summary: {
      en: 'For university students and engineers: linear algebra (matrices, eigenvalues) and calculus are enough, some least squares helps, and no control theory is assumed.',
      zh: '写给大学生和工程师：会线性代数（矩阵、特征值）和微积分就够了，懂一点最小二乘更好，不需要控制理论基础。',
    },
    links: [
      { title: 'Steve Brunton: Control Bootcamp', url: 'https://www.youtube.com/playlist?list=PLMrJAkhIeNNR20Mz-VpzgfQs5zrYi085m', note: { en: 'videos: state space, LQR, the Kalman filter', zh: '视频课（英文）：状态空间、LQR、卡尔曼滤波' } },
      { title: { en: 'Boyd & Vandenberghe: Convex Optimization', zh: 'Boyd 与 Vandenberghe：《凸优化》' }, url: 'https://web.stanford.edu/~boyd/cvxbook/', note: { en: 'free PDF; chapter 4 covers quadratic programs', zh: '免费 PDF；第 4 章讲二次规划' } },
      { title: { en: 'Rawlings, Mayne & Diehl: Model Predictive Control', zh: 'Rawlings、Mayne 与 Diehl：《模型预测控制》' }, url: 'https://sites.engineering.ucsb.edu/~jbraw/mpc/', note: { en: 'the standard textbook, free PDF from the authors', zh: 'MPC 的标准教材，作者网站提供免费 PDF' } },
    ],
  },
  feature: '/courses/mpc/horizon.{lang}.webp',
  accent: '#0F766E',
  // no labs section for this course (the user's decision, 2026-10-26)
  suggestions: [
    { en: 'Why apply only the first step of the plan?', zh: '为什么只执行计划的第一步？' },
    { en: 'How is MPC different from LQR?', zh: 'MPC 和 LQR 有什么区别？' },
    { en: 'How do constraints turn into a quadratic program?', zh: '约束是怎么变成二次规划的？' },
  ],
  // order and cards from src/lessons/mpc/unit.ts (tools/course_manifest.ts); lessons load when opened
  units: MPC_UNITS,
  // planned in two batches (M1-M4, then M5-M8); both were ready together, so all eight are published
};

/** In this order on the home page (a first-time visitor's list starts at the featured course). */
export const COURSES: Course[] = [FT_COURSE, MPC_COURSE, MATH_COURSE];
/** The first course (kept for older callers). */
export const COURSE = MATH_COURSE;
/** The units and lessons a course page shows: hand-made lessons only (AI-generated syllabus entries and hidden units stay out for now). */
export function visible_units(c: Course): Unit[] {
  return c.units
    .filter((u) => !u.hidden)
    .map((u) => ({ ...u, lessons: u.lessons.filter((l) => !!(l.lesson || l.load) && (!c.published || c.published.includes(l.id))) }))
    .filter((u) => u.lessons.length);
}
export const visible_lessons = (c: Course): CourseLesson[] => visible_units(c).flatMap((u) => u.lessons);
/** A unit's title inside its course: without the course's name ("微调 A · 地图与 RAG" → "A · 地图与 RAG"). */
export function unit_title(c: Course, u: Unit, lang: Lang): string {
  const title = tr(u.title, lang), short = c.short && tr(c.short, lang);
  if (!short || !title.startsWith(short + ' ')) return title;
  return title.slice(short.length).replace(/^\s+(·\s+)?/, '') || title;
}
/**
 * A lesson's code from its id: fine-tuning "ft-c2-lora" → "C2", "ft-a2b" → "A2b";
 * MPC "mpc-m5-solvers" (or "mpc-m5") → "M5". Other lessons have none.
 */
export function lesson_code(id: string): string {
  const m = /^ft-([a-f])(\d+[a-z]?)\b/.exec(id) ?? /^mpc-(m)(\d+[a-z]?)\b/.exec(id);
  return m ? m[1].toUpperCase() + m[2] : '';
}
/** Every lesson of every course. */
export function all_lessons(): CourseLesson[] {
  return COURSES.flatMap((c) => c.units.flatMap((u) => u.lessons));
}
/** A course by id. */
export const find_course = (id: string): Course | undefined => COURSES.find((c) => c.id === id);
/** A course by its address (/<slug>). */
export const course_by_slug = (slug: string): Course | undefined => COURSES.find((c) => c.slug === slug);
/** The addresses of a course, a lesson and a lab (real paths; the history API routes them). */
export const course_path = (c: Course): string => `/${c.slug}`;
export const lesson_path = (id: string): string => {
  const c = course_of(id);
  return c ? `/${c.slug}/${encodeURIComponent(id)}` : '/';
};
export const lab_path = (c: Course, lab: string): string => `/${c.slug}/labs/${encodeURIComponent(lab)}`;
/** The course a lesson belongs to. */
export function course_of(lesson_id: string): Course | undefined {
  return COURSES.find((c) => c.units.some((u) => u.lessons.some((l) => l.id === lesson_id)));
}

const GEN = (id: string) => `mathnim.generated.${id}`;
export function cached_generation(id: string): GeneratedLesson | null {
  try {
    return JSON.parse(localStorage.getItem(GEN(id)) ?? 'null');
  } catch {
    return null;
  }
}
export function cache_generation(g: GeneratedLesson): void {
  localStorage.setItem(GEN(g.entry.id), JSON.stringify(g));
}
export function find_lesson(id: string): CourseLesson | undefined {
  return all_lessons().find((l) => l.id === id);
}
/** The playable lesson for a course entry (authored and loaded, or generated and cached); null for one not loaded yet. */
export function playable(cl: CourseLesson): Lesson | null {
  if (cl.lesson) return cl.lesson;
  if (cl.load) return null;
  const g = cached_generation(cl.id);
  return g ? lesson_from_generated(g) : null;
}
const loading = new Map<string, Promise<Lesson>>();
/** The lesson, loading its chunk first when it is loaded on demand (once; later calls share it). */
export async function ensure_lesson(cl: CourseLesson): Promise<Lesson | null> {
  if (cl.lesson || !cl.load) return playable(cl);
  let p = loading.get(cl.id);
  if (!p) {
    p = cl.load().then((l) => (cl.lesson = l));
    p.catch(() => loading.delete(cl.id)); // a failed download can be tried again
    loading.set(cl.id, p);
  }
  return p;
}
/** Load every lesson (the tools, which check them all). */
export async function load_all_lessons(): Promise<void> {
  await Promise.all(all_lessons().map(ensure_lesson));
}
/** What the course map needs about a lesson, loaded or not. */
export function lesson_info(cl: CourseLesson): { mode: 'essay' | 'game'; langs: Lang[]; has_scene: boolean; kinds: string[]; skills: Skill[] } | null {
  const l = cl.lesson;
  if (l) return { mode: l.mode ?? 'essay', langs: lesson_langs(l), has_scene: l.steps.some((s) => 'scene' in s && !!s.scene), kinds: [...new Set(l.steps.map((s) => s.kind))], skills: l.skills };
  return cl.meta ?? null;
}
export function all_skills(): Skill[] {
  const out: Skill[] = [];
  for (const l of all_lessons()) {
    const skills = l.lesson?.skills ?? l.meta?.skills ?? cached_generation(l.id)?.plan.skills;
    if (skills) out.push(...skills);
  }
  return out;
}
