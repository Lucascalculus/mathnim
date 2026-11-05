# Helpers shared by the MKTG90037 lesson files: the loop of docs/lessons/NEXT-LEARNING.md as steps, and the generic
# instrument kinds (public/frames/kit/kinds/: place, dial, connect, tag, choose) as frame blocks.
from lesson_kit import *  # noqa: F403,F401

KINDS = 'frames/kit/kinds/'

# the chapter titles of the loop, one per move
CH = {
    'puzzle': T('The puzzle', '先看一个难题'),
    'predict': T('Your guess', '先猜一猜'),
    'touch': T('Touch it', '动手摆弄'),
    'name': T('Name it', '给它命名'),
    'apply': T('Use it on a brand', '用在一个品牌上'),
    'neighbour': T('The look-alike', '那个长得像的'),
    'recall': T('Two from before', '回忆两个旧概念'),
    'exam': T('On the paper', '考卷上的写法'),
}


def place(alt, zones, chips, cols=None, prompt=None, done=None, caption=None, height=420, counted=True):
    return frame(KINDS + 'place.html', alt, caption, height, zones=zones, chips=chips, cols=cols or min(len(zones), 3), prompt=prompt, done=done, counted=counted)


def tag(alt, cats, items, prompt=None, done=None, caption=None, height=480):
    return frame(KINDS + 'tag.html', alt, caption, height, cats=cats, items=items, prompt=prompt, done=done)


def dial(alt, sliders, outs, plot=None, notes=None, consts=None, presets=None, prompt=None, caption=None, height=520):
    return frame(KINDS + 'dial.html', alt, caption, height, sliders=sliders, outs=outs, plot=plot, notes=notes or [], consts=consts or {}, presets=presets, prompt=prompt)


def connect(alt, left, right, pairs, prompt=None, done=None, reuse=False, no=None, caption=None, height=440):
    return frame(KINDS + 'connect.html', alt, caption, height, left=left, right=right, pairs=pairs, prompt=prompt, done=done, reuse=reuse, no=no)


def choose(alt, rounds, reveal, caption=None, height=440):
    return frame(KINDS + 'choose.html', alt, caption, height, rounds=rounds, reveal=reveal)


def predict(id, skill, prompt, options, explain):
    """The guess before the instrument: one choice, committed before anything is shown."""
    return choice(id, T('Commit before you look', '先下注再看'), skill, prompt, options, explain, purpose='predict', chapter=CH['predict'])


def recall(id, skill, prompt, options, explain, first=False):
    return choice(id, T('From an earlier lesson', '回忆旧知识'), skill, prompt, options, explain, purpose='check', chapter=CH['recall'] if first else None)


def apply_q(id, skill, prompt, key_points, model, explain, title=None):
    return text_q(id, title or T('Use it on a brand', '用在品牌上'), skill, prompt, key_points, model, explain, chapter=CH['apply'])


def exam_three(slug, skill, question, explain, apply_, recommend):
    """
    The exam-shaped ending: one question with its three parts, each marked on its own against the Week 11 rubric
    (precise, thorough, clear / specific, cause and effect, evidence / realistic, strategic, actionable, follows from
    the analysis). Each part is (prompt, key_points, model_answer). With a model key present the answer is marked
    against the key points; without one the learner marks it against them and the model answer (the lesson view's
    own fallback).
    """
    rubric_note = {
        'explain': T('Explain (5 marks). Exceeds: precise, thorough, clear, with the right terms. Meets: accurate, key points present, a little shallow.',
                     '解释（5 分）。优秀：精确、完整、清楚，用对术语。达标：准确、要点齐全，但深度略浅。'),
        'apply': T('Apply (10 marks). Exceeds: this company, rigorous cause and effect, evidence from the case. Meets: correct and logical, connections could go deeper.',
                   '应用（10 分）。优秀：针对这家公司，因果分析严密，有案例证据。达标：应用正确、逻辑通顺，但联系还可以更深。'),
        'rec': T('Recommend (5 marks). Exceeds: exactly two, realistic, strategic, actionable, each following from your analysis, with a risk named. Meets: sound but thin on how.',
                 '建议（5 分）。优秀：恰好两条，现实、有战略性、可执行，都从你的分析里推出来，并点出风险。达标：合理，但“怎么做”偏薄。'),
    }
    out = []
    for key, part, title, marks in (('explain', explain, T('Explain', '解释'), 5), ('apply', apply_, T('Apply', '应用'), 10), ('rec', recommend, T('Recommend', '建议'), 5)):
        prompt, kps, model = part
        full = T(question['en'] + '\n\n' + rubric_note[key]['en'] + '\n\n' + prompt['en'], question['zh'] + '\n\n' + rubric_note[key]['zh'] + '\n\n' + prompt['zh'])
        out.append(text_q(f'{slug}-{key}', T(f"{title['en']} ({marks} marks)", f"{title['zh']}（{marks} 分）"), skill, full, kps, model,
                          T('Compare with the key points and the model answer. A scoring answer says the thing, shows it on this company, and stops.', '对照要点和参考答案。拿分的答案：把概念说准，落到这家公司上，然后收住。'),
                          chapter=CH['exam'] if key == 'explain' else None))
    return out
